# MyFast - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Team Lead

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyFast
- **Tagline:** "Intermittent fasting timer"
- **Module ID:** `fast`
- **Feature ID Prefix:** FT
- **Table Prefix:** `ft_`
- **Tier:** Free (always unlocked)
- **Accent Color:** #14B8A6 (teal)
- **Icon:** Timer (stopwatch)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Sarah the Starter | 25-35, curious about IF, limited fasting experience, uses iPhone daily | Start a simple 16:8 protocol, see progress, build consistency |
| Mark the Methodical | 30-45, experienced faster, tracks weight and hydration, data-oriented | Track multiple metrics (fasts, weight, water), see trends over weeks/months, hit streak goals |
| Elena the Extended Faster | 35-50, does 24-48hr fasts monthly, wants zone awareness | Monitor fasting zones during extended fasts, log notes about how she feels, export data for doctor visits |
| Dev the Dry Faster | 28-40, practices dry fasting for religious or health reasons, wants timer without hydration pressure | Use fasting timer without water reminders, track religious fasting schedules |

### 1.3 Core Value Proposition

MyFast is a free, privacy-first intermittent fasting timer that replaces paid competitors like Zero ($70/yr). It provides a full-featured fasting tracker with preset protocols, fasting zone visualization, streak tracking, weight logging, water intake monitoring, goal setting, and CSV export. All data stays on-device with zero accounts, zero analytics, and zero network calls. MyFast is the free tier of the MyLife hub, serving as the entry point that demonstrates the suite's value before users upgrade to Pro for additional modules.

### 1.4 Competitive Landscape

| Competitor | Price | Strengths | Weaknesses | Our Differentiator |
|-----------|-------|-----------|------------|-------------------|
| Zero | $70/yr | Research-backed zones, community features, polished UI | Expensive, requires cloud account, stores health data on their servers | Free, fully offline, no account needed, same zone features |
| Yazio | $33/yr | Combined fasting + calorie tracking | Bloated with nutrition features most fasters do not need | Focused on fasting only, no feature creep |
| Fastic | $65/yr | Meal plans, recipes, coaching | Expensive, aggressive upsells, requires subscription for basic features | All core features free, no paywalls on timer or zones |
| WaterMinder | $10/yr | Best-in-class hydration tracking, Apple Watch | Hydration only, no fasting timer | Combined fasting + hydration in one free app |
| Life Fasting | Free | Free tier exists, social circles | Limited analytics, data stored in cloud | Richer stats, fully local storage, no cloud dependency |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full CSV export and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export
- Fasting patterns can reveal health conditions, religious practices, and body image concerns - MyFast treats this data as deeply personal
- HealthKit integration (when enabled) reads/writes only to the user's local Apple Health database - no network calls are made
- Marketing angle: "The best fasting app is free. And it does not sell your health data."

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| FT-001 | Fasting Timer | P0 | Core | None | Implemented |
| FT-002 | Fasting Protocols | P0 | Core | None | Implemented |
| FT-003 | Fasting Zone Visualization | P0 | Core | FT-001 | Implemented |
| FT-004 | Streak Tracking | P0 | Analytics | FT-001 | Implemented |
| FT-005 | Fast History Log | P0 | Data Management | FT-001 | Implemented |
| FT-006 | Weight Tracking | P1 | Data Management | None | Implemented |
| FT-007 | Water Intake Logging | P1 | Data Management | None | Implemented |
| FT-008 | Goal Setting and Progress | P1 | Analytics | FT-001, FT-006 | Implemented |
| FT-009 | Statistics and Charts | P1 | Analytics | FT-001 | Implemented |
| FT-010 | Notification Preferences | P1 | Settings | FT-001 | Implemented |
| FT-011 | CSV Export | P1 | Import/Export | FT-001, FT-006 | Implemented |
| FT-012 | Settings Management | P1 | Settings | None | Implemented |
| FT-013 | Smart Water Reminders | P1 | Core | FT-007, FT-006 | Not Started |
| FT-014 | Multi-Beverage Types | P1 | Data Management | FT-007 | Not Started |
| FT-015 | Custom Container Presets | P2 | Settings | FT-007 | Not Started |
| FT-016 | Caffeine Tracking | P2 | Data Management | FT-014 | Not Started |
| FT-017 | Apple Watch Quick-Log | P1 | Core | FT-001, FT-007 | Not Started |
| FT-018 | HealthKit Integration | P1 | Import/Export | FT-006 | Not Started |
| FT-019 | Fasting Insights and Tips | P2 | Onboarding | FT-003 | Not Started |
| FT-020 | Community Fasting Challenges | P3 | Social | FT-001, FT-004 | Not Started |
| FT-021 | Home Screen Widgets | P2 | Core | FT-001, FT-007, FT-004 | Not Started |
| FT-022 | Fast Editing | P1 | Data Management | FT-005 | Implemented |
| FT-023 | Onboarding Flow | P1 | Onboarding | FT-002 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

---

## 3. Feature Specifications

### FT-001: Fasting Timer

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-001 |
| **Feature Name** | Fasting Timer |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a person interested in intermittent fasting, I want to start and stop a fasting timer, so that I can accurately track how long I have been fasting without manually calculating times.

**Secondary:**
> As a user who closes the app during a fast, I want the timer to continue counting accurately in the background, so that I do not lose my progress when I switch to other apps or lock my phone.

#### 3.3 Detailed Description

The fasting timer is the central feature of MyFast. It displays a large circular progress ring showing elapsed time relative to the target duration, with a digital clock readout in HH:MM:SS format at the center. The timer is timestamp-based, not interval-based: when a fast starts, the current datetime is stored in the database, and elapsed time is always computed as `now - startedAt`. This means the timer remains accurate even if the app is killed, the phone restarts, or the user does not open the app for days.

At most one fast can be active at any time. Starting a new fast while one is already active is not allowed - the user must end or discard the current fast first. When the user starts a fast, a row is inserted into `ft_fasts` and a singleton row is written to `ft_active_fast`. When the fast ends, the `ft_fasts` row is updated with `ended_at`, `duration_seconds`, and `hit_target`, and the `ft_active_fast` row is deleted.

The timer has three states: idle (no active fast), fasting (active fast in progress), and eating_window (post-fast period before the next fast). The progress ring fills from 0% to 100% as elapsed time approaches the target duration. Once the target is reached, the ring stays at 100% and the timer continues counting to show overtime.

Users can optionally backdate a fast start time (e.g., "I started fasting at 8 PM last night but forgot to start the timer"). The timer recomputes elapsed time from the backdated timestamp.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local storage for SQLite database
- System clock for timestamp computation

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Timer Screen (Tab 1)

**Layout:**
- The screen has a top section showing the current fasting protocol name and target duration (e.g., "Lean Gains 16:8 - 16 hours")
- Below that is a large circular progress ring (at least 250px diameter) that fills clockwise from the top
- Inside the ring: the elapsed time in HH:MM:SS format (large, primary text) and below it the remaining time or "+HH:MM overtime" (smaller, secondary text)
- Below the ring is the current fasting zone indicator (see FT-003) showing zone name and a short description
- At the bottom: a large primary action button ("Start Fast" when idle, "End Fast" when fasting)
- Below the primary button: a secondary "Change Protocol" link/button (idle state only)
- When fasting, a small "Discard Fast" text button appears below the End Fast button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | No active fast | Empty ring at 0%, "Start Fast" button, protocol selector visible, streak count badge |
| Fasting (pre-target) | Active fast, elapsed < target | Ring filling, elapsed time counting up, remaining time counting down, "End Fast" button |
| Fasting (target reached) | Active fast, elapsed >= target | Ring at 100%, elapsed time still counting, shows "+HH:MM overtime", celebration animation plays once, "End Fast" button |
| Loading | Computing timer state on app open | Spinner inside ring for up to 500ms while reading active fast from database |

**Interactions:**
- Tap "Start Fast": If idle, inserts new fast row with current timestamp and transitions to fasting state. If a custom start time is set, uses that timestamp instead.
- Tap "End Fast": Shows confirmation dialog "End this fast? Duration: HH:MM:SS". On confirm, updates fast row with ended_at and computed fields, clears active fast, transitions to idle, refreshes streak cache.
- Tap "Discard Fast": Shows destructive confirmation "Discard this fast? This cannot be undone." On confirm, deletes the fast row and active fast row, transitions to idle without updating streak cache.
- Tap "Change Protocol": Opens protocol picker (see FT-002)
- Tap zone indicator: Expands to show all zones with current zone highlighted (see FT-003)
- Long press elapsed time: Opens backdating UI to adjust the start time (see FT-022)

**Transitions/Animations:**
- Progress ring animates smoothly (60fps) as a derived value, not a ticking animation
- On target reached: ring pulses once with a glow effect, optional haptic feedback
- State transitions (idle to fasting, fasting to idle) use a 300ms crossfade

#### 3.6 Data Requirements

##### Entity: Fast

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto (UUID) | Unique identifier for this fasting session |
| protocol | TEXT | Required | None | Protocol ID used for this fast (e.g., "16:8") |
| target_hours | REAL | Required, > 0 | None | Target fasting duration in hours |
| started_at | TEXT | Required, ISO 8601 datetime | None | When the fast began |
| ended_at | TEXT | Nullable, ISO 8601 datetime | null | When the fast ended (null if still active) |
| duration_seconds | INTEGER | Nullable, >= 0 | null | Computed: ended_at - started_at in seconds |
| hit_target | INTEGER | Nullable, 0 or 1 | null | Whether duration_seconds >= target_hours * 3600 |
| notes | TEXT | Nullable, max 2000 chars | null | User notes about this fast |
| created_at | TEXT | Auto-set, ISO 8601 | datetime('now') | Record creation time |

##### Entity: ActiveFast (Singleton)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, always 'current' | 'current' | Singleton key |
| fast_id | TEXT | Required, FK to ft_fasts.id, CASCADE delete | None | The currently active fast |
| protocol | TEXT | Required | None | Denormalized protocol ID for quick access |
| target_hours | REAL | Required, > 0 | None | Denormalized target for quick access |
| started_at | TEXT | Required, ISO 8601 | None | Denormalized start time for quick access |

**Relationships:**
- ActiveFast references Fast via fast_id (one-to-one, cascade delete)
- At most one ActiveFast row exists at any time

**Indexes:**
- `ft_fasts_started_idx` on ft_fasts(started_at) - time-range queries for stats
- `ft_fasts_protocol_idx` on ft_fasts(protocol) - filter by protocol
- `ft_fasts_hit_target_idx` on ft_fasts(hit_target) - streak computation

**Validation Rules:**
- started_at must be a valid ISO 8601 datetime
- started_at must not be in the future (max: current timestamp + 60 seconds to account for clock drift)
- target_hours must be > 0 and <= 168 (7 days max)
- If ended_at is set, it must be after started_at
- A new fast cannot be started if an ActiveFast row already exists

**Example Data:**

```json
{
  "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "protocol": "16:8",
  "target_hours": 16,
  "started_at": "2026-03-05T20:00:00.000Z",
  "ended_at": "2026-03-06T12:15:30.000Z",
  "duration_seconds": 58530,
  "hit_target": 1,
  "notes": "Felt great, no hunger pangs after hour 12",
  "created_at": "2026-03-05T20:00:00.000Z"
}
```

#### 3.7 Business Logic Rules

##### Timer State Machine

**Purpose:** Compute the current display state of the fasting timer from the active fast record and current time.

**Inputs:**
- activeFast: ActiveFast | null - the singleton active fast record
- now: Date - current system time

**Logic:**

```
1. IF activeFast is null THEN
     RETURN { state: 'idle', elapsed: 0, remaining: 0, progress: 0, targetReached: false }
2. elapsed = floor((now - activeFast.startedAt) / 1000) in seconds
3. targetSeconds = activeFast.targetHours * 3600
4. remaining = max(0, targetSeconds - elapsed)
5. progress = elapsed / targetSeconds (0.0 to 1.0, capped at 1.0 for ring display)
6. targetReached = elapsed >= targetSeconds
7. RETURN { state: 'fasting', elapsed, remaining, progress: min(progress, 1.0), targetReached }
```

**Formulas:**
- `elapsed_seconds = floor((now_ms - started_at_ms) / 1000)`
- `progress = min(1.0, elapsed_seconds / (target_hours * 3600))`
- `remaining_seconds = max(0, (target_hours * 3600) - elapsed_seconds)`

**Edge Cases:**
- App killed and reopened after 3 days: elapsed computes correctly from stored timestamp, no data loss
- System clock changed backward: elapsed may become negative; clamp to 0
- System clock changed forward significantly: elapsed may jump; this is correct behavior since the fast was running
- started_at in the future (backdating error): elapsed is negative, display "Starts in HH:MM"
- Division by zero: if targetSeconds is 0, progress = 0 (should not occur due to validation)

##### State Machine: Fast Lifecycle

| Current State | Trigger | Next State | Side Effects |
|--------------|---------|------------|-------------|
| idle | User taps "Start Fast" | fasting | Insert ft_fasts row, insert ft_active_fast row |
| fasting | User taps "End Fast" + confirms | idle | Update ft_fasts with ended_at/duration/hit_target, delete ft_active_fast, refresh streak cache |
| fasting | User taps "Discard Fast" + confirms | idle | Delete ft_fasts row, delete ft_active_fast row |
| fasting | Target duration reached | fasting (target_reached) | Fire notification if enabled, no database change |

##### Duration Formatting

**Purpose:** Convert seconds to human-readable HH:MM:SS string.

**Inputs:**
- seconds: number - total elapsed seconds

**Logic:**

```
1. h = floor(seconds / 3600)
2. m = floor((seconds % 3600) / 60)
3. s = seconds % 60
4. RETURN h padded to 2 digits + ":" + m padded to 2 digits + ":" + s padded to 2 digits
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on start fast | Toast: "Could not start fast. Please try again." | User taps Start again; transaction is atomic so no partial state |
| Database write fails on end fast | Toast: "Could not save fast. Your fast is still running." | User taps End again; active fast row still exists |
| Active fast row exists but referenced fast row is missing | Auto-cleanup: delete orphaned active fast row, show idle state | Transparent to user; logged for debugging |
| Clock drift > 60 seconds detected | No user-facing message; timer uses stored timestamp regardless | Timer remains accurate since it uses absolute timestamps |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the app is in idle state with protocol set to 16:8,
   **When** the user taps "Start Fast",
   **Then** the timer begins counting from 00:00:00, the progress ring starts filling, the remaining time shows "16:00:00", and the state changes to fasting.

2. **Given** a fast has been running for 16 hours and 5 minutes,
   **When** the user opens the app,
   **Then** the timer shows 16:05:00 elapsed, the ring is at 100%, the display shows "+00:05 overtime", and the target reached celebration has played.

3. **Given** a fast is active,
   **When** the user taps "End Fast" and confirms,
   **Then** the fast is saved with correct duration and hit_target values, the timer returns to idle, and the streak cache is refreshed.

**Edge Cases:**

4. **Given** a fast was started 3 days ago and the app was never opened since,
   **When** the user opens the app,
   **Then** the timer shows approximately 72:00:00 elapsed, computed from the stored start timestamp.

5. **Given** a fast is active,
   **When** the user taps "Start Fast",
   **Then** nothing happens because the button is not visible (End Fast is shown instead).

**Negative Tests:**

6. **Given** no database is available (storage full),
   **When** the user taps "Start Fast",
   **Then** the system shows a toast "Could not start fast. Please try again."
   **And** no partial data is written to the database.

7. **Given** a fast is active,
   **When** the user taps "Discard Fast" and confirms,
   **Then** the fast row is deleted entirely, the active fast is cleared, and no streak data is affected.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computeTimerState returns idle when no active fast | activeFast: null, now: any | { state: 'idle', elapsed: 0, remaining: 0, progress: 0, targetReached: false } |
| computeTimerState computes elapsed correctly | activeFast started 3600s ago, targetHours: 16 | elapsed: 3600, remaining: 53400, progress: 0.0625 |
| computeTimerState caps progress at 1.0 | activeFast started 20h ago, targetHours: 16 | progress: 1.0, targetReached: true |
| computeTimerState handles zero elapsed | activeFast started now, targetHours: 16 | elapsed: 0, remaining: 57600, progress: 0 |
| formatDuration formats single digits with padding | seconds: 3661 | "01:01:01" |
| formatDuration formats zero | seconds: 0 | "00:00:00" |
| formatDuration formats large values | seconds: 360000 (100 hours) | "100:00:00" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Start and end a fast | 1. Start fast with 16:8 protocol, 2. End fast after simulated 16h | Fast row has correct duration_seconds (57600) and hit_target (1) |
| Start fast rejects duplicate | 1. Start fast, 2. Attempt to start another | Second call throws error "A fast is already active" |
| Discard fast cleans up | 1. Start fast, 2. Delete fast by ID | Both ft_fasts and ft_active_fast rows are removed |

---

### FT-002: Fasting Protocols

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-002 |
| **Feature Name** | Fasting Protocols |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user starting intermittent fasting, I want to choose from preset fasting protocols, so that I do not have to research and configure fasting/eating windows myself.

**Secondary:**
> As an experienced faster, I want to create custom protocols with my own fasting/eating hours, so that I can follow a schedule not covered by the presets.

#### 3.3 Detailed Description

Fasting protocols define the fasting-to-eating hour ratio. MyFast ships with 6 preset protocols covering the most popular intermittent fasting schedules, from the beginner-friendly 16:8 to extended 48-hour fasts. Users can also create custom protocols with any fasting/eating hour combination.

The default protocol is 16:8 (Lean Gains). Users can change their default protocol in settings. When starting a new fast, the most recently used protocol is pre-selected, but users can tap "Change Protocol" to pick a different one.

Protocols are stored in the `ft_protocols` table and seeded on first migration. Custom protocols have `is_custom = 1` and can be edited or deleted. Preset protocols cannot be deleted but can be hidden (future feature).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

**External Dependencies:**
- Local SQLite storage

**Assumed Capabilities:**
- Database is initialized with seed data

#### 3.5 User Interface Requirements

##### Modal: Protocol Picker

**Layout:**
- A bottom sheet modal showing a scrollable list of protocols
- Each protocol row shows: protocol name (bold), fasting/eating hour split (e.g., "16h fasting / 8h eating"), and a short description
- The currently selected/default protocol has a checkmark icon
- At the bottom of the list: a "+ Create Custom Protocol" button
- A "Done" button in the top-right corner closes the picker

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | 6 preset protocols loaded | Scrollable list with all presets, default protocol checked |
| With Custom | User has created custom protocols | Custom protocols appear after presets, separated by a divider |
| Empty Customs | No custom protocols exist | Only presets shown, no divider |

**Interactions:**
- Tap a protocol row: Selects it as the active protocol, updates the timer screen header
- Tap "+ Create Custom Protocol": Opens the custom protocol form
- Swipe left on a custom protocol: Reveals "Edit" and "Delete" actions
- Tap "Done": Closes the modal

##### Modal: Custom Protocol Form

**Layout:**
- A form with fields: Name (text input), Fasting Hours (numeric stepper, 1-167), Eating Hours (numeric stepper, 0-23), Description (optional textarea)
- Fasting + Eating hours do not need to equal 24 (extended fasts have 0 eating hours)
- "Save" button at top-right, "Cancel" at top-left

#### 3.6 Data Requirements

##### Entity: Protocol

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Unique ID (preset: "16:8", custom: UUID) |
| name | TEXT | Required, max 50 chars | None | Display name |
| fasting_hours | REAL | Required, 1-168 | None | Hours of fasting |
| eating_hours | REAL | Required, 0-23 | None | Hours of eating window |
| description | TEXT | Nullable, max 200 chars | null | Short explanation |
| is_custom | INTEGER | 0 or 1 | 0 | Whether user-created |
| is_default | INTEGER | 0 or 1 | 0 | Whether this is the default protocol |
| sort_order | INTEGER | >= 0 | 0 | Display order (presets: 1-6, custom: 100+) |

**Preset Protocol Seed Data:**

| ID | Name | Fasting | Eating | Description |
|----|------|---------|--------|-------------|
| 16:8 | Lean Gains (16:8) | 16 | 8 | Fast 16 hours, eat within an 8-hour window. Most popular protocol for beginners. |
| 18:6 | Daily 18:6 | 18 | 6 | Fast 18 hours, eat within a 6-hour window. Moderate intensity. |
| 20:4 | Warrior (20:4) | 20 | 4 | Fast 20 hours, eat within a 4-hour window. One main meal with snacks. |
| 23:1 | OMAD (23:1) | 23 | 1 | One Meal A Day. Fast 23 hours, single eating hour. |
| 36:0 | Alternate Day (36h) | 36 | 0 | Full 36-hour fast. Skip an entire day of eating. |
| 48:0 | Extended (48h) | 48 | 0 | Full 48-hour fast. Two days without eating. |

#### 3.7 Business Logic Rules

##### Protocol Selection

**Purpose:** Determine which protocol to pre-select when the user opens the timer screen.

**Logic:**

```
1. Read 'defaultProtocol' from ft_settings
2. Look up protocol by ID in ft_protocols
3. IF found, use it
4. ELSE fall back to '16:8' preset
```

**Edge Cases:**
- Default protocol was deleted (custom): fall back to 16:8
- No protocols in database (corrupt state): re-seed presets

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Custom protocol name is empty | Inline validation: "Name is required" | User fills in the name |
| Fasting hours set to 0 | Stepper prevents going below 1 | Stepper has min=1 constraint |
| Deleting a custom protocol that is currently default | Toast: "Default protocol reset to 16:8" | System sets default back to 16:8 |

#### 3.9 Acceptance Criteria

1. **Given** a fresh install,
   **When** the user opens the protocol picker,
   **Then** 6 preset protocols are listed in order, with 16:8 checked as default.

2. **Given** the user creates a custom protocol "My Protocol" with 14h fasting / 10h eating,
   **When** the user opens the protocol picker,
   **Then** "My Protocol" appears below the presets with correct hours displayed.

3. **Given** a custom protocol exists,
   **When** the user swipes left and taps Delete,
   **Then** the protocol is removed and cannot be selected for future fasts.

4. **Given** preset protocols exist,
   **When** the user swipes left on a preset,
   **Then** no delete action is available (presets cannot be deleted).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| PRESET_PROTOCOLS has 6 entries | None | length: 6 |
| All presets have is_custom false | None | every preset: isCustom === false |
| Exactly one preset is default | None | filter(isDefault).length === 1, and it is "16:8" |
| Fasting + eating hours are positive | None | every preset: fastingHours > 0, eatingHours >= 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create custom protocol | Insert custom protocol, list protocols | Custom protocol appears in list with is_custom = 1 |
| Delete custom protocol | Insert custom, delete by ID, list protocols | Custom protocol no longer in list |
| Preset protocol cannot be deleted via app | Attempt to delete preset "16:8" | UI does not offer delete action for presets |

---

### FT-003: Fasting Zone Visualization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-003 |
| **Feature Name** | Fasting Zone Visualization |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fasting user, I want to see which metabolic zone I am currently in during my fast, so that I can understand the potential health benefits of continuing to fast longer.

**Secondary:**
> As a user doing an extended fast, I want to see all the zones I have passed through and what zone comes next, so that I feel motivated to keep going.

#### 3.3 Detailed Description

Fasting zone visualization shows the user a progression through 6 metabolic zones based on elapsed fasting time. Each zone has a name, a time range, a title summarizing the metabolic state, and a description providing context. The zones are based on commonly cited research about metabolic changes during fasting, but all language intentionally avoids medical certainty (using "may", "some research suggests", "for some people" phrasing) because individual responses vary significantly.

The zone indicator appears on the timer screen below the progress ring. It shows the current zone name, title, and description. Users can tap the zone indicator to expand a full zone timeline showing all 6 zones, with the current zone highlighted and past zones marked as completed.

Zone transitions are purely time-based. There is no biometric input required. The zone is determined solely by elapsed fasting hours.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer (requires elapsed time to compute current zone)

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Component: Zone Indicator (Compact)

**Layout:**
- A card below the progress ring showing: zone icon (colored circle), zone name (bold), zone title (regular), and a thin progress bar showing progress within the current zone
- Background color subtly tinted to match the zone's color

**Interactions:**
- Tap: Expands to the full zone timeline view

##### Component: Zone Timeline (Expanded)

**Layout:**
- A vertical timeline showing all 6 zones from top (Fed State) to bottom (Autophagy Possible)
- Each zone shows: hour range, zone name, title, description
- Completed zones (elapsed time has passed their range) have a filled circle icon and muted styling
- The current zone has a highlighted/active state with a pulsing indicator
- Future zones have an empty circle icon and lighter text
- The user's current position is marked with a marker on the timeline between zones

#### 3.6 Data Requirements

##### Entity: FastingZone (Static Configuration)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Unique | N/A | Zone identifier (e.g., "fed-state") |
| name | string | Required | N/A | Display name (e.g., "Fed State") |
| startHour | number | >= 0 | N/A | Hour at which this zone begins |
| endHour | number or null | > startHour or null | N/A | Hour at which this zone ends (null = open-ended) |
| title | string | Required | N/A | Metabolic summary (e.g., "Insulin rising") |
| description | string | Required | N/A | Detailed explanation with hedging language |

**Zone Definitions:**

| Zone ID | Name | Hours | Title |
|---------|------|-------|-------|
| fed-state | Fed State | 0-4 | Insulin rising |
| early-fasting | Early Fasting | 4-8 | Insulin dropping |
| fat-burning | Fat Burning | 8-12 | Glucagon activity may increase |
| ketosis-beginning | Ketosis Beginning | 12-18 | Ketone production may rise |
| deep-ketosis | Deep Ketosis | 18-24 | Sustained fasting window |
| autophagy-possible | Autophagy Possible | 24+ | Extended fast territory |

#### 3.7 Business Logic Rules

##### Zone Resolution

**Purpose:** Determine which fasting zone the user is currently in based on elapsed time.

**Inputs:**
- elapsedSeconds: number - seconds since fast started

**Logic:**

```
1. elapsedHours = max(0, elapsedSeconds / 3600)
2. FOR each zone in FASTING_ZONES (ordered by startHour ascending):
     IF zone.endHour is null:
       IF elapsedHours >= zone.startHour THEN RETURN zone
     ELSE:
       IF elapsedHours >= zone.startHour AND elapsedHours < zone.endHour THEN RETURN zone
3. RETURN last zone (autophagy-possible) as fallback
```

##### Zone Progress

**Purpose:** Compute 0-1 progress within the current zone for the intra-zone progress bar.

**Inputs:**
- elapsedSeconds: number

**Logic:**

```
1. zone = getCurrentFastingZone(elapsedSeconds)
2. elapsedHours = max(0, elapsedSeconds / 3600)
3. IF zone.endHour is null THEN RETURN 1.0 (open-ended zone is always "full")
4. span = max(0.1, zone.endHour - zone.startHour)
5. raw = (elapsedHours - zone.startHour) / span
6. RETURN clamp(raw, 0.0, 1.0)
```

**Edge Cases:**
- Elapsed time is 0: returns Fed State zone, progress 0.0
- Elapsed time is exactly on a boundary (e.g., 4.0 hours): returns the next zone (Early Fasting), progress 0.0
- Elapsed time is 100 hours: returns Autophagy Possible zone, progress 1.0
- Negative elapsed time (clock error): clamped to 0, returns Fed State

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Zone data array is empty (should never happen) | Falls back to a generic "Fasting" label | Defensive coding; zones are hardcoded constants |
| Elapsed time is negative | Shows "Fed State" at 0% progress | Clamp input to 0 |

#### 3.9 Acceptance Criteria

1. **Given** a fast has been running for 2 hours,
   **When** the user views the timer screen,
   **Then** the zone indicator shows "Fed State" with title "Insulin rising" and progress at 50%.

2. **Given** a fast has been running for 15 hours,
   **When** the user views the timer screen,
   **Then** the zone indicator shows "Ketosis Beginning" with appropriate title and progress at 50% (3 of 6 hours into the zone).

3. **Given** a fast has been running for 30 hours,
   **When** the user taps the zone indicator,
   **Then** the expanded timeline shows zones 1-5 as completed and zone 6 (Autophagy Possible) as active.

4. **Given** no fast is active (idle state),
   **When** the user views the timer screen,
   **Then** no zone indicator is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| getCurrentFastingZone at 0 seconds | elapsedSeconds: 0 | zone.id: "fed-state" |
| getCurrentFastingZone at 2 hours | elapsedSeconds: 7200 | zone.id: "fed-state" |
| getCurrentFastingZone at 4 hours exactly | elapsedSeconds: 14400 | zone.id: "early-fasting" |
| getCurrentFastingZone at 10 hours | elapsedSeconds: 36000 | zone.id: "fat-burning" |
| getCurrentFastingZone at 15 hours | elapsedSeconds: 54000 | zone.id: "ketosis-beginning" |
| getCurrentFastingZone at 20 hours | elapsedSeconds: 72000 | zone.id: "deep-ketosis" |
| getCurrentFastingZone at 30 hours | elapsedSeconds: 108000 | zone.id: "autophagy-possible" |
| getCurrentZoneProgress at zone midpoint | elapsedSeconds: 7200 (2h, mid fed-state) | 0.5 |
| getCurrentZoneProgress at zone start | elapsedSeconds: 14400 (4h, start early-fasting) | 0.0 |
| getCurrentZoneProgress in open-ended zone | elapsedSeconds: 108000 (30h) | 1.0 |
| getCurrentZoneProgress negative input | elapsedSeconds: -100 | 0.0 (after clamp) |

---

### FT-004: Streak Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-004 |
| **Feature Name** | Streak Tracking |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a regular faster, I want to see my current consecutive fasting streak, so that I feel motivated to maintain my daily fasting habit.

**Secondary:**
> As a competitive self-tracker, I want to see my longest-ever streak, so that I have a personal best to try to beat.

#### 3.3 Detailed Description

Streak tracking counts consecutive days on which the user completed at least one fast that hit its target duration. The "current streak" is the number of consecutive days ending today (or yesterday, to allow for same-day completion) with at least one target-hit fast. The "longest streak" is the all-time maximum consecutive run.

A day is counted by the date of the fast's `started_at` timestamp, not `ended_at`. This means a fast started on Monday at 8 PM that ends Tuesday at 12 PM counts toward Monday's streak, not Tuesday's.

Streaks are cached in the `ft_streak_cache` table for performance. The cache is refreshed whenever a fast is ended or deleted. If the cache is empty (first read), streaks are computed from scratch.

The current streak and total fasts count are displayed on the timer screen as badges. The longest streak is shown on the stats screen.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer (requires completed fasts to compute streaks)

#### 3.5 User Interface Requirements

##### Component: Streak Badge

**Layout:**
- A small badge on the timer screen showing a flame icon and the current streak number (e.g., "7 days")
- Below the badge, a smaller "Best: 14 days" label showing the longest streak
- The badge is only visible when current streak >= 1

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No streak | currentStreak = 0 | Badge hidden or shows "Start your streak!" |
| Active streak | currentStreak >= 1 | Flame icon + "N days" |
| Record streak | currentStreak > longestStreak | Special color/animation on the badge |

#### 3.6 Data Requirements

##### Entity: StreakCache

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | TEXT | Primary key, one of: 'current_streak', 'longest_streak', 'total_fasts' | N/A | Cache key |
| value | INTEGER | >= 0 | N/A | Cached numeric value |
| updated_at | TEXT | Auto-set, ISO 8601 | datetime('now') | When cache was last refreshed |

#### 3.7 Business Logic Rules

##### Streak Computation

**Purpose:** Calculate the current and longest consecutive fasting streaks.

**Inputs:**
- All completed fasts with hit_target = 1 from ft_fasts

**Logic:**

```
1. Query DISTINCT dates (by started_at) of all completed fasts where hit_target = 1, ordered descending
2. Count total completed fasts (all, not just target-hit)
3. IF no target-hit dates exist: RETURN { currentStreak: 0, longestStreak: 0, totalFasts }
4. Convert all dates to day numbers (UTC milliseconds / 86400000)
5. Get today's day number
6. Current streak:
   a. IF most recent fast day is today or yesterday (within 1 day): start counting
   b. Walk backward through sorted day numbers; increment streak for each consecutive day
   c. Break at first gap
7. Longest streak:
   a. Walk all day numbers; track run lengths of consecutive days
   b. Record the maximum run length
8. RETURN { currentStreak, longestStreak, totalFasts }
```

**Edge Cases:**
- User completes a fast at 11:59 PM: counts toward that day's streak
- User has not fasted today but fasted yesterday: current streak still active (grace period of 1 day)
- User has not fasted for 2+ days: current streak resets to 0
- Multiple fasts on the same day: the day counts once (DISTINCT date)
- Fast started on day 1, ended on day 2: counts toward day 1 (by started_at)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Cache table is empty | Compute streaks from scratch, populate cache | Transparent to user |
| Cache is stale (not refreshed after fast ended) | May show outdated streak for up to one session | Cache is refreshed on every fast end/delete |

#### 3.9 Acceptance Criteria

1. **Given** the user has completed target-hitting fasts on 5 consecutive days ending today,
   **When** the streak is computed,
   **Then** currentStreak is 5.

2. **Given** the user fasted on Mon, Tue, Wed, skipped Thu, fasted Fri,
   **When** the streak is computed on Friday,
   **Then** currentStreak is 1 (only Friday), longestStreak is 3 (Mon-Wed).

3. **Given** the user has no completed fasts,
   **When** the streak is computed,
   **Then** currentStreak is 0, longestStreak is 0, totalFasts is 0.

4. **Given** the user completed a fast yesterday but not today,
   **When** the streak is computed,
   **Then** currentStreak still counts (grace period: yesterday counts as active).

5. **Given** the user completed a fast 2 days ago but not yesterday or today,
   **When** the streak is computed,
   **Then** currentStreak is 0.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| No fasts returns zero streaks | empty database | { currentStreak: 0, longestStreak: 0, totalFasts: 0 } |
| Single fast today | 1 fast today, hit_target=1 | currentStreak: 1, longestStreak: 1 |
| Three consecutive days | fasts on day-2, day-1, today | currentStreak: 3, longestStreak: 3 |
| Gap breaks current streak | fasts on day-4, day-3, day-1, today | currentStreak: 2, longestStreak: 2 |
| Yesterday grace period | fast on yesterday only | currentStreak: 1 |
| Two days ago is not current | fast on day-2 only | currentStreak: 0, longestStreak: 1 |
| Multiple fasts same day | 3 fasts on today | currentStreak: 1 (distinct day) |
| Fasts that did not hit target | 5 consecutive days, all hit_target=0 | currentStreak: 0, longestStreak: 0 |

---

### FT-005: Fast History Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-005 |
| **Feature Name** | Fast History Log |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who has been fasting for weeks, I want to scroll through my past fasts, so that I can review my fasting history and see patterns.

**Secondary:**
> As a user who made a mistake, I want to delete a past fast entry, so that my stats accurately reflect my actual fasting history.

#### 3.3 Detailed Description

The fast history log shows all completed fasts in reverse chronological order (newest first). Each entry displays the protocol name, start/end times, total duration, whether the target was hit (checkmark or X icon), and any notes the user added. The list is paginated with infinite scroll, loading 50 fasts per page.

Users can tap a fast entry to view its full details, including the fasting zones traversed during that fast. From the detail view, users can edit the fast's start/end times (see FT-022) or delete it.

The history is displayed on the History tab (Tab 2). A summary bar at the top shows total completed fasts and overall adherence rate.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer (fasts must exist to be listed)

#### 3.5 User Interface Requirements

##### Screen: History Screen (Tab 2)

**Layout:**
- Top summary bar: "N fasts completed" on the left, "N% adherence" on the right
- Below: a scrollable vertical list of completed fast entries
- Each entry shows: date (e.g., "Mar 5, 2026"), protocol name, duration (e.g., "16h 15m"), start/end times (e.g., "8:00 PM - 12:15 PM"), hit target icon (green checkmark or red X), and truncated notes (first line, if any)
- Pagination: loads 50 entries at a time, loads more on scroll-to-bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No completed fasts | Illustration of a clock, text: "No fasts yet", subtitle: "Complete your first fast to see it here" |
| Populated | 1+ completed fasts | Scrollable list with summary bar |
| Loading more | Fetching next page | Spinner at bottom of list |
| All loaded | No more pages | "You have reached the end" text at bottom |

**Interactions:**
- Tap a fast entry: Navigate to Fast Detail screen
- Swipe left on an entry: Reveals "Delete" action (red)
- Pull-to-refresh: Reloads from database

##### Screen: Fast Detail

**Layout:**
- Header: protocol name and date
- Duration section: large text showing total duration, hit target badge
- Times section: start time, end time
- Zone timeline: compact view of all zones, highlighting which ones were traversed
- Notes section: full notes text (editable inline)
- Actions: "Edit Times" button, "Delete Fast" button (red, destructive)

**Interactions:**
- Tap "Edit Times": Opens time editing UI (see FT-022)
- Tap "Delete Fast": Shows confirmation dialog, deletes on confirm, navigates back to history list
- Tap notes area: Enters edit mode for notes, auto-saves on blur

#### 3.6 Data Requirements

Uses the Fast entity defined in FT-001. No additional entities.

**Queries:**
- List: `SELECT * FROM ft_fasts WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ? OFFSET ?`
- Count: `SELECT COUNT(*) FROM ft_fasts WHERE ended_at IS NOT NULL`
- Detail: `SELECT * FROM ft_fasts WHERE id = ?`

#### 3.7 Business Logic Rules

##### Pagination

**Purpose:** Load fasts in pages for performance.

**Inputs:**
- limit: number (default 50)
- offset: number (default 0)

**Logic:**

```
1. Query ft_fasts WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT limit OFFSET offset
2. Map rows to Fast domain objects
3. RETURN array of Fast objects
```

##### Delete Fast

**Purpose:** Remove a fast entry and update dependent caches.

**Logic:**

```
1. Delete from ft_active_fast WHERE fast_id = id (in case it was the active fast)
2. Delete from ft_fasts WHERE id = id
3. Refresh streak cache
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Delete fails | Toast: "Could not delete fast. Please try again." | User retries |
| Fast not found by ID | Navigate back to history list, toast: "Fast not found" | Entry may have been deleted in another session |

#### 3.9 Acceptance Criteria

1. **Given** the user has completed 3 fasts,
   **When** the user navigates to the History tab,
   **Then** all 3 fasts are listed in reverse chronological order with correct details.

2. **Given** the user has completed 75 fasts,
   **When** the user scrolls to the bottom of the history list,
   **Then** the first 50 are loaded initially, and 25 more load on scroll.

3. **Given** the user taps a fast entry,
   **When** the detail screen opens,
   **Then** all fast details are displayed including zone timeline and notes.

4. **Given** the user deletes a fast from the detail screen,
   **When** they return to the history list,
   **Then** the deleted fast is no longer visible and the summary bar total is decremented.

5. **Given** the user has no completed fasts,
   **When** they navigate to the History tab,
   **Then** the empty state illustration and message are displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| listFasts returns newest first | 3 fasts with different start dates | First element has the latest started_at |
| listFasts respects limit | 10 fasts, limit: 5 | Returns exactly 5 fasts |
| listFasts respects offset | 10 fasts, offset: 3, limit: 5 | Returns fasts 4-8 (0-indexed) |
| listFasts excludes active fasts | 1 active (no ended_at), 2 completed | Returns 2 fasts |
| countFasts counts only completed | 1 active, 3 completed | count: 3 |
| deleteFast removes entry | Delete fast by ID | getFast returns null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| End fast and verify in history | 1. Start fast, 2. End fast, 3. List fasts | Newly ended fast appears first in list |
| Delete fast updates streak | 1. End target-hit fast, 2. Check streak (1), 3. Delete fast, 4. Refresh streak | Streak decrements appropriately |

---

### FT-006: Weight Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-006 |
| **Feature Name** | Weight Tracking |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who fasts for weight management, I want to log my weight regularly and see a chart of my progress, so that I can correlate my fasting habits with weight changes.

**Secondary:**
> As a user, I want to switch between pounds and kilograms, so that I can use my preferred unit of measurement.

#### 3.3 Detailed Description

Weight tracking allows users to log daily weight entries with optional notes. Entries are displayed as a line chart showing weight over time, with the most recent 30/90/365 days selectable. The chart includes a trend line (7-day moving average) to smooth out daily fluctuations.

Weight tracking is opt-in. Users enable it in settings. Once enabled, a "Log Weight" button appears on the timer screen and a weight section appears on the stats screen. The preferred unit (lbs or kg) is configurable in settings. All weight values are stored in the user's chosen unit; no conversion is performed at storage time.

Weight data is used by the goal system (FT-008) for weight milestone goals and by smart water reminders (FT-013) to calculate personalized daily water targets.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone data feature)

**External Dependencies:**
- Local SQLite storage

**Assumed Capabilities:**
- Settings system is available to read/write preferences

#### 3.5 User Interface Requirements

##### Screen: Weight Log (accessible from Stats tab or Timer screen button)

**Layout:**
- Top section: a line chart showing weight entries over the selected time period
- Chart has: X-axis (dates), Y-axis (weight in user's unit), data points as dots, a 7-day moving average trend line (dashed), and a horizontal line showing the user's goal weight (if a weight milestone goal exists)
- Time period selector: "30D", "90D", "1Y", "All" buttons above the chart
- Below the chart: current weight (latest entry), change from first entry in period (e.g., "-3.2 lbs"), and change from 7 days ago
- Below stats: a scrollable list of recent weight entries showing date, weight value, and notes
- Floating action button: "+" to add a new weight entry

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No weight entries | Illustration of a scale, text: "Start tracking your weight", "+" button prominent |
| Single entry | 1 entry | Chart shows single dot, no trend line, no change stats |
| Multiple entries | 2+ entries | Full chart with trend line and change stats |
| Feature disabled | weightTrackingEnabled = false | Section hidden from timer/stats, accessible only via Settings toggle |

**Interactions:**
- Tap "+": Opens weight entry form (date picker defaulting to today, weight numeric input, optional notes textarea)
- Tap a data point on the chart: Shows tooltip with date, weight, and notes
- Tap a list entry: Opens edit form pre-filled with existing values
- Swipe left on a list entry: Reveals "Delete" action
- Tap period selector: Reloads chart for selected range

##### Modal: Weight Entry Form

**Layout:**
- Date picker (defaults to today, cannot be in the future)
- Weight input: numeric keypad with one decimal place precision (e.g., 175.5)
- Unit display: shows "lbs" or "kg" next to the input (based on settings)
- Notes textarea (optional, max 500 chars)
- "Save" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: WeightEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto (UUID) | Unique identifier |
| weight_value | REAL | Required, > 0, max 1500 | None | Weight in user's preferred unit |
| unit | TEXT | Required, "lbs" or "kg" | "lbs" | Unit of measurement |
| date | TEXT | Required, ISO date YYYY-MM-DD | None | Date of the weigh-in |
| notes | TEXT | Nullable, max 500 chars | null | Optional notes |
| created_at | TEXT | Auto-set, ISO 8601 | datetime('now') | Record creation time |

**Indexes:**
- `ft_weight_date_idx` on ft_weight_entries(date) - chronological queries for charting

**Validation Rules:**
- weight_value must be > 0 and <= 1500 (reasonable human weight range in any unit)
- date must not be in the future
- Only one entry per date is allowed (upsert on date collision)

**Example Data:**

```json
{
  "id": "w1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "weight_value": 175.5,
  "unit": "lbs",
  "date": "2026-03-06",
  "notes": "After morning fast, before breakfast",
  "created_at": "2026-03-06T07:30:00.000Z"
}
```

#### 3.7 Business Logic Rules

##### Weight Trend Calculation

**Purpose:** Compute a 7-day moving average for trend line display.

**Inputs:**
- Weight entries for the selected period, ordered by date ascending

**Logic:**

```
1. FOR each entry at index i:
2.   IF i < 6: movingAverage = null (not enough data)
3.   ELSE: movingAverage = average of entries[i-6..i] weight values
4. RETURN entries with movingAverage appended
```

##### Weight Change Stats

**Purpose:** Show weight change over the selected period.

**Inputs:**
- entries: WeightEntry[] for the period

**Logic:**

```
1. current = entries[last].weight_value
2. periodStart = entries[0].weight_value
3. changePeriod = current - periodStart (negative means weight lost)
4. Find entry closest to 7 days ago
5. changeWeek = current - entry7daysAgo.weight_value
6. RETURN { current, changePeriod, changeWeek }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Weight value is 0 or negative | Inline validation: "Enter a valid weight" | User corrects input |
| Duplicate date entry | Upsert: replaces existing entry for that date | Previous value is overwritten, user sees updated list |
| Date is in the future | Date picker prevents future selection | Disabled dates in picker |

#### 3.9 Acceptance Criteria

1. **Given** weight tracking is enabled and the user taps "+",
   **When** they enter 175.5 lbs and save,
   **Then** the entry appears in the list and as a data point on the chart.

2. **Given** the user has 30 weight entries over the past month,
   **When** they view the weight chart with "30D" selected,
   **Then** all 30 points are plotted with a 7-day moving average trend line.

3. **Given** the user's weight has gone from 180 to 175 over 30 days,
   **When** they view the weight stats,
   **Then** the change shows "-5.0 lbs".

4. **Given** weight tracking is disabled in settings,
   **When** the user views the timer and stats screens,
   **Then** no weight-related UI elements are visible.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Weight entry stores correct unit | value: 80, unit: "kg" | Stored with unit "kg" |
| Weight validation rejects zero | value: 0 | Validation error |
| Weight validation rejects negative | value: -5 | Validation error |
| Trend line needs 7+ entries | 5 entries | First 6 have movingAverage: null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add weight entry | 1. Insert entry, 2. Query by date | Entry retrievable with correct values |
| Upsert on same date | 1. Insert 175 on Mar 6, 2. Insert 174 on Mar 6 | Only one entry for Mar 6, value is 174 |
| Delete weight entry | 1. Insert entry, 2. Delete by ID | Entry no longer in list |

---

### FT-007: Water Intake Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-007 |
| **Feature Name** | Water Intake Logging |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a fasting user, I want to track how many glasses of water I drink each day, so that I stay hydrated during my fasting windows.

**Secondary:**
> As a user, I want to see my progress toward a daily water goal, so that I am motivated to drink enough water.

#### 3.3 Detailed Description

Water intake logging provides a simple daily counter. Each day has a target number of glasses (default: 8) and a current count. Users increment the counter with a single tap. The counter resets to 0 at the start of each new day (midnight local time). Progress is shown as a fraction (e.g., "5/8 glasses") and a progress bar or ring.

The daily target is configurable in settings and persists as the default for new days. Historical water intake data is preserved in the `ft_water_intake` table.

The water section appears on the timer screen below the fasting zone indicator (when a fast is active) or prominently when idle. It is always visible regardless of fasting state because hydration matters whether or not the user is fasting.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone data feature)

**External Dependencies:**
- Local SQLite storage

#### 3.5 User Interface Requirements

##### Component: Water Intake Card (Timer Screen)

**Layout:**
- A card showing: water drop icon, "N / M glasses" text (N = count, M = target), and a horizontal progress bar
- A large "+" tap target on the right side of the card to increment
- A small "-" button (or undo) to decrement by 1 if the user tapped by mistake

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not started | count = 0 | "0 / 8 glasses", empty progress bar, prominent "+" button |
| In progress | 0 < count < target | "N / M glasses", partially filled progress bar |
| Goal met | count >= target | "M / M glasses", full progress bar, checkmark icon, celebration micro-animation |
| Over target | count > target | "N / M glasses" (no cap), full progress bar, count continues incrementing |

**Interactions:**
- Tap "+": Increments count by 1, animates the progress bar fill
- Tap "-": Decrements count by 1 (minimum 0)
- Long press card: Opens water settings (daily target, unit preference)
- Tap count text: Opens daily water detail view with history

##### Screen: Water History (accessible from Stats tab)

**Layout:**
- Weekly view: 7-day bar chart showing daily glass counts with target line
- Monthly view: calendar heatmap where each day is colored by completion (none, partial, complete)
- Below: scrollable list of daily entries

#### 3.6 Data Requirements

##### Entity: WaterIntake

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| date | TEXT | Primary key, ISO date YYYY-MM-DD | None | The day this intake record covers |
| count | INTEGER | >= 0 | 0 | Number of glasses/units consumed |
| target | INTEGER | >= 1 | 8 | Daily target for this day |
| updated_at | TEXT | Auto-set, ISO 8601 | datetime('now') | Last update time |

**Indexes:**
- `ft_water_updated_idx` on ft_water_intake(updated_at) - recent entries query

**Validation Rules:**
- count must be >= 0
- target must be >= 1

**Example Data:**

```json
{
  "date": "2026-03-06",
  "count": 5,
  "target": 8,
  "updated_at": "2026-03-06T14:30:00.000Z"
}
```

#### 3.7 Business Logic Rules

##### Increment Water Intake

**Purpose:** Add to today's water count.

**Inputs:**
- amount: number (default: 1)
- date: Date (default: today)

**Logic:**

```
1. Get current intake for date (or create default row with count=0, target from settings)
2. nextCount = current.count + max(1, floor(amount))
3. UPSERT ft_water_intake with nextCount, preserving target
4. RETURN updated WaterIntake
```

##### Default Target Resolution

**Purpose:** Determine the daily water target for a new day.

**Logic:**

```
1. Read 'waterDailyTarget' from ft_settings
2. Parse as integer
3. IF not finite or < 1: return 8 (default)
4. RETURN parsed value
```

**Edge Cases:**
- First day ever: no row exists, return default { count: 0, target: 8 }
- Target changed mid-day: existing day keeps its original target; new target applies to next day
- Decrement below 0: clamp to 0

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on increment | Toast: "Could not log water. Please try again." | User taps again |
| Count somehow negative | Clamp to 0 on read | Transparent to user |

#### 3.9 Acceptance Criteria

1. **Given** it is a new day with no water logged,
   **When** the user taps "+" 3 times,
   **Then** the display shows "3 / 8 glasses" and the progress bar is at 37.5%.

2. **Given** the user has logged 8 glasses (meeting the target),
   **When** they view the water card,
   **Then** the progress bar is full, a checkmark is shown, and a micro-celebration animation plays.

3. **Given** the user tapped "+" by mistake,
   **When** they tap "-",
   **Then** the count decrements by 1.

4. **Given** the user changes their daily target to 10,
   **When** tomorrow starts,
   **Then** the new day's target is 10 glasses.

5. **Given** the user logged 5 glasses yesterday,
   **When** they view today's counter,
   **Then** today shows 0 glasses (daily reset).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| getWaterIntake returns default for new date | date with no row | { count: 0, target: 8, completed: false } |
| incrementWaterIntake adds 1 | count was 3 | count becomes 4 |
| incrementWaterIntake minimum increment is 1 | amount: 0 | count increments by 1 |
| setWaterTarget updates setting | target: 10 | Setting 'waterDailyTarget' is '10' |
| resetWaterIntake sets count to 0 | count was 5 | count becomes 0, target preserved |
| completed flag is true when count >= target | count: 8, target: 8 | completed: true |
| completed flag is false when count < target | count: 7, target: 8 | completed: false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Increment and read | 1. Increment 3 times, 2. Read water intake | count is 3 |
| Set target persists | 1. Set target to 12, 2. Read new date | New date target is 12 |
| Reset preserves target | 1. Set target 10, 2. Increment 5 times, 3. Reset | count: 0, target: 10 |

---

### FT-008: Goal Setting and Progress

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-008 |
| **Feature Name** | Goal Setting and Progress |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a user building a fasting routine, I want to set a goal like "fast at least 4 times per week", so that I have a concrete target to work toward.

**Secondary:**
> As a user tracking weight, I want to set a weight milestone goal (e.g., "reach 170 lbs"), so that I can see my progress toward a long-term target.

#### 3.3 Detailed Description

The goal system lets users create measurable fasting and weight objectives. There are 4 goal types: fasts per week, fasting hours per week, fasting hours per month, and weight milestone. Each goal has a target value, a direction (at least or at most), and a time period (weekly, monthly, or milestone).

Goal progress is computed on demand by querying the relevant data (completed fasts for fasting goals, latest weight entry for weight goals) within the goal's current period. Progress snapshots are stored in `ft_goal_progress` for historical tracking.

Users can have multiple active goals simultaneously. Goals can be archived (deactivated) when no longer relevant. The goals section appears on the Stats screen.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer (for fasting-based goals)
- FT-006: Weight Tracking (for weight milestone goals)

#### 3.5 User Interface Requirements

##### Component: Goals Section (Stats Screen)

**Layout:**
- Section header: "Goals" with an "Add Goal" button on the right
- Each active goal shows: goal label/type, progress bar, current value / target value, period indicator (e.g., "This week" or "This month"), and a completion badge if met
- Tapping a goal opens its detail view with historical progress periods

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No goals | No goals created | "Set a goal to track your progress" with "Add Goal" button |
| Active goals | 1+ active goals | Goal cards with progress bars |
| Goal completed | currentValue meets/exceeds targetValue in direction | Green checkmark, celebration animation |

##### Modal: Add/Edit Goal Form

**Layout:**
- Goal type picker: "Fasts per week", "Hours per week", "Hours per month", "Weight milestone"
- Target value input: numeric stepper
- Direction toggle: "At least" / "At most" (defaults based on type)
- Optional label (e.g., "My weekly fasting goal")
- Start date (defaults to today)
- Optional end date
- "Save" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: Goal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto (timestamp-random) | Unique identifier |
| type | TEXT | Required, one of: fasts_per_week, hours_per_week, hours_per_month, weight_milestone | None | Goal type |
| target_value | REAL | Required, > 0 | None | Target number to reach |
| period | TEXT | Required, one of: weekly, monthly, milestone | Derived from type | Evaluation period |
| direction | TEXT | Required, "at_least" or "at_most" | Derived from type | Whether to meet or stay under target |
| label | TEXT | Nullable, max 100 chars | null | User-defined label |
| unit | TEXT | Nullable | Derived from type | Display unit ("fasts", "hours", "weight") |
| start_date | TEXT | Required, ISO date | Today | When goal tracking begins |
| end_date | TEXT | Nullable, ISO date | null | When goal expires (null = indefinite) |
| is_active | INTEGER | 0 or 1 | 1 | Whether goal is currently tracked |
| created_at | TEXT | Auto-set, ISO 8601 | datetime('now') | Record creation time |

##### Entity: GoalProgress

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Unique identifier |
| goal_id | TEXT | Required, FK to ft_goals.id, CASCADE delete | None | The goal this progress belongs to |
| period_start | TEXT | Required, ISO date | None | Start of the evaluation period |
| period_end | TEXT | Required, ISO date | None | End of the evaluation period |
| current_value | REAL | Required | None | Progress value at snapshot time |
| target_value | REAL | Required | None | Target at snapshot time |
| completed | INTEGER | 0 or 1 | 0 | Whether goal was met in this period |
| created_at | TEXT | Auto-set, ISO 8601 | datetime('now') | Snapshot time |

**Indexes:**
- `ft_goals_active_idx` on ft_goals(is_active) - filter active goals
- `ft_goals_type_idx` on ft_goals(type) - filter by goal type
- `ft_goal_progress_goal_idx` on ft_goal_progress(goal_id) - progress lookup
- `ft_goal_progress_unique_period_idx` UNIQUE on ft_goal_progress(goal_id, period_start, period_end) - prevent duplicate snapshots

#### 3.7 Business Logic Rules

##### Goal Progress Computation

**Purpose:** Calculate current progress for a goal based on live data.

**Inputs:**
- goal: Goal
- asOf: Date (default: now)

**Logic:**

```
1. Determine the evaluation period range:
   - fasts_per_week / hours_per_week: current ISO week (Monday-Sunday)
   - hours_per_month: current calendar month
   - weight_milestone: from goal.startDate to asOf
2. Compute currentValue:
   - fasts_per_week: COUNT completed fasts WHERE date(started_at) in range
   - hours_per_week / hours_per_month: SUM duration_seconds / 3600 WHERE date(started_at) in range
   - weight_milestone: latest weight entry value
3. Determine completed:
   - IF direction = 'at_least': completed = currentValue >= targetValue
   - IF direction = 'at_most': completed = currentValue <= targetValue
4. RETURN GoalProgress snapshot
```

##### Week Range Calculation

**Purpose:** Get Monday-Sunday range for the given date.

**Logic:**

```
1. day = date.getUTCDay()
2. offsetToMonday = day === 0 ? 6 : day - 1
3. start = date - offsetToMonday days (Monday)
4. end = start + 6 days (Sunday)
5. RETURN { start, end } as ISO dates
```

**Edge Cases:**
- Goal created mid-week: first period starts from goal's start_date, not Monday
- Goal with end_date in the past: skip evaluation (no progress snapshot created)
- Weight milestone with no weight entries: currentValue = 0, completed = false
- Division: no division involved, so no division-by-zero risk

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Target value is 0 | Inline validation: "Target must be greater than 0" | User corrects |
| Goal type is weight_milestone but no weight entries exist | Progress shows 0 / target with message "Log your weight to track this goal" | User logs weight |
| Goal with expired end_date | Goal appears grayed out with "Expired" badge | User can archive or extend |

#### 3.9 Acceptance Criteria

1. **Given** the user creates a "fasts per week" goal with target 4,
   **When** they have completed 3 fasts this week,
   **Then** the goal shows "3 / 4 fasts" with 75% progress bar.

2. **Given** the user has a "hours per month" goal of 100 hours,
   **When** they have fasted 105 hours this month,
   **Then** the goal shows completed with a green checkmark.

3. **Given** the user has a weight milestone goal of "at most 170 lbs",
   **When** their latest weight entry is 172 lbs,
   **Then** the goal shows "172 / 170" as not yet completed.

4. **Given** the user archives a goal,
   **When** they view the goals section,
   **Then** the archived goal is hidden (unless "Show archived" is toggled).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Default period for fasts_per_week | type: fasts_per_week | period: "weekly" |
| Default period for hours_per_month | type: hours_per_month | period: "monthly" |
| Default direction for weight_milestone | type: weight_milestone | direction: "at_most" |
| isGoalCompleted at_least met | direction: at_least, current: 5, target: 4 | true |
| isGoalCompleted at_least not met | direction: at_least, current: 3, target: 4 | false |
| isGoalCompleted at_most met | direction: at_most, current: 170, target: 175 | true |
| Week range for Wednesday | date: 2026-03-04 (Wed) | start: 2026-03-02 (Mon), end: 2026-03-08 (Sun) |
| Month range for March | year: 2026, month: 3 | start: 2026-03-01, end: 2026-03-31 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and evaluate goal | 1. Create fasts_per_week goal target 3, 2. Complete 3 fasts, 3. Get progress | completed: true |
| Archive goal hides from active list | 1. Create goal, 2. Archive it, 3. List active goals | Goal not in active list |
| Delete goal cascades progress | 1. Create goal, 2. Refresh progress, 3. Delete goal | Goal and all progress rows deleted |

---

### FT-009: Statistics and Charts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-009 |
| **Feature Name** | Statistics and Charts |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a data-oriented user, I want to see charts and statistics about my fasting habits, so that I can understand my patterns and progress over time.

**Secondary:**
> As a user who has been fasting for months, I want monthly and annual summary reports, so that I can share my achievements.

#### 3.3 Detailed Description

The Stats screen (Tab 3) provides a comprehensive analytics dashboard for fasting data. It includes:

1. **Summary cards**: Total fasts, total hours, average duration, longest fast, adherence rate, current streak
2. **Weekly rollup**: Bar chart of daily fasting hours for the past 7 days, with hit-target indicators
3. **Monthly heatmap**: Calendar view where each day is colored by fasting status (none, fasted, hit target)
4. **Duration trend**: Line chart of daily fasting duration over 30 days with a 7-day moving average
5. **Period summaries**: Monthly and annual summary reports that can be formatted as shareable text

All stats are computed from the `ft_fasts` table using SQL aggregation queries. The system does not store pre-computed stats (except streak cache); all values are calculated on demand.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer (requires completed fasts)

#### 3.5 User Interface Requirements

##### Screen: Stats Screen (Tab 3)

**Layout:**
- Period selector at top: "Week", "Month", "Year", "All Time" tabs
- Summary cards row: 6 cards in a 3x2 grid showing key metrics
- Below summary: the appropriate chart for the selected period (weekly bar chart, monthly heatmap, or duration trend)
- Below chart: Goals section (see FT-008)
- Below goals: Weight chart section (if enabled, see FT-006)
- At bottom: "Share Summary" button generating text summary

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No completed fasts | "Complete your first fast to see stats here" |
| Populated | 1+ completed fasts | Full dashboard with charts and numbers |
| Loading | Computing stats | Skeleton loading cards and chart placeholders |

**Interactions:**
- Tap period tab: Switches chart and recalculates summary for that period
- Tap "Share Summary": Generates text summary, opens system share sheet
- Tap monthly heatmap day: Shows that day's fast details (if any)
- Tap weekly bar: Shows that day's breakdown

#### 3.6 Data Requirements

Uses existing Fast entity from FT-001. Stats are computed via queries, not stored.

##### Computed Types:

**SummaryStats:**
- totalFasts: number
- totalHours: number
- averageDurationHours: number
- longestFastHours: number
- adherenceRate: number (0-100)
- currentStreak: number

**DaySummary (weekly rollup):**
- date: string (YYYY-MM-DD)
- totalSeconds: number
- totalHours: number
- fastCount: number
- hitTarget: boolean

**MonthDay (monthly heatmap):**
- date: string (YYYY-MM-DD)
- status: "none" | "fasted" | "hit_target"

**DurationPoint (trend chart):**
- date: string (YYYY-MM-DD)
- durationSeconds: number
- durationHours: number
- movingAverage: number | null

#### 3.7 Business Logic Rules

##### Average Duration

**Purpose:** Calculate the mean fasting duration across all completed fasts.

**Formula:** `AVG(duration_seconds)` from ft_fasts WHERE ended_at IS NOT NULL

##### Adherence Rate

**Purpose:** Calculate the percentage of completed fasts that hit their target.

**Formula:** `(SUM(hit_target=1) / COUNT(*)) * 100` from completed fasts, rounded to 1 decimal.

**Edge Case:** If no completed fasts, return 0 (not NaN).

##### Weekly Rollup

**Purpose:** Provide daily fasting hour data for the past 7 days.

**Logic:**

```
1. FOR each of the past 7 days (today back to 6 days ago):
2.   Query SUM(duration_seconds), COUNT(*), SUM(hit_target=1) WHERE date(started_at) = day
3.   RETURN { date, totalSeconds, totalHours, fastCount, hitTarget }
4. Always return exactly 7 entries (include days with 0 fasts)
```

##### Monthly Heatmap

**Purpose:** Show fasting status for every day of a given month.

**Logic:**

```
1. Query all completed fasts in the month, GROUP BY date(started_at)
2. FOR each day in the month:
   - IF no fasts: status = "none"
   - IF fasts exist but none hit target: status = "fasted"
   - IF at least one hit target: status = "hit_target"
3. RETURN array of MonthDay entries (one per calendar day)
```

##### Duration Trend with Moving Average

**Purpose:** Show daily total fasting duration for the past N days with a 7-day moving average.

**Logic:**

```
1. FOR each of the past N days:
2.   Query SUM(duration_seconds) WHERE date(started_at) = day
3.   Compute totalHours
4.   IF 7+ entries accumulated: movingAverage = mean of last 7 totalHours values
5.   ELSE: movingAverage = null
6. RETURN array of DurationPoint entries
```

##### Share Summary Text

**Purpose:** Generate a human-readable text summary for sharing.

**Format:**

```
[Period Label] Summary
Total fasts: N
Total hours: Nh
Average duration: Nh
Longest fast: Nh
Current streak: N day(s)
Adherence: N%
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data for selected period | "No fasts in this period" message | User selects different period |
| Share sheet fails | Toast: "Could not share. Please try again." | User retries |

#### 3.9 Acceptance Criteria

1. **Given** the user has fasted 10 times over 2 weeks with 8 hitting their target,
   **When** they view the Stats screen "All Time" tab,
   **Then** total fasts shows 10 and adherence shows 80.0%.

2. **Given** the user fasted every day this week,
   **When** they view the weekly rollup,
   **Then** all 7 bars have non-zero heights.

3. **Given** it is March 2026 and the user fasted on 15 of 31 days,
   **When** they view the monthly heatmap for March,
   **Then** 15 days are colored (fasted or hit_target) and 16 are "none".

4. **Given** the user taps "Share Summary",
   **When** the share sheet opens,
   **Then** the text includes all 6 summary metrics formatted correctly.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| averageDuration with no fasts | empty database | 0 |
| adherenceRate all hits | 5 fasts, all hit_target=1 | 100.0 |
| adherenceRate none hit | 5 fasts, all hit_target=0 | 0 |
| adherenceRate mixed | 3 hit, 2 miss | 60.0 |
| weeklyRollup returns 7 entries | any data | length: 7 |
| weeklyRollup includes zero-fast days | 2 fasts on 2 different days | 5 entries have fastCount: 0, 2 have fastCount: 1 |
| monthlyRollup returns correct day count | year: 2026, month: 2 | 28 entries (Feb 2026) |
| monthlyRollup returns correct day count for March | year: 2026, month: 3 | 31 entries |
| durationTrend moving average starts at day 7 | 10 days of data | First 6 have movingAverage: null, days 7-10 have numeric values |
| formatSummaryShareText includes all fields | SummaryStats with known values | Text contains all 6 metrics |

---

### FT-010: Notification Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-010 |
| **Feature Name** | Notification Preferences |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user who wants to be reminded when my fast is complete, I want to receive a push notification when I reach my target, so that I know it is time to eat without constantly checking the app.

**Secondary:**
> As a user who dislikes frequent notifications, I want to control which progress milestones trigger notifications, so that I only get the alerts I care about.

#### 3.3 Detailed Description

Notification preferences let users configure which fasting milestones trigger local push notifications. There are 5 configurable notification events: fast started confirmation, 25% progress, 50% progress (halfway), 75% progress, and fast target reached. Each can be independently toggled on or off.

Defaults: fast start (on), 25% (off), 50% (on), 75% (on), fast complete (on).

These are local push notifications only. No server-side push infrastructure is used. Notifications are scheduled when a fast starts based on the target duration and active preferences. If preferences change during an active fast, notifications are rescheduled.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer (notifications fire during active fasts)

**External Dependencies:**
- Push notification permission from the OS
- Local notification scheduling API (Expo Notifications)

#### 3.5 User Interface Requirements

##### Component: Notification Settings Section (Settings Screen)

**Layout:**
- Section header: "Notifications"
- 5 toggle rows, each with a label and a switch:
  - "Fast started" (on by default)
  - "25% complete" (off by default)
  - "50% complete (halfway)" (on by default)
  - "75% complete" (on by default)
  - "Fast target reached" (on by default)
- If notification permission is not granted: a warning banner at the top of the section with "Enable Notifications" link to system settings

**Interactions:**
- Toggle a switch: Immediately saves the preference to ft_notifications_config
- Tap "Enable Notifications": Opens system notification settings for this app

#### 3.6 Data Requirements

##### Entity: NotificationsConfig

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | TEXT | Primary key, one of: fastStart, progress25, progress50, progress75, fastComplete | N/A | Notification event identifier |
| enabled | INTEGER | 0 or 1 | See defaults below | Whether this notification is active |

**Default seed data:**

| Key | Enabled |
|-----|---------|
| fastStart | 1 |
| progress25 | 0 |
| progress50 | 1 |
| progress75 | 1 |
| fastComplete | 1 |

#### 3.7 Business Logic Rules

##### Notification Scheduling

**Purpose:** Schedule local notifications when a fast starts.

**Inputs:**
- activeFast: ActiveFast (with startedAt and targetHours)
- preferences: NotificationPreferences

**Logic:**

```
1. Cancel any existing scheduled MyFast notifications
2. targetSeconds = targetHours * 3600
3. FOR each preference key:
   a. IF not enabled: skip
   b. Calculate fire time:
      - fastStart: immediately (or startedAt)
      - progress25: startedAt + (targetSeconds * 0.25)
      - progress50: startedAt + (targetSeconds * 0.50)
      - progress75: startedAt + (targetSeconds * 0.75)
      - fastComplete: startedAt + targetSeconds
   c. IF fire time is in the past: skip
   d. Schedule local notification with title "MyFast" and body:
      - fastStart: "Your fast has started! Target: Xh"
      - progress25: "25% done! Keep going."
      - progress50: "Halfway there!"
      - progress75: "75% complete! Almost there."
      - fastComplete: "Target reached! You fasted for Xh."
```

**Edge Cases:**
- Fast started with backdated time: some progress notifications may already be in the past; skip those
- User changes preferences mid-fast: reschedule all notifications
- Notification permission denied: preferences still save but notifications do not fire; show warning

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Notification permission not granted | Warning banner: "Notifications are disabled. Tap to enable." | User enables in system settings |
| Scheduling fails | Silent failure; no notification fires | Preference is still saved for next fast |

#### 3.9 Acceptance Criteria

1. **Given** the user starts a 16-hour fast with all notifications enabled,
   **When** they reach the halfway point (8 hours),
   **Then** a notification fires: "Halfway there!"

2. **Given** the user disables the 25% notification,
   **When** they complete 25% of their fast,
   **Then** no notification fires at that milestone.

3. **Given** notification permission is not granted,
   **When** the user views notification settings,
   **Then** a warning banner is displayed with a link to system settings.

4. **Given** the user starts a fast with a backdated start time 10 hours ago on a 16:8 protocol,
   **When** notifications are scheduled,
   **Then** the 25% (4h) and 50% (8h) notifications are skipped because they are in the past.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| getNotificationPreferences returns defaults on empty table | empty ft_notifications_config | { fastStart: true, progress25: false, progress50: true, progress75: true, fastComplete: true } |
| setNotificationPreference toggles single key | key: "progress25", enabled: true | Subsequent read returns progress25: true |
| Only valid keys are read | extra row with key "invalid" in table | Returned preferences only contain the 5 valid keys |

---

### FT-011: CSV Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-011 |
| **Feature Name** | CSV Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user who wants to analyze my fasting data in a spreadsheet, I want to export my fast history as a CSV file, so that I can do custom analysis or back up my data.

**Secondary:**
> As a user who tracks weight in MyFast, I want to export my weight entries as a separate CSV file, so that I can share weight data with my doctor or nutritionist.

#### 3.3 Detailed Description

CSV export generates downloadable CSV files for two data types: fast history and weight entries. Each export produces a single CSV file with a header row and one data row per entry. The CSV uses standard comma separation with proper field escaping (fields containing commas, quotes, or newlines are wrapped in double quotes).

Export is available from the Settings screen under a "Data" section. Users choose which data set to export, and the file is shared via the system share sheet (or downloaded on web).

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer (for fast history export)
- FT-006: Weight Tracking (for weight export)

**External Dependencies:**
- System share sheet / file download capability
- File system for temporary CSV file creation

#### 3.5 User Interface Requirements

##### Component: Export Section (Settings Screen)

**Layout:**
- Section header: "Data"
- Two buttons: "Export Fast History (CSV)" and "Export Weight Log (CSV)"
- Each button shows the count of records that will be exported (e.g., "42 fasts")

**Interactions:**
- Tap "Export Fast History": Generates CSV, opens system share sheet with the file
- Tap "Export Weight Log": Same flow for weight data

#### 3.6 Data Requirements

**Fast History CSV columns:**
- id, protocol, target_hours, started_at, ended_at, duration_seconds, hit_target (yes/no), notes

**Weight Log CSV columns:**
- id, weight_value, unit, date, notes

#### 3.7 Business Logic Rules

##### CSV Generation

**Purpose:** Convert database rows to a properly escaped CSV string.

**Logic:**

```
1. Build header row from column names
2. FOR each row in query results:
   a. FOR each field:
      - IF null or undefined: output empty string
      - IF contains comma, quote, or newline: wrap in double quotes, escape internal quotes by doubling
      - ELSE: output raw string value
   b. Join fields with commas
3. Join all rows with newlines
4. Append trailing newline
5. RETURN CSV string
```

**Edge Cases:**
- Notes field contains commas: properly escaped in double quotes
- Notes field contains double quotes: escaped as ""
- No completed fasts: CSV contains only the header row
- hit_target field: converted from 0/1 to "no"/"yes" for human readability

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data to export | Toast: "No data to export" | Button remains enabled for future use |
| Share sheet dismissed | No action needed | CSV can be re-exported at any time |
| File creation fails | Toast: "Could not create export file" | User retries |

#### 3.9 Acceptance Criteria

1. **Given** the user has 10 completed fasts,
   **When** they tap "Export Fast History",
   **Then** a CSV file is generated with 1 header row + 10 data rows and opened in the share sheet.

2. **Given** a fast has notes containing a comma ("Felt good, no hunger"),
   **When** the CSV is generated,
   **Then** the notes field is wrapped in double quotes: `"Felt good, no hunger"`.

3. **Given** the user has no weight entries,
   **When** they tap "Export Weight Log",
   **Then** a toast shows "No data to export".

4. **Given** the user exports fasts,
   **When** the CSV is opened in a spreadsheet application,
   **Then** all columns align correctly and special characters are properly escaped.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| escapeField handles null | null | "" (empty string) |
| escapeField handles comma | "hello, world" | "\"hello, world\"" |
| escapeField handles quotes | 'say "hi"' | '"say ""hi"""' |
| escapeField passes clean string | "hello" | "hello" |
| exportFastsCSV header row | any | First line: "id,protocol,target_hours,started_at,ended_at,duration_seconds,hit_target,notes" |
| exportFastsCSV hit_target as yes/no | hit_target: 1 | Field value: "yes" |
| exportWeightCSV header row | any | First line: "id,weight_value,unit,date,notes" |
| Export with no data | empty database | Header row + trailing newline only |

---

### FT-012: Settings Management

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-012 |
| **Feature Name** | Settings Management |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user, I want to configure my default fasting protocol, weight unit, and other preferences, so that the app works the way I prefer.

#### 3.3 Detailed Description

Settings provides a centralized configuration screen for all MyFast preferences. Settings are stored as key-value pairs in the `ft_settings` table. The Settings tab (Tab 4) organizes preferences into logical sections: General, Notifications, Data, and About.

Current settings keys: defaultProtocol, notifyFastComplete, notifyEatingWindowClosing, weightTrackingEnabled, weightUnit, waterDailyTarget, healthSyncEnabled, healthReadWeight, healthWriteFasts.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Settings Screen (Tab 4)

**Layout:**
- **General section:**
  - Default Protocol: tap to open protocol picker (FT-002)
  - Weight Tracking: toggle switch (enables/disables weight features)
  - Weight Unit: segmented control "lbs" / "kg" (visible only when weight tracking is on)
  - Daily Water Target: numeric stepper (1-30 glasses)
- **Notifications section:** (see FT-010)
- **Health section:** (see FT-018)
  - HealthKit Sync: toggle
  - Read Weight from Health: toggle (visible when sync is on)
  - Write Fasts to Health: toggle (visible when sync is on)
- **Data section:** (see FT-011)
  - Export Fast History
  - Export Weight Log
  - Delete All Data (destructive, red text)
- **About section:**
  - App version
  - Privacy policy link
  - "MyFast is part of MyLife" with link to hub

**Interactions:**
- Toggle any switch: Immediately writes to ft_settings
- Tap "Delete All Data": Shows destructive confirmation dialog: "Delete all MyFast data? This includes all fasts, weight entries, goals, and settings. This cannot be undone." On confirm: drops and recreates all ft_ tables.

#### 3.6 Data Requirements

##### Entity: Settings (Key-Value)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | TEXT | Primary key | N/A | Setting identifier |
| value | TEXT | Required | N/A | Setting value (stored as string, parsed on read) |

**Known keys and defaults:**

| Key | Default | Description |
|-----|---------|-------------|
| defaultProtocol | "16:8" | Default fasting protocol ID |
| notifyFastComplete | "true" | Notify when fast target reached |
| notifyEatingWindowClosing | "false" | Notify before eating window closes |
| weightTrackingEnabled | "false" | Whether weight tracking is active |
| weightUnit | "lbs" | Weight unit preference |
| waterDailyTarget | "8" | Daily water glass target |
| healthSyncEnabled | "false" | Whether HealthKit sync is active |
| healthReadWeight | "false" | Read weight from HealthKit |
| healthWriteFasts | "false" | Write fasting sessions to HealthKit |

#### 3.7 Business Logic Rules

##### Setting Read/Write

**Logic:**

```
Read: SELECT value FROM ft_settings WHERE key = ?
Write: INSERT OR REPLACE INTO ft_settings (key, value) VALUES (?, ?)
```

All values are stored as TEXT. Boolean values are stored as "true"/"false" strings. Numeric values are stored as their string representation.

##### Delete All Data

**Purpose:** Completely reset MyFast module data.

**Logic:**

```
1. Show destructive confirmation dialog
2. On confirm:
   a. Drop all ft_ tables (reverse dependency order)
   b. Re-run all migrations (recreates tables with seed data)
   c. Navigate to timer screen (fresh state)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Setting write fails | Toast: "Could not save setting" | User retries toggle |
| Delete all data fails mid-operation | Toast: "Could not delete data. Some data may remain." | User retries or contacts support |

#### 3.9 Acceptance Criteria

1. **Given** the user changes the default protocol to 18:6,
   **When** they return to the timer screen,
   **Then** the protocol header shows "Daily 18:6".

2. **Given** the user enables weight tracking,
   **When** they view the timer screen,
   **Then** a "Log Weight" button becomes visible.

3. **Given** the user taps "Delete All Data" and confirms,
   **When** the operation completes,
   **Then** all fasts, weight entries, goals, and settings are reset to defaults.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| getSetting returns null for missing key | key: "nonexistent" | null |
| setSetting stores value | key: "test", value: "hello" | getSetting returns "hello" |
| setSetting overwrites existing | set "test" to "a", then set "test" to "b" | getSetting returns "b" |

---

### FT-013: Smart Water Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-013 |
| **Feature Name** | Smart Water Reminders |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who forgets to drink water, I want to receive reminders at regular intervals throughout the day, so that I consistently meet my hydration goal.

**Secondary:**
> As a user who tracks my weight, I want my daily water goal to be calculated from my body weight, so that my target is personalized to my body.

#### 3.3 Detailed Description

Smart water reminders extend the basic water intake feature (FT-007) with personalized daily targets and scheduled push notification reminders. The personalized target is calculated from the user's body weight: 0.5 oz per pound (or 33 ml per kg) of body weight, converted to glasses (8 oz each). For example, a 160 lb person would have a target of 80 oz = 10 glasses.

Reminders are sent as local push notifications at configurable intervals (every 30, 60, 90, or 120 minutes) during waking hours (default: 7 AM to 10 PM). Reminders pause automatically when the daily target is met. Users can optionally pause reminders during fasting windows if they practice dry fasting.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-007: Water Intake Logging (the base water system)
- FT-006: Weight Tracking (for weight-based target calculation)

**External Dependencies:**
- Local notification scheduling API
- Notification permission from the OS

#### 3.5 User Interface Requirements

##### Component: Water Reminder Settings (accessible from water card long press or Settings)

**Layout:**
- "Smart Reminders" toggle (master on/off)
- When enabled:
  - "Reminder Interval" picker: 30 min, 60 min, 90 min, 120 min (default: 60 min)
  - "Waking Hours" range picker: start time (default 7:00 AM) and end time (default 10:00 PM)
  - "Pause During Dry Fasting" toggle (default: off)
  - "Personalized Goal" toggle: when on, calculates target from weight; when off, uses manual target
  - When personalized goal is on: shows calculated target (e.g., "Based on your weight of 160 lbs: 10 glasses/day")

**Interactions:**
- Toggle "Smart Reminders": Schedules or cancels all water reminder notifications
- Change interval: Reschedules notifications at new interval
- Change waking hours: Reschedules within new time range

#### 3.6 Data Requirements

New settings keys added to ft_settings:

| Key | Default | Description |
|-----|---------|-------------|
| waterRemindersEnabled | "false" | Master toggle for water reminders |
| waterReminderInterval | "60" | Minutes between reminders |
| waterWakeStart | "07:00" | Start of waking hours (HH:MM, 24hr) |
| waterWakeEnd | "22:00" | End of waking hours (HH:MM, 24hr) |
| waterPauseDuringDryFast | "false" | Suppress reminders during active fast |
| waterPersonalizedGoal | "false" | Calculate target from weight |

#### 3.7 Business Logic Rules

##### Personalized Water Target

**Purpose:** Calculate daily water goal from body weight.

**Inputs:**
- weightValue: number (from latest weight entry)
- weightUnit: "lbs" | "kg"

**Logic:**

```
1. IF weightUnit = "lbs":
     targetOz = weightValue * 0.5
   ELSE (kg):
     targetMl = weightValue * 33
     targetOz = targetMl / 29.5735
2. targetGlasses = round(targetOz / 8)
3. RETURN max(4, min(30, targetGlasses))  -- clamp to 4-30 range
```

**Edge Cases:**
- No weight entries: fall back to manual target (default 8)
- Very low weight (< 80 lbs): clamp target to minimum 4 glasses
- Very high weight (> 400 lbs): clamp target to maximum 30 glasses

##### Reminder Scheduling

**Purpose:** Schedule repeating local notifications for water intake.

**Logic:**

```
1. Cancel all existing water reminder notifications
2. IF waterRemindersEnabled is false: RETURN
3. Get current water intake for today
4. IF count >= target AND reminders pause on goal met: RETURN
5. IF waterPauseDuringDryFast AND active fast exists: RETURN
6. Calculate next reminder time:
   a. Start from max(now, wakeStart)
   b. Round up to next interval boundary
   c. IF past wakeEnd: schedule for tomorrow at wakeStart
7. Schedule repeating notification every [interval] minutes
8. Set notification body: "Time to drink water! [count]/[target] glasses today."
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No weight entries but personalized goal is on | Toast: "Log your weight to get a personalized water goal" | Falls back to manual target |
| Notification permission not granted | Warning in settings section | Link to system settings |

#### 3.9 Acceptance Criteria

1. **Given** the user weighs 160 lbs and enables personalized goal,
   **When** the target is calculated,
   **Then** the daily target is 10 glasses (160 * 0.5 / 8).

2. **Given** reminders are enabled with 60-minute interval and waking hours 7 AM - 10 PM,
   **When** the user has not met their target at 2 PM,
   **Then** a notification fires at 2 PM with current progress.

3. **Given** the user has met their daily water target,
   **When** the next reminder would fire,
   **Then** no notification is sent (reminders pause on goal completion).

4. **Given** "Pause During Dry Fasting" is enabled and a fast is active,
   **When** a reminder would fire,
   **Then** no notification is sent.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Personalized target for 160 lbs | weight: 160, unit: "lbs" | 10 glasses |
| Personalized target for 70 kg | weight: 70, unit: "kg" | 10 glasses (70*33/29.5735/8 = 9.7 -> 10) |
| Target clamps to minimum 4 | weight: 50, unit: "lbs" | 4 glasses (not 3) |
| Target clamps to maximum 30 | weight: 500, unit: "lbs" | 30 glasses (not 31) |
| Falls back to manual target with no weight entries | no weight data | Uses setting waterDailyTarget |

---

### FT-014: Multi-Beverage Types

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-014 |
| **Feature Name** | Multi-Beverage Types |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who drinks tea and coffee in addition to water, I want to log different beverage types with different hydration values, so that my hydration tracking is more accurate.

#### 3.3 Detailed Description

Multi-beverage types extend the water intake system to support logging different drink types. Each beverage type has a name, icon, default serving size (in oz or ml), and a hydration coefficient that determines how much the drink counts toward the daily water goal. For example, coffee has a coefficient of 0.8 (slightly dehydrating due to caffeine), so an 8 oz coffee counts as 6.4 oz of water equivalent.

The daily hydration total is calculated as the sum of (volume * coefficient) across all beverages logged that day, converted to glasses for display. This replaces the simple glass counter from FT-007 with a more nuanced system while maintaining backward compatibility (water defaults to coefficient 1.0 and 8 oz serving).

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-007: Water Intake Logging (base system being extended)

#### 3.5 User Interface Requirements

##### Component: Beverage Quick-Log (replaces simple "+" button)

**Layout:**
- The "+" button on the water card expands to show a row of beverage type icons (water, tea, coffee, juice, etc.)
- Tapping an icon logs one serving of that beverage at its default size
- A "More..." option at the end opens the full beverage picker with custom volume input
- Most recently used beverage types appear first (up to 4 quick-access icons)

**Interactions:**
- Tap beverage icon: Logs one serving of that type, animates progress bar update
- Long press beverage icon: Opens custom volume input for that beverage type
- Tap "More...": Opens full beverage list with all types and custom volume entry

##### Screen: Beverage Types Management (in Settings)

**Layout:**
- List of all beverage types with name, icon, default serving size, and coefficient
- Built-in types cannot be deleted but can have their default serving size changed
- Users can create custom beverage types

#### 3.6 Data Requirements

##### Entity: BeverageType (new table: ft_beverage_types)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Unique identifier |
| name | TEXT | Required, max 50 chars | None | Display name (e.g., "Coffee") |
| icon | TEXT | Required | None | Emoji or icon identifier |
| default_oz | REAL | Required, > 0 | 8.0 | Default serving size in fluid ounces |
| coefficient | REAL | Required, -1.0 to 2.0 | 1.0 | Hydration coefficient |
| is_builtin | INTEGER | 0 or 1 | 0 | Whether this is a system-defined type |
| sort_order | INTEGER | >= 0 | 0 | Display order |

##### Entity: BeverageLog (new table: ft_beverage_log)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Unique identifier |
| date | TEXT | Required, ISO date | None | Day this log entry belongs to |
| beverage_type_id | TEXT | Required, FK to ft_beverage_types.id | None | Which beverage was consumed |
| volume_oz | REAL | Required, > 0 | None | Volume consumed in fluid ounces |
| hydration_oz | REAL | Required | None | Computed: volume_oz * coefficient |
| logged_at | TEXT | Required, ISO 8601 | datetime('now') | When this was logged |

**Built-in Beverage Types:**

| Name | Icon | Default oz | Coefficient | Rationale |
|------|------|-----------|-------------|-----------|
| Water | Water drop | 8 | 1.0 | Baseline hydration |
| Herbal Tea | Tea cup | 8 | 1.0 | Caffeine-free, fully hydrating |
| Green Tea | Green tea | 8 | 0.95 | Mild caffeine, mostly hydrating |
| Black Tea | Tea cup | 8 | 0.9 | Moderate caffeine |
| Coffee | Coffee cup | 8 | 0.8 | Caffeine causes mild diuresis |
| Sparkling Water | Bubbles | 12 | 1.0 | Same as still water |
| Juice | Glass | 8 | 0.9 | Sugar content reduces net hydration slightly |
| Milk | Milk | 8 | 0.9 | Protein and fat slow absorption slightly |
| Alcohol | Beer mug | 12 | -0.5 | Net dehydrating |

#### 3.7 Business Logic Rules

##### Daily Hydration Calculation

**Purpose:** Compute total effective hydration for a day.

**Inputs:**
- All BeverageLog entries for the given date

**Logic:**

```
1. totalHydrationOz = SUM(hydration_oz) for all logs on date
2. totalGlasses = totalHydrationOz / 8.0
3. RETURN { totalHydrationOz, totalGlasses, meetsTarget: totalGlasses >= dailyTarget }
```

**Edge Cases:**
- Alcohol entries with negative coefficient reduce total hydration
- Total hydration cannot go below 0 (clamp)
- Legacy water intake data (from FT-007) is treated as beverage type "water" with coefficient 1.0

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Custom volume is 0 or negative | Inline validation: "Enter a valid amount" | User corrects |
| Beverage type deleted after logs exist | Logs retain the beverage_type_id; display shows "[Deleted type]" | Orphaned logs still count toward hydration |

#### 3.9 Acceptance Criteria

1. **Given** the user logs 3 glasses of water (3 * 8oz * 1.0 = 24oz) and 1 coffee (8oz * 0.8 = 6.4oz),
   **When** they view their daily hydration,
   **Then** total shows 30.4 oz (3.8 glasses equivalent).

2. **Given** the user logs a 12oz beer (coefficient -0.5),
   **When** hydration is calculated,
   **Then** the beer reduces total by 6 oz.

3. **Given** the user taps the "+" button,
   **When** the beverage picker expands,
   **Then** their most recently used beverage types appear as quick-access icons.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Water hydration is 1:1 | 8oz water, coefficient 1.0 | hydration_oz: 8.0 |
| Coffee hydration is reduced | 8oz coffee, coefficient 0.8 | hydration_oz: 6.4 |
| Alcohol is dehydrating | 12oz beer, coefficient -0.5 | hydration_oz: -6.0 |
| Daily total sums correctly | 3 waters + 1 coffee | 30.4 oz total |
| Total cannot go below 0 | Only alcohol logged | Clamped to 0 |

---

### FT-015: Custom Container Presets

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-015 |
| **Feature Name** | Custom Container Presets |
| **Priority** | P2 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user with a specific water bottle, I want to save my bottle's size as a preset, so that I can log my exact intake with a single tap instead of entering a custom volume.

#### 3.3 Detailed Description

Custom container presets let users save named containers with specific volumes for one-tap water/beverage logging. Instead of always logging in 8 oz glass increments, users can create presets like "My Nalgene (32 oz)" or "Office Mug (12 oz)" and tap them to log that exact amount. The system ships with common defaults.

Presets appear on the hydration quick-log UI as buttons alongside beverage type icons.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-007: Water Intake Logging (base system)

#### 3.5 User Interface Requirements

##### Component: Container Preset Buttons (Water Card)

**Layout:**
- A row of preset buttons below the beverage type icons, each showing the container name and volume
- "+" button at the end to add a new preset
- Each button shows: container name (truncated if long) and volume (e.g., "32 oz")

**Interactions:**
- Tap preset button: Logs that volume of the selected beverage type (default: water)
- Long press preset button: Opens edit/delete options
- Tap "+": Opens new container preset form (name, volume in oz or ml)

#### 3.6 Data Requirements

##### Entity: ContainerPreset (new table: ft_container_presets)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Unique identifier |
| name | TEXT | Required, max 30 chars | None | Display name (e.g., "Nalgene") |
| volume_oz | REAL | Required, > 0, max 128 | None | Volume in fluid ounces |
| is_builtin | INTEGER | 0 or 1 | 0 | Whether system-provided |
| sort_order | INTEGER | >= 0 | 0 | Display order |

**Default presets:**

| Name | Volume (oz) |
|------|------------|
| Small Glass | 8 |
| Can | 12 |
| Bottle | 16 |
| Large Bottle | 32 |
| XL Bottle | 40 |

#### 3.7 Business Logic Rules

##### Container Log

**Purpose:** Log water intake using a container preset.

**Logic:**

```
1. Look up container by ID
2. Convert volume to glasses equivalent (volume_oz / 8.0)
3. Call incrementWaterIntake with the glass equivalent amount
4. OR if multi-beverage is enabled: create BeverageLog with volume_oz
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Container name is empty | Inline validation: "Name is required" | User fills in name |
| Volume is 0 or negative | Inline validation: "Enter a valid volume" | User corrects |

#### 3.9 Acceptance Criteria

1. **Given** the user creates a preset "My Stanley" at 40 oz,
   **When** they tap the "My Stanley" button,
   **Then** 40 oz (5 glasses equivalent) is logged.

2. **Given** default presets are loaded,
   **When** the user views the container row,
   **Then** 5 default presets are shown in order.

3. **Given** the user deletes a custom preset,
   **When** they view the container row,
   **Then** the deleted preset is no longer visible.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Default presets have 5 entries | seed data | 5 presets |
| Volume must be positive | volume: 0 | Validation error |
| Name must not be empty | name: "" | Validation error |
| Glass equivalent calculation | 32 oz | 4.0 glasses |

---

### FT-016: Caffeine Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-016 |
| **Feature Name** | Caffeine Tracking |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a coffee drinker who fasts, I want to track my daily caffeine intake, so that I know if I am consuming too much and can adjust my timing to avoid disrupting sleep.

#### 3.3 Detailed Description

Caffeine tracking extends the beverage logging system to calculate and display daily caffeine consumption. Each caffeinated beverage type has a caffeine content in milligrams per serving. When the user logs a caffeinated beverage, the system calculates the caffeine contribution and adds it to the daily total.

The feature displays: daily caffeine total (mg), a metabolization timeline showing when caffeine levels will drop below a threshold (based on a 5-hour half-life), and a warning if caffeine is consumed late relative to typical sleep time.

Caffeine data is stored in the beverage log; no separate caffeine table is needed.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-014: Multi-Beverage Types (provides the beverage logging infrastructure)

#### 3.5 User Interface Requirements

##### Component: Caffeine Summary Card (Timer Screen, below water card)

**Layout:**
- Shows: daily caffeine total (e.g., "245 mg today"), a mini timeline showing metabolization curve, and a warning icon if intake is high (> 400 mg) or late (after 2 PM by default)
- The metabolization curve shows a declining exponential from each caffeinated drink

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No caffeine | No caffeinated drinks logged today | Card hidden or shows "0 mg caffeine" |
| Normal | Total < 400 mg, last drink before cutoff | Green indicator, total and timeline |
| High intake | Total >= 400 mg | Yellow warning: "High caffeine day" |
| Late intake | Caffeinated drink after cutoff time | Orange warning: "Late caffeine - may affect sleep" |

#### 3.6 Data Requirements

Additional field on BeverageType:

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| caffeine_mg | REAL | Nullable, >= 0 | null | Caffeine content per default serving in mg |

**Caffeine content by beverage type:**

| Beverage | Caffeine (mg per 8oz) |
|----------|----------------------|
| Espresso (2oz shot) | 63 |
| Drip Coffee | 95 |
| Black Tea | 47 |
| Green Tea | 28 |
| Herbal Tea | 0 |
| Cola | 22 |
| Energy Drink (8oz) | 80 |

New settings keys:

| Key | Default | Description |
|-----|---------|-------------|
| caffeineCutoffTime | "14:00" | Time after which caffeine triggers a warning (HH:MM, 24hr) |
| caffeineTrackingEnabled | "false" | Master toggle for caffeine display |

#### 3.7 Business Logic Rules

##### Daily Caffeine Total

**Purpose:** Sum caffeine from all beverages logged today.

**Logic:**

```
1. Query all BeverageLog entries for today
2. For each entry: look up beverage type's caffeine_mg
3. Scale by volume: actual_caffeine = caffeine_mg * (volume_oz / default_oz)
4. RETURN SUM of actual_caffeine for the day
```

##### Caffeine Metabolization

**Purpose:** Estimate when caffeine will be below a threshold.

**Inputs:**
- caffeinated drink logs with timestamps and amounts
- half_life: 5 hours (constant)

**Logic:**

```
1. FOR each caffeinated drink at time T with amount C:
2.   remaining(t) = C * (0.5 ^ ((t - T) / 5 hours))
3. Total caffeine at any time = SUM of remaining(t) for all drinks
4. Find time when total < 25 mg (roughly negligible)
5. RETURN that time as "caffeine clear by" estimate
```

**Edge Cases:**
- No caffeinated drinks: total is 0, no timeline shown
- Multiple drinks at different times: each metabolizes independently
- Half-life is approximate and varies by individual; display as estimate

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Caffeine data unavailable for beverage | Treat as 0 mg | No warning shown |

#### 3.9 Acceptance Criteria

1. **Given** the user logs 2 cups of drip coffee (95 mg each),
   **When** they view the caffeine card,
   **Then** it shows "190 mg today" with a green indicator.

2. **Given** the user has consumed 450 mg of caffeine today,
   **When** they view the caffeine card,
   **Then** a yellow warning shows "High caffeine day".

3. **Given** the user logs coffee at 4 PM and cutoff is 2 PM,
   **When** the caffeine card updates,
   **Then** an orange warning shows "Late caffeine - may affect sleep".

4. **Given** the user logged 200 mg of caffeine at 8 AM,
   **When** they check the metabolization timeline at 1 PM (5 hours later),
   **Then** the remaining caffeine shows approximately 100 mg.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Daily total sums correctly | 2 coffees at 95 mg each | 190 mg |
| Scaled caffeine for different volume | 16oz coffee (default 8oz at 95mg) | 190 mg |
| Metabolization after one half-life | 200 mg at T, check T+5h | ~100 mg |
| Metabolization after two half-lives | 200 mg at T, check T+10h | ~50 mg |
| No caffeine drinks returns 0 | only water logged | 0 mg |

---

### FT-017: Apple Watch Quick-Log

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-017 |
| **Feature Name** | Apple Watch Quick-Log |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a user wearing an Apple Watch, I want to log water intake from my wrist, so that I do not need to pull out my phone every time I drink water.

**Secondary:**
> As a fasting user with an Apple Watch, I want to see my current fasting timer status on my watch and start/stop fasts from my wrist.

#### 3.3 Detailed Description

The Apple Watch companion app provides two key interactions: (1) a water intake quick-log complication that lets users tap to log a glass of water, and (2) a fasting timer status display showing the current fasting zone, elapsed time, and a start/stop button. Data syncs between the watch and phone app via WatchConnectivity.

This feature requires a native watchOS companion app. In the Expo/React Native context, this is implemented as a native Swift module using expo-dev-client and a custom native extension.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer (for timer display/control)
- FT-007: Water Intake Logging (for water quick-log)

**External Dependencies:**
- Apple Watch with watchOS 10+
- WatchConnectivity framework
- expo-dev-client (cannot use Expo Go for native watch features)

#### 3.5 User Interface Requirements

##### Watch App: Timer Screen

**Layout:**
- Digital crown at top: shows current fasting zone name and color
- Center: elapsed time in HH:MM format (large text)
- Below: current zone name
- Bottom: "End Fast" button (when fasting) or "Start Fast" button (when idle)
- Complication (circular): shows elapsed time and a small progress ring

##### Watch App: Water Screen

**Layout:**
- Center: daily water count and target (e.g., "5 / 8")
- Below: circular progress ring
- Bottom: "Log Water" button (logs one default glass)
- Complication (circular): shows water progress ring with count

**Interactions:**
- Tap "Log Water": Logs one glass, sends to phone via WatchConnectivity, haptic confirmation
- Tap "Start Fast": Sends start command to phone, updates timer display
- Tap "End Fast": Shows confirmation, sends end command to phone, updates display
- Digital crown scroll: Switches between timer and water screens

#### 3.6 Data Requirements

No new database entities. Watch state is synced from the phone's SQLite database via WatchConnectivity messages:

**Phone to Watch:**
- Active fast state (protocol, startedAt, targetHours) or null
- Today's water intake (count, target)
- Current fasting zone info

**Watch to Phone:**
- "logWater" command (increments count by 1)
- "startFast" command (with protocol and targetHours)
- "endFast" command

#### 3.7 Business Logic Rules

##### Watch Sync Protocol

**Purpose:** Keep watch and phone in sync.

**Logic:**

```
1. On phone app state change (fast started/ended, water logged):
   a. Send current state to watch via WatchConnectivity.updateApplicationContext()
2. On watch command received (logWater, startFast, endFast):
   a. Execute the command on the phone's database
   b. Send updated state back to watch
3. On watch app launch:
   a. Request current state from phone
   b. Display cached state while waiting for response
```

**Edge Cases:**
- Phone app not running: watch sends command, phone processes it when launched
- Watch loses connection: displays last known state, queues commands for sync
- Conflicting actions (start fast on watch while phone shows active fast): phone rejects, watch updates

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Phone not reachable | Watch shows "Syncing..." with last known state | Commands queued, sync when reconnected |
| Start fast rejected (already active) | Watch haptic error, updates to show active fast | State syncs from phone |
| Watch app not installed | Feature not available | Detected at runtime, watch features hidden on phone |

#### 3.9 Acceptance Criteria

1. **Given** the user taps "Log Water" on the watch,
   **When** the phone is reachable,
   **Then** the phone's water count increments by 1 and the watch display updates within 2 seconds.

2. **Given** a fast is active on the phone,
   **When** the user opens the watch app,
   **Then** the timer screen shows the correct elapsed time and fasting zone.

3. **Given** the user starts a fast from the watch,
   **When** they open the phone app,
   **Then** the timer screen shows the active fast with correct timing.

4. **Given** the phone is not reachable,
   **When** the user taps "Log Water" on the watch,
   **Then** the command is queued and synced when the phone becomes available.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Sync message formats correctly | active fast state | Valid WatchConnectivity message structure |
| Command handler processes logWater | logWater command | Water count incremented |
| Command handler processes startFast | startFast with protocol "16:8" | New fast created |
| Command handler rejects duplicate start | startFast when fast active | Error response |

---

### FT-018: HealthKit Integration

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-018 |
| **Feature Name** | HealthKit Integration |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a user who tracks my weight in Apple Health, I want MyFast to read my weight data from HealthKit, so that I do not have to log it in two places.

**Secondary:**
> As a user who wants to correlate fasting with activity, I want to see my step count and calories burned alongside my fasting data, so that I can understand how fasting affects my activity.

#### 3.3 Detailed Description

HealthKit integration allows MyFast to read health metrics from Apple Health and optionally write fasting sessions as dietary metadata. This is a two-way integration with granular user control: users can independently enable/disable reading weight, reading activity data, and writing fasting sessions.

All HealthKit access requires explicit user permission via the iOS health data authorization prompt. MyFast never reads health data without authorization and never transmits health data over the network. This aligns with the privacy-first positioning.

Supported reads: weight (for auto-updating weight tracking), heart rate (during fasts), step count, active calories burned.

Supported writes: fasting session metadata (start time, end time, duration, protocol).

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-006: Weight Tracking (for HealthKit weight auto-import)

**External Dependencies:**
- iOS 15+ with HealthKit framework
- HealthKit authorization from the user
- expo-health-connect or react-native-health package

#### 3.5 User Interface Requirements

##### Component: Health Integration Section (Settings Screen)

**Layout:**
- "HealthKit Sync" master toggle
- When enabled, sub-toggles appear:
  - "Read Weight from Health" - auto-imports latest weight entries
  - "Read Activity During Fasts" - shows steps/calories/heart rate during active fasts
  - "Write Fasts to Health" - records completed fasting sessions in Health
- A "Last synced: [time]" indicator
- A "Sync Now" button for manual sync

##### Component: Activity Context Card (Timer Screen, during active fast)

**Layout:**
- Shows during an active fast when health read is enabled:
  - Steps today: N
  - Calories burned during fast: N
  - Heart rate (latest): N bpm
- This data provides context but is not stored in MyFast's database

#### 3.6 Data Requirements

No new database tables. Health data is read on demand from HealthKit and displayed ephemerally. Weight data from HealthKit is written to the existing ft_weight_entries table.

Settings keys used:

| Key | Default | Description |
|-----|---------|-------------|
| healthSyncEnabled | "false" | Master HealthKit toggle |
| healthReadWeight | "false" | Auto-import weight from Health |
| healthWriteFasts | "false" | Write completed fasts to Health |

#### 3.7 Business Logic Rules

##### Weight Auto-Import

**Purpose:** Sync weight entries from HealthKit to ft_weight_entries.

**Logic:**

```
1. IF healthSyncEnabled AND healthReadWeight: proceed
2. Query HealthKit for weight samples since last sync (or last 30 days on first sync)
3. FOR each weight sample:
   a. Convert to user's preferred unit (lbs or kg)
   b. Check if an entry exists for that date in ft_weight_entries
   c. IF no entry exists: insert with source="healthkit"
   d. IF entry exists and was manually entered: do not overwrite
   e. IF entry exists and was from healthkit: update with latest value
4. Update lastSyncTimestamp in settings
```

##### Fast Write to HealthKit

**Purpose:** Record completed fasts as dietary events in Apple Health.

**Logic:**

```
1. When a fast is ended (endFast completes):
2. IF healthSyncEnabled AND healthWriteFasts: proceed
3. Create a HealthKit dietary energy sample or custom category sample:
   - Start: fast.startedAt
   - End: fast.endedAt
   - Metadata: { protocol: fast.protocol, target_hours: fast.targetHours, hit_target: fast.hitTarget }
4. Write to HealthKit
```

**Edge Cases:**
- HealthKit permission revoked after initial grant: sync fails silently, toggle shows warning
- Weight entry from HealthKit conflicts with manual entry: manual entry takes precedence
- HealthKit not available (Android, web): feature is hidden entirely

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| HealthKit permission denied | Toast: "Health access denied. Enable in Settings > Privacy > Health." | Link to system settings |
| HealthKit not available (Android/web) | Health section hidden in settings | Platform check hides the feature |
| Sync fails | Toast: "Could not sync with Health. Please try again." | "Sync Now" button for manual retry |
| Weight conflict | Manual entry preserved, HealthKit value discarded | Transparent to user |

#### 3.9 Acceptance Criteria

1. **Given** the user enables "Read Weight from Health" and has weight data in Apple Health,
   **When** a sync occurs,
   **Then** weight entries from Health appear in the weight chart (without duplicating manually entered values).

2. **Given** the user enables "Write Fasts to Health" and completes a fast,
   **When** the fast ends,
   **Then** the fasting session is recorded in Apple Health.

3. **Given** HealthKit is not available (Android device),
   **When** the user views settings,
   **Then** the Health section is not displayed.

4. **Given** the user has both a manual weight entry and a HealthKit entry for the same date,
   **When** the sync runs,
   **Then** the manual entry is preserved (not overwritten).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Weight conversion lbs to kg | 175 lbs | 79.4 kg (rounded to 1 decimal) |
| Weight conversion kg to lbs | 80 kg | 176.4 lbs |
| Manual entry takes precedence | manual entry exists for date | HealthKit value not written |
| No HealthKit entry means no overwrite | no entry for date | HealthKit value inserted |
| Fast metadata formats correctly | completed fast | Valid HealthKit sample structure |

---

### FT-019: Fasting Insights and Tips

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-019 |
| **Feature Name** | Fasting Insights and Tips |
| **Priority** | P2 |
| **Category** | Onboarding |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a new faster, I want to learn about what happens in each fasting zone, so that I understand the potential benefits and feel motivated to continue.

#### 3.3 Detailed Description

Fasting insights provide educational content about each fasting zone and general fasting health tips. When the user enters a new zone during a fast, a brief educational card appears with 2-3 facts about that zone. A dedicated "Learn" section (accessible from the zone timeline) provides a scrollable collection of articles about fasting science, hydration during fasts, common mistakes, and tips for different protocols.

All content is bundled locally in the app. No network requests are made. Content uses hedging language ("may", "some research suggests") to avoid medical claims.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-003: Fasting Zone Visualization (zones trigger insight display)

#### 3.5 User Interface Requirements

##### Component: Zone Entry Card (appears on zone transition during active fast)

**Layout:**
- A dismissible card that slides up from the bottom when the user enters a new zone
- Shows: zone name, 2-3 bullet points of educational facts, "Learn More" link, dismiss button
- Auto-dismisses after 10 seconds if not interacted with

##### Screen: Learn Screen (accessible from zone timeline or settings)

**Layout:**
- Scrollable list of educational articles grouped by topic:
  - "Understanding Fasting Zones" (6 articles, one per zone)
  - "Hydration Tips" (3-4 articles)
  - "Protocol Guides" (one per preset protocol)
  - "Common Mistakes" (5-6 articles)
- Each article is 200-400 words with a title, reading time estimate, and simple illustrations

#### 3.6 Data Requirements

No database entities. Content is hardcoded as static data structures in the app bundle.

##### Content Structure:

```typescript
interface InsightArticle {
  id: string;
  category: 'zones' | 'hydration' | 'protocols' | 'tips';
  title: string;
  readingTimeMinutes: number;
  body: string; // plain text or markdown
  relatedZoneId?: string; // for zone-specific articles
}
```

#### 3.7 Business Logic Rules

##### Zone Transition Detection

**Purpose:** Show educational card when user enters a new zone.

**Logic:**

```
1. Track previousZoneId in component state
2. On each timer tick:
   a. Compute currentZone from elapsed time
   b. IF currentZone.id !== previousZoneId:
      - Show zone entry card with content for currentZone
      - Update previousZoneId
3. Do not show card for the initial zone when a fast starts (Fed State)
```

#### 3.8 Error Handling

No error scenarios. Content is static and bundled.

#### 3.9 Acceptance Criteria

1. **Given** a fast is active and the user transitions from "Fat Burning" to "Ketosis Beginning" zone,
   **When** the zone changes,
   **Then** an educational card appears with facts about ketosis.

2. **Given** the educational card is showing,
   **When** 10 seconds pass without interaction,
   **Then** the card auto-dismisses.

3. **Given** the user opens the Learn screen,
   **When** they browse articles,
   **Then** all content loads instantly (no network dependency).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| All zones have corresponding articles | FASTING_ZONES array | Each zone.id has a matching article with relatedZoneId |
| Articles have required fields | all InsightArticle entries | Every article has id, category, title, readingTimeMinutes, body |
| No medical certainty in content | all article bodies | No instances of "will", "guarantees", "cures", "treats" without hedging |

---

### FT-020: Community Fasting Challenges

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-020 |
| **Feature Name** | Community Fasting Challenges |
| **Priority** | P3 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a user who is motivated by group accountability, I want to join fasting challenges with other users, so that I stay committed to my fasting goals.

#### 3.3 Detailed Description

Community fasting challenges provide opt-in group fasting events where users can see anonymized participation stats (e.g., "47 of 120 participants completed today's fast"). Challenges are time-bound events with a specific protocol and duration (e.g., "7-Day 16:8 Challenge").

This feature is deprioritized (P3) because it conflicts with the privacy-first positioning. The implementation uses anonymized, aggregated data only. No individual user data is shared. Users must explicitly opt in to each challenge. Challenge data requires a network connection to a Supabase backend.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer
- FT-004: Streak Tracking

**External Dependencies:**
- Network connection
- Supabase backend for challenge data
- User opt-in consent flow

#### 3.5 User Interface Requirements

##### Screen: Challenges Screen (accessible from Stats tab or as a future 5th tab)

**Layout:**
- Active challenges: cards showing challenge name, protocol, duration, participant count, and user's progress
- Upcoming challenges: cards with "Join" buttons
- Past challenges: completed challenges with final stats

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Offline | No network connection | "Challenges require an internet connection" |
| No challenges | No active or upcoming challenges | "No challenges right now. Check back soon!" |
| Active challenge | User joined a challenge | Challenge card with daily progress tracker |

#### 3.6 Data Requirements

##### Entity: Challenge (server-side, Supabase)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Challenge identifier |
| name | TEXT | Challenge title |
| protocol | TEXT | Required fasting protocol |
| start_date | DATE | When the challenge begins |
| end_date | DATE | When the challenge ends |
| participant_count | INTEGER | Number of opted-in users |

##### Entity: ChallengeParticipation (local + server)

| Field | Type | Description |
|-------|------|-------------|
| challenge_id | TEXT | FK to challenge |
| joined_at | TEXT | When user opted in |
| days_completed | INTEGER | Number of days with target-hit fasts |

No individual fasting data is sent to the server. Only a daily "completed: true/false" flag per participant is transmitted.

#### 3.7 Business Logic Rules

##### Challenge Completion Check

**Logic:**

```
1. At end of each day (or when user ends a fast):
2. IF user is in an active challenge:
   a. Check if today's fast matched the challenge protocol
   b. IF hit_target: send anonymized "completed" flag to server
   c. Increment local days_completed counter
3. Server aggregates: "X of Y participants completed today"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Network unavailable | "Could not load challenges" | Retry button; local progress still tracked |
| Challenge ended while user offline | Challenge marked as completed/missed on next sync | Backfill from local data |

#### 3.9 Acceptance Criteria

1. **Given** the user joins a "7-Day 16:8 Challenge",
   **When** they complete a 16:8 fast on day 1,
   **Then** their progress shows "1/7 days completed" and the server shows updated participant stats.

2. **Given** the user has not opted into any challenges,
   **When** they view the challenges screen,
   **Then** no data is sent to or received from the server.

3. **Given** the user is offline during a challenge,
   **When** they complete a fast,
   **Then** the completion is tracked locally and synced when connectivity is restored.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Challenge active check | challenge with start_date <= today <= end_date | isActive: true |
| Challenge expired check | challenge with end_date < today | isActive: false |
| Completion flag only sends boolean | completed fast during challenge | Transmitted data contains only challenge_id and completed: true |
| No data sent without opt-in | fast completed, no challenge joined | Zero network requests |

---

### FT-021: Home Screen Widgets

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-021 |
| **Feature Name** | Home Screen Widgets |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a user who checks my fasting status frequently, I want a home screen widget showing my current fast timer, so that I can see my progress without opening the app.

**Secondary:**
> As a user tracking hydration, I want a widget showing my daily water intake progress, so that I am reminded to drink water throughout the day.

#### 3.3 Detailed Description

Home screen widgets provide at-a-glance fasting and hydration information directly on the iOS/Android home screen. Three widget sizes are supported:

1. **Small (2x2):** Current fast status - either "Fasting: HH:MM" with a mini progress ring or "Not fasting" with streak count
2. **Medium (4x2):** Fast status + water intake progress side by side
3. **Large (4x4):** Fast status + water intake + today's fasting zone + streak count

Widgets update periodically via the OS widget refresh mechanism (typically every 15-30 minutes on iOS). They read from a shared app group data store that the main app updates whenever state changes.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-001: Fasting Timer
- FT-007: Water Intake Logging
- FT-004: Streak Tracking

**External Dependencies:**
- iOS: WidgetKit (requires native Swift code, expo-dev-client)
- Android: App Widgets (requires native Kotlin code)
- Shared app group / data store for cross-process data sharing

#### 3.5 User Interface Requirements

##### Widget: Small (2x2)

**Layout:**
- Fasting state: mini progress ring with elapsed time text
- When idle: streak flame icon + "N day streak" or "Start fasting"

##### Widget: Medium (4x2)

**Layout:**
- Left half: fast status (same as small widget)
- Right half: water intake ring with "N/M" glasses text

##### Widget: Large (4x4)

**Layout:**
- Top section: fast status with larger ring and zone name
- Middle section: water intake bar
- Bottom section: streak count and today's summary

**Interactions:**
- Tap any widget: Deep links to the Timer screen in the app

#### 3.6 Data Requirements

Widgets read from a shared data store (UserDefaults suite on iOS, SharedPreferences on Android):

| Key | Type | Description |
|-----|------|-------------|
| fastActive | boolean | Whether a fast is currently active |
| fastStartedAt | string | ISO timestamp of fast start |
| fastTargetHours | number | Target duration |
| fastProtocol | string | Protocol name |
| waterCount | number | Today's water count |
| waterTarget | number | Today's water target |
| currentStreak | number | Current streak days |

The main app updates this shared store whenever relevant state changes.

#### 3.7 Business Logic Rules

##### Widget Data Sync

**Logic:**

```
1. On fast start/end: update shared store with current fast state
2. On water log: update shared store with today's water count/target
3. On streak change: update shared store with current streak
4. Widget reads from shared store on refresh (every 15-30 min)
5. Widget computes elapsed time from fastStartedAt for display
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Shared store empty (first install) | Widget shows "Open MyFast to get started" | User opens app, data populates |
| Widget refresh fails | Shows last known state | Next refresh cycle will update |

#### 3.9 Acceptance Criteria

1. **Given** a fast is active,
   **When** the user views the home screen widget,
   **Then** it shows the current elapsed time and a progress ring.

2. **Given** the user logs water in the app,
   **When** the widget refreshes,
   **Then** the water count is updated on the widget.

3. **Given** no fast is active,
   **When** the user views the widget,
   **Then** it shows the current streak count or "Start fasting".

4. **Given** the user taps the widget,
   **When** the app opens,
   **Then** it navigates directly to the Timer screen.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Shared store writes correctly | fast started | fastActive: true, fastStartedAt populated |
| Shared store clears on fast end | fast ended | fastActive: false |
| Widget elapsed computation | startedAt 2h ago | Displays ~02:00 |

---

### FT-022: Fast Editing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-022 |
| **Feature Name** | Fast Editing |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who forgot to start my fast timer on time, I want to adjust the start time of my current fast, so that the timer reflects when I actually started fasting.

**Secondary:**
> As a user reviewing my history, I want to edit the start and end times of a past fast, so that I can correct any mistakes.

#### 3.3 Detailed Description

Fast editing allows users to modify the start and/or end times of both active and completed fasts. This is critical for users who forget to start the timer or who want to correct inaccurate entries.

For active fasts: the user can backdate the start time. The timer recalculates elapsed time from the new start time. The start time cannot be set to the future.

For completed fasts: the user can edit both start and end times. Duration and hit_target are recomputed from the new times. End time must be after start time.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-005: Fast History Log (completed fast editing)
- FT-001: Fasting Timer (active fast editing)

#### 3.5 User Interface Requirements

##### Modal: Edit Fast Times

**Layout:**
- Start time: date+time picker, pre-filled with current started_at
- End time: date+time picker, pre-filled with current ended_at (hidden for active fasts)
- Duration preview: shows computed duration from the selected times
- "Hit target" preview: shows whether the duration meets the target
- "Save" and "Cancel" buttons

**Interactions:**
- Change start time: Duration preview updates in real time
- Change end time: Duration and hit_target preview update in real time
- Tap Save: Validates times, updates database, refreshes timer/history/streaks

#### 3.6 Data Requirements

No new entities. Edits update existing Fast and ActiveFast rows.

**Validation Rules:**
- start time must not be in the future (max: now + 60 seconds)
- end time must be after start time
- end time must not be in the future (for completed fasts)
- duration must be > 0 seconds

#### 3.7 Business Logic Rules

##### Edit Active Fast Start Time

**Logic:**

```
1. Validate new startedAt is not in the future
2. Update ft_fasts SET started_at = newStartedAt WHERE id = fastId
3. Update ft_active_fast SET started_at = newStartedAt WHERE fast_id = fastId
4. Timer automatically recomputes from new startedAt
```

##### Edit Completed Fast Times

**Logic:**

```
1. Validate startedAt < endedAt
2. Compute new durationSeconds = floor((endedAt - startedAt) / 1000)
3. Compute new hitTarget = durationSeconds >= (targetHours * 3600) ? 1 : 0
4. Update ft_fasts SET started_at, ended_at, duration_seconds, hit_target WHERE id = fastId
5. Refresh streak cache (hit_target may have changed)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Start time after end time | Inline validation: "Start time must be before end time" | User adjusts times |
| Start time in the future | Inline validation: "Start time cannot be in the future" | User selects past time |
| Duration becomes 0 | Inline validation: "Fast must be at least 1 minute" | User adjusts times |

#### 3.9 Acceptance Criteria

1. **Given** a fast is active and started at 8 PM today,
   **When** the user edits the start time to 6 PM today,
   **Then** the timer shows 2 additional hours of elapsed time.

2. **Given** a completed fast shows 15 hours (missed target of 16h),
   **When** the user edits the start time to 1 hour earlier,
   **Then** the duration shows 16 hours and hit_target changes to true.

3. **Given** the user tries to set start time to tomorrow,
   **When** they attempt to save,
   **Then** validation prevents the save with "Start time cannot be in the future".

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Duration recomputes on edit | start: 8PM, end: 12PM next day | 57600 seconds (16 hours) |
| Hit target recomputes on edit | duration: 16h, target: 16h | hit_target: 1 |
| Hit target false on short edit | duration: 15h, target: 16h | hit_target: 0 |
| Start time validation rejects future | startedAt: tomorrow | Validation error |
| End time must be after start | end before start | Validation error |

---

### FT-023: Onboarding Flow

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FT-023 |
| **Feature Name** | Onboarding Flow |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a first-time user, I want a brief introduction to the app that helps me choose my fasting protocol and set my preferences, so that I can start fasting immediately without reading documentation.

#### 3.3 Detailed Description

The onboarding flow runs on first launch (or when the user has no completed fasts and no protocol selected). It consists of 3-4 screens that guide the user through initial setup: choosing a fasting protocol, setting their water target, optionally enabling weight tracking, and optionally enabling notifications.

After onboarding, the user lands on the timer screen ready to start their first fast.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FT-002: Fasting Protocols (protocol selection)

#### 3.5 User Interface Requirements

##### Flow: Onboarding Screens

**Screen 1: Welcome**
- App logo and name
- Tagline: "Track your fasting journey, free and private"
- "Get Started" button

**Screen 2: Choose Your Protocol**
- Brief explanation: "How long do you want to fast?"
- Protocol cards (simplified): 16:8 (Beginner), 18:6 (Intermediate), 20:4 (Advanced), Custom
- Tapping a card selects it (highlighted border)
- "Next" button

**Screen 3: Hydration & Weight**
- "Daily water goal" stepper (default 8 glasses)
- "Track weight?" toggle
- If toggle on: "Preferred unit?" segmented control (lbs / kg)
- "Next" button

**Screen 4: Notifications**
- "Get notified when your fast is complete?" toggle (default on)
- "Remind me to drink water?" toggle (default off)
- "Start Fasting" primary button

**Interactions:**
- Swipe left/right: Navigate between screens
- Tap "Skip": Skips to timer with defaults
- Tap "Start Fasting" on last screen: Saves preferences, marks onboarding complete, navigates to timer

#### 3.6 Data Requirements

New settings key:

| Key | Default | Description |
|-----|---------|-------------|
| onboardingComplete | "false" | Whether onboarding has been completed |

#### 3.7 Business Logic Rules

##### Onboarding Gate

**Logic:**

```
1. On app launch:
2. IF getSetting('onboardingComplete') !== 'true':
   a. Show onboarding flow
3. On onboarding completion:
   a. Save all selected preferences to ft_settings
   b. Set 'onboardingComplete' to 'true'
   c. Navigate to timer screen
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| User kills app during onboarding | Onboarding restarts on next launch | No data loss (nothing saved until completion) |
| Settings save fails | Toast: "Could not save preferences. Using defaults." | User can adjust in Settings later |

#### 3.9 Acceptance Criteria

1. **Given** it is the user's first launch,
   **When** the app opens,
   **Then** the onboarding flow is presented.

2. **Given** the user selects 18:6 protocol and 10 glasses water target during onboarding,
   **When** they tap "Start Fasting",
   **Then** the timer screen shows 18:6 as the default protocol and water target shows 10.

3. **Given** the user has completed onboarding,
   **When** they launch the app again,
   **Then** the onboarding flow is not shown.

4. **Given** the user taps "Skip" during onboarding,
   **When** they land on the timer screen,
   **Then** defaults are used (16:8, 8 glasses, weight tracking off).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Onboarding shows when setting is false | onboardingComplete: "false" | Should show onboarding |
| Onboarding skips when setting is true | onboardingComplete: "true" | Should not show onboarding |
| All preferences save on completion | protocol: 18:6, water: 10, weight: true | Settings match selections |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Fast** entity, which represents a completed or in-progress fasting session. Each fast uses a **Protocol** that defines the target fasting/eating window split. At most one fast can be active at a time, tracked by the singleton **ActiveFast** record. Users optionally log **WeightEntry** records to track body weight over time. Daily hydration is tracked via **WaterIntake** (simple counter) and optionally **BeverageLog** entries (detailed multi-beverage tracking with **BeverageType** definitions). **ContainerPreset** entries provide quick-log volume shortcuts. Users set **Goal** targets with computed **GoalProgress** snapshots. The **StreakCache** stores pre-computed streak values for performance. **Settings** and **NotificationsConfig** store user preferences as key-value pairs.

### 4.2 Complete Entity Definitions

#### Entity: ft_fasts

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto (UUID) | Unique identifier |
| protocol | TEXT | Required | None | Protocol ID used |
| target_hours | REAL | Required, > 0 | None | Target fasting duration in hours |
| started_at | TEXT | Required, ISO 8601 | None | When the fast began |
| ended_at | TEXT | Nullable | null | When the fast ended |
| duration_seconds | INTEGER | Nullable, >= 0 | null | Computed duration |
| hit_target | INTEGER | Nullable, 0/1 | null | Whether target was reached |
| notes | TEXT | Nullable, max 2000 | null | User notes |
| created_at | TEXT | Auto-set | datetime('now') | Creation timestamp |

#### Entity: ft_active_fast

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PK, always 'current' | 'current' | Singleton key |
| fast_id | TEXT | FK ft_fasts(id) CASCADE | None | Active fast reference |
| protocol | TEXT | Required | None | Denormalized protocol |
| target_hours | REAL | Required | None | Denormalized target |
| started_at | TEXT | Required | None | Denormalized start time |

#### Entity: ft_protocols

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Protocol identifier |
| name | TEXT | Required, max 50 | None | Display name |
| fasting_hours | REAL | Required, 1-168 | None | Hours of fasting |
| eating_hours | REAL | Required, 0-23 | None | Hours of eating |
| description | TEXT | Nullable, max 200 | null | Short description |
| is_custom | INTEGER | 0/1 | 0 | User-created flag |
| is_default | INTEGER | 0/1 | 0 | Default protocol flag |
| sort_order | INTEGER | >= 0 | 0 | Display order |

#### Entity: ft_weight_entries

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto (UUID) | Unique identifier |
| weight_value | REAL | Required, > 0 | None | Weight measurement |
| unit | TEXT | Required, "lbs"/"kg" | "lbs" | Unit of measurement |
| date | TEXT | Required, ISO date | None | Weigh-in date |
| notes | TEXT | Nullable, max 500 | null | Optional notes |
| created_at | TEXT | Auto-set | datetime('now') | Creation timestamp |

#### Entity: ft_streak_cache

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | TEXT | PK | None | Cache key (current_streak, longest_streak, total_fasts) |
| value | INTEGER | >= 0 | None | Cached value |
| updated_at | TEXT | Auto-set | datetime('now') | Last refresh time |

#### Entity: ft_settings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | TEXT | Primary key | None | Setting identifier |
| value | TEXT | Required | None | Setting value (string-encoded) |

#### Entity: ft_water_intake

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| date | TEXT | Primary key, ISO date | None | Day this record covers |
| count | INTEGER | >= 0 | 0 | Glasses consumed |
| target | INTEGER | >= 1 | 8 | Daily target |
| updated_at | TEXT | Auto-set | datetime('now') | Last update |

#### Entity: ft_goals

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Goal identifier |
| type | TEXT | Required | None | Goal type enum |
| target_value | REAL | Required, > 0 | None | Target to reach |
| period | TEXT | Required | Derived | Evaluation period |
| direction | TEXT | Required | Derived | at_least / at_most |
| label | TEXT | Nullable, max 100 | null | User label |
| unit | TEXT | Nullable | Derived | Display unit |
| start_date | TEXT | Required, ISO date | Today | Goal start |
| end_date | TEXT | Nullable, ISO date | null | Goal expiry |
| is_active | INTEGER | 0/1 | 1 | Active flag |
| created_at | TEXT | Auto-set | datetime('now') | Creation time |

#### Entity: ft_goal_progress

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Snapshot identifier |
| goal_id | TEXT | FK ft_goals(id) CASCADE | None | Goal reference |
| period_start | TEXT | Required, ISO date | None | Period start |
| period_end | TEXT | Required, ISO date | None | Period end |
| current_value | REAL | Required | None | Progress value |
| target_value | REAL | Required | None | Target at snapshot time |
| completed | INTEGER | 0/1 | 0 | Goal met in period |
| created_at | TEXT | Auto-set | datetime('now') | Snapshot time |

#### Entity: ft_notifications_config

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | TEXT | Primary key | None | Notification event key |
| enabled | INTEGER | 0/1 | See seed data | Whether enabled |

#### Entity: ft_beverage_types (new, FT-014)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Beverage type ID |
| name | TEXT | Required, max 50 | None | Display name |
| icon | TEXT | Required | None | Emoji/icon |
| default_oz | REAL | Required, > 0 | 8.0 | Default serving size |
| coefficient | REAL | Required, -1.0 to 2.0 | 1.0 | Hydration coefficient |
| caffeine_mg | REAL | Nullable, >= 0 | null | Caffeine per serving (FT-016) |
| is_builtin | INTEGER | 0/1 | 0 | System-defined flag |
| sort_order | INTEGER | >= 0 | 0 | Display order |

#### Entity: ft_beverage_log (new, FT-014)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Log entry ID |
| date | TEXT | Required, ISO date | None | Day logged |
| beverage_type_id | TEXT | FK ft_beverage_types(id) | None | Beverage type |
| volume_oz | REAL | Required, > 0 | None | Volume consumed |
| hydration_oz | REAL | Required | None | Effective hydration |
| logged_at | TEXT | Required, ISO 8601 | datetime('now') | Timestamp |

#### Entity: ft_container_presets (new, FT-015)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | Auto | Preset ID |
| name | TEXT | Required, max 30 | None | Container name |
| volume_oz | REAL | Required, > 0, max 128 | None | Volume in oz |
| is_builtin | INTEGER | 0/1 | 0 | System-provided flag |
| sort_order | INTEGER | >= 0 | 0 | Display order |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| ft_active_fast -> ft_fasts | one-to-one | Active fast references a fast row (CASCADE delete) |
| ft_fasts -> ft_protocols | many-to-one | Each fast uses a protocol (by protocol ID string, not FK) |
| ft_goal_progress -> ft_goals | many-to-one | Each progress snapshot belongs to a goal (CASCADE delete) |
| ft_beverage_log -> ft_beverage_types | many-to-one | Each log entry references a beverage type |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| ft_fasts | ft_fasts_started_idx | started_at | Time-range queries for stats and history |
| ft_fasts | ft_fasts_protocol_idx | protocol | Filter fasts by protocol |
| ft_fasts | ft_fasts_hit_target_idx | hit_target | Streak computation and adherence rate |
| ft_weight_entries | ft_weight_date_idx | date | Chronological weight chart queries |
| ft_water_intake | ft_water_updated_idx | updated_at | Recent water entries |
| ft_goals | ft_goals_active_idx | is_active | Filter active goals |
| ft_goals | ft_goals_type_idx | type | Filter by goal type |
| ft_goal_progress | ft_goal_progress_goal_idx | goal_id | Progress lookup by goal |
| ft_goal_progress | ft_goal_progress_unique_period_idx | goal_id, period_start, period_end | UNIQUE - prevent duplicate snapshots |

### 4.5 Table Prefix

**MyLife hub table prefix:** `ft_`

All table names in the SQLite database are prefixed with `ft_` to avoid collisions with other modules in the MyLife hub. Example: the `fasts` table becomes `ft_fasts`, the `protocols` table becomes `ft_protocols`.

### 4.6 Migration Strategy

- **V1 migration:** Creates all 10 original tables (fasts, weight_entries, protocols, streak_cache, active_fast, settings, water_intake, goals, goal_progress, notifications_config), indexes, and seeds protocols/settings/notifications.
- **V2 migration:** Feature set additions (water, goals, notification defaults). Uses CREATE IF NOT EXISTS for idempotency.
- **Future V3 migration:** Will add ft_beverage_types, ft_beverage_log, and ft_container_presets tables for multi-beverage and container features.
- Tables are created on module enable. Schema version is tracked by the module registry migration orchestrator.
- Data from standalone MyFast app can be imported via the migration package data importer.
- Destructive migrations (column removal) are deferred to major versions only.
- All migrations use CREATE TABLE IF NOT EXISTS and INSERT OR IGNORE for safe re-running.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Timer | clock | Timer Screen | Fasting timer with progress ring, zone indicator, water card |
| History | list | History Screen | Scrollable list of completed fasts |
| Stats | bar-chart | Stats Screen | Charts, analytics, goals, weight |
| Settings | settings | Settings Screen | Preferences, notifications, data, health |

### 5.2 Navigation Flow

```
[Tab 1: Timer]
  ├── Protocol Picker (modal)
  ├── Zone Timeline (expandable in-screen)
  ├── Water Reminder Settings (modal)
  ├── Beverage Picker (modal)
  ├── Edit Active Fast Times (modal)
  └── Caffeine Detail (modal)

[Tab 2: History]
  └── Fast Detail Screen
        ├── Edit Fast Times (modal)
        ├── Zone Timeline (compact)
        └── Delete Confirmation (dialog)

[Tab 3: Stats]
  ├── Period Selector (in-screen tabs)
  ├── Goal Detail Screen
  │     ├── Add/Edit Goal (modal)
  │     └── Goal Progress History
  ├── Weight Log Screen
  │     ├── Add Weight Entry (modal)
  │     └── Weight Chart (in-screen)
  ├── Water History Screen
  └── Share Summary (system share sheet)

[Tab 4: Settings]
  ├── Protocol Picker (modal)
  ├── Notification Preferences (in-screen section)
  ├── Health Integration (in-screen section)
  ├── Beverage Types Management
  ├── Container Presets Management
  ├── Export (system share sheet)
  ├── Delete All Data (destructive dialog)
  └── Learn / Insights Screen
        └── Article Detail Screen
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Timer Screen | /(fast)/timer | Main fasting timer with zone, water, caffeine | Tab 1, widget deep link, onboarding completion |
| History Screen | /(fast)/history | List of completed fasts | Tab 2 |
| Fast Detail | /(fast)/history/[id] | Single fast details with zone timeline | Tap history list entry |
| Stats Screen | /(fast)/stats | Analytics dashboard with charts and goals | Tab 3 |
| Goal Detail | /(fast)/stats/goal/[id] | Single goal progress over time | Tap goal card on stats |
| Weight Log | /(fast)/stats/weight | Weight chart and entry list | Tap weight section on stats |
| Water History | /(fast)/stats/water | Water intake history charts | Tap water card details |
| Settings Screen | /(fast)/settings | All preferences and configuration | Tab 4 |
| Beverage Types | /(fast)/settings/beverages | Manage beverage type definitions | Settings > Beverages |
| Container Presets | /(fast)/settings/containers | Manage container presets | Settings > Containers |
| Learn Screen | /(fast)/learn | Educational articles about fasting | Settings > Learn, zone timeline |
| Article Detail | /(fast)/learn/[id] | Single educational article | Tap article in learn list |
| Onboarding | /(fast)/onboarding | First-run setup flow | First launch |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| mylife://fast/timer | Timer Screen | None |
| mylife://fast/history | History Screen | None |
| mylife://fast/history/:id | Fast Detail | id: fast UUID |
| mylife://fast/stats | Stats Screen | None |
| mylife://fast/settings | Settings Screen | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Fasting zone context on workouts | Fast | Workouts | Fast provides current zone when a workout is logged | On workout save |
| Eating window for meal timing | Fast | Nutrition | Fast provides eating window start/end times | On fast start/end |
| Fasting streak as daily habit | Fast | Habits | Fast reports whether today's fast hit target | On fast end |
| Water intake as daily habit | Fast | Habits | Fast reports whether daily water goal was met | On water goal completion |
| Fasting impact on mood | Fast | Mood | Fast provides fasting duration for mood correlation | On mood entry save |
| Meal planning around eating windows | Fast | Recipes | Fast provides next eating window open time | On recipe browse |
| Weight sync across modules | Fast | Health | Fast's weight data shared with aggregate health view | On weight entry |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Fasting history | Local SQLite (ft_fasts) | At rest (OS-level) | No | Never leaves device |
| Weight entries | Local SQLite (ft_weight_entries) | At rest (OS-level) | No | Never leaves device |
| Water intake | Local SQLite (ft_water_intake) | At rest (OS-level) | No | Never leaves device |
| Goals and progress | Local SQLite (ft_goals, ft_goal_progress) | At rest (OS-level) | No | Never leaves device |
| User preferences | Local SQLite (ft_settings) | At rest (OS-level) | No | Never leaves device |
| Notification config | Local SQLite (ft_notifications_config) | At rest (OS-level) | No | Never leaves device |
| HealthKit data | Apple Health (on-device) | OS-managed | No | Read/written via HealthKit API only |
| Challenge participation | Supabase (opt-in only, FT-020) | TLS in transit, encrypted at rest | Yes (opt-in) | Only anonymized boolean flags |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| HealthKit sync | Read/write health data | Fasting session metadata (to HealthKit, local only) | Weight, heart rate, steps (from HealthKit, local only) | Explicit HealthKit authorization prompt |
| Challenge participation (P3, opt-in) | Group fasting events | Anonymized completion boolean per day | Aggregate participant stats | Explicit opt-in per challenge |

For core functionality (P0 and P1 features), this module operates entirely offline. No network requests are made under any circumstances.

### 7.3 Data That Never Leaves the Device

- Fasting session history (start times, end times, durations, protocols)
- Weight measurements and trends
- Water intake counts and hydration data
- Beverage consumption logs and caffeine tracking
- Goals and progress snapshots
- User preferences and notification settings
- Streak counts and statistics
- Personal notes on fasts

### 7.4 User Data Ownership

- **Export:** Users can export all fasting and weight data as CSV files (FT-011)
- **Delete:** Users can delete all module data from Settings with a single action (FT-012). This is irreversible and requires a confirmation dialog.
- **Portability:** CSV export format uses standard columns with human-readable headers. hit_target is exported as "yes"/"no" rather than 0/1.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| App-level lock | Inherits from MyLife hub app lock (if configured) | Not module-specific |
| HealthKit authorization | Granular per-data-type permission | Users can revoke at any time via iOS Settings |
| Challenge opt-in | Per-challenge explicit consent | No data shared without active opt-in |
| No telemetry | Zero analytics, zero crash reporting, zero usage tracking | Aligns with MyLife privacy charter |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Protocol | A fasting schedule defining the ratio of fasting hours to eating hours (e.g., 16:8 means 16 hours fasting, 8 hours eating). |
| Fasting Zone | A time-based phase during a fast associated with metabolic changes (e.g., Fat Burning, Ketosis). Zones are approximations, not medical diagnostics. |
| Streak | The count of consecutive days on which the user completed at least one fast that met its target duration. |
| Hit Target | A fast is said to have "hit target" if its actual duration equals or exceeds the protocol's fasting hours. |
| Adherence Rate | The percentage of completed fasts that hit their target, expressed as 0-100%. |
| Hydration Coefficient | A multiplier (0 to 1.0, or negative for alcohol) applied to a beverage's volume to calculate its effective hydration contribution. Water has a coefficient of 1.0. |
| Container Preset | A saved beverage container with a specific volume (e.g., "32 oz Nalgene") for one-tap intake logging. |
| Eating Window | The period after a fast ends when the user eats. In protocols like 16:8, the eating window is 8 hours. |
| Dry Fasting | A fast during which the user abstains from both food and water. Some users practice this for religious or health reasons. |
| OMAD | One Meal A Day. A fasting protocol (23:1) where the user eats a single meal in a 1-hour window. |
| Singleton | A database record constrained to at most one row. The ft_active_fast table uses this pattern (id always = 'current'). |
| Moving Average | A statistical smoothing technique that averages the last N data points to reduce daily fluctuations. Used for weight trend lines and duration trends. |
| HealthKit | Apple's framework for reading and writing health and fitness data on iOS and watchOS. |
| WatchConnectivity | Apple's framework for bidirectional communication between an iPhone app and its Apple Watch companion. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification covering 23 features |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should the 12:12 and 14:10 protocols be added as presets? | The design doc mentions 8 presets but current code has 6. Competitors like Zero include these beginner options. | Pending | - |
| 2 | Should water intake transition fully to multi-beverage (FT-014) or remain as a parallel simple system? | FT-007 provides a simple counter; FT-014 adds complexity. Need to decide if FT-014 replaces FT-007 or extends it. | Recommended: FT-014 extends FT-007. Simple counter remains as the default; multi-beverage is opt-in. | - |
| 3 | What is the maximum recommended fast duration before showing a health warning? | Extended fasts (48h+) carry health risks. Should the app show a disclaimer? | Pending | - |
| 4 | Should caffeine tracking (FT-016) be a separate module or stay in MyFast? | Caffeine tracking could be useful outside of fasting context. | Recommended: Keep in MyFast. Caffeine + hydration + fasting are tightly coupled. If a MyNutrition module is built, it can share caffeine data via cross-module integration. | - |
| 5 | What watchOS minimum version should be supported? | watchOS 10 supports modern WidgetKit; watchOS 9 has more device coverage. | Pending | - |
