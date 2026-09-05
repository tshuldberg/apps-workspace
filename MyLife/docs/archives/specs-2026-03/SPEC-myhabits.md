# MyHabits - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** MyLife Product Team
> **Reviewer:** Principal Architect

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyHabits
- **Tagline:** "Build habits that stick"
- **Module ID:** `habits`
- **Feature ID Prefix:** HB
- **Table Prefix:** `hb_` (habits core), `cy_` (cycle tracking)
- **Accent Color:** #8B5CF6 (violet)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Alex, Self-Improvement Enthusiast | 25-40, reads r/getdisciplined, tried Habitica and Habitify, currently uses a notebook or notes app | Track 3-8 daily habits with minimal friction, see visual streaks, avoid gamification bloat and subscriptions |
| Sam, Recovery & Sobriety Tracker | 20-55, in recovery or quitting a substance, values extreme privacy, may attend support groups | Track days sober, log cravings with triggers, celebrate milestones, save money calculations, never expose data |
| Jordan, Fitness & Health Optimizer | 22-38, tracks workouts and nutrition, wants Apple Health integration, measures water intake and steps | Auto-complete habits from HealthKit, track numeric measurements, see completion heatmaps |
| Riley, Student & Productivity Seeker | 18-28, needs Pomodoro timers, study habit tracking, wants structured 30-day challenges | Focus timer with session tracking, structured programs, time tracking for projects |
| Morgan, Cycle-Aware Wellness Tracker | 18-45, tracks menstrual cycle alongside daily habits, wants fertility predictions | Log periods and symptoms, see fertility window estimates, correlate cycle phases with habit adherence |

### 1.3 Core Value Proposition

MyHabits is a privacy-first habit tracker that consolidates six paid apps into one: Streaks ($5), Habitify ($40/yr), Habitica ($48/yr), Forest ($4), I Am Sober ($40/yr), and Toggl ($108/user/yr). It combines flexible habit scheduling, streak tracking, heatmap visualization, sobriety clocks, focus timers, RPG gamification, and cycle tracking in a single offline-first app. All data stays on-device. No accounts, no cloud sync, no telemetry. Users own their data completely.

### 1.4 Competitive Landscape

| Competitor | Price | Strengths | Weaknesses | Our Differentiator |
|-----------|-------|-----------|------------|-------------------|
| Streaks | $5 once | Beautiful, simple, local-only | iOS only, 24-habit cap, no heatmap, no measurements | Cross-platform, unlimited habits, heatmap visualization, negative habit tracking |
| Habitify | $40/yr | Clean UI, Apple Health integration, widgets | Subscription for basic features, free tier capped at 3 habits, cloud-required | One-time purchase via MyLife Pro, unlimited habits, fully offline |
| Habitica | $48/yr | RPG gamification, social quests | Gamification overwhelms the habit, cloud-required, account required | Optional gamification layer that can be turned off, privacy-first, no account needed |
| Forest | $4 once | Beautiful focus timer with tree growth | Only does focus timing, no habit tracking, no measurements | Integrated focus timer within a full habit tracking suite |
| I Am Sober | $40/yr | Sobriety clock, milestone celebrations, community pledges | Cloud account required for recovery data, $40/yr subscription, community features expose status | Sobriety tracking with zero cloud exposure, no account, free with MyLife Pro |
| Toggl | $108/user/yr | Professional time tracking, invoicing, team features | Expensive, cloud-only, enterprise-focused, no habit tracking | Integrated time tracking for personal projects, fully offline, no per-user pricing |
| Productive | $24/yr | Smart reminders, habit templates | Subscription, feature bloat, cloud-synced | Privacy-first, simpler core with optional depth, no subscription |
| Finch | Freemium | Adorable pet companion, self-care focus | Cloud-required, limited habit types, monetized through pet items | Local-only pet/avatar companion, no monetization of companion items |
| Smoke Free | Freemium | Quit smoking focus, health recovery timeline | Narrow focus (smoking only), cloud-based | Multi-substance sobriety support, fully offline, broader habit tracking |
| Sorted3 | $15 once | Calendar + tasks unified view | iOS/Mac only, no Android, no habit streaks | Cross-platform, calendar integration alongside full habit tracking |
| Loop Habit Tracker | Free (OSS) | Fully local, open source, free | Android only, dated UI, development slowed | Cross-platform, modern UI, active development, integrated advanced features |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full CSV and JSON export and complete delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export

**Product-specific privacy notes:**

- **Sobriety and addiction recovery data** is among the most sensitive personal data categories. MyHabits ensures this data never leaves the device. No cloud account, no breach risk, no subpoena risk. Users tracking recovery should never have to trust a third party with that information.
- **Menstrual cycle data** remains local, which is increasingly important given legal scrutiny of period tracking apps. No cycle data is transmitted, synced, or backed up to any cloud service.
- **Habit names themselves can be sensitive** (e.g., "Take antidepressant," "AA meeting," "Therapy appointment"). The local-only architecture ensures these labels never leave the device.
- **Focus/productivity data** stays private. No employer, advertiser, or third party can observe work patterns.
- **Apple Health data** is read-only and processed on-device. HealthKit data is never stored in the habits database beyond a boolean completion flag.

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| HB-001 | Habit Creation & Management | P0 | Core | None | Implemented |
| HB-002 | Daily Check-In & Completion | P0 | Core | HB-001 | Implemented |
| HB-003 | Streak Tracking | P0 | Core | HB-002 | Implemented |
| HB-004 | Timed Sessions | P0 | Core | HB-001 | Implemented |
| HB-005 | Numeric Measurements | P0 | Core | HB-001 | Implemented |
| HB-006 | Heatmap Visualization | P0 | Analytics | HB-002 | Implemented |
| HB-007 | Habit Statistics | P0 | Analytics | HB-002 | Implemented |
| HB-008 | Habit Categories & Organization | P1 | Data Management | HB-001 | Implemented |
| HB-009 | Menstrual Cycle Tracking | P1 | Core | None | Implemented |
| HB-010 | Fertility Predictions | P1 | Analytics | HB-009 | Implemented |
| HB-011 | Data Export | P1 | Import/Export | HB-001 | Implemented |
| HB-012 | Negative Habit Tracking | P0 | Core | HB-001, HB-003 | Not Started |
| HB-013 | Sobriety Clock | P0 | Core | HB-012 | Not Started |
| HB-014 | Craving Log | P1 | Core | HB-012 | Not Started |
| HB-015 | Milestone Celebrations & Badges | P1 | Core | HB-003, HB-012 | Not Started |
| HB-016 | Daily Pledge System | P2 | Core | HB-012 | Not Started |
| HB-017 | RPG Gamification (XP & Levels) | P1 | Core | HB-002 | Not Started |
| HB-018 | Pet/Avatar Companion | P2 | Core | HB-017 | Not Started |
| HB-019 | Focus Timer (Pomodoro) | P1 | Core | HB-004 | Not Started |
| HB-020 | Apple Health Auto-Tracking | P1 | Core | HB-002 | Not Started |
| HB-021 | Location-Based Reminders | P2 | Settings | HB-001 | Not Started |
| HB-022 | Siri Shortcuts | P2 | Core | HB-002 | Not Started |
| HB-023 | Time Tracking with Billable Hours | P2 | Core | HB-004 | Not Started |
| HB-024 | Calendar & Tasks Unified View | P2 | Core | HB-001 | Not Started |
| HB-025 | Challenges & Programs | P1 | Core | HB-001, HB-002 | Not Started |
| HB-026 | Habit Sharing | P2 | Social | HB-001 | Not Started |
| HB-027 | Smart Reminders | P2 | Settings | HB-002, HB-007 | Not Started |
| HB-028 | Action Lists (Sub-Tasks) | P2 | Data Management | HB-001 | Not Started |
| HB-029 | Data Import | P1 | Import/Export | HB-001 | Not Started |
| HB-030 | Settings & Preferences | P0 | Settings | None | Implemented |

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

### HB-001: Habit Creation & Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-001 |
| **Feature Name** | Habit Creation & Management |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a habit tracker user, I want to create habits with a name, icon, color, frequency, and target, so that I have a personalized daily checklist.

**Secondary:**
> As a long-term user, I want to archive habits I no longer track without losing historical data, so that my active list stays clean while my history is preserved.

#### 3.3 Detailed Description

Habit Creation & Management is the foundational feature of MyHabits. Users create habits with a descriptive name, an emoji icon, an accent color, a frequency (daily, weekly, monthly, or specific days of the week), and a target count. Each habit has a type that determines its tracking behavior: standard (binary check-off), timed (start/stop session), negative (track avoidance), or measurable (log a numeric value).

Habits can be edited after creation to change any property. Habits can be archived to remove them from the active daily view without deleting any historical completion data. Archived habits can be unarchived to restore them to the active list. Habits can be permanently deleted with a confirmation dialog, which removes the habit and all associated completions, sessions, and measurements.

Users can reorder habits via drag-and-drop to control the order they appear on the Today screen. There is no artificial cap on the number of habits (unlike Streaks' 24-habit limit).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local SQLite database initialized and writable
- UUID generation for habit IDs

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized via module migration system

#### 3.5 User Interface Requirements

##### Screen: Add Habit

**Layout:**
- The screen is presented as a pushed screen from the Today tab or a modal sheet
- A top navigation bar shows "New Habit" as the title with a Cancel button on the left
- The form contains the following fields in vertical order:
  - Name: text input, placeholder "Habit name" (required)
  - Description: multi-line text input, placeholder "Optional description"
  - Icon: emoji picker showing recent emojis and a full grid, default checkmark
  - Color: horizontal row of 12 curated color circles, tap to select
  - Habit Type: segmented control with options: Standard, Timed, Negative, Measurable
  - Frequency: segmented control with options: Daily, Weekly, Monthly, Specific Days
  - If Specific Days: row of 7 day-of-week toggle buttons (M T W T F S S)
  - Target Count: numeric stepper (default 1), label "times per [frequency period]"
  - Unit: text input for measurable habits, placeholder "e.g., glasses, minutes, pages"
  - Time of Day: segmented control with options: Morning, Afternoon, Evening, Anytime
  - Grace Period: numeric stepper (0-7 days), label "days before streak breaks"
  - Reminder Time: time picker, optional
- A "Save Habit" button at the bottom, disabled until name is filled

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Form | Screen just opened | All fields at defaults, Save button disabled |
| Valid Form | Name has at least 1 character | Save button enabled |
| Saving | User tapped Save | Brief loading indicator, then dismiss screen |
| Error | Database write fails | Toast notification: "Could not save habit. Please try again." |

**Interactions:**
- Tap Save: validates fields, creates habit in database, dismisses screen, habit appears in Today list
- Tap Cancel: dismisses screen without saving (confirmation if form has been modified)
- Tap color circle: selects that color with a subtle scale animation
- Tap Habit Type segment: shows/hides type-specific fields (unit for measurable, no extra for standard)
- Tap frequency segment: shows/hides frequency-specific fields (day toggles for specific days)

##### Screen: Edit Habit

**Layout:**
- Identical to Add Habit but pre-populated with existing habit data
- Title reads "Edit Habit"
- Save button reads "Save Changes"
- Additional buttons at the bottom: Archive (or Unarchive if already archived), Delete
- Delete button is styled in red/destructive color

**Interactions:**
- Tap Save Changes: updates habit in database, dismisses screen
- Tap Archive: sets `isArchived = true`, removes habit from Today view, preserves all data
- Tap Unarchive: sets `isArchived = false`, restores habit to Today view
- Tap Delete: shows confirmation dialog "Delete [habit name]? This will permanently remove all completion history. This cannot be undone." with Cancel and Delete buttons

#### 3.6 Data Requirements

##### Entity: Habit

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, max 255 chars, non-empty after trim | None | Display name of the habit |
| description | string or null | Max 1000 chars | null | Optional longer description |
| icon | string or null | Valid emoji or null | null | Emoji icon for display |
| color | string or null | Valid hex color string | null | Accent color for heatmap and UI |
| frequency | enum | One of: daily, weekly, monthly, specific_days | 'daily' | How often the habit is tracked |
| targetCount | integer | Min: 1, Max: 100 | 1 | Number of completions required per period |
| unit | string or null | Max 50 chars | null | Unit label for measurable habits |
| habitType | enum | One of: standard, timed, negative, measurable | 'standard' | Determines tracking behavior |
| timeOfDay | enum | One of: morning, afternoon, evening, anytime | 'anytime' | Preferred time for sorting |
| specificDays | array of enum or null | Array of: mon, tue, wed, thu, fri, sat, sun | null | Which days of the week (for specific_days frequency) |
| gracePeriod | integer | Min: 0, Max: 7 | 0 | Days allowed to miss before streak breaks |
| reminderTime | string or null | HH:MM format | null | Local notification time |
| isArchived | boolean | - | false | Whether habit is hidden from active view |
| sortOrder | integer | Min: 0 | 0 | Position in the habit list |
| createdAt | datetime | ISO 8601, auto-set on creation | Current timestamp | Record creation time |
| updatedAt | datetime | ISO 8601, auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Habit has many Completions (one-to-many via habitId)
- Habit has many TimedSessions (one-to-many via habitId)
- Habit has many Measurements (one-to-many via habitId)

**Indexes:**
- `is_archived` - filter active vs archived habits
- `sort_order, name` - sorted listing on Today screen

**Validation Rules:**
- `name`: must not be empty string after trimming whitespace
- `specificDays`: must contain at least 1 day when frequency is 'specific_days'
- `targetCount`: must be at least 1
- `gracePeriod`: must be between 0 and 7 inclusive
- `unit`: required when habitType is 'measurable'

**Example Data:**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "Read 30 minutes",
  "description": "Read at least 30 minutes of a book before bed",
  "icon": "📚",
  "color": "#F5A623",
  "frequency": "daily",
  "targetCount": 1,
  "unit": null,
  "habitType": "standard",
  "timeOfDay": "evening",
  "specificDays": null,
  "gracePeriod": 1,
  "reminderTime": "21:00",
  "isArchived": false,
  "sortOrder": 0,
  "createdAt": "2026-01-15T10:30:00Z",
  "updatedAt": "2026-01-15T10:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Habit Archival

**Purpose:** Remove a habit from the active daily view without losing historical data.

**Inputs:**
- habitId: string - the habit to archive

**Logic:**

```
1. Set habit.isArchived = true
2. Set habit.updatedAt = now
3. Habit no longer appears in the Today view
4. Habit data (completions, sessions, measurements) is preserved
5. Streak is frozen at the time of archival
6. Habit can be viewed in Settings > Archived Habits
7. Habit can be unarchived to restore it to the Today view
```

**Edge Cases:**
- Archiving a habit mid-streak: streak value is preserved but stops incrementing
- Unarchiving a habit: streak restarts from 0 (the gap during archival breaks continuity)

##### Habit Deletion

**Purpose:** Permanently remove a habit and all associated data.

**Inputs:**
- habitId: string - the habit to delete

**Logic:**

```
1. Show confirmation dialog with habit name
2. IF user confirms THEN
     Delete all completions where habitId matches (CASCADE)
     Delete all timed sessions where habitId matches (CASCADE)
     Delete all measurements where habitId matches (CASCADE)
     Delete the habit record
3. ELSE
     Do nothing
```

**Edge Cases:**
- Deleting a habit with thousands of completions: deletion is wrapped in a transaction
- Deleting the last habit: app shows empty state on Today view

**Sort/Filter/Ranking Logic:**
- **Default sort:** `sort_order ASC, name ASC`
- **Available sort options:** Manual (drag-and-drop order), Name A-Z, Name Z-A, Most completions, Newest first, Oldest first
- **Filter options:** Active only (default), Archived only, All, By habit type, By frequency
- **Search:** Name field is searchable with substring matching (case-insensitive)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on create | Toast notification: "Could not save habit. Please try again." | User taps Save again; data is not lost from the form |
| Name field is empty on save | Inline validation message below name field: "Habit name is required" | User fills in name, error clears on input |
| Duplicate habit name | Allowed (no uniqueness constraint on name) | N/A |
| Database write fails on delete | Toast notification: "Could not delete habit. Please try again." | User retries deletion |

**Validation Timing:**
- Field-level validation runs on blur (when the user leaves the field)
- Form-level validation runs on save button tap
- Name validation runs on every keystroke (to enable/disable Save button)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Today screen with no habits,
   **When** they tap the "+" button and fill in "Meditate" as the name, select a purple color, set frequency to Daily, and tap Save,
   **Then** the habit "Meditate" appears in the Today list with the purple accent color.

2. **Given** a habit "Meditate" exists,
   **When** the user opens the edit screen and changes the name to "Morning Meditation" and taps Save Changes,
   **Then** the habit displays as "Morning Meditation" everywhere in the app.

3. **Given** a habit "Meditate" with 30 completions exists,
   **When** the user archives the habit,
   **Then** it disappears from the Today view but remains visible in Settings > Archived Habits with all completion data intact.

**Edge Cases:**

4. **Given** a habit with the maximum name length (255 characters),
   **When** displayed on the Today screen,
   **Then** the name is truncated with an ellipsis and the full name is visible on the detail screen.

5. **Given** 50 habits exist,
   **When** the user reorders via drag-and-drop,
   **Then** the new order persists across app restarts.

**Negative Tests:**

6. **Given** the Add Habit screen is open,
   **When** the user taps Save without entering a name,
   **Then** the system shows inline validation "Habit name is required"
   **And** no habit is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates habit with valid input | name: "Read", frequency: "daily" | Habit record in database with id, createdAt set |
| rejects empty name | name: "   " (whitespace) | Validation error: "Habit name is required" |
| sets default values correctly | name: "Test" (no other fields) | frequency: "daily", targetCount: 1, habitType: "standard", gracePeriod: 0 |
| archives habit preserving data | habitId with 10 completions | isArchived: true, completions still queryable |
| deletes habit cascading data | habitId with 10 completions | Habit and all 10 completions removed |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and verify in list | 1. Create habit "Run", 2. Navigate to Today | "Run" appears in the Today list |
| Archive and verify hidden | 1. Archive "Run", 2. Check Today list, 3. Check archived list | Not in Today, visible in Archived |
| Delete and verify removed | 1. Delete "Run", 2. Check all lists | Not found anywhere, completions gone |

---

### HB-002: Daily Check-In & Completion

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-002 |
| **Feature Name** | Daily Check-In & Completion |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a habit tracker user, I want to tap a checkbox next to each habit to mark it done for today, so that my daily check-in takes less than 10 seconds.

**Secondary:**
> As a user who made a mistake, I want to un-complete a habit by tapping the checkbox again, so that my data stays accurate.

#### 3.3 Detailed Description

The Daily Check-In is the primary interaction surface of MyHabits. The Today screen shows all active, non-archived habits filtered to those scheduled for the current day (respecting frequency and specificDays settings). Each habit appears as a row with its emoji icon, name, current streak count, and a circular checkbox.

Tapping the checkbox marks the habit complete for today. The checkbox fills with the habit's accent color, haptic feedback fires (medium impact), and the streak counter increments with a roll-up animation. Tapping a completed checkbox un-completes the habit (toggle behavior). No confirmation is needed for either direction.

Completions are stored with a timestamp and optional value and notes fields. For standard habits, the value is null. For negative habits, a completion indicates a "slip" and is recorded with value = -1.

The entire daily check-in for a user with 5 habits should take less than 10 seconds: one tap per habit, no modals, no extra screens.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management - habits must exist to complete them

**External Dependencies:**
- Haptic feedback hardware (optional, degrades gracefully)
- System clock for completion timestamp

**Assumed Capabilities:**
- Active habits are loaded from the database on screen mount
- Today's date is determined from the device clock

#### 3.5 User Interface Requirements

##### Screen: Today

**Layout:**
- Top navigation bar showing "Today" and the current date (e.g., "Thursday, March 6")
- A "+" button on the right side of the navigation bar to add a new habit
- Below the navigation bar: a daily completion summary ring showing "X/Y today" (e.g., "4/6 today")
- The main content area is a scrollable vertical list of today's habits
- Each habit row displays:
  - Left: emoji icon (or colored circle fallback)
  - Center: habit name (primary text) and streak count with flame icon (secondary text, e.g., "14 days")
  - Right: circular checkbox. Empty circle when incomplete, filled circle with checkmark when complete
- Habits are sorted by sortOrder, then by name alphabetically
- Habits not scheduled for today (e.g., a Mon/Wed/Fri habit on Tuesday) do not appear
- Below the habit list: overall completion percentage for the day

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No active habits exist | Illustration with message "No habits yet" and a "Create your first habit" button |
| All Incomplete | Habits exist, none completed today | All checkboxes empty, summary shows "0/Y today" |
| Partially Complete | Some habits completed | Completed habits show filled checkboxes, summary updates |
| All Complete | Every habit completed today | All checkboxes filled, summary shows "Y/Y today" with a celebration animation |
| Loading | Database query in progress | Skeleton loading rows |

**Interactions:**
- Tap checkbox (incomplete): records completion, fills checkbox with color animation (200ms), haptic fires, streak increments
- Tap checkbox (complete): removes completion, empties checkbox, streak decrements
- Tap habit name/row (not checkbox): navigates to Habit Detail screen
- Long press habit row: shows context menu with Edit, Archive, Delete options
- Pull-to-refresh: reloads habit list and completion status from database
- Swipe left on habit row: reveals Archive and Delete action buttons

**Transitions/Animations:**
- Checkbox fill: circle wipe from center outward, 200ms spring curve, fills with habit's accent color
- Checkbox unfill: reverse circle wipe, 150ms ease-out
- Streak counter: digit rolls up by 1 on completion, rolls down by 1 on un-completion, 300ms
- Completion summary ring: animates fill percentage change, 400ms ease-in-out
- All-complete celebration: confetti particle effect for 1.5 seconds when last habit is checked

#### 3.6 Data Requirements

##### Entity: Completion

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| habitId | string | Foreign key to Habit.id, required | None | Which habit this completion belongs to |
| completedAt | datetime | ISO 8601, required | None | When the completion was recorded |
| value | number or null | - | null | Optional numeric value (null for standard, -1 for negative habit slip) |
| notes | string or null | Max 500 chars | null | Optional note about this completion |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- Completion belongs to Habit (many-to-one via habitId)

**Indexes:**
- `habit_id` - fast lookup of completions for a specific habit
- `completed_at` - date-range queries for heatmap and statistics

**Validation Rules:**
- `habitId`: must reference an existing habit
- `completedAt`: must be a valid ISO 8601 datetime string
- `value`: when habitType is 'negative' and recording a slip, value must be -1

**Example Data:**

```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "habitId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "completedAt": "2026-03-06T08:15:00Z",
  "value": null,
  "notes": null,
  "createdAt": "2026-03-06T08:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Completion Toggle

**Purpose:** Toggle a habit's completion status for a given day.

**Inputs:**
- habitId: string - the habit to toggle
- date: string - the date (YYYY-MM-DD) to toggle

**Logic:**

```
1. Query completions for this habitId on this date
2. IF no completion exists for this date THEN
     Create a new Completion record with completedAt = now
     Trigger haptic feedback (medium impact)
     Recalculate streak for this habit
3. ELSE
     Delete the existing Completion record
     Trigger haptic feedback (light impact)
     Recalculate streak for this habit
```

**Edge Cases:**
- Multiple completions on the same day for targetCount > 1: each tap adds one completion until targetCount is reached, then toggles off the most recent
- Completing a habit for a past date (via calendar view): allowed, streak is recalculated
- Completing a habit for a future date: not allowed, button is disabled

##### Today Filter Logic

**Purpose:** Determine which habits appear on the Today screen.

**Inputs:**
- today: Date - current date
- habits: Habit[] - all non-archived habits

**Logic:**

```
1. FOR each habit in habits WHERE isArchived = false
2.   IF habit.frequency = 'daily' THEN include
3.   ELSE IF habit.frequency = 'weekly' THEN include (trackable any day of the week)
4.   ELSE IF habit.frequency = 'monthly' THEN include (trackable any day of the month)
5.   ELSE IF habit.frequency = 'specific_days' THEN
        Get today's day of week (mon, tue, ..., sun)
        IF today's day is in habit.specificDays THEN include
        ELSE exclude
6. RETURN included habits sorted by sortOrder ASC, name ASC
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on completion | Toast: "Could not save completion. Please try again." | Checkbox reverts to previous state |
| Database write fails on un-completion | Toast: "Could not undo completion. Please try again." | Checkbox stays in completed state |
| Clock is set to future date | Habits for future dates are not completable | Inform user if detected |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a daily habit "Meditate" exists and has not been completed today,
   **When** the user taps its checkbox,
   **Then** the checkbox fills with the habit's color, haptic feedback fires, and the streak counter increments by 1.

2. **Given** "Meditate" was just completed,
   **When** the user taps the checkbox again,
   **Then** the checkbox empties and the streak counter decrements by 1.

3. **Given** 5 active habits exist and none are completed today,
   **When** the user taps all 5 checkboxes,
   **Then** the completion summary shows "5/5 today" and a celebration animation plays.

**Edge Cases:**

4. **Given** a Mon/Wed/Fri habit exists and today is Tuesday,
   **When** the user views the Today screen,
   **Then** the Mon/Wed/Fri habit does not appear in the list.

5. **Given** a habit with targetCount = 3,
   **When** the user taps the checkbox 3 times,
   **Then** the progress shows "3/3" and the habit is considered complete for the day.

**Negative Tests:**

6. **Given** no habits have been created,
   **When** the user opens the Today screen,
   **Then** the empty state illustration and "Create your first habit" button are shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| records completion for habit | habitId, today's date | Completion record created with correct habitId and date |
| removes completion on toggle | habitId with existing completion | Completion record deleted |
| filters daily habits correctly | 3 daily habits, today | All 3 returned |
| filters specific_days correctly | MWF habit, Tuesday | Habit excluded from result |
| filters specific_days correctly | MWF habit, Wednesday | Habit included in result |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete and verify streak | 1. Complete habit, 2. Check streak | Streak incremented by 1 |
| Complete and verify heatmap | 1. Complete habit, 2. Open heatmap | Today's cell shows 1 completion |

---

### HB-003: Streak Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-003 |
| **Feature Name** | Streak Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a habit tracker user, I want to see how many consecutive days I have completed a habit, so that I am motivated to maintain my streak.

**Secondary:**
> As a user with an occasional off day, I want to configure a grace period so that missing one day does not break a long streak.

#### 3.3 Detailed Description

Streak tracking is the core motivation engine of MyHabits. For each habit, the system computes two values: the current streak (consecutive days/periods the habit has been completed, counting from today backwards) and the longest streak (the all-time best consecutive run).

The streak engine supports three modes based on habit type:

1. **Standard habits:** A streak is the number of consecutive days with at least one completion. Missing a day breaks the streak (unless within the grace period).
2. **Negative habits:** The "streak" is the number of days since the last slip (completion with value = -1). No slips ever recorded means the streak equals days since habit creation.
3. **Measurable habits:** A day counts as "completed" only if the measurement value meets or exceeds the target.

The optional grace period allows users to miss up to N days without breaking their streak. A grace period of 1 means the user can miss one day and the streak continues. This is particularly important for habits tracked on weekdays only or for users who may be ill for a day.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-002: Daily Check-In & Completion - completions must exist to calculate streaks

**External Dependencies:**
- System clock for determining "today"

#### 3.5 User Interface Requirements

##### Component: Streak Display (inline on Today screen)

**Layout:**
- Flame emoji icon followed by the current streak number (e.g., "14")
- Displayed in the right portion of each habit row on the Today screen
- Font size is secondary to the habit name
- If streak is 0, display "0" (no flame icon)

##### Component: Streak Detail (on Habit Detail screen)

**Layout:**
- Card showing:
  - Current streak: large number with "days" label and flame icon
  - Best streak: secondary number with "days" label and trophy icon
  - Grace period indicator: if grace period > 0, show "1 day grace period" in muted text
  - For negative habits: shows "X days clean" instead of "X day streak"

#### 3.6 Data Requirements

Streak data is computed on-the-fly from completions. No dedicated streak table is used for the primary display (the streak_cache from the design doc is an optional optimization). The StreakInfo and NegativeStreakInfo interfaces define the return types.

##### Type: StreakInfo

| Field | Type | Description |
|-------|------|-------------|
| currentStreak | integer | Consecutive days/periods completed from today backwards |
| longestStreak | integer | All-time best consecutive run |

##### Type: NegativeStreakInfo

| Field | Type | Description |
|-------|------|-------------|
| daysSinceLastSlip | integer | Days since the most recent slip (value = -1 completion) |
| longestCleanStreak | integer | Longest gap between slips (or since habit creation) |

#### 3.7 Business Logic Rules

##### Standard Streak Calculation with Grace Period

**Purpose:** Compute current and longest streak for standard and timed habits, allowing optional missed days.

**Inputs:**
- habitId: string - the habit
- gracePeriod: integer (0-7) - allowed missed days before streak breaks

**Logic:**

```
1. Query DISTINCT dates of completions for this habit, ordered DESC
2. IF no completions exist THEN RETURN { currentStreak: 0, longestStreak: 0 }
3. Compute daysSinceLast = days between most recent completion date and today
4. IF daysSinceLast > (gracePeriod + 1) THEN currentStreak = 0, streak is broken
5. ELSE currentStreak = 1 (most recent day counts)
6. Walk backwards through sorted dates:
   a. Compute gap = days between consecutive completion dates
   b. IF gap <= (1 + gracePeriod) THEN streak continues (increment)
   c. ELSE streak breaks, record if longest, reset to 1
7. After full walk, compare final streak to longestStreak
8. RETURN { currentStreak, longestStreak }
```

**Edge Cases:**
- Today not yet completed: if yesterday was completed and grace period >= 0, current streak includes yesterday's value
- Grace period of 0: only consecutive days count (no missed days allowed)
- Grace period of 1: one missed day is tolerated (e.g., completed Mon, missed Tue, completed Wed = streak continues)
- Habit created today with no completions: currentStreak = 0, longestStreak = 0
- All completions on the same date: currentStreak = 1, longestStreak = 1

##### Negative Streak Calculation

**Purpose:** Compute days since last slip and longest clean streak for negative habits.

**Inputs:**
- habitId: string - the negative habit

**Logic:**

```
1. Query DISTINCT dates of slip completions (value = -1), ordered DESC
2. IF no slips exist THEN
     Query habit creation date
     daysSinceLastSlip = days from creation to today
     longestCleanStreak = daysSinceLastSlip
     RETURN
3. daysSinceLastSlip = days from most recent slip to today
4. longestCleanStreak = daysSinceLastSlip (current clean run)
5. Walk through consecutive slips:
   a. gap = days between consecutive slips - 1 (exclusive)
   b. IF gap > longestCleanStreak THEN longestCleanStreak = gap
6. Also check gap from habit creation to first-ever slip
7. RETURN { daysSinceLastSlip, longestCleanStreak }
```

**Edge Cases:**
- Slip recorded today: daysSinceLastSlip = 0
- Multiple slips on the same day: counted as one slip day
- Habit created today, no slips: daysSinceLastSlip = 0, longestCleanStreak = 0

##### Measurable Streak Calculation

**Purpose:** Compute streaks for measurable habits where a day counts only if the measured value meets or exceeds the target.

**Inputs:**
- habitId: string - the measurable habit
- gracePeriod: integer (0-7)

**Logic:**

```
1. Query DISTINCT dates where measurement value >= target, ordered DESC
2. Apply the same streak calculation algorithm as Standard Streak
3. RETURN { currentStreak, longestStreak }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Streak computation fails | Display "---" instead of streak number | Retry on next completion or screen reload |
| No completions exist | Display "0" with no flame icon | N/A, expected state for new habits |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a daily habit completed for 7 consecutive days including today,
   **When** the user views the Today screen,
   **Then** the streak shows "7" with a flame icon.

2. **Given** a daily habit with grace period of 1, completed Mon, missed Tue, completed Wed (today),
   **When** the user views the streak,
   **Then** the current streak is 3 (Mon + Tue grace + Wed).

3. **Given** a negative habit with the last slip 30 days ago,
   **When** the user views the streak,
   **Then** it shows "30 days clean."

**Edge Cases:**

4. **Given** a habit with grace period 0, completed yesterday but not today,
   **When** viewed before completing today,
   **Then** current streak shows the streak through yesterday (not broken until end of today).

5. **Given** a measurable habit "Drink water" with target 8, and today's measurement is 5,
   **When** the user views the streak,
   **Then** today does not count toward the streak (5 < 8).

**Negative Tests:**

6. **Given** a daily habit completed Mon, missed Tue and Wed, completed Thu (today), grace period 0,
   **When** the streak is computed,
   **Then** current streak is 1 (only today counts, 2-day gap exceeded grace period of 0).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| consecutive days streak | 7 consecutive dates ending today | currentStreak: 7, longestStreak: 7 |
| broken streak resets | 5 days, 2-day gap, 3 days | currentStreak: 3, longestStreak: 5 |
| grace period bridges 1-day gap | 3 dates with 1-day gaps, grace: 1 | streak continues across gaps |
| negative habit no slips | habit created 30 days ago | daysSinceLastSlip: 30 |
| negative habit with slip | slip 10 days ago | daysSinceLastSlip: 10 |
| measurable below target | value: 5, target: 8 | day does not count for streak |
| measurable meets target | value: 8, target: 8 | day counts for streak |

---

### HB-004: Timed Sessions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-004 |
| **Feature Name** | Timed Sessions |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user tracking meditation or exercise, I want to start a timer when I begin my habit and stop it when I finish, so that I can track the duration of each session.

#### 3.3 Detailed Description

Timed Sessions allow users to track duration-based habits. When a habit has `habitType: 'timed'`, the Today screen shows a play button instead of a checkbox. Tapping play starts a session timer that counts up from 0. The user sees an elapsed time display (MM:SS). Tapping stop ends the session and records the duration. Sessions have an optional target duration (e.g., "30 minutes of meditation") and are marked as completed if the duration meets or exceeds the target.

Sessions are stored as individual records with start time, duration, target, and completion status. Multiple sessions can be recorded per day for the same habit.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management - habit must have type 'timed'

**External Dependencies:**
- System clock for timing
- Background execution capability for timer (app may be backgrounded during a session)

#### 3.5 User Interface Requirements

##### Screen: Active Timer

**Layout:**
- Full-screen or half-sheet overlay
- Large elapsed time display in center (MM:SS or HH:MM:SS format)
- Target time displayed below in muted text (e.g., "Target: 30:00")
- Progress ring around the timer that fills as time approaches target
- Pause button (center) and Stop button (bottom)
- Habit name and icon displayed at the top

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Timer not started | Play button, "0:00" display |
| Running | Timer active | Counting up, progress ring filling, Pause and Stop visible |
| Paused | Timer paused | Elapsed time frozen, Resume and Stop visible |
| Completed | Duration >= target | Timer can continue running, checkmark overlay on progress ring |
| Stopped | User tapped Stop | Session saved, return to Today screen |

**Interactions:**
- Tap Play: starts the timer
- Tap Pause: pauses the timer (elapsed time freezes)
- Tap Resume: continues the timer from paused time
- Tap Stop: ends session, records duration, navigates back

#### 3.6 Data Requirements

##### Entity: TimedSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| habitId | string | Foreign key to Habit.id, required | None | Which habit this session belongs to |
| startedAt | datetime | ISO 8601 | Current timestamp | When the session started |
| durationSeconds | integer | Min: 0 | 0 | Total elapsed seconds |
| targetSeconds | integer | Min: 0 | 0 | Target duration in seconds |
| completed | boolean | - | false | Whether duration met or exceeded target |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- TimedSession belongs to Habit (many-to-one via habitId)

**Indexes:**
- `habit_id` - lookup sessions for a habit
- `started_at` - date-range queries

#### 3.7 Business Logic Rules

##### Session Recording

**Purpose:** Record a completed timed session and optionally auto-complete the habit.

**Logic:**

```
1. On Stop: compute durationSeconds = now - startedAt (minus any paused time)
2. Set completed = (durationSeconds >= targetSeconds)
3. INSERT session record
4. IF completed THEN
     Also record a Completion for this habit on today's date
     Recalculate streak
```

**Edge Cases:**
- App is killed during an active session: session is lost (no background persistence in MVP). Consider saving session state to AsyncStorage for recovery in a future version.
- Session duration of 0 seconds: session is still saved but marked as not completed
- Multiple sessions in one day: all are recorded, habit is completed if any session meets the target

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Timer fails to start | Toast: "Could not start timer" | User taps Play again |
| App backgrounded during session | Timer continues in background (if OS allows), or picks up on foreground | Display elapsed time from startedAt on return |
| Session save fails | Toast: "Could not save session. Please try again." | Retry save with same data |

#### 3.9 Acceptance Criteria

1. **Given** a timed habit "Meditate" with target 600 seconds (10 minutes),
   **When** the user starts a session and stops after 12 minutes,
   **Then** the session is saved with durationSeconds = 720 and completed = true, and the habit is marked complete for today.

2. **Given** a timed habit session is paused at 5 minutes,
   **When** the user resumes and stops at 8 minutes total,
   **Then** the session records 480 seconds (pause time excluded).

3. **Given** a timed habit with target 600 seconds,
   **When** the user stops at 300 seconds,
   **Then** the session is saved with completed = false and the habit is NOT auto-completed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| starts session correctly | habitId, targetSeconds: 600 | Session record with startedAt = now, durationSeconds = 0 |
| ends session with duration | sessionId, durationSeconds: 720 | Updated record with completed = true |
| session below target not completed | durationSeconds: 300, target: 600 | completed = false |

---

### HB-005: Numeric Measurements

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-005 |
| **Feature Name** | Numeric Measurements |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user tracking water intake, I want to log a numeric value like "8 glasses" each day, so that I can track measurable habits beyond binary completion.

#### 3.3 Detailed Description

Numeric Measurements allow users to log a specific value for measurable habits (habitType: 'measurable'). Instead of a binary checkbox, measurable habits show a number input on the Today screen. The user enters a value (e.g., 8 for "8 glasses of water"), and the system compares it to the habit's target to determine completion.

Measurements are stored as individual records with the measured value and target. The habit is considered complete for the day if the cumulative measurement value meets or exceeds the target. Multiple measurements can be logged per day (e.g., logging water intake at multiple points during the day).

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management - habit must have type 'measurable' with a unit defined

#### 3.5 User Interface Requirements

##### Component: Measurement Input (on Today screen)

**Layout:**
- Instead of a checkbox, measurable habits show:
  - Current value / target (e.g., "5/8 glasses") in a progress-style display
  - A "+" button to increment by 1
  - Tap the value to open a numeric input for direct entry
- Progress bar fills proportionally (5/8 = 62.5% filled)
- When value >= target, the progress bar shows full and a checkmark appears

**Interactions:**
- Tap "+": increments measurement by 1, records/updates measurement
- Tap value display: opens numeric input modal for exact value entry
- Long press "+": opens numeric input modal to add a custom increment

#### 3.6 Data Requirements

##### Entity: Measurement

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| habitId | string | Foreign key to Habit.id, required | None | Which habit this measurement belongs to |
| measuredAt | datetime | ISO 8601, required | None | When the measurement was recorded |
| value | number | Required | None | The measured value |
| target | number | Required, > 0 | None | The target value to reach |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- Measurement belongs to Habit (many-to-one via habitId)

**Indexes:**
- `habit_id` - lookup measurements for a habit
- `measured_at` - date-range queries

#### 3.7 Business Logic Rules

##### Measurement Completion Check

**Purpose:** Determine if a measurable habit is complete for the day.

**Logic:**

```
1. Query all measurements for habitId on today's date
2. Sum the values
3. IF sum >= target THEN habit is complete for today
4. ELSE habit is incomplete
```

**Edge Cases:**
- Negative measurement values: not allowed (validation rejects values < 0)
- Target of 0: always considered complete (edge case, should not happen due to validation)
- Very large values: no upper bound enforced, displayed as-is

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid number entered | Inline validation: "Please enter a valid number" | User corrects input |
| Database save fails | Toast: "Could not save measurement. Please try again." | User retries |

#### 3.9 Acceptance Criteria

1. **Given** a measurable habit "Drink water" with target 8 and unit "glasses",
   **When** the user taps "+" 8 times,
   **Then** the display shows "8/8 glasses" and the habit is marked complete.

2. **Given** "Drink water" has 5 glasses logged today,
   **When** the user taps the value and enters 3 directly,
   **Then** the display shows "8/8 glasses" (5 + 3).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| records measurement | habitId, value: 3, target: 8 | Measurement record created |
| sums daily measurements | two measurements (3, 5) for same day | Total: 8, meets target of 8 |
| below target not complete | measurement value: 5, target: 8 | Habit incomplete |

---

### HB-006: Heatmap Visualization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-006 |
| **Feature Name** | Heatmap Visualization |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a habit tracker user, I want to see a GitHub-style contribution heatmap showing my habit completion over time, so that I can visualize consistency and identify patterns.

#### 3.3 Detailed Description

The heatmap is the signature visual feature of MyHabits, inspired by the GitHub contribution graph and the r/theXeffect "don't break the chain" method. It renders a grid of colored squares, one per day, spanning 12 months. Each cell is colored by the number of completions for that day, ranging from empty (dark gray) to fully colored (the habit's accent color).

Two types of heatmaps are available:

1. **Per-habit heatmap:** Shows completion data for a single habit on its detail screen. Binary coloring: completed = habit's accent color, not completed = dark gray.
2. **Global heatmap:** Shows aggregate completion percentage across all habits. Cells are colored on a gradient from dark gray (0%) through light accent (1-33%) to medium (34-66%) to full accent (67-100%).

The heatmap data is computed by querying completion counts grouped by date, then filling in every day in the range with the count (0 for days with no completions).

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-002: Daily Check-In & Completion - completions provide the data

#### 3.5 User Interface Requirements

##### Screen: Heatmap Tab

**Layout:**
- Top section: Global heatmap (all habits aggregated)
  - 52 columns (weeks) x 7 rows (days of week)
  - Most recent week on the right
  - Day-of-week labels on the left (Mon, Wed, Fri)
  - Month labels along the top
- Below: scrollable list of per-habit heatmap cards
  - Each card: habit name, emoji icon, current/best streak, and a 12-month heatmap in the habit's color
- Heatmap cells are rounded squares with 2px gaps

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No completions exist | All cells are dark gray with message "Complete your first habit to see your heatmap" |
| Populated | Completions exist | Cells colored by completion percentage/status |
| Loading | Data is being computed | Skeleton heatmap grid with pulsing animation |

**Interactions:**
- Tap any cell: shows tooltip with the date and completion details (e.g., "March 6, 2026 - 4/6 habits completed")
- Horizontal scroll on global heatmap: view earlier months
- Tap a per-habit heatmap card: navigates to Habit Detail screen

#### 3.6 Data Requirements

##### Type: HeatmapDay

| Field | Type | Description |
|-------|------|-------------|
| date | string | ISO 8601 date (YYYY-MM-DD) |
| count | integer | Number of completions on this date |

#### 3.7 Business Logic Rules

##### Heatmap Data Generation

**Purpose:** Generate an array of HeatmapDay objects for a habit over a date range.

**Inputs:**
- habitId: string - the habit (or null for global)
- from: string - start date (YYYY-MM-DD)
- to: string - end date (YYYY-MM-DD)

**Logic:**

```
1. Query completion counts grouped by DATE(completed_at)
   WHERE habit_id = habitId AND date BETWEEN from AND to
2. Build a map of date -> count for fast lookup
3. Iterate through every day from 'from' to 'to':
   a. Look up count from map (default 0 if not found)
   b. Add { date, count } to result array
4. RETURN array of HeatmapDay objects
```

**Formulas:**
- `color_intensity = count / max_count_in_range` (for per-habit)
- `completion_percentage = completions_today / total_active_habits` (for global)
- Color gradient: 4 levels - empty (0%), light (1-33%), medium (34-66%), full (67-100%)

**Edge Cases:**
- No completions at all: all cells are dark gray
- Date range spanning years: supported, scrollable
- Performance with 3+ years of data: limit default view to 12 months, load more on scroll

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Heatmap computation takes > 2 seconds | Show loading skeleton | Result appears when ready |
| Date parsing error | Display empty heatmap | Log error internally |

#### 3.9 Acceptance Criteria

1. **Given** a habit completed every day for 30 days,
   **When** the user views the per-habit heatmap,
   **Then** the last 30 cells are fully colored and the preceding cells are dark gray.

2. **Given** 6 habits exist and 4 were completed today,
   **When** the user views the global heatmap,
   **Then** today's cell shows medium intensity (4/6 = 67%).

3. **Given** the user taps a heatmap cell for March 1,
   **When** the tooltip appears,
   **Then** it shows "March 1, 2026" and the completion count for that day.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates correct day count | from: Jan 1, to: Dec 31 | 365 HeatmapDay objects (366 for leap year) |
| fills missing days with 0 | 3 completions in 30-day range | 3 days with count > 0, 27 days with count = 0 |
| groups by date correctly | 3 completions on same date | Single day with count = 3 |

---

### HB-007: Habit Statistics

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-007 |
| **Feature Name** | Habit Statistics |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a habit tracker user, I want to see detailed statistics for each habit and overall, so that I understand my consistency patterns.

#### 3.3 Detailed Description

Habit Statistics provides analytics at two levels: per-habit stats (available on the Habit Detail screen) and overall stats (available on the Stats tab). Per-habit stats include total completions, completion rate, best day of week, best time of day, monthly completion rates, average completions per week, and best streak. Overall stats aggregate across all habits.

Statistics are computed on-the-fly from completion data. No pre-aggregated tables are used; all computations query the completions and measurements tables directly.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-002: Daily Check-In & Completion - provides the data

#### 3.5 User Interface Requirements

##### Screen: Stats Tab

**Layout:**
- Top section: Overall stats summary card
  - Total habits (count)
  - Total completions (count)
  - Average completion rate (percentage)
  - Best habit (name and rate)
- Middle section: Completion rate by day of week (bar chart, 7 bars for Mon-Sun)
- Bottom section: Completion rate by time of day (bar chart, 4 bars for morning/afternoon/evening/night)
- Scrollable content below: monthly completion rates chart (line or bar chart, 12 months)

##### Screen: Habit Detail (stats section)

**Layout:**
- Current streak, best streak, total completions
- Completion rate percentage with progress ring
- Best day of week, best time of day
- Monthly rates chart for current year
- Average completions per week

#### 3.6 Data Requirements

##### Type: HabitStats

| Field | Type | Description |
|-------|------|-------------|
| totalCompletions | integer | Total number of completion records |
| completionRate | float (0.0-1.0) | Distinct completion days / total days since creation |
| bestDay | string | Day of week with highest completion rate (e.g., "mon") |
| bestTimeOfDay | string | Time slot with highest completion rate (e.g., "morning") |
| monthlyRates | Record<string, number> | Completion rate per month ("01" through "12") |
| averagePerWeek | float | Total completions / weeks since creation |
| bestStreak | integer | Longest consecutive completion run |

##### Type: OverallStats

| Field | Type | Description |
|-------|------|-------------|
| totalHabits | integer | Total habit count |
| totalCompletions | integer | Total completions across all habits |
| averageCompletionRate | float (0.0-1.0) | Mean completion rate across all habits |
| bestHabit | object or null | { id, name, completionRate } of the top performer |

#### 3.7 Business Logic Rules

##### Completion Rate Calculation

**Purpose:** Calculate completion rate for a habit.

**Formulas:**
- `completionRate = distinct_completion_days / total_days_since_creation`
- `total_days_since_creation = max(1, daysBetween(habit.createdAt, today))`
- Division by zero guard: if total days is 0, use 1

##### Day of Week Analysis

**Purpose:** Determine which day of the week has the highest completion rate.

**Logic:**

```
1. Group completions by day of week (strftime('%w'))
2. Count completions per day
3. Compute proportional rate = day_count / total_completions
4. RETURN day with highest rate
```

##### Time of Day Analysis

**Purpose:** Determine which time slot has the highest completion rate.

**Logic:**

```
1. Group completions by hour (strftime('%H'))
2. Bucket into time slots:
   - Morning: 05:00-11:59
   - Afternoon: 12:00-16:59
   - Evening: 17:00-20:59
   - Night: 21:00-04:59
3. Compute proportional rate per slot
4. RETURN slot with highest rate
```

**Edge Cases:**
- No completions: all rates are 0, bestDay = "none", bestTimeOfDay = "none"
- Habit created today: total_days = 1, rate = completions_today / 1
- All completions at same time: that time slot gets 100%

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Stats computation fails | Show "Unable to load stats" message | Pull-to-refresh to retry |
| No data for a time period | Show 0% / "No data" | N/A, expected for new habits |

#### 3.9 Acceptance Criteria

1. **Given** a habit created 30 days ago with 20 completions,
   **When** the user views Habit Statistics,
   **Then** the completion rate shows 66.7% (20/30).

2. **Given** most completions are logged in the morning,
   **When** the user views the time-of-day chart,
   **Then** the "Morning" bar is the tallest.

3. **Given** 5 habits exist with varying completion rates,
   **When** the user views Overall Stats,
   **Then** the best habit is the one with the highest completion rate.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates completion rate | 20 completions in 30 days | rate: 0.667 |
| identifies best day | most completions on Wednesday | bestDay: "wed" |
| handles zero completions | no completions | rate: 0, bestDay: "none" |
| monthly rate correct | 15 completion days in January (31 days) | January rate: 0.484 |
| overall stats aggregates | 3 habits with rates 0.5, 0.8, 0.3 | averageRate: 0.533 |

---

### HB-008: Habit Categories & Organization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-008 |
| **Feature Name** | Habit Categories & Organization |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user with 10+ habits, I want to organize habits into categories like "Health," "Productivity," and "Personal," so that I can group related habits and view them by category.

#### 3.3 Detailed Description

Habit Categories allow users to organize their habits into named groups. Each habit can optionally belong to one category. Categories appear as section headers on the Today screen, grouping habits visually. Users can create, rename, reorder, and delete categories. Deleting a category does not delete the habits in it; they become uncategorized.

Categories are implemented as a separate table with a foreign key on the habits table. The Today screen supports two view modes: flat list (sorted by sortOrder) and grouped by category (sorted by category order, then habit sortOrder within each category).

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management

#### 3.5 User Interface Requirements

##### Component: Category Selector (on Add/Edit Habit screen)

**Layout:**
- Dropdown or bottom sheet showing existing categories plus "None" and "Create New"
- Category has a name and optional color
- "Create New" opens an inline text field to name the new category

##### Component: Grouped Today View

**Layout:**
- Section headers showing category name and color bar
- Habits grouped under their category
- Uncategorized habits appear in an "Other" section at the bottom
- Toggle between flat and grouped view via a segmented control at the top

#### 3.6 Data Requirements

##### Entity: Category

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, max 100 chars, unique | None | Category display name |
| color | string or null | Valid hex color | null | Accent color for section header |
| sortOrder | integer | Min: 0 | 0 | Display order |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

**Relationships:**
- Category has many Habits (one-to-many, optional relationship)
- Habit optionally belongs to one Category

**Note:** The current schema does not include a category_id column on hb_habits. This feature requires a V3 migration to add `category_id TEXT REFERENCES hb_categories(id)` and create the `hb_categories` table.

#### 3.7 Business Logic Rules

##### Category Deletion

**Logic:**

```
1. When a category is deleted, all habits in that category have their category_id set to NULL
2. Habits are NOT deleted
3. The "Other" / uncategorized section absorbs them
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate category name | Inline validation: "A category with this name already exists" | User enters a different name |
| Category with habits deleted | Habits moved to uncategorized, toast: "Category deleted. X habits moved to Other." | N/A |

#### 3.9 Acceptance Criteria

1. **Given** the user creates a category "Health" and assigns 3 habits to it,
   **When** viewing the Today screen in grouped mode,
   **Then** a "Health" section header appears with those 3 habits underneath.

2. **Given** a category "Work" with 2 habits is deleted,
   **When** viewing the Today screen,
   **Then** those 2 habits appear in the "Other" section.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates category | name: "Health" | Category record created |
| assigns habit to category | habitId, categoryId | Habit's categoryId updated |
| deleting category nullifies habits | delete category with 3 habits | 3 habits have categoryId = null |

---

### HB-009: Menstrual Cycle Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-009 |
| **Feature Name** | Menstrual Cycle Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a cycle-tracking user, I want to log my period start and end dates with flow level and symptoms, so that I can track my menstrual cycle history alongside my habits.

**Secondary:**
> As a user with recurring symptoms, I want to log symptoms by date with severity ratings, so that I can identify patterns across cycles.

#### 3.3 Detailed Description

Menstrual Cycle Tracking is a self-contained feature within MyHabits that allows users to log periods, track symptoms, and view cycle history. This feature is particularly sensitive from a privacy perspective, as menstrual cycle data has been subject to legal scrutiny. All data is stored locally in SQLite and never leaves the device.

Users log a period by setting a start date. They can optionally set an end date when the period finishes. Symptoms can be logged for any date during a period, with a severity rating (1-5) and optional notes. The system provides 15 predefined symptom types (cramps, headache, bloating, fatigue, mood swings, back pain, nausea, breast tenderness, acne, insomnia, appetite change, anxiety, irritability, cravings, dizziness) and supports custom symptom types.

Cycle data is stored in separate tables with the `cy_` prefix (not `hb_`) to keep it isolated from the general habits data.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (independent feature within the module)

**External Dependencies:**
- Local SQLite database with cy_ tables initialized

#### 3.5 User Interface Requirements

##### Screen: Cycle Tracker

**Layout:**
- Calendar view showing the current month
  - Period days highlighted in red/pink
  - Predicted period days shown with a dashed outline
  - Fertility window shown in light green (if predictions are enabled)
  - Symptom dots on days with logged symptoms
- Below calendar: current cycle summary (cycle day, predicted next period, average cycle length)
- "Log Period" button to start or end a period
- "Log Symptom" button to record a symptom for today

##### Modal: Log Period

**Layout:**
- Start date picker (defaults to today)
- End date picker (optional, can be set later)
- Notes field (optional)
- Save button

##### Modal: Log Symptom

**Layout:**
- Date picker (defaults to today)
- Symptom type: scrollable list of 15 predefined symptoms plus "Custom" option
- Severity: 1-5 scale with labeled ticks (Mild, Moderate, Severe, Very Severe, Extreme)
- Notes field (optional)
- Save button

#### 3.6 Data Requirements

##### Entity: CyclePeriod

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| startDate | string | ISO date (YYYY-MM-DD), required | None | Period start date |
| endDate | string or null | ISO date, must be >= startDate | null | Period end date (null if ongoing) |
| cycleLength | integer or null | 15-60 days | null | Computed cycle length (days between this start and next start) |
| notes | string or null | Max 500 chars | null | Optional notes |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |
| updatedAt | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: CycleSymptom

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| periodId | string | Foreign key to CyclePeriod.id, required | None | Which period this symptom is associated with |
| date | string | ISO date (YYYY-MM-DD), required | None | Date of the symptom |
| symptomType | string | Required, one of 15 predefined types or custom | None | Type of symptom |
| severity | integer | Min: 1, Max: 5 | 1 | Severity rating |
| notes | string or null | Max 500 chars | null | Optional notes |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

**Predefined Symptom Types:**
cramps, headache, bloating, fatigue, mood_swings, back_pain, nausea, breast_tenderness, acne, insomnia, appetite_change, anxiety, irritability, cravings, dizziness

**Relationships:**
- CyclePeriod has many CycleSymptoms (one-to-many via periodId, CASCADE delete)

**Indexes:**
- `cy_symptoms.period_id` - lookup symptoms for a period
- `cy_symptoms.date` - date-range queries
- `cy_periods.start_date` - chronological ordering

#### 3.7 Business Logic Rules

##### Cycle Length Computation

**Purpose:** Auto-compute cycle length when a new period is logged.

**Logic:**

```
1. When a new period is logged with a start date:
2. Find the most recent previous period with an end date
3. cycleLength = days from previous period's start date to this period's start date
4. Store cycleLength on the PREVIOUS period record (it describes that cycle)
```

**Edge Cases:**
- First period logged: cycleLength = null (no previous cycle to measure)
- Period without end date: do not compute cycle length until the next period starts

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| End date before start date | Inline validation: "End date must be on or after start date" | User corrects the date |
| Overlapping periods | Warning: "This overlaps with an existing period (start - end). Save anyway?" | User confirms or adjusts |
| Symptom severity out of range | Slider constrains to 1-5 | N/A, UI prevents invalid input |

#### 3.9 Acceptance Criteria

1. **Given** the user is on the Cycle Tracker screen,
   **When** they tap "Log Period" and set start date to March 1,
   **Then** a period record is created and March 1 is highlighted on the calendar.

2. **Given** a period started March 1,
   **When** the user sets end date to March 5,
   **Then** March 1-5 are highlighted on the calendar.

3. **Given** a period exists from March 1-5,
   **When** the user logs a "cramps" symptom on March 2 with severity 4,
   **Then** March 2 shows a symptom dot on the calendar and the symptom appears in the period's symptom list.

4. **Given** the previous period started Feb 1 and the current period starts March 1,
   **When** the current period is saved,
   **Then** the February period's cycleLength is set to 28.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| logs period with start date | startDate: "2026-03-01" | Period record created |
| updates period with end date | endDate: "2026-03-05" | Period updated |
| logs symptom with severity | type: "cramps", severity: 4 | Symptom record created |
| computes cycle length | prev start: Feb 1, current start: Mar 1 | cycleLength: 28 |
| rejects severity > 5 | severity: 6 | Validation error |

---

### HB-010: Fertility Predictions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-010 |
| **Feature Name** | Fertility Predictions |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a cycle-tracking user, I want to see predicted period dates and fertility windows, so that I can plan ahead.

#### 3.3 Detailed Description

Fertility Predictions uses a moving average algorithm to predict the next period start and end dates, and estimates the fertility (ovulation) window. The algorithm requires at least 2 completed cycles (periods with both start and end dates) and uses up to 6 most recent cycles for the moving average. A confidence interval is computed from the standard deviation of cycle lengths.

The fertility window estimation uses the luteal phase constant method: ovulation is estimated at approximately 14 days before the end of the predicted cycle, and the fertility window spans from 5 days before ovulation to 1 day after.

**IMPORTANT DISCLAIMER:** These predictions are informational estimates only. They are NOT medically validated and should NOT be used as a contraceptive method or for medical decision-making. The app does not provide medical advice.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-009: Menstrual Cycle Tracking - at least 2 completed cycles required

#### 3.5 User Interface Requirements

##### Component: Prediction Display (on Cycle Tracker screen)

**Layout:**
- Predicted next period: "Expected [start date] - [end date]" with confidence indicator
- Fertility window: "Fertile window: [start date] - [end date]" shown in light green
- Confidence indicator: "+/- X days" based on standard deviation
- Calendar overlay: predicted period in dashed red, fertility window in light green
- Disclaimer text at bottom: "Predictions are estimates based on your cycle history. Not medical advice."

#### 3.6 Data Requirements

##### Entity: CyclePrediction

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto-generated | Unique identifier |
| predictedStart | string | ISO date | None | Predicted period start date |
| predictedEnd | string | ISO date | None | Predicted period end date |
| confidenceDays | number | >= 0 | 0 | Standard deviation of cycle lengths (confidence interval in days) |
| algorithmVersion | string | - | 'moving_avg_v1' | Version of the prediction algorithm |
| createdAt | datetime | Auto-set | Current timestamp | When prediction was generated |

#### 3.7 Business Logic Rules

##### Cycle Prediction Algorithm (moving_avg_v1)

**Purpose:** Predict the next period start and end dates using a moving average of recent cycle lengths.

**Inputs:**
- Completed periods (with start and end dates), ordered by most recent first

**Constants:**
- MIN_CYCLES_FOR_PREDICTION = 2
- MAX_CYCLES_FOR_AVERAGE = 6

**Logic:**

```
1. Query completed periods (end_date IS NOT NULL), ordered by start_date DESC, LIMIT MAX_CYCLES + 1
2. IF fewer than MIN_CYCLES_FOR_PREDICTION periods THEN RETURN null
3. Compute cycle lengths from consecutive periods:
   FOR i = 0 to periods.length - 2:
     cycleLength[i] = daysBetween(periods[i+1].startDate, periods[i].startDate)
4. IF no valid cycle lengths computed THEN fall back to stored cycle_length values
5. IF still fewer than MIN_CYCLES_FOR_PREDICTION THEN RETURN null
6. Take at most MAX_CYCLES_FOR_AVERAGE recent cycle lengths
7. avgCycleLength = mean(recentCycleLengths)
8. variance = sum((length - avgCycleLength)^2) / count
9. stdDev = sqrt(variance)
10. Compute average period duration from period start/end gaps (default 5 days)
11. predictedStart = lastPeriodStart + avgCycleLength (in days)
12. predictedEnd = predictedStart + avgPeriodDuration
13. confidenceDays = round(stdDev, 2)
14. Store prediction in cy_predictions table
15. RETURN { predictedStart, predictedEnd, confidenceDays }
```

**Edge Cases:**
- Exactly 2 cycles: prediction is made but confidence may be low (high stdDev)
- Very irregular cycles (stdDev > 10): confidence indicator shows warning "Cycle is irregular, prediction may be less accurate"
- No end dates on any period: prediction cannot be made, return null

##### Fertility Window Estimation

**Purpose:** Estimate the ovulation/fertility window based on predicted cycle length.

**Inputs:**
- Latest prediction and average cycle length

**Logic:**

```
1. Get the latest prediction. IF none THEN RETURN null
2. Get average cycle length from recent periods
3. ovulationDay = round(avgCycleLength - 14) (luteal phase constant)
4. fertileStart = max(1, ovulationDay - 5) (5 days before ovulation)
5. fertileEnd = ovulationDay + 1 (1 day after ovulation)
6. Compute dates relative to last period's start date
7. RETURN { start: fertileStartDate, end: fertileEndDate }
```

**Medical Basis:**
- The luteal phase (post-ovulation to period start) is relatively constant at approximately 14 days across most cycles
- Ovulation typically occurs 14 days before the NEXT period, not 14 days after the last
- Sperm can survive up to 5 days, so the fertile window extends 5 days before ovulation
- The egg survives approximately 24 hours after ovulation, extending the window 1 day after

**Edge Cases:**
- Very short cycles (< 21 days): fertile window may overlap with period. Algorithm still computes but UI shows a note
- Very long cycles (> 40 days): algorithm still computes but confidence is lower
- Fewer than 2 periods: return null (cannot estimate)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient data (< 2 cycles) | Message: "Log at least 2 complete periods to see predictions" | User logs more periods |
| Highly irregular cycles (stdDev > 10) | Warning: "Your cycle length varies significantly. Predictions may be less accurate." | N/A, informational |

#### 3.9 Acceptance Criteria

1. **Given** 3 completed cycles with lengths 28, 29, 27 days,
   **When** the prediction algorithm runs,
   **Then** the predicted next period starts 28 days after the last period start (average), with confidence +/- 0.82 days (stdDev).

2. **Given** an average cycle length of 28 days,
   **When** the fertility window is estimated,
   **Then** the fertile window spans from cycle day 9 to cycle day 15 (ovulation at day 14, minus 5, plus 1).

3. **Given** only 1 completed cycle,
   **When** the user views predictions,
   **Then** the message "Log at least 2 complete periods to see predictions" is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| predicts with 3 cycles | lengths: 28, 29, 27 | avg: 28, stdDev: 0.82 |
| returns null with 1 cycle | 1 period | null |
| fertility window correct | avgCycle: 28 | ovulationDay: 14, fertile: day 9-15 |
| handles irregular cycles | lengths: 25, 35, 28 | avg: 29.33, stdDev: 4.19 |
| uses max 6 cycles | 8 cycle lengths | only most recent 6 used |

---

### HB-011: Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-011 |
| **Feature Name** | Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious user, I want to export all my habit data as CSV, so that I own my data and can analyze it outside the app.

#### 3.3 Detailed Description

Data Export allows users to download all their habit data in CSV format. The export includes four sections: habits (definitions), completions (daily records), timed sessions, and measurements. Each section has a header row with column names. The export file uses `#` comment lines to separate sections.

Users can export all data at once or export completions filtered by a specific habit. The export is generated entirely on-device and saved to the device's file system or shared via the system share sheet.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management - data must exist to export

#### 3.5 User Interface Requirements

##### Screen: Export (within Settings)

**Layout:**
- "Export All Data" button - exports everything as a single CSV file
- "Export by Habit" option - shows a habit picker, then exports only that habit's completions
- Export format selector: CSV (default), JSON (future)
- After export: system share sheet opens with the generated file

#### 3.6 Data Requirements

The export produces a CSV string with the following structure:

```
# Habits
id,name,description,icon,color,frequency,target_count,unit,habit_type,...
[rows]

# Completions
id,habit_id,completed_at,value,notes,created_at
[rows]

# Timed Sessions
id,habit_id,started_at,duration_seconds,target_seconds,completed,created_at
[rows]

# Measurements
id,habit_id,measured_at,value,target,created_at
[rows]
```

#### 3.7 Business Logic Rules

##### CSV Escaping

**Purpose:** Ensure CSV values are properly escaped.

**Logic:**

```
1. IF value contains comma, double-quote, or newline THEN
     Wrap in double-quotes and escape internal double-quotes by doubling them
2. ELSE output value as-is
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data to export | Toast: "No data to export" | N/A |
| File write fails | Toast: "Could not export data. Please try again." | User retries |
| Share sheet cancelled | No action taken, file is discarded | User can tap Export again |

#### 3.9 Acceptance Criteria

1. **Given** 5 habits with 100 completions exist,
   **When** the user taps "Export All Data,"
   **Then** a CSV file is generated containing all 5 habits and 100 completions, and the share sheet opens.

2. **Given** the user selects "Export by Habit" and picks "Meditate,"
   **When** the export runs,
   **Then** only completions for "Meditate" are included.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| exports habits CSV | 3 habits in DB | CSV with header + 3 data rows |
| exports completions CSV | 10 completions | CSV with header + 10 data rows |
| escapes commas in values | name: "Read, Write" | Value wrapped in double-quotes |
| empty database produces empty string | no data | Empty string returned |

---

### HB-012: Negative Habit Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-012 |
| **Feature Name** | Negative Habit Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user trying to break a bad habit, I want to track how many days since I last indulged in the habit, so that I can see my progress in quitting.

**Secondary:**
> As a user who slipped, I want to log that I broke my streak with honesty, so that my data reflects reality and I can identify patterns in when I slip.

#### 3.3 Detailed Description

Negative Habit Tracking flips the traditional habit model: instead of tracking completion, it tracks avoidance. Users create a habit with `habitType: 'negative'` and the app shows a "days since" counter - the number of days since the last slip. Each day without a slip is automatically counted as progress. Users only interact with the app when they slip by tapping a "Log Slip" button.

This feature directly replaces core functionality from I Am Sober ($40/yr) and Smoke Free. The approach is supportive and non-judgmental: slipping is treated as data, not failure. Language throughout the UI avoids shame: "Reset" instead of "Failed," "Log slip" instead of "I gave in," and progress messages focus on cumulative achievement ("You've been smoke-free for 47 of the last 50 days" rather than "You failed 3 days ago").

Slips are recorded as completions with `value = -1` to distinguish them from positive completions. The negative streak engine computes days since the last slip and the longest clean streak.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management - habit type 'negative' must be creatable
- HB-003: Streak Tracking - negative streak calculation engine

**External Dependencies:**
- None (fully offline)

#### 3.5 User Interface Requirements

##### Component: Negative Habit Row (on Today screen)

**Layout:**
- Instead of a checkbox, negative habits display:
  - "X days clean" counter in large text (using the habit's accent color)
  - Longest clean streak below in muted text
  - "Log Slip" button (muted, small, non-prominent) on the right
- The counter automatically increments each day without user action
- No daily check-in required for clean days - only slips need logging

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Clean (day 0) | Habit just created, no slips ever | "0 days clean - Your journey starts today" |
| Clean (1-6 days) | Days since creation or last slip is 1-6 | "X days clean" with encouraging text |
| Clean (7+ days) | Clean for a week or more | "X days clean" with milestone marker if applicable |
| Just slipped | Slip logged today | "0 days - Tomorrow is a new day" (supportive, non-judgmental) |

**Interactions:**
- Tap "Log Slip": opens a confirmation with supportive language: "Log a slip for [habit name]? This resets your counter, but your overall progress is still recorded." Confirm / Cancel
- Tap the counter/row: navigates to the Negative Habit Detail screen showing full history
- No undo on slips (they are permanent records for honest tracking)

##### Screen: Negative Habit Detail

**Layout:**
- Large "days clean" counter with animation
- Timeline showing all slips as dots on a horizontal timeline
- Longest clean streak with trophy icon
- Total clean days / total days tracked
- Clean rate percentage (clean days / total days)
- Slip frequency chart (slips per week over time - showing decrease is motivating)
- "Log Slip" button at the bottom

**Language Guidelines (Critical):**
All copy in the negative habit feature must follow these principles:
- Never use "fail," "failure," "relapse," "weak," or other shame-laden language
- Use "slip" instead of "relapse" (less clinical, less loaded)
- Use "reset" instead of "broke your streak"
- Focus on cumulative progress, not just the current streak
- After a slip, always show a forward-looking message: "Tomorrow is a new day" or "You've still been clean 47 of the last 50 days"
- Celebrate milestones warmly but not condescendingly

#### 3.6 Data Requirements

Negative habits use the existing Habit and Completion entities. No new tables are needed.

**Habit Configuration for Negative Habits:**
- `habitType` = 'negative'
- Completions with `value = -1` represent slips
- Days without slips are automatically counted as clean days

**Derived Data:**

| Metric | Computation |
|--------|-------------|
| Days clean (current) | daysBetween(lastSlipDate, today). If no slips, daysBetween(habitCreatedAt, today) |
| Longest clean streak | Max gap between consecutive slips, or gap from creation to first slip |
| Total clean days | totalDaysTracked - numberOfSlipDays |
| Clean rate | totalCleanDays / totalDaysTracked |
| Slip frequency | slips per week, computed over rolling 4-week windows |

#### 3.7 Business Logic Rules

##### Slip Recording

**Purpose:** Record that the user slipped on a negative habit.

**Inputs:**
- habitId: string
- slipDate: string (YYYY-MM-DD, defaults to today)
- notes: string (optional)

**Logic:**

```
1. Show confirmation dialog with supportive language
2. IF user confirms THEN
     Record completion with value = -1, completedAt = now
     Optionally record notes about triggers/circumstances
     Recalculate negative streak
     Display supportive message based on accumulated progress
3. ELSE do nothing
```

**Edge Cases:**
- Multiple slips on the same day: each is recorded as a separate completion, but they count as one slip day for streak purposes
- Slip logged for a past date: allowed, recalculates streaks accordingly
- Slip on the first day: daysSinceLastSlip = 0, clean rate = 0%, display "Your journey starts fresh tomorrow"

##### Progress Messages After Slip

**Purpose:** Display an encouraging message after a user logs a slip.

**Logic:**

```
1. Compute total clean days and total tracked days
2. IF clean rate > 90% THEN
     "You've been clean [X] of the last [Y] days. One slip doesn't erase that."
3. ELSE IF clean rate > 70% THEN
     "You've been clean [X] of the last [Y] days. You're still making progress."
4. ELSE IF clean rate > 50% THEN
     "More clean days than not. Keep going."
5. ELSE
     "Tomorrow is a new day. Every clean day counts."
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Slip save fails | Toast: "Could not save. Please try again." | User retries |
| No slips ever logged | Display clean days from creation | N/A, happy path |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a negative habit "No Smoking" created 10 days ago with 0 slips,
   **When** the user views the Today screen,
   **Then** the habit shows "10 days clean."

2. **Given** "No Smoking" at 10 days clean,
   **When** the user taps "Log Slip" and confirms,
   **Then** the counter resets to "0 days" and a supportive message appears.

3. **Given** "No Smoking" with 2 slips in 30 days,
   **When** the user views the detail screen,
   **Then** it shows clean rate of 93.3% (28/30 clean days).

**Edge Cases:**

4. **Given** a negative habit created today with no slips,
   **When** viewing the Today screen,
   **Then** it shows "0 days clean - Your journey starts today."

5. **Given** 3 slips logged on the same day,
   **When** computing the clean streak,
   **Then** that day counts as 1 slip day (not 3).

**Negative Tests:**

6. **Given** the user taps "Log Slip" and then taps Cancel,
   **When** viewing the counter,
   **Then** it has not changed and no slip is recorded.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| records slip with value -1 | habitId, today | Completion with value = -1 |
| computes days since last slip | slip 10 days ago | daysSinceLastSlip: 10 |
| handles no slips | habit created 30 days ago | daysSinceLastSlip: 30 |
| multiple slips same day | 3 slips on March 1 | 1 slip day for streak calculation |
| clean rate calculation | 28 clean days in 30 | cleanRate: 0.933 |
| progress message > 90% | 47 of 50 days clean | "You've been clean 47 of the last 50 days..." |

---

### HB-013: Sobriety Clock

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-013 |
| **Feature Name** | Sobriety Clock |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a person in recovery, I want a sobriety clock that shows my days sober, money saved, and health recovery milestones, so that I can see the tangible benefits of my journey.

#### 3.3 Detailed Description

The Sobriety Clock extends negative habit tracking with substance-specific features. When creating a negative habit, users can optionally configure it as a sobriety tracker by specifying the substance (alcohol, nicotine, cannabis, caffeine, or custom), their average daily spend on the substance, and their average daily consumption quantity.

The sobriety clock then provides three specialized views:

1. **Time sober:** Days, hours, minutes since the last slip (or since habit creation). Large, constantly updating display.
2. **Money saved:** Cumulative savings based on daily spend multiplied by clean days. Shows both total saved and projected savings at 1 month, 6 months, 1 year.
3. **Health recovery timeline:** Substance-specific milestones showing what is happening in the body as it recovers. These milestones are based on published medical research and are marked with timestamps relative to the quit date.

**CRITICAL SENSITIVITY NOTE:** This feature handles deeply personal recovery data. All language must be supportive, non-judgmental, and medically responsible. Health milestones must include a disclaimer that individual results vary and this is not medical advice. The feature must never gamify recovery in a way that trivializes the difficulty of addiction.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-012: Negative Habit Tracking - sobriety clock is built on top of negative habits

#### 3.5 User Interface Requirements

##### Screen: Sobriety Dashboard

**Layout:**
- Top: Large sobriety counter showing "X days, Y hours, Z minutes" in real-time (updates every minute)
- Subtitle: "Since [quit date]" or "Since last reset on [date]"
- Below counter: Three info cards in a horizontal scroll:
  1. Money Saved card: "$X.XX saved" with "$Y/day, $Z projected this year"
  2. Health Recovery card: "Next milestone: [milestone name] in X days" with progress bar
  3. Clean Rate card: "X% of days clean overall"
- Middle: Health Recovery Timeline (vertical timeline with milestone markers)
  - Past milestones: checkmark icon, green, with date achieved
  - Next milestone: pulsing dot, amber, with countdown
  - Future milestones: gray, with estimated date
- Bottom: "Log Slip" button (small, non-prominent)

##### Component: Substance Configuration (on habit creation when type = negative)

**Layout:**
- "Track as sobriety clock?" toggle
- If enabled:
  - Substance picker: Alcohol, Nicotine (cigarettes), Nicotine (vaping), Cannabis, Caffeine, Custom
  - "Average daily spend" numeric input with currency symbol (e.g., "$12.50")
  - "Average daily consumption" numeric input with unit (e.g., "10 cigarettes", "3 drinks")
  - "Quit date" date picker (defaults to today)

#### 3.6 Data Requirements

Sobriety configuration is stored in the `hb_settings` key-value table with habit-specific keys.

**Settings Keys:**

| Key Pattern | Type | Description |
|------------|------|-------------|
| `sobriety_{habitId}_substance` | string | Substance type (alcohol, nicotine_cigarettes, nicotine_vaping, cannabis, caffeine, custom) |
| `sobriety_{habitId}_daily_spend` | number | Average daily spend in user's currency |
| `sobriety_{habitId}_daily_quantity` | number | Average daily consumption |
| `sobriety_{habitId}_quantity_unit` | string | Unit for daily quantity (e.g., "cigarettes", "drinks") |
| `sobriety_{habitId}_quit_date` | string | ISO date of quit date |
| `sobriety_{habitId}_currency` | string | Currency code (e.g., "USD") |

#### 3.7 Business Logic Rules

##### Money Saved Calculation

**Purpose:** Compute cumulative money saved since quitting.

**Inputs:**
- dailySpend: number - average daily spend on the substance
- cleanDays: integer - total clean days (not just current streak)

**Logic:**

```
1. totalSaved = dailySpend * cleanDays
2. projectedMonthly = dailySpend * 30
3. projectedYearly = dailySpend * 365
4. RETURN { totalSaved, projectedMonthly, projectedYearly }
```

**Formulas:**
- `totalSaved = dailySpend * cleanDays`
- `savingsPerMonth = dailySpend * 30`
- `savingsPerYear = dailySpend * 365`

**Edge Cases:**
- Daily spend of 0: savings displays as "$0.00" (valid for users who only want to track time)
- Slips reduce clean days but not the money already saved up to the slip
- Currency formatting follows device locale

##### Health Recovery Timeline

**Purpose:** Show substance-specific health recovery milestones.

**Milestones for Alcohol:**

| Time Since Quit | Milestone | Description |
|----------------|-----------|-------------|
| 8 hours | Blood alcohol normalizes | Blood alcohol level drops to zero |
| 24 hours | Blood sugar normalizes | Blood sugar levels begin to normalize |
| 48 hours | Taste and smell improve | Nerve endings begin to regenerate, improving taste and smell |
| 72 hours | Withdrawal symptoms peak | Physical withdrawal symptoms are at their most intense, then begin to subside |
| 1 week | Sleep quality improves | Sleep patterns begin to normalize without alcohol's sedative interference |
| 2 weeks | Stomach lining heals | Gastric acid production normalizes, reducing heartburn and nausea |
| 1 month | Liver fat reduces | Liver fat can decrease by up to 15%, liver function tests begin to improve |
| 3 months | Blood cells regenerate | Red blood cells have fully regenerated; overall blood health improves |
| 6 months | Liver inflammation decreases | Significant reduction in liver inflammation markers |
| 1 year | Liver disease risk halved | Risk of developing alcoholic liver disease is reduced by approximately 50% |
| 5 years | Stroke risk normalizes | Stroke risk decreases to approximately that of a non-drinker |

**Milestones for Nicotine (Cigarettes):**

| Time Since Quit | Milestone | Description |
|----------------|-----------|-------------|
| 20 minutes | Heart rate normalizes | Heart rate and blood pressure begin to drop to normal levels |
| 8 hours | Oxygen levels normalize | Carbon monoxide levels drop; oxygen levels in blood return to normal |
| 24 hours | Heart attack risk decreases | Risk of heart attack begins to decrease |
| 48 hours | Nerve endings regrow | Nerve endings start to regrow; ability to smell and taste improves |
| 72 hours | Breathing becomes easier | Bronchial tubes relax, making breathing easier; lung capacity begins to increase |
| 2 weeks | Circulation improves | Circulation improves and lung function increases up to 30% |
| 1 month | Cilia regrow in lungs | Cilia in lungs regrow, improving ability to handle mucus and reduce infection |
| 3 months | Lung function improves | Lung function has improved significantly; coughing and shortness of breath decrease |
| 9 months | Lungs largely healed | Lungs have significantly healed; risk of infections is substantially lower |
| 1 year | Heart disease risk halved | Risk of coronary heart disease is half that of a continuing smoker |
| 5 years | Stroke risk normalized | Risk of stroke falls to that of a non-smoker |
| 10 years | Lung cancer risk halved | Risk of dying from lung cancer is about half that of a continuing smoker |
| 15 years | Heart disease risk normalized | Risk of coronary heart disease equals that of a non-smoker |

**Milestones for Cannabis:**

| Time Since Quit | Milestone | Description |
|----------------|-----------|-------------|
| 1 day | THC effects wear off | Acute psychoactive effects of THC subside |
| 3 days | THC begins clearing | THC metabolites begin to clear from the body |
| 1 week | Sleep patterns shift | REM sleep begins to return; vivid dreams may occur as the brain adjusts |
| 2 weeks | Withdrawal symptoms peak | Irritability, anxiety, and sleep disruption may peak then begin improving |
| 1 month | Cognitive function improves | Short-term memory, attention, and learning ability show measurable improvement |
| 3 months | Lung function improves | If smoked, lung irritation and bronchitis symptoms decrease significantly |
| 6 months | Mood stabilizes | Mood regulation and motivation levels stabilize |
| 1 year | Full cognitive recovery | Cognitive functions are generally fully recovered for most users |

**Milestones for Caffeine:**

| Time Since Quit | Milestone | Description |
|----------------|-----------|-------------|
| 12 hours | Withdrawal begins | Headaches, fatigue, and irritability may begin |
| 24 hours | Withdrawal peaks | Withdrawal symptoms including headache and drowsiness are strongest |
| 2 days | Adenosine receptors adjust | Brain begins to reduce the number of adenosine receptors |
| 1 week | Withdrawal subsides | Most physical withdrawal symptoms have resolved |
| 2 weeks | Sleep quality improves | Sleep latency decreases, sleep quality improves significantly |
| 1 month | Energy levels stabilize | Natural energy levels normalize without caffeine dependence |
| 3 months | Adrenal function improves | Adrenal glands recover from chronic stimulation |

**DISCLAIMER:** All health recovery timelines are approximations based on published medical literature and general population studies. Individual results vary significantly based on duration of use, quantity consumed, genetics, overall health, and other factors. These milestones are for informational and motivational purposes only. They do not constitute medical advice. Consult a healthcare provider for personalized guidance.

**Edge Cases:**
- Custom substance: no health timeline available, display "Health milestones are available for alcohol, nicotine, cannabis, and caffeine"
- Milestone already passed: show with checkmark and date achieved
- Slip resets the timeline: milestones start over from the new quit date, but previously achieved milestones are noted in history

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid daily spend | Inline validation: "Please enter a valid amount" | User corrects input |
| No substance selected but sobriety toggle on | Inline validation: "Please select a substance" | User selects substance |
| Custom substance with no health timeline | Message: "Health milestones are available for alcohol, nicotine, cannabis, and caffeine" | N/A |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a sobriety habit for nicotine with quit date 30 days ago and daily spend of $15,
   **When** the user views the Sobriety Dashboard,
   **Then** it shows "30 days sober", "$450.00 saved", and milestones through "1 month: Cilia regrow in lungs" are checked off.

2. **Given** a sobriety habit for alcohol with quit date 2 days ago,
   **When** viewing the health timeline,
   **Then** "8 hours: Blood alcohol normalizes", "24 hours: Blood sugar normalizes", and "48 hours: Taste and smell improve" are checked. "72 hours: Withdrawal symptoms peak" shows as next milestone with a countdown.

3. **Given** a sobriety habit with daily spend of $12.50,
   **When** the user has been clean for 100 days,
   **Then** total saved shows "$1,250.00" and projected yearly shows "$4,562.50."

**Edge Cases:**

4. **Given** a slip is logged on day 30 of sobriety,
   **When** the timeline resets,
   **Then** previously achieved milestones show dates achieved, and the counter restarts from 0.

5. **Given** a custom substance "Sugar",
   **When** viewing the dashboard,
   **Then** time and money displays work but health timeline shows "Health milestones are available for..." message.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| money saved calculation | dailySpend: 15, cleanDays: 30 | totalSaved: 450 |
| projected yearly savings | dailySpend: 12.50 | yearly: 4562.50 |
| alcohol milestones at day 1 | substance: alcohol, days: 1 | First 3 milestones achieved |
| nicotine milestones at day 365 | substance: nicotine_cigarettes, days: 365 | First 11 milestones achieved |
| custom substance no timeline | substance: custom | Empty milestone array |
| zero daily spend | dailySpend: 0, cleanDays: 30 | totalSaved: 0 |

---

### HB-014: Craving Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-014 |
| **Feature Name** | Craving Log |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a person in recovery, I want to log cravings with their intensity and trigger, so that I can identify patterns in what causes cravings and learn to manage them.

#### 3.3 Detailed Description

The Craving Log is a companion feature to Negative Habit Tracking and the Sobriety Clock. When a user experiences a craving (but has not slipped), they can log it with a timestamp, intensity (1-10 scale), trigger category, and the outcome (resisted or gave in). If the outcome is "gave in," a slip is automatically recorded on the negative habit.

Over time, craving logs reveal patterns: which triggers are most common, what times of day cravings are strongest, whether craving frequency is decreasing, and what the user's resist rate is. This data is presented in a Craving Insights section on the Negative Habit Detail screen.

**Language note:** Cravings are normal and expected during recovery. The UI must normalize them: "Cravings are part of the process. Logging them helps you understand your patterns." Resisting a craving is celebrated. Giving in is recorded without judgment.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-012: Negative Habit Tracking - cravings are associated with negative habits

#### 3.5 User Interface Requirements

##### Modal: Log Craving

**Layout:**
- Habit selector (auto-filled if opened from a specific habit's detail screen)
- Intensity slider: 1-10 with labels (1 = "Mild thought," 5 = "Strong urge," 10 = "Overwhelming")
- Trigger category: dropdown with predefined options
  - Stress, Boredom, Social pressure, Emotional distress, Physical discomfort, Celebration/reward, Routine/habit cue, Seeing/smelling substance, Fatigue, Other
- Notes field: optional free text
- Outcome: "Resisted" (default, green) or "Gave in" (red, triggers slip recording)
- Save button

##### Component: Craving Insights (on Negative Habit Detail screen)

**Layout:**
- Total cravings logged (count)
- Resist rate: percentage of cravings resisted vs gave in
- Most common trigger: bar chart of trigger categories
- Craving frequency trend: line chart showing cravings per week over time (decreasing trend = progress)
- Intensity trend: line chart showing average craving intensity over time
- Peak craving time: time-of-day analysis similar to habit stats

#### 3.6 Data Requirements

##### Entity: Craving

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| habitId | string | Foreign key to Habit.id, required | None | The negative habit this craving is for |
| loggedAt | datetime | ISO 8601 | Current timestamp | When the craving was logged |
| intensity | integer | Min: 1, Max: 10 | None | Craving intensity (1 = mild thought, 10 = overwhelming) |
| triggerCategory | string | One of predefined categories or "other" | None | What triggered the craving |
| outcome | enum | One of: resisted, gave_in | 'resisted' | Whether the user resisted or gave in |
| notes | string or null | Max 500 chars | null | Optional notes |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

**Note:** This entity requires a new table `hb_cravings` in a V3 migration.

**Relationships:**
- Craving belongs to Habit (many-to-one via habitId)

**Indexes:**
- `habit_id` - lookup cravings for a habit
- `logged_at` - date-range queries and trend analysis

#### 3.7 Business Logic Rules

##### Craving with "Gave In" Outcome

**Purpose:** When a user logs a craving with outcome "gave_in," automatically record a slip.

**Logic:**

```
1. Save the craving record
2. IF outcome = 'gave_in' THEN
     Record a slip (completion with value = -1) on the associated negative habit
     Show supportive message (same as HB-012 slip recording)
3. ELSE (outcome = 'resisted')
     Show encouraging message: "You resisted. That takes real strength."
```

##### Resist Rate Calculation

**Formulas:**
- `resistRate = cravings_where_outcome_is_resisted / total_cravings`
- Display as percentage: "78% resist rate"

**Edge Cases:**
- No cravings logged: display "No cravings logged yet"
- All cravings resisted: display "100% resist rate" with celebration
- Zero resist rate: display rate without judgment

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Craving save fails | Toast: "Could not save craving log. Please try again." | User retries |
| Invalid intensity | Slider constrains to 1-10 | N/A, UI prevents |

#### 3.9 Acceptance Criteria

1. **Given** a negative habit "No Smoking" exists,
   **When** the user logs a craving with intensity 7, trigger "Stress", outcome "Resisted",
   **Then** the craving is saved and the message "You resisted. That takes real strength." appears.

2. **Given** a craving with outcome "Gave in" is logged,
   **When** saved,
   **Then** a slip is automatically recorded on the habit and the sobriety counter resets.

3. **Given** 20 cravings logged with 15 resisted and 5 gave in,
   **When** viewing Craving Insights,
   **Then** the resist rate shows "75%."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| logs craving successfully | intensity: 7, trigger: "stress" | Craving record created |
| gave_in triggers slip | outcome: "gave_in" | Completion with value = -1 also created |
| resist rate computation | 15 resisted, 5 gave_in | resistRate: 0.75 |
| trigger frequency count | 10 stress, 5 boredom, 5 social | stress is most common |

---

### HB-015: Milestone Celebrations & Badges

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-015 |
| **Feature Name** | Milestone Celebrations & Badges |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a habit tracker user, I want to receive visual celebrations and earn badges when I hit streak milestones, so that I feel rewarded for my consistency.

**Secondary:**
> As a user in recovery, I want to see milestone markers at 1 week, 30 days, 90 days, and 1 year sober, so that I have intermediate goals to work toward.

#### 3.3 Detailed Description

Milestone Celebrations provides visual rewards when users hit significant streak milestones. Milestones trigger a celebration animation (confetti, badge reveal) and earn a collectible badge that appears in the user's Achievement Badge grid (accessible from the Stats tab).

Milestones apply to both positive habits (streak days) and negative habits (clean days). The milestone thresholds are:

**Standard Milestones (positive habits):**
- 7 days (1 week)
- 14 days (2 weeks)
- 21 days (3 weeks - habit formation threshold)
- 30 days (1 month)
- 60 days (2 months)
- 90 days (3 months)
- 180 days (6 months)
- 365 days (1 year)
- 500 days
- 730 days (2 years)
- 1000 days
- 1095 days (3 years)

**Recovery Milestones (negative habits) - additional emotional significance:**
- 24 hours
- 3 days
- 1 week
- 2 weeks
- 1 month
- 60 days
- 90 days (widely recognized recovery milestone)
- 6 months
- 1 year
- 18 months
- 2 years
- 5 years

Each badge has a name, icon, and description. Badges are earned once and never lost (even if the streak later breaks). A badge grid displays all earned badges with earned date and a grayscale preview of unearned badges.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-003: Streak Tracking - milestones are triggered by streak values
- HB-012: Negative Habit Tracking - recovery milestones for negative habits

#### 3.5 User Interface Requirements

##### Component: Milestone Celebration (overlay)

**Layout:**
- Full-screen overlay that appears when a milestone is reached
- Badge icon in the center with a reveal animation (scale up from 0 with bounce)
- Confetti particle effect in the background
- Badge name in large text (e.g., "21-Day Warrior")
- Description text (e.g., "Research suggests 21 days is the threshold for forming a new habit")
- For recovery milestones: supportive, celebratory language tailored to the milestone
- "Awesome!" dismiss button
- Auto-dismiss after 5 seconds if not tapped

##### Screen: Achievement Badges (accessible from Stats tab)

**Layout:**
- Grid of badge icons (4 per row)
- Earned badges: full color with earned date below
- Unearned badges: grayscale with "?" overlay
- Tap a badge: shows badge detail with name, description, habit name, and date earned
- Filter: All, Earned, Unearned
- Filter by habit: show badges for a specific habit

#### 3.6 Data Requirements

##### Entity: Badge

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| habitId | string | Foreign key to Habit.id | None | Which habit earned this badge |
| badgeType | string | One of predefined milestone types | None | e.g., "streak_7", "streak_30", "recovery_90" |
| earnedAt | datetime | ISO 8601 | None | When the badge was earned |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

**Note:** Requires a new `hb_badges` table in a V3 migration.

**Indexes:**
- `habit_id` - lookup badges for a habit
- `badge_type` - check if a specific badge has been earned

#### 3.7 Business Logic Rules

##### Milestone Check

**Purpose:** After every streak recalculation, check if a new milestone has been reached.

**Logic:**

```
1. After streak recalculation, get new current streak value
2. FOR each milestone threshold:
   a. IF streak >= threshold THEN
        Check if badge for this habit + threshold already exists
        IF not earned THEN
          Create badge record
          Trigger celebration animation
3. Badges are never revoked (streak may later break, badge stays)
```

**Edge Cases:**
- Streak jumps from 5 to 30 (due to backdated completions): award all milestones in between (7, 14, 21, 30)
- Multiple milestones on the same day: show celebration for the highest milestone only, but award all badges
- Habit is deleted: badges associated with that habit are preserved with a "Deleted habit" label

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Badge save fails | Celebration still shows; badge save retried on next app launch | Silent retry |
| Badge grid fails to load | Message: "Could not load badges" | Pull-to-refresh |

#### 3.9 Acceptance Criteria

1. **Given** a habit's streak reaches 7 days,
   **When** the completion that triggers the milestone is logged,
   **Then** a celebration animation plays and the "7-Day Streak" badge appears in the badge grid.

2. **Given** a recovery habit reaches 90 days clean,
   **When** the 90th day passes,
   **Then** a special recovery celebration appears with supportive language and the "90 Days" badge is earned.

3. **Given** a streak breaks after earning a 30-day badge,
   **When** the user views the badge grid,
   **Then** the 30-day badge is still displayed with its earned date.

4. **Given** a streak jumps from day 5 to day 35 via backdated completions,
   **When** streak is recalculated,
   **Then** badges for 7, 14, 21, and 30 days are all awarded, celebration shows for 30-day milestone only.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| awards 7-day badge | streak reaches 7 | Badge record created with type "streak_7" |
| does not duplicate badge | streak at 7, badge already exists | No new badge created |
| awards multiple badges on jump | streak goes from 5 to 35 | 4 badges: streak_7, streak_14, streak_21, streak_30 |
| badges survive streak break | streak breaks after 30-day badge | Badge still exists |

---

### HB-016: Daily Pledge System

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-016 |
| **Feature Name** | Daily Pledge System |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a person in recovery, I want to make a daily morning pledge to stay clean today, so that I start each day with a conscious commitment.

#### 3.3 Detailed Description

The Daily Pledge System is a morning commitment ritual for negative habits. Each day, the user can "take the pledge" for one or more negative habits. Taking the pledge is a simple tap that records a pledge entry for today. The system tracks the pledge streak (consecutive days pledged) separately from the clean streak.

Pledges are optional and do not affect the clean streak. They are a psychological reinforcement tool used in many recovery programs. The feature is inspired by I Am Sober's daily pledge, which is one of its most-used features.

The pledge prompt can be configured to appear as a morning notification or shown prominently on the Today screen at the top.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-012: Negative Habit Tracking

#### 3.5 User Interface Requirements

##### Component: Pledge Card (on Today screen, top position for negative habits)

**Layout:**
- Card showing: "[Habit name] - Take today's pledge"
- Large tap target with the text "I pledge to stay [clean/sober/smoke-free] today"
- After pledge: card shows "Pledged today" with checkmark and pledge streak count
- Pledge streak: "X days consecutively pledged"

#### 3.6 Data Requirements

##### Entity: Pledge

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| habitId | string | Foreign key to Habit.id | None | Which negative habit this pledge is for |
| pledgeDate | string | ISO date (YYYY-MM-DD) | Today | The date of the pledge |
| pledgedAt | datetime | ISO 8601 | Current timestamp | When the pledge was taken |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

**Note:** Requires a new `hb_pledges` table in a V3 migration.

**Unique constraint:** (habitId, pledgeDate) - only one pledge per habit per day.

#### 3.7 Business Logic Rules

##### Pledge Streak

**Logic:**

```
1. Query pledge dates for habitId ordered DESC
2. Compute consecutive days pledged from today backwards
3. Missing a pledge day does NOT affect the clean streak (pledges are separate)
4. Pledge streak is displayed alongside but not tied to clean streak
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Already pledged today | Button shows "Pledged today" (disabled) | N/A |
| Pledge save fails | Toast: "Could not save pledge. Please try again." | User retries |

#### 3.9 Acceptance Criteria

1. **Given** a negative habit exists and the user has not pledged today,
   **When** they tap "Take today's pledge",
   **Then** the card shows "Pledged today" and the pledge streak increments.

2. **Given** the user pledged yesterday and today,
   **When** viewing the pledge streak,
   **Then** it shows "2 days consecutively pledged."

3. **Given** the user missed pledging yesterday,
   **When** they pledge today,
   **Then** the pledge streak resets to 1, but the clean streak is unaffected.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| records pledge | habitId, today | Pledge record created |
| prevents duplicate pledge | pledge already exists for today | No duplicate, error or silent ignore |
| pledge streak consecutive | pledges for 5 consecutive days | pledgeStreak: 5 |
| pledge streak broken | pledges Mon, Wed (missed Tue) | pledgeStreak: 1 (Wed only) |

---

### HB-017: RPG Gamification (XP & Levels)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-017 |
| **Feature Name** | RPG Gamification (XP & Levels) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who enjoys gamification, I want to earn XP for completing habits and level up a character, so that habit tracking feels like a game.

**Secondary:**
> As a user who dislikes gamification, I want to turn off all RPG features, so that they do not clutter my experience.

#### 3.3 Detailed Description

RPG Gamification adds an optional layer of game mechanics to habit tracking. Users earn Experience Points (XP) for completing habits, with bonus XP for maintaining streaks, hitting milestones, and resisting cravings. XP accumulates toward character levels, with each level requiring progressively more XP. Leveling up unlocks cosmetic avatar items (hats, backgrounds, colors) for the pet/avatar companion (HB-018).

The entire gamification system is optional and controlled by a single toggle in Settings. When disabled, no XP is shown, no levels are tracked, and the UI reverts to the clean, non-gamified experience. This addresses the primary criticism of Habitica: that gamification overwhelms the habit itself.

**Design Philosophy:** The gamification layer must always be secondary to the habit tracking. XP and levels are motivational tools, not the primary loop. A user who turns off gamification should have an equally complete experience.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-002: Daily Check-In & Completion - XP is earned from completions

#### 3.5 User Interface Requirements

##### Component: XP Bar (on Today screen, visible when gamification is enabled)

**Layout:**
- Thin XP progress bar at the top of the Today screen, below the navigation bar
- Shows "Level X" on the left and "XP / NextLevelXP" on the right
- Bar fills with accent color as XP accumulates
- When level up occurs: bar flashes, number increments with celebration animation

##### Component: Level Up Celebration (overlay)

**Layout:**
- "Level Up!" text with large level number
- Unlocked items shown (if any)
- Particle effect
- "Continue" dismiss button

##### Settings: Gamification Toggle

**Layout:**
- "RPG Mode" toggle in Settings
- When toggled off: XP bar, level display, and all gamification UI elements are hidden
- When toggled on: XP bar appears, historical XP is preserved (not lost by toggling off)

#### 3.6 Data Requirements

##### Entity: PlayerProfile

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, singleton (one record) | 'player' | Unique identifier |
| totalXP | integer | Min: 0 | 0 | Cumulative XP earned |
| currentLevel | integer | Min: 1 | 1 | Current character level |
| xpToNextLevel | integer | > 0 | 100 | XP needed to reach next level |
| gamificationEnabled | boolean | - | false | Whether RPG mode is active |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |
| updatedAt | datetime | Auto-set | Current timestamp | Last modification time |

**Note:** Stored in `hb_settings` key-value table rather than a separate table.

##### Entity: XPTransaction

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| amount | integer | > 0 | None | XP earned |
| source | string | Required | None | What earned the XP (e.g., "completion", "streak_bonus", "milestone") |
| habitId | string or null | FK to Habit.id | null | Which habit (null for system-level rewards) |
| earnedAt | datetime | ISO 8601 | Current timestamp | When XP was earned |

**Note:** Requires a new `hb_xp_transactions` table in a V3 migration.

#### 3.7 Business Logic Rules

##### XP Award Table

| Action | Base XP | Conditions |
|--------|---------|------------|
| Complete a habit (standard) | 10 XP | Per completion |
| Complete a timed session (met target) | 15 XP | Duration >= target |
| Complete a measurable habit (met target) | 12 XP | Value >= target |
| Resist a craving | 20 XP | Craving logged with outcome "resisted" |
| Maintain streak (daily bonus) | streak * 1 XP | Bonus scales with streak length, capped at 50 XP/day |
| Hit milestone (7 days) | 50 XP | One-time bonus |
| Hit milestone (30 days) | 150 XP | One-time bonus |
| Hit milestone (90 days) | 500 XP | One-time bonus |
| Hit milestone (365 days) | 2000 XP | One-time bonus |
| Take daily pledge | 5 XP | Per pledge |
| Complete all habits for the day | 25 XP | Bonus for 100% daily completion |

##### Leveling Curve

**Purpose:** Define how much XP is needed for each level.

**Formula:**
- `xpForLevel(n) = floor(100 * (1.2 ^ (n - 1)))`

**Level Table (first 20 levels):**

| Level | XP to Reach | Cumulative XP | Unlockable |
|-------|-------------|---------------|------------|
| 1 | 0 | 0 | Default avatar |
| 2 | 100 | 100 | Blue background |
| 3 | 120 | 220 | Green hat |
| 4 | 144 | 364 | Red scarf |
| 5 | 173 | 537 | Gold border |
| 6 | 207 | 744 | Purple aura |
| 7 | 249 | 993 | Silver crown |
| 8 | 299 | 1,292 | Rainbow trail |
| 9 | 358 | 1,650 | Star badge |
| 10 | 430 | 2,080 | "Habit Master" title |
| 11 | 516 | 2,596 | Fire effect |
| 12 | 619 | 3,215 | Ice theme |
| 13 | 743 | 3,958 | Nature background |
| 14 | 892 | 4,850 | Lightning bolt |
| 15 | 1,070 | 5,920 | "Habit Legend" title |
| 16 | 1,284 | 7,204 | Crystal crown |
| 17 | 1,541 | 8,745 | Phoenix wings |
| 18 | 1,849 | 10,594 | Galaxy background |
| 19 | 2,219 | 12,813 | Dragon companion |
| 20 | 2,663 | 15,476 | "Habit Grandmaster" title |

**Typical progression:** A user completing 5 habits daily earns approximately 75 XP/day (50 base + 25 all-complete bonus). This reaches Level 5 in about 7 days, Level 10 in about 28 days, and Level 15 in about 79 days.

**Edge Cases:**
- XP is never lost (no negative XP)
- Toggling gamification off does not reset XP or level
- Un-completing a habit does not subtract XP (to prevent gaming the system by toggling completions)
- Maximum level is unbounded (curve continues indefinitely)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| XP transaction save fails | XP still added to profile total; transaction log may be incomplete | Silent retry |
| Level computation error | Display last known level | Recompute from totalXP on next launch |

#### 3.9 Acceptance Criteria

1. **Given** gamification is enabled and the user completes a standard habit,
   **When** the completion is recorded,
   **Then** 10 XP is added and the XP bar updates.

2. **Given** the user's XP reaches the threshold for Level 5,
   **When** the level-up occurs,
   **Then** a celebration animation plays and the "Gold border" item is unlocked.

3. **Given** gamification is disabled,
   **When** the user completes habits,
   **Then** no XP bar, level indicator, or gamification UI is visible.

4. **Given** the user toggles gamification off then on again,
   **When** viewing the XP bar,
   **Then** all previously earned XP and level progress is preserved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| awards 10 XP for completion | standard habit completion | totalXP increases by 10 |
| awards streak bonus | streak of 15 | bonus: 15 XP (capped calculation) |
| level up at threshold | totalXP reaches 100 | currentLevel: 2 |
| leveling curve correct | level 5 | xpToReach: 173 |
| XP not lost on toggle off | toggle off gamification | totalXP unchanged |
| un-completion does not subtract | un-complete a habit | totalXP unchanged |

---

### HB-018: Pet/Avatar Companion

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-018 |
| **Feature Name** | Pet/Avatar Companion |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who enjoys virtual companions, I want a pet or avatar whose health and appearance reflect my habit completion, so that I have an emotional connection to my daily progress.

#### 3.3 Detailed Description

The Pet/Avatar Companion is a virtual creature displayed on the Today screen that visually reflects the user's habit adherence. When habits are completed consistently, the pet appears happy, healthy, and vibrant. When habits are missed, the pet appears sad, tired, or unwell. The pet is customized with cosmetic items unlocked through the RPG leveling system (HB-017).

The companion system is inspired by Finch (self-care pet app) and Habitica (character health), but without the monetization of pet items. All cosmetic items are earned through gameplay, never purchased.

**Design Philosophy:** The pet should create a gentle emotional incentive without guilt-tripping. A neglected pet looks tired, not dying. The tone is "your pet missed you" not "you're killing your pet."

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-017: RPG Gamification - cosmetic items are unlocked via leveling

#### 3.5 User Interface Requirements

##### Component: Pet Display (on Today screen)

**Layout:**
- Small animated avatar in the top-right corner of the Today screen (or as a card above the habit list)
- Pet has 5 visual states based on daily completion rate:
  1. Thriving (80-100%): bright, bouncy, sparkle effects
  2. Happy (60-79%): smiling, normal animation
  3. Neutral (40-59%): calm, minimal animation
  4. Tired (20-39%): droopy, slow blink, muted colors
  5. Sleepy (0-19%): eyes closed, zzz bubbles, very muted
- Equipped cosmetic items from leveling system
- Tap pet: opens Pet Detail screen

##### Screen: Pet Detail

**Layout:**
- Large pet display with current mood animation
- Pet name (user-customizable, default "Buddy")
- Mood label: "Thriving!", "Happy", "Okay", "Tired", "Sleepy"
- Today's completion percentage
- Wardrobe section: grid of all unlocked items, tap to equip/unequip
- Stats: days together, total habits completed, longest streak achieved

#### 3.6 Data Requirements

##### Entity: PetState

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, singleton | 'pet' | Unique identifier |
| name | string | Max 50 chars | 'Buddy' | Pet's user-given name |
| equippedItems | string | JSON array of item IDs | '[]' | Currently equipped cosmetic items |
| createdAt | datetime | Auto-set | Current timestamp | When pet was created |
| updatedAt | datetime | Auto-set | Current timestamp | Last modification time |

**Note:** Stored in `hb_settings` key-value table.

#### 3.7 Business Logic Rules

##### Pet Mood Calculation

**Purpose:** Determine the pet's visual state based on recent habit performance.

**Logic:**

```
1. Calculate today's completion percentage (completed / total active habits)
2. Map to mood state:
   - 80-100% = Thriving
   - 60-79%  = Happy
   - 40-59%  = Neutral
   - 20-39%  = Tired
   - 0-19%   = Sleepy
3. If no habits exist, pet is Neutral
```

**Edge Cases:**
- All habits completed: pet is Thriving with sparkle effect
- No habits exist: pet is Neutral (not sad - there's nothing to do)
- Gamification disabled but pet visible: pet still shows mood based on completion rate (pet is not tied to gamification toggle)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Pet state fails to load | Show default pet with Neutral mood | Retry on next screen load |
| Cosmetic item fails to render | Show pet without that item | Fall back to default appearance |

#### 3.9 Acceptance Criteria

1. **Given** the user has completed 5/6 habits today (83%),
   **When** viewing the pet,
   **Then** the pet shows the "Thriving" animation.

2. **Given** the user has completed 1/6 habits today (17%),
   **When** viewing the pet,
   **Then** the pet shows the "Sleepy" animation.

3. **Given** the user has unlocked "Green hat" at Level 3,
   **When** they equip it on the Pet Detail screen,
   **Then** the pet displays wearing the green hat on the Today screen.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| mood at 100% completion | 6/6 complete | mood: "thriving" |
| mood at 50% completion | 3/6 complete | mood: "neutral" |
| mood at 0% completion | 0/6 complete | mood: "sleepy" |
| mood with no habits | 0 habits | mood: "neutral" |
| equip item | itemId: "green_hat" | equippedItems includes "green_hat" |

---

### HB-019: Focus Timer (Pomodoro)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-019 |
| **Feature Name** | Focus Timer (Pomodoro) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who wants to focus deeply, I want a Pomodoro timer with 25-minute work sessions and 5-minute breaks, so that I can maintain concentration and track focus time.

**Secondary:**
> As a user who enjoys visual feedback, I want to see a tree or plant grow during my focus session, so that I have a satisfying visual incentive to stay focused.

#### 3.3 Detailed Description

The Focus Timer implements the Pomodoro technique: 25-minute work sessions followed by 5-minute short breaks, with a 15-minute long break after every 4 work sessions. The timer includes a visual growing tree/plant animation that progresses as the work session advances.

This feature directly replaces Forest ($4), which popularized the tree-growing focus timer concept. Unlike Forest, MyHabits integrates the focus timer with the broader habit tracking system - focus sessions can auto-complete a "Focus" or "Deep Work" habit.

The timer follows a precise state machine with clear transitions between work, short break, long break, and idle states. Session data is recorded for statistics: total focus time, sessions completed, focus streaks.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-004: Timed Sessions - Focus Timer builds on the timed session infrastructure

#### 3.5 User Interface Requirements

##### Screen: Focus Timer

**Layout:**
- Large circular timer display showing remaining time (MM:SS countdown)
- Growing tree/plant animation in the center of the timer ring
  - Tree progresses through 5 growth stages during a work session (sapling to full tree)
  - Tree resets on break, grows a new tree for each work session
  - A "forest" of completed session trees accumulates at the bottom of the screen
- Current state label: "Focus" (work), "Short Break", "Long Break"
- Session counter: "Session 2 of 4" (shows position in the Pomodoro cycle)
- Play/Pause button (center)
- Stop button (ends the Pomodoro cycle entirely)
- Settings icon: configure work/break durations

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | Timer not started | "Start Focus" button, tree at sapling stage |
| Working | Work session active | Countdown timer, tree growing, "Focus" label |
| Work Paused | Work session paused | Timer frozen, tree frozen, Resume/Stop buttons |
| Short Break | Break between work sessions | Countdown timer (5:00), "Short Break" label, relaxing animation |
| Long Break | Break after 4 work sessions | Countdown timer (15:00), "Long Break" label |
| Session Complete | All planned sessions done | Forest of grown trees, total focus time, "Well done!" message |

**Interactions:**
- Tap Start: begins a work session (25:00 countdown)
- Tap Pause: pauses the current timer
- Tap Resume: continues from paused state
- Tap Stop: ends the entire Pomodoro cycle, records completed sessions
- Timer reaches 0:00 during work: notification sound, auto-transition to Short Break (or Long Break after session 4)
- Timer reaches 0:00 during break: notification sound, auto-transition to next Work session

##### Modal: Focus Timer Settings

**Layout:**
- Work duration: stepper (5-60 minutes, default 25)
- Short break: stepper (1-15 minutes, default 5)
- Long break: stepper (5-30 minutes, default 15)
- Sessions before long break: stepper (2-8, default 4)
- Auto-start breaks: toggle (default on)
- Auto-start work sessions: toggle (default off)
- Linked habit: dropdown of timed habits to auto-complete on session finish

#### 3.6 Data Requirements

##### Entity: FocusSession (extends TimedSession)

Focus sessions are stored using the existing `hb_timed_sessions` table with additional metadata in the `hb_settings` table.

**Focus-specific settings keys:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `focus_work_duration` | integer | 1500 (25 min) | Work session length in seconds |
| `focus_short_break` | integer | 300 (5 min) | Short break length in seconds |
| `focus_long_break` | integer | 900 (15 min) | Long break length in seconds |
| `focus_sessions_before_long` | integer | 4 | Work sessions before a long break |
| `focus_auto_start_breaks` | boolean | true | Auto-start break timer |
| `focus_auto_start_work` | boolean | false | Auto-start next work session |
| `focus_linked_habit_id` | string or null | null | Habit to auto-complete |

#### 3.7 Business Logic Rules

##### Focus Timer State Machine

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| Idle | User taps Start | Working | Start 25:00 countdown, begin tree growth animation |
| Working | Timer reaches 0:00 | Short Break (if session < 4) | Record work session, increment session counter, play notification, start break countdown |
| Working | Timer reaches 0:00 | Long Break (if session = 4) | Record work session, play notification, start long break countdown |
| Working | User taps Pause | Work Paused | Freeze timer and tree animation |
| Work Paused | User taps Resume | Working | Continue timer and tree animation |
| Working | User taps Stop | Idle | Record partial session, reset counter |
| Short Break | Timer reaches 0:00 | Working (if auto-start) or Idle | Start next work session or wait for user |
| Long Break | Timer reaches 0:00 | Idle or Working | Reset session counter, start new cycle or wait |
| Short Break | User taps Stop | Idle | End cycle |
| Long Break | User taps Stop | Idle | End cycle |

##### Tree Growth Algorithm

**Purpose:** Map elapsed work time to tree growth stages.

**Logic:**

```
1. totalWorkDuration = focus_work_duration (default 1500 seconds)
2. elapsed = totalWorkDuration - remainingSeconds
3. growthPercent = elapsed / totalWorkDuration
4. stage = floor(growthPercent * 5)
   - Stage 0 (0-19%): seed/sprout
   - Stage 1 (20-39%): sapling
   - Stage 2 (40-59%): small tree
   - Stage 3 (60-79%): medium tree
   - Stage 4 (80-99%): large tree
   - Stage 5 (100%): full tree with flourish animation
```

##### Auto-Complete Linked Habit

**Logic:**

```
1. When a work session timer reaches 0:00 (full completion, not stopped early):
2. IF focus_linked_habit_id is set THEN
     Record a completion for the linked habit
     Record a timed session with duration = focus_work_duration
     Recalculate streak for the linked habit
```

**Edge Cases:**
- User stops a work session early: tree dies (withering animation), no habit completion, partial session recorded
- User pauses for a long time then resumes: elapsed time does not include paused duration
- App killed during focus session: session is lost (same limitation as HB-004)
- Notification permission denied: timer still works but no sound/vibration at transitions

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Timer fails to start | Toast: "Could not start timer" | User retries |
| Notification permission denied | Timer works without sound; message: "Enable notifications for timer alerts" | Link to system settings |
| Session save fails | Toast: "Could not save session" | Retry on next opportunity |

#### 3.9 Acceptance Criteria

1. **Given** default settings (25/5/15/4),
   **When** the user starts a focus session and the 25:00 timer reaches 0:00,
   **Then** a work session is recorded, the tree reaches full growth, and a 5:00 short break timer auto-starts.

2. **Given** 4 work sessions have been completed,
   **When** the 4th session timer reaches 0:00,
   **Then** a 15:00 long break timer starts instead of a 5:00 short break.

3. **Given** a linked habit "Deep Work" exists,
   **When** a work session completes,
   **Then** the "Deep Work" habit is auto-completed and its streak increments.

4. **Given** the user stops a session at 12:30 remaining,
   **When** the session ends,
   **Then** a partial session of 750 seconds (12.5 minutes) is recorded but the habit is NOT auto-completed, and the tree shows a withering animation.

5. **Given** the user customizes work duration to 45 minutes,
   **When** starting a focus session,
   **Then** the timer counts down from 45:00 and the tree grows proportionally over the full 45 minutes.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| state transition: idle to working | user starts | state: Working, timer: 1500 |
| state transition: work to short break | timer reaches 0, session 1 | state: ShortBreak, timer: 300 |
| state transition: work to long break | timer reaches 0, session 4 | state: LongBreak, timer: 900 |
| tree growth at 50% | elapsed: 750 of 1500 | stage: 2 (small tree) |
| tree growth at 100% | elapsed: 1500 of 1500 | stage: 5 (full tree) |
| auto-complete linked habit | session completes, linked habit set | completion recorded |
| partial session no completion | stopped at 750s | session recorded, no habit completion |
| custom durations | work: 2700 (45 min) | timer starts at 2700 |

---

### HB-020: Apple Health Auto-Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-020 |
| **Feature Name** | Apple Health Auto-Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fitness-oriented user, I want my "Walk 10,000 steps" habit to auto-complete when Apple Health reports 10,000+ steps, so that I do not have to manually check off habits that my phone already knows about.

#### 3.3 Detailed Description

Apple Health Auto-Tracking reads data from HealthKit (iOS) to auto-complete habits based on health metrics. Users can link a habit to a HealthKit data type and set a threshold. When the threshold is met, the habit is automatically marked complete for the day.

Supported HealthKit data types and example thresholds:
- Steps: "Walk 10,000 steps" (stepCount >= 10000)
- Walking/Running distance: "Walk 5 km" (distanceWalkingRunning >= 5000 meters)
- Active energy: "Burn 500 calories" (activeEnergyBurned >= 500)
- Sleep: "Sleep 8 hours" (sleepAnalysis >= 28800 seconds)
- Water: "Drink 8 cups" (dietaryWater >= 1893 ml, ~8 cups)
- Mindful minutes: "Meditate 10 min" (mindfulSession >= 600 seconds)
- Stand hours: "Stand 12 hours" (appleStandHour >= 12)
- Exercise minutes: "Exercise 30 min" (appleExerciseTime >= 30)

**Privacy note:** HealthKit data is read on-device only. No health data is stored in the habits database beyond a completion flag. The raw HealthKit values are never persisted. The user must explicitly grant HealthKit read permission per data type, and can revoke it at any time through iOS Settings.

**Platform limitation:** This feature is iOS-only. On Android and web, the habit functions as a normal manual habit. The UI clearly indicates "Auto-tracking is available on iOS only" on other platforms.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-002: Daily Check-In & Completion

**External Dependencies:**
- iOS HealthKit framework
- User grants HealthKit read permissions for selected data types
- expo-health-connect or react-native-health library

#### 3.5 User Interface Requirements

##### Component: Auto-Track Configuration (on Add/Edit Habit screen)

**Layout:**
- "Auto-track from Apple Health" toggle (iOS only)
- If enabled:
  - Data type picker: list of supported HealthKit types
  - Threshold input: numeric value with unit label (e.g., "10000 steps")
  - "Check now" button: tests the current HealthKit value against the threshold
  - Permission status indicator: "Connected" or "Permission required" with link to grant

##### Component: Auto-Track Indicator (on Today screen)

**Layout:**
- Habits with auto-tracking show a small Apple Health icon badge
- Auto-completed habits show "Auto-completed at [time]" in muted text below the habit name
- Users can still manually toggle auto-completed habits (manual override)

#### 3.6 Data Requirements

**Habit-level settings stored in hb_settings:**

| Key Pattern | Type | Description |
|------------|------|-------------|
| `healthkit_{habitId}_enabled` | boolean | Whether auto-tracking is on |
| `healthkit_{habitId}_data_type` | string | HealthKit data type identifier |
| `healthkit_{habitId}_threshold` | number | Value threshold for auto-completion |
| `healthkit_{habitId}_unit` | string | Unit for the threshold (e.g., "steps", "meters") |

#### 3.7 Business Logic Rules

##### HealthKit Polling

**Purpose:** Periodically check HealthKit data and auto-complete habits.

**Logic:**

```
1. On app launch and every 30 minutes while app is in foreground:
2. FOR each habit with healthkit enabled:
   a. Query HealthKit for today's aggregate value of the configured data type
   b. IF value >= threshold AND habit is not yet completed today THEN
        Record completion with notes = "Auto-completed from Apple Health"
        Recalculate streak
   c. ELSE do nothing
3. HealthKit raw values are NOT stored - only the boolean completion is recorded
```

**Edge Cases:**
- HealthKit permission revoked: auto-tracking stops silently, habit reverts to manual. Show "Permission required" on next view.
- HealthKit data delayed: some data types (sleep, weight) may not appear until hours after the event. Polling handles this.
- Manual completion before auto-completion: auto-tracking does not create a duplicate completion
- Manual un-completion after auto-completion: the user's manual action takes precedence. Do not re-auto-complete until the next polling cycle after HealthKit data changes.
- Multiple HealthKit sources (Apple Watch + iPhone): HealthKit handles deduplication natively

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| HealthKit not available (Android/web) | "Auto-tracking is available on iOS only" | Habit works as manual |
| Permission denied | "Permission required. Tap to open Settings." | Deep link to iOS Settings |
| HealthKit query fails | Silent failure, habit stays manual for this cycle | Retry on next poll |

#### 3.9 Acceptance Criteria

1. **Given** a habit "Walk 10K" linked to stepCount with threshold 10000,
   **When** HealthKit reports 10500 steps for today,
   **Then** the habit is auto-completed with note "Auto-completed from Apple Health."

2. **Given** the user has manually completed a habit,
   **When** HealthKit polling runs,
   **Then** no duplicate completion is created.

3. **Given** the user is on Android,
   **When** viewing the auto-track option,
   **Then** the toggle is disabled with message "Available on iOS only."

4. **Given** HealthKit permission is revoked,
   **When** the app attempts to poll,
   **Then** the habit shows "Permission required" and functions as a manual habit.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| auto-completes at threshold | steps: 10500, threshold: 10000 | Completion recorded |
| does not complete below threshold | steps: 8000, threshold: 10000 | No completion |
| no duplicate on re-poll | already completed, steps: 12000 | No new completion |
| handles permission denied | HealthKit returns error | No completion, status: "permission_required" |

---

### HB-021: Location-Based Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-021 |
| **Feature Name** | Location-Based Reminders |
| **Priority** | P2 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a gym-goer, I want to be reminded of my "Workout" habit when I arrive at the gym, so that I do not forget to log it.

#### 3.3 Detailed Description

Location-Based Reminders use geofencing to trigger habit reminders when the user arrives at or departs from a specified location. Users can associate a location with a habit and choose whether to trigger on arrival, departure, or both. The reminder appears as a local notification.

Locations are stored as latitude/longitude coordinates with a radius (default 100 meters) and a user-given name (e.g., "Home," "Gym," "Office"). Users can set locations by dropping a pin on a map, searching for an address, or using "Current Location."

**Privacy note:** Location data is stored locally. No location data is transmitted to any server. The app uses the device's geofencing API, which processes location events on-device.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management

**External Dependencies:**
- Location permissions (always-on for geofencing)
- iOS: Core Location region monitoring
- Android: Geofencing API
- Map display: expo-location and react-native-maps

#### 3.5 User Interface Requirements

##### Component: Location Picker (on Add/Edit Habit screen)

**Layout:**
- "Location reminder" toggle
- If enabled:
  - Map view with search bar and "Use current location" button
  - Draggable pin to set location
  - Radius slider (50-500 meters, default 100)
  - Location name text input
  - Trigger: "On arrival" / "On departure" / "Both" segmented control

#### 3.6 Data Requirements

**Habit-level settings stored in hb_settings:**

| Key Pattern | Type | Description |
|------------|------|-------------|
| `location_{habitId}_enabled` | boolean | Whether location reminder is on |
| `location_{habitId}_lat` | number | Latitude |
| `location_{habitId}_lng` | number | Longitude |
| `location_{habitId}_radius` | integer | Geofence radius in meters (50-500) |
| `location_{habitId}_name` | string | User-given location name |
| `location_{habitId}_trigger` | string | "arrival", "departure", or "both" |

#### 3.7 Business Logic Rules

##### Geofence Registration

**Logic:**

```
1. When location reminder is enabled for a habit:
   a. Register a geofence with the OS (latitude, longitude, radius)
   b. Monitor for entry/exit events based on trigger setting
2. When geofence event fires:
   a. IF the habit has not been completed today THEN
        Show local notification: "Time for [habit name]!"
   b. ELSE do nothing (already completed)
3. Maximum geofences: iOS supports 20, Android supports 100
   a. If limit reached, warn user: "Maximum location reminders reached"
```

**Edge Cases:**
- Location permission denied or downgraded: feature disabled with message
- Device does not support geofencing: toggle hidden
- User in airplane mode: geofencing still works (uses cached location)
- Multiple habits at same location: multiple notifications fire

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Location permission denied | "Location permission required for this feature" | Link to settings |
| Geofence limit reached | "Maximum location reminders reached (20 on iOS)" | User removes another location |
| Map fails to load | Show coordinate input fields as fallback | User enters lat/lng manually |

#### 3.9 Acceptance Criteria

1. **Given** "Workout" has a location reminder set for the gym,
   **When** the user arrives within 100 meters of the gym,
   **Then** a notification "Time for Workout!" appears.

2. **Given** "Workout" was already completed today,
   **When** the user arrives at the gym,
   **Then** no notification is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| registers geofence | lat, lng, radius: 100 | Geofence registered with OS |
| suppresses if completed | habit completed today, enter geofence | No notification |
| validates radius range | radius: 600 | Validation error: max 500 |

---

### HB-022: Siri Shortcuts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-022 |
| **Feature Name** | Siri Shortcuts |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As an iOS user, I want to say "Hey Siri, log my meditation" to complete a habit hands-free.

#### 3.3 Detailed Description

Siri Shortcuts allows users to complete habits via voice commands on iOS. Each habit registers an App Intent (Shortcut) that can be triggered by Siri. Users can customize the Siri phrase for each habit in the Shortcuts app or through the habit's settings.

The feature also supports Shortcuts automation: habits can be completed as part of a Shortcut workflow (e.g., "Good Morning" shortcut that logs multiple habits).

**Platform limitation:** iOS only. On Android, similar functionality could be achieved through Google Assistant Routines in a future update.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-002: Daily Check-In & Completion

**External Dependencies:**
- iOS App Intents framework (via expo-shortcuts or native module)

#### 3.5 User Interface Requirements

##### Component: Siri Shortcut Configuration (on Habit Detail screen)

**Layout:**
- "Add Siri Shortcut" button
- Opens the system Siri phrase recording sheet
- After setup: shows the configured phrase (e.g., "Log my meditation")
- "Remove Siri Shortcut" option

#### 3.6 Data Requirements

No additional data storage needed. Siri shortcuts are managed by the OS through the App Intents framework.

#### 3.7 Business Logic Rules

##### Voice Completion

**Logic:**

```
1. User invokes Siri and says configured phrase
2. App Intent fires in the background
3. Record a completion for the associated habit
4. Siri confirms: "Done. [Habit name] logged."
5. If the habit is already completed today: "Already done for today."
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Siri not available | Feature not shown | N/A |
| Habit deleted but shortcut exists | Siri: "This habit no longer exists." | User removes orphaned shortcut |

#### 3.9 Acceptance Criteria

1. **Given** a Siri shortcut configured for "Log my meditation,"
   **When** the user says "Hey Siri, log my meditation,"
   **Then** the habit is completed and Siri confirms "Done. Meditation logged."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates completion via intent | habitId from intent | Completion recorded |
| duplicate completion blocked | habit already done | Response: "Already done for today" |

---

### HB-023: Time Tracking with Billable Hours

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-023 |
| **Feature Name** | Time Tracking with Billable Hours |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a freelancer, I want to track time spent on projects and generate simple invoices, so that I can bill clients without paying $108/year for Toggl.

#### 3.3 Detailed Description

Time Tracking extends the existing timed session feature with project-based time tracking, hourly rates, and simple invoice generation. Users create "project habits" (timed habits with a project name and hourly rate), track time against them, and generate PDF or CSV time reports for billing.

This is a lightweight alternative to Toggl ($108/user/yr) for freelancers and independent workers who need basic time tracking without team features, cloud sync, or enterprise reporting.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-004: Timed Sessions - time tracking builds on the session infrastructure

#### 3.5 User Interface Requirements

##### Component: Project Configuration (on Add/Edit Habit, when type = timed)

**Layout:**
- "Track as project" toggle
- If enabled:
  - Project name: text input
  - Client name: text input (optional)
  - Hourly rate: currency input (e.g., "$75.00")
  - Currency: selector (USD, EUR, GBP, etc.)

##### Screen: Time Reports

**Layout:**
- Date range selector (this week, this month, custom range)
- List of projects with total hours and billable amount
- Expandable: individual sessions under each project
- "Generate Report" button: creates CSV or formatted text report
- Summary: total hours, total billable amount

#### 3.6 Data Requirements

**Project settings stored in hb_settings:**

| Key Pattern | Type | Description |
|------------|------|-------------|
| `project_{habitId}_name` | string | Project name |
| `project_{habitId}_client` | string or null | Client name |
| `project_{habitId}_hourly_rate` | number | Hourly rate in currency |
| `project_{habitId}_currency` | string | Currency code |

#### 3.7 Business Logic Rules

##### Billable Amount Calculation

**Formulas:**
- `totalHours = sum(session.durationSeconds) / 3600`
- `billableAmount = totalHours * hourlyRate`
- Round to 2 decimal places for currency display

**Edge Cases:**
- Hourly rate of 0: time tracked but billable amount shows $0.00
- Very short sessions (< 1 minute): included in total, rounds to nearest minute in reports
- Session spans midnight: attributed to the day it started

##### Report Generation

**Logic:**

```
1. Query all sessions for the date range, grouped by project
2. For each project:
   a. Sum session durations
   b. Calculate billable amount
   c. List individual sessions with date, start time, duration
3. Format as CSV or formatted text
4. Include summary totals at the bottom
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No sessions in date range | "No time tracked in this period" | User adjusts date range |
| Report generation fails | Toast: "Could not generate report" | User retries |

#### 3.9 Acceptance Criteria

1. **Given** a project "Website Redesign" with hourly rate $75,
   **When** the user tracks 3 sessions totaling 4.5 hours this week,
   **Then** the Time Reports screen shows "4.5 hours - $337.50."

2. **Given** the user generates a CSV report for March,
   **Then** the CSV contains one row per session with date, duration, and billable amount, plus a summary row.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| billable calculation | 4.5 hours at $75/hr | $337.50 |
| zero rate | 4.5 hours at $0/hr | $0.00 |
| report generation | 3 sessions in range | CSV with 3 data rows + header + summary |

---

### HB-024: Calendar & Tasks Unified View

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-024 |
| **Feature Name** | Calendar & Tasks Unified View |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who plans my day, I want to see my habits alongside my calendar events, so that I can schedule habits around meetings and appointments.

#### 3.3 Detailed Description

The Calendar & Tasks Unified View overlays habits with calendar events from the device's native calendar. This gives users a single view of their day, showing when habits are scheduled between meetings, appointments, and other events. The view is read-only for calendar events (managed in the native calendar app) and interactive for habits (completable from this view).

This feature is inspired by Sorted3 ($15) which popularizes the "hyper-schedule" concept of seeing tasks and events together.

**Privacy note:** Calendar data is read from the device's native calendar via EventKit (iOS) or Calendar Provider (Android). Calendar events are displayed in the app but never stored in the habits database. The app requires calendar read permission, which can be revoked at any time.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management

**External Dependencies:**
- Calendar read permission (iOS EventKit, Android Calendar Provider)
- expo-calendar library

#### 3.5 User Interface Requirements

##### Screen: Day Planner

**Layout:**
- Timeline view showing hours of the day (7 AM to 11 PM by default)
- Calendar events rendered as colored blocks at their scheduled times
- Habits rendered as floating cards that can be dragged to a time slot
  - Habits with timeOfDay = "morning" default to the 7-9 AM zone
  - Habits with timeOfDay = "evening" default to the 7-9 PM zone
  - Habits with timeOfDay = "anytime" appear in an "Unscheduled" section
- Completable: tapping a habit's checkbox marks it done (same as Today screen)
- Date navigation: swipe left/right to move between days

#### 3.6 Data Requirements

No additional storage needed. Calendar events are read from the OS in real-time. Habit time placements are transient (not saved between sessions in MVP).

#### 3.7 Business Logic Rules

##### Calendar Event Fetching

**Logic:**

```
1. On screen load, query device calendar for events on the displayed date
2. Render events as non-interactive blocks in the timeline
3. Render habits as interactive cards with checkboxes
4. Calendar events and habits do not interact with each other (no conflict detection in MVP)
```

**Edge Cases:**
- Calendar permission denied: show only habits, with message "Grant calendar access to see your events alongside habits"
- All-day events: shown in a header bar above the timeline
- Overlapping events: stacked horizontally
- No events on this day: only habits are shown

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Calendar permission denied | "Grant calendar access to see your events" | Link to settings |
| Calendar query fails | Show habits only, no error shown | Silent fallback |

#### 3.9 Acceptance Criteria

1. **Given** the user has a "Team standup" event at 9 AM and a "Morning meditation" habit,
   **When** viewing the Day Planner,
   **Then** both the event block and habit card are visible, with the event at 9 AM and the habit in the morning zone.

2. **Given** calendar permission is denied,
   **When** viewing the Day Planner,
   **Then** only habits are shown with a prompt to grant calendar access.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| fetches events for date | date: March 6 | Array of calendar events for that date |
| handles permission denied | calendar access denied | Empty events array, habits still shown |
| places morning habits | habit with timeOfDay: "morning" | Positioned in 7-9 AM zone |

---

### HB-025: Challenges & Programs

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-025 |
| **Feature Name** | Challenges & Programs |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who wants structured guidance, I want to join a "30 Days of Meditation" challenge with daily targets that increase over time, so that I build the habit progressively.

#### 3.3 Detailed Description

Challenges & Programs provides structured multi-week programs that guide users through progressive habit building. Each program defines a sequence of daily targets over a fixed duration (e.g., 7 days, 21 days, 30 days, 60 days). Targets can increase over time (e.g., "Meditate: Day 1 = 2 min, Day 15 = 10 min, Day 30 = 20 min") to help users build habits gradually.

Programs can be built-in (shipped with the app) or user-created. Built-in programs cover common habit-building journeys.

**Built-in Programs:**
1. "30 Days of Meditation" (2 min to 20 min progressive)
2. "Couch to 5K" (walk/run intervals over 9 weeks)
3. "Morning Routine Builder" (start with 1 habit, add 1 per week for 4 weeks)
4. "30-Day No Sugar Challenge" (negative habit with daily tips)
5. "Daily Reading Habit" (5 pages to 30 pages over 30 days)
6. "Hydration Challenge" (6 glasses to 10 glasses over 14 days)
7. "Digital Detox" (reduce screen time targets over 21 days)
8. "Gratitude Practice" (write 1 to 5 things over 30 days)

When a user joins a program, a habit is created (or linked) and the daily target automatically adjusts according to the program schedule. Progress is tracked with a program-specific progress bar and day counter.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management
- HB-002: Daily Check-In & Completion

#### 3.5 User Interface Requirements

##### Screen: Programs Browser

**Layout:**
- List of available programs, each showing:
  - Program name and icon
  - Duration (e.g., "30 days")
  - Brief description
  - Difficulty indicator (Beginner, Intermediate, Advanced)
- "Create Custom Program" button at the bottom
- Active programs section at the top showing enrolled programs with progress bars

##### Screen: Program Detail

**Layout:**
- Program name, description, and duration
- Day-by-day schedule showing targets (scrollable calendar strip)
- Progress bar: "Day X of Y"
- Current day highlighted with today's target
- "Join Program" button (or "Leave Program" if enrolled)
- Completed days marked with checkmarks

##### Modal: Create Custom Program

**Layout:**
- Program name
- Duration: stepper (7-90 days)
- Linked habit: select existing habit or create new one
- Target schedule: define targets for key days (interpolated for days in between)
  - Day 1 target, Day 7 target, Day 14 target, Day 30 target, etc.
- Description (optional)
- Save button

#### 3.6 Data Requirements

##### Entity: Program

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, max 100 chars | None | Program name |
| description | string or null | Max 500 chars | null | Program description |
| durationDays | integer | Min: 7, Max: 90 | 30 | Total program length in days |
| schedule | string | JSON array of daily targets | None | Daily target values serialized as JSON |
| difficulty | enum | One of: beginner, intermediate, advanced | 'beginner' | Difficulty label |
| isBuiltIn | boolean | - | false | Whether this is a built-in program |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

##### Entity: ProgramEnrollment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| programId | string | FK to Program.id | None | Which program |
| habitId | string | FK to Habit.id | None | Linked habit |
| startDate | string | ISO date | Today | When the user started the program |
| currentDay | integer | Min: 1 | 1 | Current day in the program |
| status | enum | One of: active, completed, abandoned | 'active' | Enrollment status |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

**Note:** Requires new `hb_programs` and `hb_program_enrollments` tables in a V3 migration.

#### 3.7 Business Logic Rules

##### Daily Target Resolution

**Purpose:** Determine today's target for an enrolled program.

**Logic:**

```
1. Get the enrollment and its program
2. currentDay = daysBetween(enrollment.startDate, today) + 1
3. IF currentDay > program.durationDays THEN program is complete
4. ELSE look up schedule[currentDay - 1] for today's target
5. Set the linked habit's targetCount to today's target value
6. RETURN today's target
```

##### Target Interpolation

**Purpose:** For custom programs, interpolate daily targets between defined keyframes.

**Logic:**

```
1. User defines targets for key days (e.g., Day 1: 2, Day 15: 10, Day 30: 20)
2. For days between keyframes, linearly interpolate:
   target = startValue + (endValue - startValue) * (currentDay - startDay) / (endDay - startDay)
3. Round to nearest integer
```

**Edge Cases:**
- User misses a day: program day does not advance (based on calendar, not completions)
- User completes ahead of schedule: day counter does not skip ahead
- Program abandoned: status set to "abandoned," habit continues as normal
- Multiple active programs: each has its own enrollment, a single habit can only be in one program at a time

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Program join fails | Toast: "Could not join program. Please try again." | User retries |
| Linked habit deleted | Program shows "Habit deleted. Create a new habit to continue." | User creates new habit and re-links |

#### 3.9 Acceptance Criteria

1. **Given** the user joins "30 Days of Meditation" on March 1,
   **When** viewing Day 1 (March 1),
   **Then** the target is 2 minutes of meditation.

2. **Given** the user is on Day 15 of the program,
   **When** viewing today's target,
   **Then** the target is 10 minutes (linearly interpolated from the schedule).

3. **Given** the user completes all 30 days,
   **When** Day 31 arrives,
   **Then** the program shows "Completed!" with a celebration and the enrollment status changes to "completed."

4. **Given** the user creates a custom program with Day 1 = 5, Day 30 = 30,
   **When** viewing Day 15,
   **Then** the interpolated target is approximately 17 (linear interpolation).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| resolves Day 1 target | program schedule, day 1 | target from schedule[0] |
| resolves Day 30 target | program schedule, day 30 | target from schedule[29] |
| interpolates correctly | keyframes: (1,5), (30,30), day 15 | approximately 17 |
| program completion | day 31 of 30-day program | status: "completed" |
| enrollment creation | programId, habitId | Enrollment record created |

---

### HB-026: Habit Sharing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-026 |
| **Feature Name** | Habit Sharing |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user with a good habit routine, I want to share my habit templates with friends, so that they can adopt my habits without setting them up from scratch.

#### 3.3 Detailed Description

Habit Sharing allows users to export a habit as a shareable template and import templates shared by others. A template includes the habit's name, description, icon, color, frequency, target count, unit, and type - but never any personal completion data, streaks, or statistics.

Sharing is done via a generated link or QR code that encodes the habit template. The recipient scans the QR code or opens the link, which deep-links into MyHabits and pre-fills the Add Habit form. The recipient can modify any fields before saving.

**Privacy note:** Sharing exports only the habit definition, never personal data. No tracking of who shares or receives templates. No social graph, no follower system.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management

#### 3.5 User Interface Requirements

##### Component: Share Button (on Habit Detail screen)

**Layout:**
- "Share Template" button
- Opens share sheet with options:
  - Copy link (mylife://habits/template/[encoded])
  - Show QR code (modal with QR code image)
  - Share via system share sheet

##### Component: Import Template

**Layout:**
- When a template link is opened or QR code scanned:
  - Opens Add Habit screen pre-filled with the template data
  - User can modify any fields
  - "Save as New Habit" button

#### 3.6 Data Requirements

Templates are encoded as URL-safe base64 JSON containing:

```json
{
  "v": 1,
  "name": "Morning Meditation",
  "description": "10 minutes of guided meditation",
  "icon": "🧘",
  "color": "#8B5CF6",
  "frequency": "daily",
  "targetCount": 1,
  "habitType": "timed",
  "timeOfDay": "morning"
}
```

No template data is stored in the database. Templates are transient encoding/decoding operations.

#### 3.7 Business Logic Rules

##### Template Encoding

**Logic:**

```
1. Extract habit definition fields (exclude id, createdAt, updatedAt, isArchived, sortOrder)
2. Add version field (v: 1) for forward compatibility
3. Serialize as JSON
4. Encode as URL-safe base64
5. Construct deep link: mylife://habits/template/{base64}
```

##### Template Decoding

**Logic:**

```
1. Extract base64 from deep link
2. Decode base64 to JSON
3. Validate against HabitSchema (ignore unknown fields for forward compat)
4. Pre-fill Add Habit form with decoded values
5. User saves as a new habit (new ID generated)
```

**Edge Cases:**
- Malformed template link: show "Invalid template" error
- Template version higher than supported: attempt to parse known fields, ignore unknown
- Template with invalid data: validation catches, shows error inline

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid template link | Toast: "Invalid habit template" | N/A |
| QR code scan fails | "Could not read QR code. Try again." | User retries |

#### 3.9 Acceptance Criteria

1. **Given** a habit "Morning Meditation,"
   **When** the user taps "Share Template" and copies the link,
   **Then** the link contains an encoded template with the habit's name, icon, color, frequency, and type (but no personal data).

2. **Given** a friend receives and opens the template link,
   **When** the link opens in MyHabits,
   **Then** the Add Habit form is pre-filled with "Morning Meditation" and all template fields.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| encodes template correctly | habit definition | Valid base64 URL |
| decodes template correctly | encoded base64 | Habit definition fields |
| rejects malformed template | invalid base64 | Error: "Invalid template" |
| strips personal data | habit with completions | Template has no completions, no id |

---

### HB-027: Smart Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-027 |
| **Feature Name** | Smart Reminders |
| **Priority** | P2 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who forgets habits, I want the app to learn the best time to remind me based on when I usually complete each habit, so that reminders arrive when I am most likely to act on them.

#### 3.3 Detailed Description

Smart Reminders analyzes completion timestamps to determine the optimal reminder time for each habit. Instead of the user setting a fixed reminder time, the system observes when the user typically completes the habit and sets the reminder for slightly before that time.

For example, if a user consistently completes "Meditate" between 7:00 and 7:30 AM, the smart reminder fires at 6:50 AM. If the user's completion pattern shifts over time, the reminder time adjusts automatically.

The algorithm requires at least 7 completions with timestamp data before generating a smart reminder. Until then, the user's manually set reminder time (if any) is used.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-002: Daily Check-In & Completion - needs timestamp data
- HB-007: Habit Statistics - uses time-of-day analysis

**External Dependencies:**
- Local notification permission

#### 3.5 User Interface Requirements

##### Component: Smart Reminder Toggle (on Habit Edit screen)

**Layout:**
- "Smart reminder" toggle (appears below the manual reminder time picker)
- When enabled: replaces the manual time picker with "Reminder at ~7:00 AM (learned from your pattern)"
- When insufficient data: "Learning your pattern (need X more completions)"

#### 3.6 Data Requirements

No additional storage. Smart reminder times are computed from existing completion timestamps and cached in `hb_settings`.

| Key Pattern | Type | Description |
|------------|------|-------------|
| `smart_reminder_{habitId}_time` | string | Computed optimal reminder time (HH:MM) |
| `smart_reminder_{habitId}_enabled` | boolean | Whether smart reminder is active |

#### 3.7 Business Logic Rules

##### Optimal Time Calculation

**Purpose:** Determine the best reminder time based on completion history.

**Logic:**

```
1. Query completion timestamps for habitId (last 30 days)
2. IF fewer than 7 completions THEN RETURN null (insufficient data)
3. Extract hour and minute from each completion timestamp
4. Compute the median completion time
5. Subtract 10 minutes (remind before typical completion)
6. RETURN computed reminder time
7. Recalculate weekly to adapt to changing patterns
```

**Edge Cases:**
- Completions span wide time range (e.g., some at 7 AM, some at 10 PM): use the mode (most frequent hour cluster) instead of median
- Weekend vs weekday patterns differ: use the pattern for the current day type (future enhancement, not in MVP)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient data | "Learning your pattern (need X more completions)" | Wait for more data |
| Notification permission denied | "Enable notifications to use smart reminders" | Link to settings |

#### 3.9 Acceptance Criteria

1. **Given** a habit with 15 completions mostly between 7:00-7:30 AM,
   **When** smart reminder is enabled,
   **Then** the reminder fires at approximately 6:50 AM.

2. **Given** a habit with only 3 completions,
   **When** smart reminder is toggled on,
   **Then** the message "Learning your pattern (need 4 more completions)" appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes median time | 10 completions at 7:00-7:30 | ~7:15 median, reminder at 7:05 |
| returns null with few data | 3 completions | null |
| handles wide time spread | 5 at 7 AM, 5 at 10 PM | uses mode (7 AM cluster) |

---

### HB-028: Action Lists (Sub-Tasks)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-028 |
| **Feature Name** | Action Lists (Sub-Tasks) |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user with multi-step habits, I want to break a habit into sub-tasks like "Morning Routine: brush teeth, stretch, journal," so that I can track each step individually.

#### 3.3 Detailed Description

Action Lists allow habits to contain ordered sub-tasks. Each sub-task is a simple text item with a checkbox. The parent habit is considered complete when all sub-tasks are checked off (or when a configurable threshold is met, e.g., "3 of 5 sub-tasks").

Sub-tasks provide structure for complex habits like "Morning Routine" or "Workout" that consist of multiple discrete steps. They also work well for habits that involve a checklist (e.g., "Daily Review: check email, review calendar, update todo list").

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management

#### 3.5 User Interface Requirements

##### Component: Sub-Task List (on Today screen, expanded view)

**Layout:**
- Parent habit row with a disclosure triangle
- Tapping the triangle expands to show sub-tasks
- Each sub-task: checkbox + text label
- Sub-task checkboxes are smaller than the parent habit checkbox
- When all sub-tasks are checked, the parent habit auto-completes
- "Add sub-task" inline text field at the bottom of the expanded list

##### Component: Sub-Task Editor (on Add/Edit Habit screen)

**Layout:**
- "Sub-tasks" section below the main habit fields
- Ordered list of sub-task text inputs
- Drag handles for reordering
- Delete button per sub-task
- "Add sub-task" button
- "Complete when" selector: "All sub-tasks" or "X of Y sub-tasks"

#### 3.6 Data Requirements

##### Entity: SubTask

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| habitId | string | FK to Habit.id, required | None | Parent habit |
| title | string | Required, max 200 chars | None | Sub-task label |
| sortOrder | integer | Min: 0 | 0 | Display order |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

##### Entity: SubTaskCompletion

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| subTaskId | string | FK to SubTask.id, required | None | Which sub-task |
| completedDate | string | ISO date (YYYY-MM-DD), required | None | Date completed |
| createdAt | datetime | Auto-set | Current timestamp | Record creation time |

**Unique constraint:** (subTaskId, completedDate) - one completion per sub-task per day.

**Note:** Requires new `hb_subtasks` and `hb_subtask_completions` tables in a V3 migration.

#### 3.7 Business Logic Rules

##### Parent Habit Auto-Complete

**Logic:**

```
1. When a sub-task checkbox is toggled:
2. Count completed sub-tasks for this habit on today's date
3. Count total sub-tasks for this habit
4. IF completionMode = "all" AND completedCount = totalCount THEN
     Auto-complete the parent habit
5. ELSE IF completionMode = "threshold" AND completedCount >= threshold THEN
     Auto-complete the parent habit
6. IF parent was auto-completed and a sub-task is unchecked causing count < requirement THEN
     Un-complete the parent habit
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Sub-task save fails | Toast: "Could not save sub-task" | User retries |
| Empty sub-task title | Inline validation: "Sub-task title is required" | User fills in title |

#### 3.9 Acceptance Criteria

1. **Given** "Morning Routine" has sub-tasks "Brush teeth," "Stretch," "Journal,"
   **When** all 3 sub-tasks are checked,
   **Then** the parent habit "Morning Routine" auto-completes.

2. **Given** a habit with 5 sub-tasks and threshold of 3,
   **When** 3 sub-tasks are checked,
   **Then** the parent habit auto-completes.

3. **Given** a parent habit was auto-completed by sub-tasks,
   **When** one sub-task is unchecked (dropping below threshold),
   **Then** the parent habit is un-completed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| auto-complete all mode | 3/3 sub-tasks done | Parent completed |
| threshold mode | 3/5 done, threshold: 3 | Parent completed |
| below threshold | 2/5 done, threshold: 3 | Parent not completed |
| un-complete on unchecked | drop from 3 to 2, threshold: 3 | Parent un-completed |

---

### HB-029: Data Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-029 |
| **Feature Name** | Data Import |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user switching from another habit tracker, I want to import my habit history from a CSV file, so that I do not lose my streak data when migrating.

#### 3.3 Detailed Description

Data Import allows users to bring their habit data from other trackers into MyHabits. The primary import format is CSV, with support for the MyHabits export format and generic CSV files with mapped columns.

The import process:
1. User selects a CSV file from the device
2. The app parses the CSV and displays a preview of detected habits and completions
3. The user maps CSV columns to MyHabits fields (if the format is not auto-detected)
4. The user reviews the import summary (X habits, Y completions)
5. The user confirms the import
6. Data is imported within a database transaction (all-or-nothing)

Supported import sources (auto-detected by CSV structure):
- MyHabits export format (exact match)
- Habitify export
- Loop Habit Tracker export
- Generic CSV with column mapping

#### 3.4 Prerequisites

**Feature Dependencies:**
- HB-001: Habit Creation & Management

**External Dependencies:**
- File picker to select CSV file from device storage

#### 3.5 User Interface Requirements

##### Screen: Import Data (within Settings)

**Layout:**
- "Import Data" button opens file picker
- After file selection:
  - Source detection: "Detected: MyHabits export" or "Unknown format - map columns"
  - Preview table: first 5 rows of data
  - Column mapping (if unknown format): dropdown per column to map to MyHabits fields
  - Import summary: "X habits and Y completions will be imported"
  - "Import" button with warning: "This will add data to your existing habits. Existing data is not modified."
  - "Cancel" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Selecting File | File picker open | System file browser |
| Parsing | CSV being parsed | Spinner: "Reading file..." |
| Preview | Data parsed successfully | Preview table with column mapping |
| Importing | Import in progress | Progress bar: "Importing X/Y..." |
| Complete | Import finished | Summary: "Successfully imported X habits and Y completions" |
| Error | Parse or import failed | Error details with "Try Again" button |

#### 3.6 Data Requirements

No new entities. Import creates Habit and Completion records using existing tables.

#### 3.7 Business Logic Rules

##### CSV Parsing and Validation

**Logic:**

```
1. Read CSV file as text
2. Detect delimiter (comma, semicolon, tab)
3. Parse header row and data rows
4. Attempt auto-detection of source format:
   a. IF headers match MyHabits export format THEN source = "myhabits"
   b. ELSE IF headers match Habitify format THEN source = "habitify"
   c. ELSE IF headers match Loop format THEN source = "loop"
   d. ELSE source = "unknown" (prompt user for column mapping)
5. Validate data:
   a. Required fields present (habit name for habits, date for completions)
   b. Date formats parseable
   c. No duplicate habit names (warn but allow)
6. Generate import preview
```

##### Import Transaction

**Logic:**

```
1. BEGIN TRANSACTION
2. FOR each habit in import data:
   a. Check if habit with same name already exists
   b. IF exists: merge completions into existing habit
   c. ELSE: create new habit with generated ID
3. FOR each completion in import data:
   a. Check for duplicate (same habitId + date)
   b. IF duplicate: skip (do not overwrite)
   c. ELSE: insert completion
4. COMMIT TRANSACTION
5. IF any step fails: ROLLBACK entire import
```

**Edge Cases:**
- Empty CSV file: show "No data found in file"
- Malformed CSV (unbalanced quotes): show "File format error on row X"
- Very large file (10,000+ rows): process in batches of 500, show progress bar
- Duplicate habit names: merge completions into existing habit, warn user
- Date format ambiguity (MM/DD vs DD/MM): ask user to confirm format

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File is not CSV | "Unsupported file format. Please select a CSV file." | User selects correct file |
| Malformed CSV | "Error reading file at row X: [reason]" | User fixes CSV and re-imports |
| Import fails mid-transaction | "Import failed. No data was changed." (transaction rolled back) | User fixes data and retries |
| Duplicate data detected | "X duplicate completions were skipped" (in summary) | N/A, expected behavior |

#### 3.9 Acceptance Criteria

1. **Given** a MyHabits export CSV with 5 habits and 100 completions,
   **When** the user imports the file,
   **Then** all 5 habits and 100 completions are imported and appear in the app.

2. **Given** a CSV from Habitify,
   **When** the file is selected,
   **Then** the auto-detection shows "Detected: Habitify export" and maps columns automatically.

3. **Given** an import fails at row 50,
   **When** the transaction is rolled back,
   **Then** no data is changed and the user sees "Import failed. No data was changed."

4. **Given** the user imports a habit named "Meditate" that already exists,
   **When** the import runs,
   **Then** completions are merged into the existing "Meditate" habit and the user is warned.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses MyHabits CSV | valid export CSV | Correct habits and completions |
| detects Habitify format | Habitify CSV headers | source: "habitify" |
| handles empty file | empty CSV | Error: "No data found" |
| rolls back on error | CSV with invalid row | No data imported |
| skips duplicates | completion for existing date | Duplicate skipped, count reported |

---

### HB-030: Settings & Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HB-030 |
| **Feature Name** | Settings & Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user, I want to configure app preferences like week start day and gamification toggle, so that the app works the way I prefer.

#### 3.3 Detailed Description

Settings & Preferences provides a central configuration screen where users can customize app behavior and manage their data. Settings are stored in the `hb_settings` key-value table.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- **General Section:**
  - Week starts on: Monday / Sunday toggle
  - RPG Mode: toggle (enables/disables gamification, XP, levels)
  - Pet companion: toggle (shows/hides pet on Today screen)
  - Smart reminders: toggle (enables/disables learning-based reminders)
- **Data Section:**
  - Export all data (CSV)
  - Import data
  - Manage archived habits
  - Wipe all data (destructive, with confirmation)
- **Cycle Tracking Section (if enabled):**
  - Show fertility predictions: toggle
  - Cycle tracking disclaimer
- **About Section:**
  - App version
  - Privacy policy link
  - Licenses

#### 3.6 Data Requirements

Settings are stored as key-value pairs in `hb_settings`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| weekStartsOn | string | 'monday' | First day of the week |
| gamificationEnabled | boolean | false | RPG mode toggle |
| petEnabled | boolean | false | Pet companion toggle |
| smartRemindersEnabled | boolean | false | Smart reminders toggle |
| showFertilityPredictions | boolean | true | Show fertility predictions |

#### 3.7 Business Logic Rules

##### Wipe All Data

**Purpose:** Permanently delete all habit data.

**Logic:**

```
1. Show confirmation dialog: "Delete ALL habit data? This includes all habits, completions, sessions, measurements, cycle data, badges, and settings. This cannot be undone."
2. Require user to type "DELETE" to confirm
3. IF confirmed:
   a. DELETE FROM hb_completions
   b. DELETE FROM hb_timed_sessions
   c. DELETE FROM hb_measurements
   d. DELETE FROM cy_symptoms
   e. DELETE FROM cy_predictions
   f. DELETE FROM cy_periods
   g. DELETE FROM cy_settings
   h. DELETE FROM hb_habits
   i. RESET hb_settings to defaults
4. Show: "All data has been deleted."
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Wipe fails | Toast: "Could not delete data. Please try again." | User retries |
| Setting save fails | Toast: "Could not save setting" | User retries |

#### 3.9 Acceptance Criteria

1. **Given** the user changes "Week starts on" to Sunday,
   **When** viewing the heatmap,
   **Then** weeks start on Sunday.

2. **Given** the user types "DELETE" and confirms wipe,
   **When** the wipe completes,
   **Then** all data is gone and the app shows the empty state.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| saves setting | key: weekStartsOn, value: "sunday" | Setting persisted |
| reads setting | key: weekStartsOn | value: "sunday" |
| wipe deletes all data | confirm wipe | All tables empty |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Habit** entity. Each Habit can have many **Completions** (daily check-offs), **TimedSessions** (duration-based tracking), and **Measurements** (numeric values). Habits can optionally belong to a **Category** for organization and be enrolled in a **Program** for structured challenges. Negative habits can have **Cravings** logged against them. **Badges** are earned from streak milestones. **Sub-Tasks** break habits into checklist items. The **Cycle Tracking** subsystem operates semi-independently with **CyclePeriods**, **CycleSymptoms**, and **CyclePredictions**.

### 4.2 Complete Entity Definitions

Entities are fully defined in the individual feature specifications (Section 3) under their respective "Data Requirements" sections. The canonical entities are:

| Entity | Feature | Table | Prefix |
|--------|---------|-------|--------|
| Habit | HB-001 | hb_habits | hb_ |
| Completion | HB-002 | hb_completions | hb_ |
| TimedSession | HB-004 | hb_timed_sessions | hb_ |
| Measurement | HB-005 | hb_measurements | hb_ |
| CyclePeriod | HB-009 | cy_periods | cy_ |
| CycleSymptom | HB-009 | cy_symptoms | cy_ |
| CyclePrediction | HB-010 | cy_predictions | cy_ |
| Settings | HB-030 | hb_settings | hb_ |
| Category | HB-008 | hb_categories | hb_ |
| Craving | HB-014 | hb_cravings | hb_ |
| Badge | HB-015 | hb_badges | hb_ |
| Pledge | HB-016 | hb_pledges | hb_ |
| XPTransaction | HB-017 | hb_xp_transactions | hb_ |
| Program | HB-025 | hb_programs | hb_ |
| ProgramEnrollment | HB-025 | hb_program_enrollments | hb_ |
| SubTask | HB-028 | hb_subtasks | hb_ |
| SubTaskCompletion | HB-028 | hb_subtask_completions | hb_ |
| CycleSettings | HB-009 | cy_settings | cy_ |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Habit -> Completion | one-to-many | A habit has many daily completion records |
| Habit -> TimedSession | one-to-many | A habit has many timed sessions |
| Habit -> Measurement | one-to-many | A habit has many numeric measurements |
| Habit -> Craving | one-to-many | A negative habit has many craving log entries |
| Habit -> Badge | one-to-many | A habit can earn many milestone badges |
| Habit -> Pledge | one-to-many | A negative habit has many daily pledges |
| Habit -> SubTask | one-to-many | A habit can have many sub-tasks |
| Habit -> Category | many-to-one (optional) | A habit optionally belongs to one category |
| Habit -> ProgramEnrollment | one-to-one (optional) | A habit can be enrolled in one program |
| Program -> ProgramEnrollment | one-to-many | A program can have many enrollments |
| CyclePeriod -> CycleSymptom | one-to-many | A period has many symptoms |
| SubTask -> SubTaskCompletion | one-to-many | A sub-task has daily completions |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Habit | hb_habits_archived_idx | is_archived | Filter active vs archived |
| Completion | hb_completions_habit_idx | habit_id | Fast lookup by habit |
| Completion | hb_completions_date_idx | completed_at | Date-range queries |
| TimedSession | hb_timed_sessions_habit_idx | habit_id | Lookup sessions by habit |
| TimedSession | hb_timed_sessions_date_idx | started_at | Date-range queries |
| Measurement | hb_measurements_habit_idx | habit_id | Lookup measurements by habit |
| Measurement | hb_measurements_date_idx | measured_at | Date-range queries |
| CycleSymptom | cy_symptoms_period_idx | period_id | Lookup symptoms by period |
| CycleSymptom | cy_symptoms_date_idx | date | Date-range queries |
| CyclePeriod | cy_periods_date_idx | start_date | Chronological ordering |
| Craving | hb_cravings_habit_idx | habit_id | Lookup cravings by habit |
| Craving | hb_cravings_date_idx | logged_at | Date-range queries |
| Badge | hb_badges_habit_idx | habit_id | Lookup badges by habit |
| Badge | hb_badges_type_idx | badge_type | Check if specific badge earned |

### 4.5 Table Prefix

**MyLife hub table prefix:** `hb_` (habits core) and `cy_` (cycle tracking)

All table names in the SQLite database are prefixed to avoid collisions with other modules in the MyLife hub. Example: the `habits` table is `hb_habits`, the `periods` table is `cy_periods`.

### 4.6 Migration Strategy

- **V1:** Core habits, completions, settings tables with indexes and seed data
- **V2:** Habit type columns (habit_type, time_of_day, specific_days, grace_period, reminder_time), timed sessions, measurements, cycle tracking tables (cy_periods, cy_symptoms, cy_predictions, cy_settings)
- **V3 (planned):** Categories, cravings, badges, pledges, XP transactions, programs, program enrollments, sub-tasks, sub-task completions
- Tables are created on module enable. Schema version is tracked via the module migration system.
- Data from standalone app can be imported via the data importer (HB-029).
- Destructive migrations (column removal) are deferred to major versions only.
- All migrations run within transactions; failure rolls back the entire migration.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Today | check-circle | Today Screen | Daily habit checklist with completion toggles |
| Habits | list | Habits List | All habits (active and archived), management |
| Stats | bar-chart | Statistics | Overall stats, per-habit analytics, achievement badges |
| Settings | settings | Settings | Preferences, data management, about |

### 5.2 Navigation Flow

```
[Tab 1: Today]
  ├── Habit Detail
  │     ├── Edit Habit
  │     ├── Streak Detail
  │     ├── Craving Insights (negative habits)
  │     └── Sobriety Dashboard (sobriety habits)
  ├── Add Habit
  ├── Active Timer (timed habits)
  ├── Focus Timer (Pomodoro)
  ├── Day Planner (calendar + habits)
  └── Pet Detail

[Tab 2: Habits]
  ├── Habit Detail (same as Tab 1)
  ├── Category Manager
  ├── Programs Browser
  │     ├── Program Detail
  │     └── Create Custom Program
  └── Archived Habits

[Tab 3: Stats]
  ├── Heatmap View
  │     └── Habit Detail (tap a per-habit heatmap)
  ├── Achievement Badges Grid
  │     └── Badge Detail
  ├── Time Reports (billable hours)
  └── Cycle Tracker
        ├── Log Period
        ├── Log Symptom
        └── Fertility Predictions

[Tab 4: Settings]
  ├── General Preferences
  ├── RPG Mode Settings
  ├── Export Data
  ├── Import Data
  ├── Manage Archived Habits
  ├── Wipe All Data
  └── About
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Today | `/` (index) | Daily habit checklist | Tab bar, app launch |
| Habit Detail | `/habits/[id]` | Single habit stats, heatmap, actions | Tap habit row on Today or Habits |
| Add Habit | `/habits/add` | Create a new habit | "+" button on Today |
| Edit Habit | `/habits/[id]/edit` | Modify existing habit | Edit button on Habit Detail |
| Habits List | `/habits` | All habits, categories, search | Tab bar |
| Statistics | `/stats` | Overall analytics and charts | Tab bar |
| Heatmap View | `/stats/heatmap` | Full heatmap visualization | Stats tab |
| Achievement Badges | `/stats/badges` | Badge grid | Stats tab |
| Time Reports | `/stats/time-reports` | Billable hours reports | Stats tab |
| Cycle Tracker | `/cycle` | Period logging, predictions | Stats tab |
| Active Timer | `/timer/[id]` | Timed session in progress | Tap play on timed habit |
| Focus Timer | `/focus` | Pomodoro timer | Today screen or habits |
| Day Planner | `/planner` | Calendar + habits view | Today screen |
| Programs Browser | `/programs` | Available programs | Habits tab |
| Program Detail | `/programs/[id]` | Single program info and progress | Programs Browser |
| Pet Detail | `/pet` | Avatar customization | Tap pet on Today |
| Sobriety Dashboard | `/habits/[id]/sobriety` | Sobriety clock, timeline | Negative habit detail |
| Settings | `/settings` | App configuration | Tab bar |
| Import Data | `/settings/import` | CSV import wizard | Settings |
| Export Data | `/settings/export` | Data export | Settings |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://habits/today` | Today Screen | None |
| `mylife://habits/[id]` | Habit Detail | id: UUID of the habit |
| `mylife://habits/add` | Add Habit Screen | None |
| `mylife://habits/template/[base64]` | Add Habit (pre-filled) | Encoded habit template |
| `mylife://habits/focus` | Focus Timer | None |
| `mylife://habits/cycle` | Cycle Tracker | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Health impact tracking | Habits | MyHealth | Habit streak data sent to health correlations | On streak update |
| Medication adherence | MyMeds | Habits | Medication schedules surfaced as trackable habits | On med schedule sync |
| Fasting as habit | MyFast | Habits | Fasting windows appear as habit entries with auto-completion | On fast window complete |
| Reflection journaling | MyJournal | Habits | Journal prompt triggered on habit completion or streak break | On completion or streak break |
| Mood correlation | MyMood | Habits | Mood data correlated with habit completion rates | On mood entry or habit stats view |
| Exercise habits | MyWorkouts | Habits | Logged workouts auto-complete exercise habits | On workout log |
| Nutrition habits | MyNutrition | Habits | Nutrition data (water intake, veggie servings) auto-completes habits | On nutrition log |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Habit definitions | Local SQLite (hb_habits) | At rest (OS-level) | No | Never leaves device |
| Completion history | Local SQLite (hb_completions) | At rest (OS-level) | No | Never leaves device |
| Timed sessions | Local SQLite (hb_timed_sessions) | At rest (OS-level) | No | Never leaves device |
| Measurements | Local SQLite (hb_measurements) | At rest (OS-level) | No | Never leaves device |
| Sobriety data | Local SQLite (hb_settings) | At rest (OS-level) | No | Extremely sensitive, never leaves device |
| Craving logs | Local SQLite (hb_cravings) | At rest (OS-level) | No | Extremely sensitive, never leaves device |
| Cycle/fertility data | Local SQLite (cy_*) | At rest (OS-level) | No | Legally sensitive, never leaves device |
| XP/level data | Local SQLite (hb_settings) | At rest (OS-level) | No | Never leaves device |
| App preferences | Local SQLite (hb_settings) | No | No | Non-sensitive configuration |

### 7.2 Network Activity

This module operates entirely offline. No network requests are made under any circumstances. The only data that could theoretically leave the device is:
- Exported CSV/JSON files (user-initiated, via system share sheet)
- Shared habit templates (user-initiated, contain no personal data)
- Apple Health reads (iOS only, on-device processing, no data transmitted)

### 7.3 Data That Never Leaves the Device

- Habit names and descriptions (may contain sensitive topics)
- Completion history and timestamps (reveals daily routines)
- Sobriety/recovery data (addiction and substance information)
- Craving logs with triggers (deeply personal recovery data)
- Menstrual cycle dates and predictions (legally sensitive)
- Symptom logs and severity (health data)
- Focus/productivity data (work patterns)
- Time tracking and billable hours (financial data)
- XP, levels, and badge data
- Pet/avatar state

### 7.4 User Data Ownership

- **Export:** Users can export all data in CSV format (HB-011)
- **Delete:** Users can delete all module data from Settings with a destructive confirmation requiring typing "DELETE" (HB-030)
- **Portability:** Export format is documented, human-readable CSV with labeled sections
- **Selective delete:** Individual habits can be deleted with all associated data (HB-001)

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Local data only | All data stored in on-device SQLite | No cloud, no sync, no accounts |
| No analytics | Zero analytics, telemetry, or crash reporting SDKs | Verified by dependency audit |
| No network permissions | App manifest declares no network access | iOS/Android verified |
| Backup exclusion | Database excluded from iCloud/Google backup | NSURLIsExcludedFromBackupKey (iOS), allowBackup=false (Android) |
| Sensitive data handling | Sobriety and cycle data stored in the same local DB, no special network exposure | Privacy-by-architecture |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Completion | A record that a habit was fulfilled on a specific date. For standard habits, a completion is binary. For negative habits, a completion with value = -1 represents a slip. |
| Streak | The number of consecutive days (or periods) a habit has been completed without interruption (subject to grace period). |
| Grace Period | The number of days a user can miss a habit before the streak is considered broken. A grace period of 1 means one missed day is tolerated. |
| Slip | For negative habits, a slip is an instance where the user engaged in the behavior they are trying to avoid. Recorded as a completion with value = -1. |
| Negative Habit | A habit tracked by avoidance rather than completion. The user's goal is to NOT do the behavior. Progress is measured in "days clean." |
| Clean Days | For negative habits, the number of days since the last slip (or since habit creation if no slips). |
| Heatmap | A grid visualization showing data intensity over time, inspired by the GitHub contribution graph. Each cell represents one day and is colored by completion count or percentage. |
| Pomodoro | A time management technique using 25-minute focused work sessions separated by short breaks, named after the tomato-shaped kitchen timer used by its inventor, Francesco Cirillo. |
| Craving | An urge to engage in a behavior being tracked as a negative habit. Cravings can be logged with intensity and triggers regardless of whether the user resisted or gave in. |
| Badge | A visual achievement earned by reaching a streak milestone. Once earned, badges are permanent and cannot be lost even if the streak later breaks. |
| XP (Experience Points) | A gamification currency earned by completing habits, maintaining streaks, and hitting milestones. XP accumulates toward character levels. |
| Program | A structured multi-day challenge with daily targets that may increase over time, designed to help users progressively build a new habit. |
| Timed Session | A duration-based habit completion recorded with a start/stop timer. Used for habits like meditation, exercise, and focus work. |
| Measurement | A numeric value logged against a measurable habit (e.g., 8 glasses of water). The habit is considered complete when the measurement meets or exceeds the target. |
| Fertility Window | The estimated period during a menstrual cycle when conception is most likely, typically spanning 5 days before ovulation to 1 day after. |
| Luteal Phase | The phase of the menstrual cycle between ovulation and the start of the next period, typically lasting approximately 14 days. |
| Resist Rate | For craving logs, the percentage of logged cravings where the user successfully resisted the urge. |
| Sobriety Clock | A real-time counter showing days, hours, and minutes since the user quit a substance, with money saved calculations and health recovery timeline. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | MyLife Product Team | Initial specification - 30 features covering existing implementation and planned additions |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should sobriety health milestones include substance-specific disclaimers or a single general disclaimer? | Milestones are based on general population studies and may not apply to all individuals | Single general disclaimer per HB-013 spec | 2026-03-06 |
| 2 | Should the gamification system penalize un-completing habits (subtract XP)? | Could prevent gaming but might discourage honest corrections | No penalty for un-completing - honest data is more important than XP integrity | 2026-03-06 |
| 3 | Should the pet companion be visible when gamification is disabled? | Pet and gamification are conceptually related but serve different purposes | Pet toggle is independent of gamification toggle | 2026-03-06 |
| 4 | What is the maximum number of sub-tasks per habit? | Need to prevent performance issues with very large sub-task lists | Pending - suggest 20 max | - |
| 5 | Should location-based reminders support Wi-Fi SSID detection as an alternative to GPS? | Could be more battery-efficient and work indoors | Pending - consider for v2 | - |
| 6 | Should craving logs support photo attachments? | Could help users document triggers visually | Pending - storage implications | - |
| 7 | What happens to XP earned from a deleted habit? | XP was earned legitimately but the habit no longer exists | Pending - suggest XP is preserved | - |
| 8 | Should programs support habit type "negative" (e.g., "7-Day No Sugar")? | Negative habit programs would need to track absence rather than completion | Pending - worth supporting | - |

