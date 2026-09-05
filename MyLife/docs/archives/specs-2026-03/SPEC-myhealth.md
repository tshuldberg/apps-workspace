# MyHealth - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyHealth
- **Tagline:** "Your complete health companion"
- **Module ID:** `health`
- **Feature ID Prefix:** `HL`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Health-Conscious Professional | Ages 25-45, wears Apple Watch, tracks multiple health metrics, moderate-to-high tech comfort. Uses 3-5 separate health apps today. | Consolidate health data into one dashboard, understand trends, reduce app fatigue |
| Sleep Optimizer | Ages 20-40, struggles with sleep quality, wants data-driven improvement. May have mild insomnia or irregular schedule. | Track sleep stages, build consistent sleep habits, understand what affects sleep quality |
| Chronic Condition Manager | Ages 30-65, manages 1-3 chronic conditions (hypertension, diabetes, thyroid). Takes daily medications. | Monitor vitals alongside medications, generate doctor reports, track treatment effectiveness |
| Anxiety/Stress Sufferer | Ages 18-45, experiences periodic anxiety or panic attacks. Wants accessible calming tools without a $80/yr meditation subscription. | Quick access to breathing exercises, grounding techniques, and SOS tools during acute episodes |
| Fitness Recovery Tracker | Ages 20-50, trains regularly (running, lifting, cycling). Wants to optimize recovery and prevent overtraining. | Monitor HRV, readiness score, sleep quality, and activity load to plan training intensity |
| Privacy-First Health Tracker | Ages 25-55, concerned about health data privacy after Samsung Health/Whoop data sharing scandals. | Track all health metrics locally without data leaving the device or being monetized |

### 1.3 Core Value Proposition

MyHealth is the central health intelligence layer of the MyLife suite. It consolidates data from fasting (MyFast), medications (MyMeds), cycle tracking, workouts (MyWorkouts), habits (MyHabits), and nutrition (MyNutrition) into a unified health dashboard with a chronological wellness timeline. Beyond aggregation, MyHealth adds standalone capabilities: sleep tracking with stage analysis, vitals monitoring via HealthKit integration, breathing exercises, guided meditation, readiness scoring, body composition tracking, an encrypted document vault for medical records, and an emergency info card. It replaces Sleep Cycle ($30/yr), AutoSleep ($8), Calm ($80/yr), Headspace ($70/yr), and Whoop ($360/yr) while keeping all data on-device with zero analytics, zero telemetry, and zero data monetization.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Apple Health (Free) | Native iOS integration, comprehensive HealthKit aggregation, clinical records | iOS-only, no meditation/breathing, no readiness score, no cross-app correlation engine | Cross-platform with same privacy guarantees, adds breathing/meditation, readiness scoring, and cross-module correlation |
| Sleep Cycle ($30/yr) | Smart alarm, snore detection, sleep stage analysis, sleep aid sounds | Sleep-only focus, collects usage analytics, no medication/vitals correlation | Sleep tracking plus full health dashboard, medication-sleep correlation, zero analytics |
| Pillow ($28/yr) | Apple Watch sleep stages, heart rate during sleep, sleep aid sounds | iOS-only, limited to sleep domain, subscription for premium features | Same sleep stage display from HealthKit plus vitals, meds, fasting correlation |
| AutoSleep ($8 one-time) | Automatic sleep tracking, readiness score, sleep bank concept | Watch-dependent, no breathing exercises, no medication tracking | Readiness score plus breathing exercises, meditation, medication correlation, no Watch requirement for manual entry |
| Calm ($80/yr) | 1000+ meditation sessions, sleep stories, masterclasses, celebrity narrators | Expensive, tracks user engagement for analytics, no health data integration | Built-in breathing exercises and guided meditation at zero extra cost, integrated with health data |
| Headspace ($70/yr) | Structured meditation courses, CBT exercises (Ebb), animations | Expensive, behavioral analytics, no vitals/sleep integration | CBT worksheets plus breathing plus meditation integrated with sleep and vitals data |
| Whoop ($360/yr) | Recovery/strain/sleep scores, HRV tracking, community | Extremely expensive, class-action lawsuit for sharing biometric data with Segment (Twilio) | Same readiness/recovery concept from HealthKit data, zero data sharing, no hardware lock-in |
| Garmin Connect (Free with device) | Readiness score, body battery, HRV, sleep stages | Hardware-locked to Garmin devices, complex UI, no medication/fasting integration | Device-agnostic via HealthKit, simpler UI, cross-module health correlation |
| Samsung Health (Free) | Comprehensive health tracking, body composition, food logging | Forced data sharing terms in 2025 (accept or delete all data), GDPR complaint filed | All data stays on-device, no ultimatums, no data sharing requirements |
| Finch (Freemium) | Self-care companion, breathing exercises, gentle gamification | Limited health data, no vitals/sleep integration, targets younger audience | Full health data integration with same breathing exercise quality |
| Stoic ($30/yr) | CBT journaling, mental wellness exercises, mood tracking | No health data integration, no sleep/vitals, text-heavy interface | CBT exercises integrated with mood-medication correlation and sleep data |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export

**MyHealth-specific privacy notes:**

- **HealthKit data is imported locally.** Data flows from Apple Health into the local SQLite database. No health data is transmitted to any server, API, or third party.
- **HealthKit permissions are granular.** Users choose exactly which data types to share (heart rate, steps, sleep, HRV, etc.). Each type can be independently enabled or disabled.
- **Snore detection audio stays on-device.** Audio recordings from snore detection are stored locally and never uploaded. Users can delete recordings at any time.
- **Document vault uses OS-level encryption.** Medical documents (lab results, prescriptions, insurance cards) are stored as BLOBs in SQLite, protected by the device's file-system encryption and optional biometric lock.
- **Emergency info is accessible from lock screen (opt-in).** Users can choose to make their ICE card visible without unlocking the device, similar to Apple's Medical ID. This is off by default.
- **Cross-module data stays local.** When MyHealth reads data from MyMeds, MyFast, MyWorkouts, or MyHabits, all correlation analysis happens on-device. No aggregated health profile is ever transmitted.
- **No pharmaceutical company involvement.** Unlike Medisafe (pharma partnerships), MySugr (owned by Roche), and Cara Care (owned by Bayer), MyHealth has zero pharmaceutical industry ties.
- **Export is user-initiated only.** Health data export produces local files (JSON, CSV). No cloud upload, no "sync to doctor" feature that phones home.

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| HL-001 | Health Dashboard | P0 | Core | None | Implemented |
| HL-002 | Wellness Timeline | P0 | Core | HL-001 | Partially Implemented |
| HL-003 | Sleep Session Logging | P0 | Core | None | Implemented |
| HL-004 | Sleep Quality Scoring | P0 | Analytics | HL-003 | Implemented |
| HL-005 | Vitals Tracking | P0 | Core | None | Implemented |
| HL-006 | Emergency Medical Info (ICE Card) | P0 | Core | None | Implemented |
| HL-007 | Health Document Vault | P0 | Data Management | None | Implemented |
| HL-008 | Health Goals | P0 | Core | None | Implemented |
| HL-009 | Trend Visualization | P0 | Analytics | HL-005, HL-003 | Implemented |
| HL-010 | Health Data Export | P1 | Import/Export | HL-001 | Implemented |
| HL-011 | Medication Correlation Display | P1 | Analytics | HL-005, HL-003 | Implemented |
| HL-012 | Apple Health / HealthKit Integration | P0 | Import/Export | HL-005, HL-003 | Not Started |
| HL-013 | Breathing Exercises | P0 | Core | None | Not Started |
| HL-014 | Sleep Stage Analysis | P1 | Analytics | HL-003, HL-012 | Not Started |
| HL-015 | Heart Rate During Sleep | P1 | Analytics | HL-012, HL-003 | Not Started |
| HL-016 | Blood Oxygen (SpO2) Trending | P1 | Analytics | HL-012 | Not Started |
| HL-017 | Readiness Score | P1 | Analytics | HL-004, HL-012 | Not Started |
| HL-018 | Guided Meditation | P1 | Core | None | Not Started |
| HL-019 | Activity Tracking | P1 | Core | HL-012 | Not Started |
| HL-020 | HRV Tracking | P1 | Analytics | HL-012 | Not Started |
| HL-021 | Smart Alarm | P2 | Core | HL-012, HL-014 | Not Started |
| HL-022 | Snore Detection and Recording | P2 | Core | HL-003 | Not Started |
| HL-023 | Sleep Bank | P2 | Analytics | HL-003, HL-004 | Not Started |
| HL-024 | CBT Exercises | P2 | Core | None | Not Started |
| HL-025 | SOS / Panic Button | P2 | Core | HL-013 | Not Started |
| HL-026 | Body Composition | P2 | Core | HL-005 | Not Started |
| HL-027 | Health Insights (AI Summary) | P2 | Analytics | HL-001, HL-002 | Not Started |
| HL-028 | Clinical Health Records Import | P3 | Import/Export | HL-007 | Not Started |
| HL-029 | Module Absorption Migration | P0 | Onboarding | None | Implemented |
| HL-030 | Settings and Preferences | P0 | Settings | None | Implemented |

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
- **Onboarding** - First-run experience, tutorials, migration

---

## 3. Feature Specifications

### HL-001: Health Dashboard

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-001 |
| **Feature Name** | Health Dashboard |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Health-Conscious Professional, I want to see all my health data consolidated in one dashboard, so that I can understand my overall health status at a glance without switching between 5 different apps.

**Secondary:**
> As a Chronic Condition Manager, I want to see my vitals, medications, and sleep data in a single view, so that I can identify patterns between my treatment and my health outcomes.

#### 3.3 Detailed Description

The Health Dashboard is the primary screen of MyHealth, serving as the "Today" view that aggregates data from all health-related modules into a single scrollable summary. It displays the user's current health snapshot: last night's sleep score, today's step count and active minutes, latest vitals (heart rate, HRV, blood oxygen), active medication schedule, current fasting window status, readiness score, and active health goals with progress.

The dashboard uses a card-based layout where each domain (sleep, vitals, activity, medications, fasting, goals) occupies a collapsible card. Cards are ordered by recency of data, with the most recently updated card at the top. Users can reorder cards by long-pressing and dragging. Empty cards (no data for that domain) show a brief prompt to set up that domain.

The dashboard pulls data from multiple module tables: `hl_sleep_sessions` for sleep, `hl_vitals` for vitals, `md_medications` and `md_dose_logs` for medications, `ft_fasting_sessions` for fasting, `hl_goals` and `hl_goal_progress` for goals, and `hl_settings` for preferences. It reads but never writes to absorbed module tables.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the root feature)

**External Dependencies:**
- Local SQLite database initialized and writable
- Module registry has MyHealth module enabled

**Assumed Capabilities:**
- User can navigate between tabs via the bottom tab bar
- Absorbed module tables (md_*, ft_*, cy_*) exist if those modules were previously enabled

#### 3.5 User Interface Requirements

##### Screen: Today Dashboard

**Layout:**
- The screen has a top header showing "Today" with the current date and a settings gear icon on the right
- Below the header is an optional readiness score ring (large circular progress indicator, 0-100) if HealthKit data is available
- The main content area is a vertically scrollable list of domain cards
- Each card has a colored left border matching the domain's accent color, a domain icon, title, and summary data
- Cards are collapsible: tapping the header toggles between summary (2-3 key metrics) and expanded (full detail) view
- A floating action button in the bottom-right corner opens a quick-log menu (log sleep, log vital, mood check-in, start fast)

**Domain Cards (default order):**
1. **Sleep Card** - Last night's quality score (0-100 ring), duration, bedtime/wake time, sleep stages bar if available
2. **Activity Card** - Steps (with daily goal progress bar), active minutes, active energy (kcal)
3. **Vitals Card** - Latest heart rate, HRV, blood oxygen, weight. Tap any metric for trend chart
4. **Medications Card** - Today's schedule with taken/pending/missed status indicators. Shows next upcoming dose time
5. **Fasting Card** - Current fasting window status (active timer or last completed fast summary)
6. **Goals Card** - Active goals with progress bars showing current vs. target for the current period

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No health data exists, first launch | Welcome message with setup prompts for each domain: "Set up sleep tracking", "Connect Apple Health", "Add your medications" |
| Loading | Data is being fetched from SQLite or HealthKit sync is running | Skeleton card placeholders with subtle pulse animation |
| Populated | At least one domain has data | Cards displayed in order with available data; empty domains show setup prompts |
| Partial | Some domains have data, others do not | Mix of populated cards and setup prompt cards |

**Interactions:**
- Tap card header: Toggle expand/collapse
- Tap metric within card: Navigate to that domain's detail screen
- Long press card: Enter reorder mode (drag to reposition)
- Pull-to-refresh: Re-sync HealthKit data (if enabled) and refresh all cards
- Tap floating action button: Show quick-log radial menu

**Transitions/Animations:**
- Cards expand/collapse with a 200ms ease-in-out height animation
- Pull-to-refresh shows a subtle health-pulse animation at the top
- Quick-log menu items fan out from the FAB with staggered 50ms delays

#### 3.6 Data Requirements

The Health Dashboard reads from multiple existing entities. It does not introduce new entities but queries across:
- `hl_sleep_sessions` (sleep card)
- `hl_vitals` (vitals card, activity card)
- `hl_goals` + `hl_goal_progress` (goals card)
- `md_medications` + `md_dose_logs` + `md_reminders` (medications card)
- `ft_fasting_sessions` (fasting card)
- `hl_settings` (card order, display preferences)

No new tables are required. Card ordering preferences are stored in `hl_settings` with key `dashboard.cardOrder` as a JSON array of domain keys.

#### 3.7 Business Logic Rules

##### Dashboard Card Ordering

**Purpose:** Determine the display order of domain cards.

**Logic:**
```
1. Load user's custom card order from hl_settings (key: 'dashboard.cardOrder')
2. IF custom order exists THEN
     Use that order, appending any new domains not in the saved order at the end
   ELSE
     Use default order: ['sleep', 'activity', 'vitals', 'medications', 'fasting', 'goals']
3. For each domain, check if data exists
4. Domains with data render as populated cards
5. Domains without data render as setup prompt cards (sorted to the bottom)
```

##### Quick-Log Menu Options

**Purpose:** Provide contextual quick-logging actions.

**Logic:**
```
1. Always show: Log Sleep, Log Vital, Mood Check-In
2. IF MyFast is enabled AND no active fast THEN show "Start Fast"
3. IF MyFast is enabled AND active fast running THEN show "End Fast"
4. IF medications exist with pending doses THEN show "Log Dose"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| HealthKit sync fails | Small warning badge on Activity/Vitals card: "Sync paused" | Tap badge to retry sync or check HealthKit permissions |
| Absorbed module table missing | Card for that domain hidden silently | No action needed; card reappears if module is re-enabled |
| Database read error | Toast: "Could not load health data. Please try again." | Pull-to-refresh retries all queries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has sleep, vitals, and medication data,
   **When** they open the Today tab,
   **Then** they see populated cards for Sleep, Vitals, and Medications with current data, and setup prompts for empty domains.

2. **Given** the user has reordered cards (moved Vitals above Sleep),
   **When** they close and reopen the app,
   **Then** the card order is preserved with Vitals above Sleep.

3. **Given** the user taps the floating action button,
   **When** the quick-log menu appears,
   **Then** it shows contextual options based on enabled modules and current state.

**Edge Cases:**

4. **Given** MyHealth is enabled but no absorbed modules have data,
   **When** the dashboard loads,
   **Then** all cards show setup prompts and a welcome message encourages the user to start with one domain.

5. **Given** HealthKit sync is running,
   **When** the user pulls to refresh,
   **Then** the refresh waits for the in-progress sync to complete rather than starting a duplicate sync.

**Negative Tests:**

6. **Given** the database is corrupted,
   **When** the dashboard attempts to load,
   **Then** the system shows an error toast "Could not load health data" and does not crash.
   **And** no data is modified.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| returns default card order when no custom order saved | No `dashboard.cardOrder` setting | `['sleep', 'activity', 'vitals', 'medications', 'fasting', 'goals']` |
| preserves custom card order | Setting: `['vitals', 'sleep', 'activity']` | Cards in that order, missing domains appended |
| quick-log menu shows "Start Fast" when no active fast | MyFast enabled, no active session | Menu includes "Start Fast" option |
| quick-log menu shows "End Fast" when fast active | MyFast enabled, active session exists | Menu includes "End Fast" option |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Dashboard loads with multi-module data | 1. Seed sleep, vitals, medication data, 2. Open dashboard | All three cards populated with correct summary metrics |
| Card reorder persists | 1. Drag Vitals card above Sleep, 2. Close app, 3. Reopen | Vitals card appears above Sleep card |

---

### HL-002: Wellness Timeline

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-002 |
| **Feature Name** | Wellness Timeline |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Manager, I want to see a chronological feed of all my health events (doses taken, vitals logged, sleep sessions, fasting windows, mood entries), so that I can see the full picture of my health in one timeline.

**Secondary:**
> As a Health-Conscious Professional, I want to filter the timeline by domain (sleep only, vitals only), so that I can focus on a specific area when reviewing my history.

#### 3.3 Detailed Description

The Wellness Timeline is a unified chronological feed of all health events across every domain that MyHealth tracks. Each entry in the timeline represents a discrete health event: a medication dose taken, a vital sign logged, a sleep session completed, a fasting window started/ended, a mood check-in recorded, a health goal milestone reached, or a symptom logged.

The timeline aggregates data from multiple module tables by querying each source, normalizing events into a common `TimelineEntry` shape (timestamp, domain, event_type, title, subtitle, icon, accent_color, metadata), and sorting by timestamp descending. The timeline supports infinite scrolling with pagination (50 events per page).

Users can filter the timeline by domain (show only sleep events, only medication events, etc.), by date range (this week, this month, custom range), or by a combination of both. A search bar allows text-based filtering on event titles and subtitles.

This feature is unique to MyLife since no competitor aggregates health events from medications, fasting, sleep, vitals, mood, and activity into a single chronological view.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-001: Health Dashboard - timeline is accessible from the dashboard and the Insights tab

**External Dependencies:**
- At least one health domain must have data to display a non-empty timeline

**Assumed Capabilities:**
- User can navigate to the timeline via the Insights tab or a link from the dashboard

#### 3.5 User Interface Requirements

##### Screen: Wellness Timeline

**Layout:**
- Top bar with "Wellness Timeline" title and a filter icon button on the right
- Below the top bar, a horizontal scrollable row of domain filter chips: All, Sleep, Vitals, Meds, Fasting, Mood, Activity, Goals
- Tapping a chip toggles that domain on/off. "All" resets to showing everything.
- A date range selector appears below the chips when the filter icon is tapped (toggle visibility)
- Main content is a vertical scrollable list of timeline entries grouped by date
- Each date group has a sticky date header ("Today", "Yesterday", "Mon, Mar 4", etc.)
- Each timeline entry is a row with: domain icon (left), event title (bold), event subtitle (secondary text), timestamp (right-aligned)
- Entries within the same date group are sorted by time, newest first

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No health events exist across any domain | Centered illustration with text: "No health events yet. Start tracking to build your timeline." |
| Loading | Querying multiple tables | Skeleton list items with shimmer animation |
| Populated | Events exist | Grouped, sorted timeline entries |
| Filtered (no results) | Active filters match zero events | Message: "No events match your filters" with a "Clear filters" button |

**Interactions:**
- Tap domain chip: Toggle filter for that domain. Active chips are filled with domain accent color; inactive chips are outlined
- Tap timeline entry: Navigate to the relevant detail screen (sleep detail, vital detail, med detail, etc.)
- Scroll to bottom: Load next page of 50 events (infinite scroll)
- Tap filter icon: Toggle date range picker visibility

#### 3.6 Data Requirements

##### Entity: TimelineEntry (computed, not persisted)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Composite: `{domain}_{source_id}` | Auto | Unique identifier combining domain and source record ID |
| domain | enum | One of: sleep, vitals, meds, fasting, mood, activity, goals | None | Which health domain this event belongs to |
| event_type | string | Domain-specific event type | None | E.g., "dose_taken", "vital_logged", "sleep_completed", "fast_started" |
| title | string | Required | None | Human-readable event title, e.g., "Took Metformin 500mg" |
| subtitle | string | Optional | null | Secondary info, e.g., "Morning dose - on time" |
| icon | string | Required | None | Icon identifier for the event type |
| accent_color | string | Hex color | Domain default | Color for the timeline entry indicator |
| timestamp | datetime | ISO 8601 | None | When the event occurred |
| metadata | JSON | Optional | null | Domain-specific extra data for the detail view |

**Note:** TimelineEntry is a computed view, not a stored table. It is assembled at query time by reading from source tables.

#### 3.7 Business Logic Rules

##### Timeline Assembly Algorithm

**Purpose:** Assemble a unified timeline from multiple data sources.

**Inputs:**
- domains: string[] - which domains to include (default: all)
- startDate: string - ISO date for range start (default: 30 days ago)
- endDate: string - ISO date for range end (default: now)
- page: number - pagination offset (default: 0)
- pageSize: number - entries per page (default: 50)

**Logic:**
```
1. For each enabled domain in the filter:
   a. Query the relevant table(s) for events within [startDate, endDate]
   b. Transform each row into a TimelineEntry shape
2. Merge all TimelineEntry arrays into one combined array
3. Sort by timestamp descending
4. Apply pagination: skip (page * pageSize), take pageSize
5. Group entries by date for display
6. RETURN grouped entries and hasMore flag
```

**Data Source Mapping:**

| Domain | Source Table(s) | Event Types |
|--------|----------------|-------------|
| sleep | hl_sleep_sessions | sleep_completed |
| vitals | hl_vitals | vital_logged |
| meds | md_dose_logs, md_medications | dose_taken, dose_missed, dose_skipped |
| fasting | ft_fasting_sessions | fast_started, fast_completed, fast_broken |
| mood | md_mood_entries | mood_logged |
| activity | hl_vitals (steps, active_energy) | activity_logged |
| goals | hl_goal_progress | goal_milestone, goal_completed |

**Edge Cases:**
- If a domain's source table does not exist (module not yet enabled), skip that domain silently
- If all domains are filtered out, show "No events match your filters"
- Maximum date range for a single query: 365 days. Ranges beyond this are clamped.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| One domain's table query fails | Timeline loads with other domains; failed domain silently omitted | Next refresh retries all domains |
| All queries fail | Error message: "Could not load timeline. Please try again." | Pull-to-refresh retries |
| Pagination returns zero additional results | "No more events" footer message | Infinite scroll stops requesting |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has medication doses, sleep sessions, and vitals logged,
   **When** they open the Wellness Timeline,
   **Then** they see all events in chronological order with correct icons and domain colors.

2. **Given** the user taps the "Sleep" filter chip,
   **When** the timeline refreshes,
   **Then** only sleep-related events are shown, and the "Sleep" chip is filled with the sleep domain accent color.

3. **Given** the timeline has 120 events,
   **When** the user scrolls to the bottom,
   **Then** the next 50 events load automatically (infinite scroll).

**Edge Cases:**

4. **Given** only MyMeds has data (no sleep, no vitals),
   **When** the timeline loads,
   **Then** only medication events appear, and other domain chips are visually dimmed.

**Negative Tests:**

5. **Given** the user filters by "Activity" but has no activity data,
   **When** the filter is applied,
   **Then** the timeline shows "No events match your filters" with a "Clear filters" button.
   **And** no data is modified.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| assembles timeline from multiple domains | Sleep session + vital + dose log | 3 TimelineEntry objects sorted by timestamp desc |
| filters timeline by single domain | domain filter: ['sleep'], mixed data | Only sleep entries returned |
| paginates correctly | 75 entries, page 0, pageSize 50 | 50 entries, hasMore = true |
| paginates second page | 75 entries, page 1, pageSize 50 | 25 entries, hasMore = false |
| handles missing domain table | meds table does not exist | Timeline loads without meds events, no error thrown |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full timeline with all domains | 1. Seed data in sleep, vitals, meds, fasting, 2. Open timeline | All events appear grouped by date, sorted by time within each group |
| Filter toggle | 1. Open timeline, 2. Tap "Meds" chip, 3. Verify only med events, 4. Tap "Meds" again | First: only med events. After second tap: all events restored |

---

### HL-003: Sleep Session Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-003 |
| **Feature Name** | Sleep Session Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Sleep Optimizer, I want to log my sleep sessions with bedtime, wake time, and optional notes, so that I can build a history of my sleep patterns and identify trends.

**Secondary:**
> As a Health-Conscious Professional, I want my Apple Watch sleep data to automatically appear in MyHealth, so that I do not have to manually enter what my watch already tracked.

#### 3.3 Detailed Description

Sleep Session Logging allows users to record sleep sessions either manually or automatically via HealthKit sync. Each session captures bedtime (start_time), wake time (end_time), duration (auto-calculated), optional sleep stage breakdown (deep, REM, light, awake minutes), data source (manual, apple_health, health_connect, imported), and freeform notes.

Manual entry presents a simple form with time pickers for bedtime and wake time. The system auto-calculates duration. Stage breakdown fields are optional for manual entry but are automatically populated when data comes from HealthKit (Apple Watch) or Health Connect (Android wearables).

Upon saving, the system computes a sleep quality score (see HL-004) and stores the session in `hl_sleep_sessions`. Sessions are displayed in a scrollable list on the Sleep Detail screen, sorted by most recent first.

The sleep log is the foundation for higher-level features: sleep stage analysis (HL-014), sleep bank (HL-023), readiness score (HL-017), and smart alarm (HL-021).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (foundational feature)

**External Dependencies:**
- Local SQLite database
- HealthKit permission for automatic sleep data (optional; manual entry works without it)

**Assumed Capabilities:**
- User can navigate to the sleep section from the Today tab or Vitals tab

#### 3.5 User Interface Requirements

##### Screen: Sleep Log List

**Layout:**
- Top header: "Sleep" with a "+" button to log a new session
- Below the header, a summary card showing: average sleep duration (7-day), average quality score (7-day), last night's sleep duration and score
- Main content is a scrollable list of sleep session cards
- Each card displays: date label (e.g., "Last Night", "Mon, Mar 3"), bedtime and wake time, duration in hours and minutes, quality score as a colored badge (green 75-100, yellow 50-74, red 0-49), sleep stage bar chart if stage data is available

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No sleep sessions exist | Illustration of a moon with text: "No sleep data yet. Log your first night or connect Apple Health." Two buttons: "Log Sleep" and "Connect Health" |
| Populated | Sessions exist | Summary card + scrollable list of session cards |

**Interactions:**
- Tap "+": Open Log Sleep modal
- Tap session card: Navigate to Sleep Detail screen for that session
- Swipe left on card: Reveal delete button (with confirmation)

##### Modal: Log Sleep

**Layout:**
- Title: "Log Sleep"
- Bedtime picker: scrollable time picker, default: yesterday 10:00 PM
- Wake time picker: scrollable time picker, default: today 6:30 AM
- Calculated duration display (auto-updates as times change): e.g., "8h 30m"
- Optional expandable section "Sleep Stages" with numeric inputs for Deep, REM, Light, Awake minutes
- Notes text field (optional, max 500 characters)
- "Save" button (primary) and "Cancel" button

**Validation:**
- Wake time must be after bedtime
- Duration must be between 30 minutes and 24 hours
- If stage breakdown is provided, deep + REM + light + awake must be less than or equal to total duration
- Bedtime must not be in the future

#### 3.6 Data Requirements

##### Entity: SleepSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier (format: `hl_slp_{timestamp}_{random}`) |
| start_time | datetime | Required, ISO 8601 | None | Bedtime |
| end_time | datetime | Required, ISO 8601, must be after start_time | None | Wake time |
| duration_minutes | integer | Computed: (end_time - start_time) in minutes | Computed | Total time in bed |
| deep_minutes | integer | Min: 0, nullable | null | Minutes in deep sleep stage |
| rem_minutes | integer | Min: 0, nullable | null | Minutes in REM sleep stage |
| light_minutes | integer | Min: 0, nullable | null | Minutes in light sleep stage |
| awake_minutes | integer | Min: 0, nullable | null | Minutes awake during session |
| quality_score | float | 0.0 to 100.0, nullable | Computed | Sleep quality score (see HL-004) |
| source | enum | One of: manual, apple_health, health_connect, imported | manual | Data source |
| notes | string | Max 500 chars, nullable | null | User notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- `start_time` - frequently queried for sorting and date range filtering
- `end_time` - used for date range queries

**Example Data:**
```json
{
  "id": "hl_slp_1709676000_a3b7c9d2",
  "start_time": "2026-03-05T22:30:00Z",
  "end_time": "2026-03-06T06:15:00Z",
  "duration_minutes": 465,
  "deep_minutes": 95,
  "rem_minutes": 110,
  "light_minutes": 220,
  "awake_minutes": 40,
  "quality_score": 78,
  "source": "apple_health",
  "notes": "Felt rested",
  "created_at": "2026-03-06T06:20:00Z"
}
```

#### 3.7 Business Logic Rules

##### Duration Calculation

**Purpose:** Auto-calculate sleep duration from bedtime and wake time.

**Logic:**
```
1. Parse start_time and end_time as Date objects
2. duration_minutes = ROUND((end_time - start_time) / 60000)
3. IF duration_minutes < 30 THEN reject with validation error
4. IF duration_minutes > 1440 THEN reject with validation error
5. RETURN duration_minutes
```

##### Stage Validation

**Purpose:** Ensure sleep stage breakdown is consistent with total duration.

**Logic:**
```
1. IF any stage field is provided THEN
     total_stages = (deep_minutes ?? 0) + (rem_minutes ?? 0) + (light_minutes ?? 0) + (awake_minutes ?? 0)
     IF total_stages > duration_minutes THEN
       REJECT: "Stage minutes cannot exceed total duration"
2. RETURN valid
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Wake time before bedtime | Inline validation: "Wake time must be after bedtime" | User adjusts time picker |
| Duration < 30 minutes | Inline validation: "Sleep session must be at least 30 minutes" | User adjusts times |
| Duration > 24 hours | Inline validation: "Sleep session cannot exceed 24 hours" | User adjusts times |
| Stage minutes exceed duration | Inline validation: "Stage breakdown exceeds total duration by X minutes" | User adjusts stage inputs |
| Database write fails | Toast: "Could not save sleep session. Please try again." | User taps retry |

**Validation Timing:**
- Duration validation runs on every time picker change
- Stage validation runs on blur of any stage input field
- Form-level validation runs on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Sleep Log List,
   **When** they tap "+", set bedtime to 10:30 PM and wake time to 6:00 AM, and tap Save,
   **Then** a new sleep session is created with duration 450 minutes, quality score is computed, and the session appears at the top of the list.

2. **Given** the user has 7 sleep sessions,
   **When** they view the Sleep Log List,
   **Then** the summary card shows accurate 7-day averages for duration and quality score.

3. **Given** HealthKit sync is enabled and Apple Watch recorded sleep with stage data,
   **When** the sync completes,
   **Then** a new session appears with source "apple_health" and populated deep/REM/light/awake fields.

**Edge Cases:**

4. **Given** the user enters bedtime at 11:55 PM and wake time at 12:05 AM (10 minutes),
   **When** they tap Save,
   **Then** the system rejects with "Sleep session must be at least 30 minutes."

**Negative Tests:**

5. **Given** the user enters stage minutes totaling 500 but duration is 450,
   **When** they tap Save,
   **Then** the system rejects with "Stage breakdown exceeds total duration by 50 minutes."
   **And** no session is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes duration correctly | start: 10:30 PM, end: 6:00 AM | 450 minutes |
| computes duration across midnight | start: 11:45 PM, end: 7:15 AM | 450 minutes |
| rejects duration under 30 minutes | start: 11:50 PM, end: 12:05 AM | Validation error |
| rejects duration over 24 hours | start: Monday 10 PM, end: Wednesday 8 AM | Validation error |
| validates stage sum <= duration | duration: 450, stages sum: 500 | Validation error |
| accepts valid stage breakdown | duration: 450, stages sum: 420 | Valid |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log and retrieve sleep session | 1. Log session via modal, 2. Query getSleepSessions | Session appears with computed duration and quality score |
| Delete sleep session | 1. Log session, 2. Swipe to delete, 3. Confirm, 4. Query | Session no longer in results |

---

### HL-004: Sleep Quality Scoring

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-004 |
| **Feature Name** | Sleep Quality Scoring |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Sleep Optimizer, I want each sleep session to receive a quality score from 0 to 100, so that I can objectively compare nights and track improvement over time.

#### 3.3 Detailed Description

Sleep Quality Scoring computes a 0-100 score for every sleep session. The algorithm uses a weighted composite of four factors: duration adequacy (40% weight), deep sleep proportion (30%), REM sleep proportion (20%), and awake time penalty (10%). When sleep stage data is unavailable (manual entry without stage breakdown), the score is based solely on duration relative to the user's target sleep hours.

The algorithm is calibrated against sleep science literature: optimal deep sleep is approximately 20% of total sleep time, optimal REM is approximately 25%, and awake time under 10% of total time-in-bed is ideal. The score degrades gracefully if the user oversleeps (sleeping 150% of target caps the duration component at 90, not 100, reflecting that oversleeping is suboptimal).

Quality scores are displayed as colored badges: green (75-100, "Good" to "Excellent"), yellow (50-74, "Fair"), red (0-49, "Poor"). The score is stored in `hl_sleep_sessions.quality_score` and is used by the readiness score (HL-017) and sleep bank (HL-023).

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-003: Sleep Session Logging - provides the input data

**External Dependencies:**
- None

**Assumed Capabilities:**
- Sleep session has been logged with at least start_time and end_time

#### 3.5 User Interface Requirements

##### Component: Quality Score Badge

**Layout:**
- Circular badge with the numeric score (0-100) centered inside
- Badge background color varies by score range:
  - 75-100: Green (#10B981) with label "Excellent" (90+) or "Good" (75-89)
  - 50-74: Yellow/Amber (#F59E0B) with label "Fair"
  - 0-49: Red (#EF4444) with label "Poor"
- Displayed on sleep session cards, sleep detail screen, and dashboard sleep card

##### Screen: Sleep Detail (score section)

**Layout:**
- Large quality score ring at the top (animated fill on load)
- Below the ring, a breakdown card showing each component's contribution:
  - Duration: X/100 (40% weight) - shows actual vs. target hours
  - Deep Sleep: X/100 (30% weight) - shows actual vs. optimal percentage
  - REM Sleep: X/100 (20% weight) - shows actual vs. optimal percentage
  - Awake Time: X/100 (10% weight) - shows actual percentage and penalty
- If stage data is unavailable, only the Duration component is shown with a note: "Connect Apple Health for detailed sleep stage analysis"

#### 3.6 Data Requirements

No new entities. The quality score is a computed value stored in the `quality_score` field of `hl_sleep_sessions`.

#### 3.7 Business Logic Rules

##### Sleep Quality Score Algorithm

**Purpose:** Compute a 0-100 sleep quality score from session data.

**Inputs:**
- durationMinutes: number - total time in bed
- deepMinutes: number | null - minutes in deep sleep
- remMinutes: number | null - minutes in REM sleep
- awakeMinutes: number | null - minutes awake during session
- targetHours: number - user's target sleep duration (default: 8)

**Logic:**
```
1. targetMinutes = targetHours * 60
2. durationRatio = durationMinutes / targetMinutes

3. Compute Duration Score (0-100):
   IF durationRatio >= 1.0 THEN
     durationScore = MAX(90, 100 - (durationRatio - 1.0) * 20)
     // Oversleeping by 50% of target drops to 90. Exactly on target = 100.
   ELSE
     durationScore = durationRatio * 100
     // 50% of target = 50 score. 75% = 75 score.

4. IF deepMinutes is null AND remMinutes is null THEN
     // No stage data available - use duration only
     finalScore = ROUND(CLAMP(durationScore, 0, 100))
     RETURN finalScore

5. sleepMinutes = durationMinutes - (awakeMinutes ?? 0)
   IF sleepMinutes <= 0 THEN RETURN 0

6. Compute Deep Sleep Score (0-100):
   deepPct = (deepMinutes ?? 0) / sleepMinutes
   deepScore = MIN(100, (deepPct / 0.20) * 100)
   // 20% deep sleep = 100. 10% = 50. 25%+ caps at 100.

7. Compute REM Score (0-100):
   remPct = (remMinutes ?? 0) / sleepMinutes
   remScore = MIN(100, (remPct / 0.25) * 100)
   // 25% REM = 100. 12.5% = 50. 30%+ caps at 100.

8. Compute Awake Penalty Score (0-100):
   awakePct = (awakeMinutes ?? 0) / durationMinutes
   awakeScore = MAX(0, 100 - awakePct * 200)
   // 0% awake = 100. 10% awake = 80. 50%+ awake = 0.

9. Weighted composite:
   finalScore = durationScore * 0.40
              + deepScore * 0.30
              + remScore * 0.20
              + awakeScore * 0.10

10. RETURN ROUND(CLAMP(finalScore, 0, 100))
```

**Formulas:**
- `durationScore = durationRatio >= 1.0 ? max(90, 100 - (durationRatio - 1) * 20) : durationRatio * 100`
- `deepScore = min(100, (deepPct / 0.20) * 100)`
- `remScore = min(100, (remPct / 0.25) * 100)`
- `awakeScore = max(0, 100 - awakePct * 200)`
- `finalScore = round(clamp(durationScore * 0.4 + deepScore * 0.3 + remScore * 0.2 + awakeScore * 0.1, 0, 100))`

**Edge Cases:**
- All awake (awakeMinutes == durationMinutes): score = 0
- Zero duration: score = 0
- No stage data: score = duration-only calculation
- Oversleep (12 hours for 8-hour target): duration score = max(90, 100 - 0.5 * 20) = 90
- Perfect night (8h, 20% deep, 25% REM, 5% awake): score = 100 * 0.4 + 100 * 0.3 + 100 * 0.2 + 90 * 0.1 = 99

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Negative duration | Score computation returns 0 | Defensive clamp prevents negative scores |
| Stage data inconsistent (sum > duration) | Score computed with available data; no crash | Validation at input layer should prevent this |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a sleep session of 8 hours with no stage data,
   **When** the quality score is computed,
   **Then** the score is 100 (exactly meeting 8-hour target).

2. **Given** a session of 7h with 85min deep, 105min REM, 190min light, 40min awake,
   **When** the quality score is computed,
   **Then** the score reflects weighted components: duration ~87.5, deep ~100 (85/380=22.4%/20%), REM ~100 (105/380=27.6%/25%), awake ~81 (40/420=9.5%).

3. **Given** a session of 4 hours (50% of 8h target) with no stage data,
   **When** the score is computed,
   **Then** the score is 50 and the badge is red with "Poor" label.

**Edge Cases:**

4. **Given** a session where the user was awake the entire time (awake = duration),
   **When** the score is computed,
   **Then** the score is 0.

5. **Given** a session of 12 hours (150% of target),
   **When** the score is computed with no stage data,
   **Then** the duration score is 90 (penalized for oversleeping), final score is 90.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| perfect 8h no stages | duration: 480, target: 8 | score: 100 |
| half target no stages | duration: 240, target: 8 | score: 50 |
| oversleep 12h no stages | duration: 720, target: 8 | score: 90 |
| perfect with stages | dur: 480, deep: 82, rem: 100, light: 258, awake: 40 | score ~97 |
| all awake | dur: 480, deep: 0, rem: 0, light: 0, awake: 480 | score: 0 |
| zero duration | dur: 0 | score: 0 |
| no deep sleep | dur: 480, deep: 0, rem: 100, light: 340, awake: 40 | low score (deep component = 0) |

---

### HL-005: Vitals Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-005 |
| **Feature Name** | Vitals Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Manager, I want to log and view my vital signs (blood pressure, heart rate, weight, temperature, blood oxygen), so that I can track my health metrics over time and share trends with my doctor.

**Secondary:**
> As a Fitness Recovery Tracker, I want my Apple Watch heart rate, HRV, and blood oxygen data to automatically appear in MyHealth, so that I can monitor recovery without manual entry.

#### 3.3 Detailed Description

Vitals Tracking provides CRUD operations for recording vital sign measurements. Supported vital types: heart_rate, resting_heart_rate, hrv (heart rate variability), blood_oxygen (SpO2), blood_pressure (systolic/diastolic), body_temperature, steps, active_energy, respiratory_rate, and vo2_max. Each vital reading stores the value, an optional secondary value (used for blood pressure diastolic), unit, source (manual or HealthKit/Health Connect), and timestamp.

Manual entry presents a form with a vital type picker, value input with appropriate keyboard (numeric), unit selector, and optional timestamp override. HealthKit sync populates vitals automatically for users with Apple Watch or other HealthKit-connected devices.

The Vitals tab shows a grid of vital type cards, each displaying the latest reading and a sparkline trend. Tapping a card opens the Vital Detail screen with a full trend chart and reading history.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (foundational feature)

**External Dependencies:**
- Local SQLite database
- HealthKit/Health Connect permissions for automatic data (optional)

**Assumed Capabilities:**
- User can navigate to the Vitals tab

#### 3.5 User Interface Requirements

##### Screen: Vitals Grid

**Layout:**
- Top header: "Vitals" with a "+" button to log a new reading
- Main content: 2-column grid of vital type cards
- Each card shows: vital type icon, name, latest value with unit, mini sparkline of last 7 readings, timestamp of latest reading ("2h ago", "Yesterday")
- Cards are ordered: Heart Rate, Resting HR, HRV, Blood Oxygen, Blood Pressure, Weight, Temperature, Steps, Active Energy, Respiratory Rate, VO2 Max
- Cards without any data show a dashed outline with "Tap to log" text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No vitals logged | Grid of dashed-outline cards with prompt: "Start tracking your vitals" |
| Populated | At least one vital has data | Mix of populated cards (with data) and empty cards (dashed outline) |

**Interactions:**
- Tap populated card: Navigate to Vital Detail screen for that type
- Tap empty card: Open Log Vital modal pre-filled with that vital type
- Tap "+": Open Log Vital modal with type picker

##### Modal: Log Vital

**Layout:**
- Title: "Log Vital"
- Vital type picker (scrollable horizontal chips or dropdown)
- Value input: numeric keyboard, appropriate step size per type
  - Heart rate: integer, BPM
  - Blood pressure: two fields (systolic/diastolic), mmHg
  - Blood oxygen: percentage with one decimal, %
  - Temperature: one decimal, F or C (respects user's unit preference)
  - Weight: one decimal, lbs or kg
  - Steps: integer
  - Active energy: integer, kcal
  - HRV: integer, ms
- Timestamp: defaults to "Now", user can override with date/time picker
- Save and Cancel buttons

**Validation per vital type:**

| Vital Type | Min | Max | Unit |
|-----------|-----|-----|------|
| heart_rate | 20 | 300 | bpm |
| resting_heart_rate | 20 | 200 | bpm |
| hrv | 1 | 300 | ms |
| blood_oxygen | 50 | 100 | % |
| blood_pressure (systolic) | 60 | 300 | mmHg |
| blood_pressure (diastolic) | 30 | 200 | mmHg |
| body_temperature | 90.0 / 32.0 | 110.0 / 44.0 | F / C |
| steps | 0 | 200000 | steps |
| active_energy | 0 | 10000 | kcal |
| respiratory_rate | 4 | 60 | breaths/min |
| vo2_max | 10 | 100 | mL/kg/min |

##### Screen: Vital Detail

**Layout:**
- Top: vital type name, latest value prominently displayed, change indicator (up/down arrow with percentage vs. previous reading)
- Chart area: line chart showing values over time. Default view: 30 days. Toggle buttons for 7d, 30d, 90d, 1y, All
- Below chart: scrollable list of individual readings with timestamp, value, and source indicator
- For blood pressure: chart shows both systolic and diastolic as dual lines with shaded zone between them
- AHA blood pressure classification bands shown as colored horizontal zones on BP chart:
  - Normal: < 120/80 (green zone)
  - Elevated: 120-129 / < 80 (yellow zone)
  - High Stage 1: 130-139 / 80-89 (orange zone)
  - High Stage 2: 140+ / 90+ (red zone)

#### 3.6 Data Requirements

##### Entity: Vital

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier (format: `hl_vit_{timestamp}_{random}`) |
| vital_type | enum | One of: heart_rate, resting_heart_rate, hrv, blood_oxygen, blood_pressure, body_temperature, steps, active_energy, respiratory_rate, vo2_max | None | Type of vital sign measurement |
| value | float | Required, see validation table for type-specific ranges | None | Primary measurement value (systolic for BP) |
| value_secondary | float | Nullable | null | Secondary value (diastolic for blood pressure) |
| unit | string | Required | None | Measurement unit (bpm, mmHg, %, F, C, steps, kcal, ms, breaths/min, mL/kg/min) |
| source | enum | One of: manual, apple_health, health_connect, imported | manual | Data source |
| recorded_at | datetime | Required, ISO 8601 | Current timestamp | When the measurement was taken |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- `(vital_type, recorded_at)` - composite index for filtered, sorted queries
- `source` - for filtering by data source

**Example Data:**
```json
{
  "id": "hl_vit_1709676000_x7k2m9p4",
  "vital_type": "blood_pressure",
  "value": 128,
  "value_secondary": 82,
  "unit": "mmHg",
  "source": "manual",
  "recorded_at": "2026-03-06T08:30:00Z",
  "created_at": "2026-03-06T08:31:00Z"
}
```

#### 3.7 Business Logic Rules

##### Vital Aggregation

**Purpose:** Compute daily aggregates for trend visualization.

**Inputs:**
- vitalType: VitalType
- days: number (default: 30)

**Logic:**
```
1. Query hl_vitals WHERE vital_type = vitalType AND recorded_at >= (now - days)
2. GROUP BY DATE(recorded_at)
3. For each day, compute: AVG(value), MIN(value), MAX(value), COUNT(*)
4. RETURN array of VitalAggregate sorted by date ASC
```

##### Blood Pressure Classification

**Purpose:** Classify blood pressure readings per AHA guidelines.

**Logic:**
```
1. IF systolic < 120 AND diastolic < 80 THEN classification = "Normal"
2. IF systolic 120-129 AND diastolic < 80 THEN classification = "Elevated"
3. IF systolic 130-139 OR diastolic 80-89 THEN classification = "High (Stage 1)"
4. IF systolic >= 140 OR diastolic >= 90 THEN classification = "High (Stage 2)"
5. IF systolic > 180 OR diastolic > 120 THEN classification = "Hypertensive Crisis"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Value outside valid range | Inline validation: "Heart rate must be between 20 and 300 bpm" | User corrects value |
| Blood pressure diastolic >= systolic | Inline validation: "Diastolic must be less than systolic" | User corrects values |
| Database write fails | Toast: "Could not save vital reading. Please try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "+" on the Vitals screen,
   **When** they select "Blood Pressure", enter 125/82, and tap Save,
   **Then** a vital reading is created and the Blood Pressure card shows "125/82 mmHg" with "Normal" classification.

2. **Given** the user has 30 days of heart rate data,
   **When** they tap the Heart Rate card,
   **Then** the Vital Detail screen shows a line chart with daily averages and a list of individual readings.

**Edge Cases:**

3. **Given** the user enters a systolic of 75 (below diastolic range),
   **When** they tap Save,
   **Then** the system accepts it (75 is above the 60 minimum for systolic), but flags it with "Unusually low reading" note.

**Negative Tests:**

4. **Given** the user enters a heart rate of 500,
   **When** they attempt to save,
   **Then** the system rejects with "Heart rate must be between 20 and 300 bpm."
   **And** no vital is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| classifies normal BP | systolic: 118, diastolic: 76 | "Normal" |
| classifies elevated BP | systolic: 125, diastolic: 75 | "Elevated" |
| classifies stage 1 hypertension | systolic: 135, diastolic: 85 | "High (Stage 1)" |
| classifies stage 2 hypertension | systolic: 145, diastolic: 95 | "High (Stage 2)" |
| classifies hypertensive crisis | systolic: 185, diastolic: 125 | "Hypertensive Crisis" |
| rejects out-of-range heart rate | value: 500 | Validation error |
| accepts edge-case heart rate | value: 300 | Valid |
| computes daily aggregates | 5 readings over 3 days | 3 aggregate entries with correct AVG/MIN/MAX |

---

### HL-006: Emergency Medical Info (ICE Card)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-006 |
| **Feature Name** | Emergency Medical Info (ICE Card) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As any MyHealth user, I want to store my emergency medical information (blood type, allergies, conditions, emergency contacts), so that first responders can access critical information if I am incapacitated.

#### 3.3 Detailed Description

The Emergency Medical Info feature stores a singleton "ICE card" (In Case of Emergency) containing the user's critical medical information. Fields include: full name, date of birth, blood type, allergies (freeform text, comma-separated), medical conditions, emergency contacts (name, relationship, phone number - up to 5), insurance provider and policy details, primary physician name and phone, organ donor status, and freeform notes.

The ICE card is accessible from the Vault tab. Users can optionally make it accessible from the device lock screen (iOS Medical ID integration via HealthKit, opt-in). The card is displayed in a clear, scannable format optimized for emergency situations: large text, high contrast, critical information first.

This is a singleton record: there is only one ICE card per user, stored with a fixed ID of "profile" in `hl_emergency_info`.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

**External Dependencies:**
- Local SQLite database

**Assumed Capabilities:**
- User can navigate to the Vault tab

#### 3.5 User Interface Requirements

##### Screen: Emergency Info View

**Layout:**
- Red/emergency-themed header with medical cross icon and "Emergency Info" title
- Content is a vertically scrollable card with high-contrast text (white on dark or black on white, respecting system theme)
- Sections in order of emergency priority:
  1. **Name and DOB** - Full name, date of birth, age
  2. **Blood Type** - Large, bold display (e.g., "O+")
  3. **Allergies** - List of allergies, each on its own line with warning icon
  4. **Medical Conditions** - List of conditions
  5. **Emergency Contacts** - Name, relationship, phone (tappable to call)
  6. **Medications** - Auto-populated from MyMeds active medications list
  7. **Insurance** - Provider, policy number, group number
  8. **Physician** - Name, phone (tappable to call)
  9. **Organ Donor** - Yes/No badge
  10. **Notes** - Freeform text
- "Edit" button in the top-right corner

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No emergency info entered | Prompt: "Set up your emergency info. This could save your life." with "Get Started" button |
| Populated | At least one field has data | Full ICE card display |

##### Screen: Emergency Info Edit

**Layout:**
- Form with fields matching the view layout
- Blood type: picker with options A+, A-, B+, B-, AB+, AB-, O+, O-
- Allergies: text area (comma-separated or one per line)
- Conditions: text area
- Emergency contacts: up to 5 entries, each with name (text), relationship (picker: Spouse, Parent, Sibling, Child, Friend, Other), phone (phone keyboard)
- "Add Contact" button (disabled if 5 contacts already exist)
- Insurance fields: provider (text), policy number (text), group number (text)
- Physician: name (text), phone (phone keyboard)
- Organ donor: toggle switch
- Notes: text area (max 1000 characters)
- Save button

#### 3.6 Data Requirements

##### Entity: EmergencyInfo

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, fixed value "profile" | "profile" | Singleton identifier |
| full_name | string | Max 255 chars, nullable | null | User's full legal name |
| date_of_birth | date | ISO date, nullable | null | Date of birth |
| blood_type | enum | One of: A+, A-, B+, B-, AB+, AB-, O+, O-, null | null | Blood type |
| allergies | string | Nullable, JSON array or comma-separated | null | Known allergies |
| conditions | string | Nullable, JSON array or comma-separated | null | Medical conditions |
| emergency_contacts | string | Nullable, JSON array of {name, relationship, phone} | null | Up to 5 emergency contacts |
| insurance_provider | string | Max 255 chars, nullable | null | Insurance company name |
| insurance_policy_number | string | Max 100 chars, nullable | null | Policy number |
| insurance_group_number | string | Max 100 chars, nullable | null | Group number |
| primary_physician | string | Max 255 chars, nullable | null | Doctor's name |
| physician_phone | string | Max 20 chars, nullable | null | Doctor's phone |
| organ_donor | boolean | Nullable | null | Organ donor status |
| notes | string | Max 1000 chars, nullable | null | Additional notes |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last update time |

**Example Data:**
```json
{
  "id": "profile",
  "full_name": "Trey Smith",
  "date_of_birth": "1992-07-15",
  "blood_type": "O+",
  "allergies": "[\"Penicillin\", \"Shellfish\"]",
  "conditions": "[\"Asthma\"]",
  "emergency_contacts": "[{\"name\": \"Jane Smith\", \"relationship\": \"Spouse\", \"phone\": \"+14155551234\"}]",
  "insurance_provider": "Blue Shield",
  "insurance_policy_number": "BSC-12345678",
  "insurance_group_number": "GRP-9876",
  "primary_physician": "Dr. Chen",
  "physician_phone": "+14155559876",
  "organ_donor": 1,
  "notes": "EpiPen in left pocket of backpack",
  "updated_at": "2026-03-06T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Emergency Contact Limit

**Purpose:** Enforce maximum of 5 emergency contacts.

**Logic:**
```
1. Parse emergency_contacts JSON array
2. IF array.length >= 5 THEN disable "Add Contact" button
3. When saving, IF array.length > 5 THEN truncate to first 5
```

##### Medications Auto-Population

**Purpose:** Show active medications on the ICE card without manual duplication.

**Logic:**
```
1. Query md_medications WHERE status = 'active'
2. Display medication name and dosage in the Medications section
3. This is read-only - medications are managed through MyMeds
4. IF md_medications table does not exist THEN skip section silently
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save emergency info. Please try again." | User retries save |
| Invalid phone number format | Inline validation: "Please enter a valid phone number" | User corrects input |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens Emergency Info for the first time,
   **When** they see the empty state,
   **Then** a prompt explains the importance of emergency info with a "Get Started" button.

2. **Given** the user fills in blood type, allergies, and one emergency contact,
   **When** they tap Save,
   **Then** the ICE card displays all entered information in the emergency-priority order.

3. **Given** the user has active medications in MyMeds,
   **When** they view the ICE card,
   **Then** the Medications section auto-populates with active medication names and dosages.

**Edge Cases:**

4. **Given** the user has already added 5 emergency contacts,
   **When** they try to add a 6th,
   **Then** the "Add Contact" button is disabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| enforces 5 contact limit | 6 contacts submitted | Only first 5 saved |
| parses allergies JSON | `["Penicillin", "Shellfish"]` | Array of 2 items |
| handles null blood type | blood_type: null | No blood type displayed |
| auto-populates medications | 3 active medications in md_medications | 3 medications listed on ICE card |

---

### HL-007: Health Document Vault

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-007 |
| **Feature Name** | Health Document Vault |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Manager, I want to store my lab results, prescriptions, and insurance cards in a secure vault on my device, so that I can access them at doctor visits without carrying paper copies.

**Secondary:**
> As any user, I want to photograph my insurance card and store it locally, so that I always have it available without relying on a cloud service that might sell my insurance data.

#### 3.3 Detailed Description

The Health Document Vault stores medical documents locally in the SQLite database as BLOBs. Supported document types: lab results, prescriptions, insurance cards, imaging reports, vaccination records, referral letters, discharge summaries, and other. Each document stores the file content (up to 10 MB), a thumbnail for quick preview, metadata (title, type, date, notes, tags), and a star/favorite flag.

Documents are added by capturing a photo, selecting from the photo library, or importing a PDF/image file. The vault displays documents in a grid or list view, filterable by type and sortable by date. Starred documents appear in a dedicated quick-access section.

All document data stays on-device. Documents are stored as BLOBs in the `hl_documents` table, which is protected by the device's file-system encryption. No document content is ever transmitted over the network.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

**External Dependencies:**
- Camera access (for photo capture)
- Photo library access (for image selection)
- File system access (for PDF/file import)
- Local SQLite database

**Assumed Capabilities:**
- User can navigate to the Vault tab

#### 3.5 User Interface Requirements

##### Screen: Document List

**Layout:**
- Top header: "Vault" with "+" button and view toggle (grid/list)
- Filter bar: horizontal scrollable chips for document types (All, Lab Results, Prescriptions, Insurance, Imaging, Vaccination, Referral, Discharge, Other)
- Starred section (if any starred documents): horizontal scrollable row of starred document thumbnails at the top
- Main content: grid (2-column) or list of document cards
- Each card shows: thumbnail (or file type icon if no thumbnail), title, document type badge, date, star indicator

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No documents stored | Illustration with text: "Your health documents are safe here. Add your first document." |
| Populated | Documents exist | Filter bar + optional starred section + document grid/list |
| Filtered (no results) | Active filter matches no documents | "No documents match this filter" |

**Interactions:**
- Tap document card: Open Document Viewer (full-screen image/PDF view)
- Long press document card: Show context menu (Star, Edit, Share, Delete)
- Tap "+": Show action sheet (Take Photo, Choose from Library, Import File)
- Swipe left (list view): Reveal delete button

##### Modal: Add Document

**Layout:**
- After capturing/selecting a file:
  - Preview of the document (image preview or PDF first-page preview)
  - Title input (required, max 255 chars)
  - Type picker: Lab Result, Prescription, Insurance, Imaging, Vaccination, Referral, Discharge, Other
  - Document date picker (optional, defaults to today)
  - Notes text area (optional, max 1000 chars)
  - Tags input (optional, comma-separated)
  - Star toggle
  - Save and Cancel buttons

#### 3.6 Data Requirements

##### Entity: HealthDocument

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| title | string | Required, max 255 chars | None | Document title |
| type | enum | One of: lab_result, prescription, insurance, imaging, vaccination, referral, discharge, other | None | Document category |
| mime_type | string | Required | None | MIME type (image/jpeg, image/png, application/pdf) |
| file_size | integer | Required, max 10,485,760 bytes (10 MB) | None | File size in bytes |
| content | blob | Required, max 10 MB | None | Document file content |
| thumbnail | blob | Nullable | null | Compressed thumbnail for list/grid display |
| notes | string | Max 1000 chars, nullable | null | User notes about the document |
| document_date | date | Nullable | null | Date the document was issued/created |
| is_starred | boolean | - | false | Whether the document is starred/favorited |
| tags | string | Nullable, JSON array of strings | null | User-defined tags |
| created_at | datetime | Auto-set | Current timestamp | When added to vault |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Indexes:**
- `type` - filtering by document type
- `is_starred` - quick access to starred documents
- `document_date` - sorting by document date

#### 3.7 Business Logic Rules

##### File Size Enforcement

**Purpose:** Prevent documents exceeding 10 MB from being stored.

**Logic:**
```
1. Before INSERT, check content.byteLength
2. IF content.byteLength > 10,485,760 THEN
     THROW "Document exceeds maximum size of 10MB"
3. ELSE proceed with save
```

##### Thumbnail Generation

**Purpose:** Generate a compressed thumbnail for grid/list display.

**Logic:**
```
1. IF mime_type starts with "image/" THEN
     Resize to 200x200 max dimension, preserving aspect ratio
     Compress as JPEG at 60% quality
     Store as thumbnail BLOB
2. IF mime_type is "application/pdf" THEN
     Render first page at 200px width
     Compress as JPEG at 60% quality
     Store as thumbnail BLOB
3. ELSE set thumbnail to null (show file type icon instead)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File exceeds 10 MB | Alert: "Document is too large. Maximum size is 10 MB." | User selects a smaller file or compresses |
| Camera permission denied | Alert: "Camera access is required to capture documents. Enable in Settings." | Link to device Settings |
| Unsupported file type | Alert: "Unsupported file type. Please use JPEG, PNG, or PDF." | User selects a supported file |
| Storage full | Alert: "Not enough storage to save this document." | User frees device storage |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "+", selects "Take Photo", captures a lab result, enters title "Blood Panel March 2026", selects type "Lab Result",
   **When** they tap Save,
   **Then** the document appears in the vault grid with a thumbnail, and is filterable under "Lab Results".

2. **Given** the user stars a document,
   **When** they return to the vault list,
   **Then** the document appears in the starred quick-access section at the top.

**Negative Tests:**

3. **Given** the user tries to import a 15 MB PDF,
   **When** the import processes,
   **Then** the system shows "Document is too large. Maximum size is 10 MB."
   **And** no document is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| rejects file over 10 MB | content: 11 MB buffer | Error: "Document exceeds maximum size of 10MB" |
| accepts file at exactly 10 MB | content: 10,485,760 byte buffer | Document created successfully |
| filters by document type | type filter: "lab_result" | Only lab result documents returned |
| returns starred documents | 3 docs, 1 starred | getStarredDocuments returns 1 document |

---

### HL-008: Health Goals

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-008 |
| **Feature Name** | Health Goals |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Health-Conscious Professional, I want to set health goals (10,000 steps/day, 8 hours sleep, lose 5 lbs), so that I can track my progress and stay motivated.

**Secondary:**
> As a Fitness Recovery Tracker, I want to set weekly goals for HRV improvement, so that I can measure whether my recovery protocol is working.

#### 3.3 Detailed Description

Health Goals allows users to create measurable health targets across multiple domains. Each goal specifies a domain (fasting, weight, steps, sleep, adherence, water, vitals, custom), a metric to track, a target value, a measurement unit, a period (daily, weekly, monthly), and a direction (at_least, at_most, exactly).

Goals are displayed on the dashboard and on a dedicated goals screen. Each goal shows a progress bar or ring indicating current progress toward the target for the current period. Progress can be recorded manually or auto-populated from existing data (e.g., steps from HealthKit, sleep duration from sleep sessions).

Goals can be deactivated (hidden from dashboard but data preserved) or deleted (permanently removed with all progress history). Active goals have an optional end date for time-bounded challenges.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone, but enhanced by HL-003, HL-005, HL-012)

**External Dependencies:**
- Local SQLite database

#### 3.5 User Interface Requirements

##### Screen: Goals List

**Layout:**
- Top header: "Health Goals" with "+" button to add a new goal
- Active goals section: scrollable list of goal cards
- Each goal card shows: domain icon, goal label (e.g., "10,000 steps daily"), circular progress ring, current value / target value, streak count (consecutive periods met), period label
- Completed goals section (collapsed by default): historical goals that were deactivated

**Interactions:**
- Tap goal card: Navigate to Goal Detail screen
- Tap "+": Navigate to Add Goal screen
- Long press goal card: Context menu (Edit, Deactivate, Delete)
- Swipe left: Reveal Deactivate/Delete buttons

##### Screen: Add Goal

**Layout:**
- Domain picker: grid of domain icons (Fasting, Weight, Steps, Sleep, Adherence, Water, Vitals, Custom)
- Selecting a domain pre-populates metric and unit suggestions
- Metric input (text, auto-suggest based on domain)
- Target value input (numeric)
- Unit input (auto-filled based on domain, editable)
- Period picker: Daily, Weekly, Monthly
- Direction picker: At Least, At Most, Exactly
- Optional label (custom name for the goal)
- Optional end date picker
- Save button

**Pre-populated suggestions by domain:**

| Domain | Suggested Metrics |
|--------|-------------------|
| steps | Daily steps (steps) |
| sleep | Duration (hours), Quality score (0-100) |
| weight | Body weight (lbs/kg) |
| fasting | Fasts per week (count), Longest fast (hours) |
| adherence | Medication adherence rate (%) |
| water | Daily water intake (oz/mL) |
| vitals | Resting HR (bpm), HRV (ms), Blood pressure (mmHg) |
| custom | User-defined metric and unit |

#### 3.6 Data Requirements

##### Entity: HealthGoal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| domain | enum | One of: fasting, weight, steps, sleep, adherence, water, vitals, custom | None | Health domain |
| metric | string | Required | None | What is being measured (e.g., "daily_steps") |
| target_value | float | Required, > 0 | None | Target value to reach |
| unit | string | Nullable | null | Unit of measurement |
| period | enum | One of: daily, weekly, monthly | daily | How often the goal resets |
| direction | enum | One of: at_least, at_most, exactly | at_least | Whether target is minimum, maximum, or exact |
| label | string | Nullable | null | Custom display name |
| is_active | boolean | - | true | Whether the goal is currently tracked |
| start_date | date | Required | Today | When tracking starts |
| end_date | date | Nullable | null | Optional end date |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

##### Entity: GoalProgress

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| goal_id | string | Foreign key to HealthGoal.id, cascade delete | None | Associated goal |
| period_start | date | Required | None | Start of the measurement period |
| period_end | date | Required | None | End of the measurement period |
| current_value | float | Required | None | Actual value achieved |
| target_value | float | Required | None | Target for this period |
| completed | boolean | - | false | Whether the target was met |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- `is_active` on HealthGoal - filtering active goals
- `domain` on HealthGoal - filtering by domain
- `goal_id` on GoalProgress - querying progress for a goal
- `(goal_id, period_start, period_end)` unique on GoalProgress - one progress entry per period

#### 3.7 Business Logic Rules

##### Goal Completion Evaluation

**Purpose:** Determine if a goal's target is met for a given period.

**Inputs:**
- currentValue: number
- targetValue: number
- direction: GoalDirection

**Logic:**
```
1. SWITCH direction:
   CASE 'at_least': completed = currentValue >= targetValue
   CASE 'at_most': completed = currentValue <= targetValue
   CASE 'exactly': completed = ABS(currentValue - targetValue) < 0.01
2. RETURN completed
```

##### Streak Calculation

**Purpose:** Count consecutive periods where the goal was met.

**Logic:**
```
1. Query GoalProgress for goal_id ORDER BY period_start DESC
2. Count consecutive entries where completed = true, starting from the most recent
3. Stop counting at the first incomplete period
4. RETURN streak count
```

**Edge Cases:**
- Goal with no progress entries: streak = 0
- Goal with all periods completed: streak = total periods count
- Goal deactivated mid-streak: streak freezes at last active value

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Target value <= 0 | Inline validation: "Target must be greater than zero" | User corrects input |
| End date before start date | Inline validation: "End date must be after start date" | User corrects date |
| Duplicate goal for same metric/period | Warning (not blocking): "You already have an active goal for daily steps. Create anyway?" | User confirms or cancels |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a goal "10,000 steps daily" with direction "at_least",
   **When** they log 12,000 steps for today,
   **Then** the goal card shows 12,000/10,000 with a full progress ring and "Completed" badge.

2. **Given** the user has met their sleep goal for 7 consecutive days,
   **When** they view the goal card,
   **Then** the streak counter shows "7-day streak".

**Edge Cases:**

3. **Given** the user creates a weight goal with direction "at_most" (e.g., "at most 180 lbs"),
   **When** they log a weight of 175,
   **Then** the goal is marked as completed (175 <= 180).

4. **Given** the user deactivates a goal,
   **When** they view the goals list,
   **Then** the goal moves to the "Completed Goals" collapsed section and progress data is preserved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| evaluates at_least: met | current: 12000, target: 10000, direction: at_least | completed: true |
| evaluates at_least: not met | current: 8000, target: 10000, direction: at_least | completed: false |
| evaluates at_most: met | current: 175, target: 180, direction: at_most | completed: true |
| evaluates at_most: not met | current: 185, target: 180, direction: at_most | completed: false |
| evaluates exactly: met | current: 8.0, target: 8.0, direction: exactly | completed: true |
| evaluates exactly: close enough | current: 8.005, target: 8.0, direction: exactly | completed: true (within 0.01) |
| evaluates exactly: not met | current: 8.5, target: 8.0, direction: exactly | completed: false |
| computes streak of 5 | 5 consecutive completed periods | streak: 5 |
| computes streak with gap | completed, completed, missed, completed | streak: 2 (resets at miss) |

---

### HL-009: Trend Visualization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-009 |
| **Feature Name** | Trend Visualization |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Manager, I want to see line charts of my blood pressure, weight, and heart rate over time, so that I can share trends with my doctor and understand whether my treatment is working.

**Secondary:**
> As a Sleep Optimizer, I want to see my sleep quality score trend over weeks and months, so that I can identify whether my sleep hygiene changes are making a difference.

#### 3.3 Detailed Description

Trend Visualization provides interactive line charts for all tracked vital types and sleep quality. Charts display daily aggregated values (average, min, max) over configurable time ranges: 7 days, 30 days, 90 days, 1 year, and all time. Users access trends from the Vital Detail screen (for each vital type) and from the Sleep Detail screen (for sleep quality and duration).

Charts support zooming and panning for detailed inspection. A horizontal reference line can be overlaid for clinically significant thresholds (e.g., AHA blood pressure zones, WHO BMI ranges). Overlay markers can show medication starts/stops on the chart (see HL-011 for correlation display).

The chart rendering uses the device's native charting capability (no external service). All data is queried locally from `hl_vitals` and `hl_sleep_sessions`.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-005: Vitals Tracking - provides vital data
- HL-003: Sleep Session Logging - provides sleep data

**External Dependencies:**
- None (all data is local)

#### 3.5 User Interface Requirements

##### Component: Trend Chart

**Layout:**
- Time range selector: row of buttons (7d, 30d, 90d, 1y, All)
- Chart area: line chart with x-axis (dates) and y-axis (values with unit)
- Data points connected by smooth lines
- Tap a data point to see tooltip with exact value, date, and source
- For blood pressure: dual lines (systolic/diastolic) with shaded zone between them and AHA classification bands as colored horizontal regions
- Below the chart: summary statistics for the selected range (avg, min, max, count of readings)

**Chart Types by Vital:**

| Vital | Chart Style | Reference Lines |
|-------|------------|-----------------|
| heart_rate | Single line | Resting HR zone (60-100 bpm) |
| resting_heart_rate | Single line | Normal range (60-100 bpm) |
| hrv | Single line + 7-day rolling average | None (individual baseline) |
| blood_oxygen | Single line | Warning threshold at 90%, concern at 95% |
| blood_pressure | Dual lines (systolic/diastolic) | AHA classification bands |
| body_temperature | Single line | Normal range (97.0-99.0 F / 36.1-37.2 C) |
| steps | Bar chart (daily totals) | Daily goal line if set |
| active_energy | Bar chart (daily totals) | Daily goal line if set |
| weight | Single line | Goal weight line if set |
| sleep_quality | Single line | 75 threshold (good sleep) |
| sleep_duration | Bar chart (nightly totals) | Target hours line |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No data | Selected range has zero readings | Empty chart with message: "No data for this period" |
| Insufficient data | Fewer than 3 readings in range | Scatter plot (dots only, no line) with note: "More data needed for trend analysis" |
| Populated | 3+ readings in range | Connected line chart with tooltips |

#### 3.6 Data Requirements

No new entities. Trend charts query `hl_vitals` via `getVitalAggregates()` and `hl_sleep_sessions` via `getSleepByDateRange()`.

#### 3.7 Business Logic Rules

##### Aggregation by Time Range

**Purpose:** Compute appropriate data granularity based on selected time range.

**Logic:**
```
1. 7d range: show individual data points (no aggregation)
2. 30d range: show daily aggregates (AVG per day)
3. 90d range: show daily aggregates
4. 1y range: show weekly aggregates (AVG per week)
5. All time: show weekly aggregates for the first year, monthly aggregates beyond
```

**Edge Cases:**
- If range has zero data: show empty chart with guidance message
- If range has 1-2 data points: show as scatter (no line connection)
- If a day has multiple readings: use AVG for the line, show MIN/MAX as shaded band

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Chart render fails | Fallback to text-based summary of statistics | None needed |
| Data query timeout (> 3 seconds) | Loading spinner, then partial results if available | Reduce time range automatically |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 30 days of heart rate data (2-3 readings/day),
   **When** they select the 30d range,
   **Then** the chart shows daily averages as a connected line with tooltips on tap.

2. **Given** the user has blood pressure readings,
   **When** they view the BP trend chart,
   **Then** dual systolic/diastolic lines are shown with AHA classification bands as colored background zones.

**Edge Cases:**

3. **Given** the user has only 2 heart rate readings in the last 7 days,
   **When** they select the 7d range,
   **Then** the chart shows 2 dots (no line) with a note "More data needed for trend analysis."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates daily for 30d range | 60 readings over 30 days | 30 aggregate entries |
| aggregates weekly for 1y range | 365 days of data | ~52 aggregate entries |
| returns empty for no-data range | date range with zero readings | Empty array |
| computes correct AVG/MIN/MAX | 3 readings on same day: 70, 80, 90 | avg: 80, min: 70, max: 90 |

---

### HL-010: Health Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-010 |
| **Feature Name** | Health Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Privacy-First Health Tracker, I want to export all my health data in a standard format, so that I own my data completely and can take it with me if I switch apps.

**Secondary:**
> As a Chronic Condition Manager, I want to export my vitals and medication data as a report for my doctor, so that I can share trends without giving my doctor access to my app.

#### 3.3 Detailed Description

Health Data Export allows users to export their health data in multiple formats: JSON (machine-readable, full fidelity), CSV (spreadsheet-compatible, one file per data type), and PDF (formatted report for healthcare providers). Users choose which domains to include in the export (sleep, vitals, medications, fasting, goals, emergency info, documents metadata) and the date range.

The export generates local files that the user can share via the system share sheet (AirDrop, email, Files app, etc.). No data is uploaded to any server. Document vault content (actual files) can optionally be included as a ZIP archive.

Export formats:
- **JSON:** Single file containing all selected data with full schema preservation
- **CSV:** ZIP archive with one CSV file per data type (vitals.csv, sleep.csv, medications.csv, etc.)
- **PDF:** Formatted health report with charts, tables, and summary statistics, suitable for sharing with healthcare providers

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-001: Health Dashboard - export is accessible from the Insights tab or Settings

**External Dependencies:**
- File system access for saving exports
- System share sheet for distributing exports

#### 3.5 User Interface Requirements

##### Screen: Export Data

**Layout:**
- Header: "Export Health Data"
- Domain checkboxes: Sleep, Vitals, Medications, Fasting, Goals, Emergency Info, Documents (metadata only), Documents (with files)
- Date range picker: Start date, End date, with presets (Last 30 days, Last 90 days, Last year, All time)
- Format picker: JSON, CSV, PDF
- "Export" button
- Progress indicator during export generation

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | User has selected at least one domain | Export button enabled |
| No selection | No domains selected | Export button disabled, hint: "Select at least one data type" |
| Exporting | Export in progress | Progress bar with domain being processed |
| Complete | Export file generated | Share sheet opens with the file |

#### 3.6 Data Requirements

No new entities. Export reads from all existing tables and produces output files.

#### 3.7 Business Logic Rules

##### Export File Generation

**Purpose:** Generate export files from selected domains and date range.

**Logic:**
```
1. For each selected domain:
   a. Query the relevant table(s) within the date range
   b. Transform rows to the export format
2. IF format is JSON THEN
     Combine all domain data into a single JSON object
     Include metadata: export_date, app_version, data_range, domains_included
3. IF format is CSV THEN
     Generate one CSV file per domain
     Package all CSVs into a ZIP archive
4. IF format is PDF THEN
     Generate formatted report with:
       - Cover page (user name from ICE card if available, date range, MyHealth branding)
       - Summary statistics per domain
       - Trend charts (rendered as static images)
       - Data tables
5. Open system share sheet with the generated file
```

**File Naming:**
- JSON: `myhealth-export-YYYY-MM-DD.json`
- CSV: `myhealth-export-YYYY-MM-DD.zip`
- PDF: `myhealth-report-YYYY-MM-DD.pdf`

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Export with zero data in range | Warning: "No data found for the selected range and domains" | User adjusts date range or domain selection |
| Storage full during export | Alert: "Not enough storage to generate the export" | User frees storage |
| PDF chart render fails | PDF generated without charts, text-only tables | Note in PDF: "Charts could not be generated" |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects Sleep and Vitals, date range "Last 30 days", format JSON,
   **When** they tap Export,
   **Then** a JSON file is generated containing sleep sessions and vital readings from the last 30 days, and the share sheet opens.

2. **Given** the user selects all domains, format CSV,
   **When** they tap Export,
   **Then** a ZIP file is generated containing separate CSV files for each domain with appropriate headers.

**Edge Cases:**

3. **Given** the user selects "Documents (with files)" and has 50 MB of documents,
   **When** they tap Export,
   **Then** the export generates a ZIP with document files, and a progress bar shows completion percentage.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates valid JSON export | 5 sleep sessions, 10 vitals | JSON with both arrays, metadata header |
| generates CSV with correct headers | 3 vital readings | CSV file with headers: id, vital_type, value, value_secondary, unit, source, recorded_at |
| file naming includes date | export on 2026-03-06 | filename contains "2026-03-06" |
| handles empty date range | date range with zero data | Empty arrays in JSON, empty CSV files (headers only) |

---

### HL-011: Medication Correlation Display

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-011 |
| **Feature Name** | Medication Correlation Display |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Manager, I want to see medication start/stop dates overlaid on my vitals charts, so that I can visually correlate medication changes with health outcome changes.

**Secondary:**
> As a Mental Health Patient, I want to see how my mood trends changed after starting a new medication, so that I can make informed decisions about my treatment with my therapist.

#### 3.3 Detailed Description

Medication Correlation Display overlays medication events (start dates, stop dates, dosage changes) on vitals and sleep trend charts. This allows users to visually identify correlations between medication changes and health outcomes. For example, a user on blood pressure medication can see whether their BP readings decreased after starting the medication.

The overlay is opt-in: users toggle "Show Medications" on any trend chart to see vertical marker lines at medication start/stop dates with medication name labels. The overlay reads from `md_medications` (start_date, end_date, name, dosage) and does not modify any data.

This feature leverages the correlation engine already built in MyMeds (`getMoodMedicationCorrelation`, `getSymptomMedicationCorrelation`, `getAdherenceMoodCorrelation`) but presents the data visually on trend charts rather than as text-based reports.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-005: Vitals Tracking - provides vitals data for charts
- HL-003: Sleep Session Logging - provides sleep data for charts

**External Dependencies:**
- MyMeds module data (`md_medications`, `md_dose_logs`)

#### 3.5 User Interface Requirements

##### Component: Medication Overlay on Trend Charts

**Layout:**
- Toggle switch at the top of any trend chart: "Show Medications"
- When enabled, vertical dashed lines appear on the chart at medication start dates (green) and stop dates (red)
- Each marker line has a small label above the chart with the medication name
- If multiple medications started on the same date, labels stack vertically
- Tapping a marker line shows a tooltip with: medication name, dosage, start/stop date, duration

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Overlay off | Toggle is off (default) | Standard chart without markers |
| Overlay on, no med data | Toggle on but no medications in md_medications | Chart unchanged, subtle note: "No medication data available" |
| Overlay on, with data | Toggle on, medications exist | Vertical marker lines at start/stop dates |

#### 3.6 Data Requirements

No new entities. Reads from `md_medications` for overlay data. The correlation display is a computed view layer on existing trend charts.

#### 3.7 Business Logic Rules

##### Medication Marker Generation

**Purpose:** Generate chart overlay markers from medication data.

**Logic:**
```
1. Query md_medications for all medications (active and inactive)
2. For each medication:
   a. IF created_at falls within the chart's date range THEN
        Create a "start" marker at created_at with green color
   b. IF end_date exists AND falls within chart date range THEN
        Create a "stop" marker at end_date with red color
3. Sort markers by date
4. RETURN array of markers [{date, type, medication_name, dosage}]
```

**Edge Cases:**
- If `md_medications` table does not exist (MyMeds never enabled): show no markers, no error
- If 10+ medications overlap in the same chart range: show first 5 with a "+N more" indicator to avoid visual clutter

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| md_medications table missing | Toggle hidden or disabled | None needed |
| Too many markers (> 10) | Show first 5 with "+N more" label | Tap "+N more" to see full list in a bottom sheet |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has BP readings and started Lisinopril 30 days ago,
   **When** they view the BP trend chart and toggle "Show Medications",
   **Then** a green vertical marker appears at the Lisinopril start date with the label "Lisinopril 10mg".

2. **Given** the user stopped a medication 2 weeks ago,
   **When** the overlay is enabled,
   **Then** both a green (start) and red (stop) marker appear for that medication.

**Edge Cases:**

3. **Given** MyMeds was never enabled,
   **When** the user views a vitals trend chart,
   **Then** the "Show Medications" toggle is not visible.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates start marker | medication with created_at in range | 1 green marker |
| generates start+stop markers | medication with created_at and end_date in range | 1 green + 1 red marker |
| excludes out-of-range medications | medication started 2 years ago, chart range is 30 days | 0 markers |
| caps at 5 visible markers | 12 medications in range | 5 markers + "+7 more" indicator |
| handles missing md_medications table | table does not exist | Empty array, no error |

---

### HL-012: Apple Health / HealthKit Integration

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-012 |
| **Feature Name** | Apple Health / HealthKit Integration |
| **Priority** | P0 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Health-Conscious Professional with an Apple Watch, I want my heart rate, steps, sleep, HRV, and blood oxygen data to automatically sync into MyHealth, so that I do not have to manually enter data that my watch already tracks.

**Secondary:**
> As a Fitness Recovery Tracker, I want MyHealth to write my sleep data back to Apple Health, so that other HealthKit-connected apps can access my MyHealth sleep analysis.

#### 3.3 Detailed Description

HealthKit Integration is the single most impactful feature for MyHealth. It enables bidirectional data flow between Apple Health and the local SQLite database. On iOS, MyHealth requests HealthKit permissions for specific data types and performs incremental syncs to import new data. On Android, the equivalent integration uses Health Connect (Google's health data API). On web, this feature is unavailable (web cannot access HealthKit).

**Read permissions (import into MyHealth):**

| HealthKit Type | HKQuantityTypeIdentifier / HKCategoryTypeIdentifier | Maps to | Sync Frequency |
|---------------|-----------------------------------------------------|---------|---------------|
| Heart Rate | `.heartRate` | hl_vitals (heart_rate) | Every 15 minutes |
| Resting Heart Rate | `.restingHeartRate` | hl_vitals (resting_heart_rate) | Daily |
| Heart Rate Variability | `.heartRateVariabilitySDNN` | hl_vitals (hrv) | Daily |
| Blood Oxygen | `.oxygenSaturation` | hl_vitals (blood_oxygen) | Every 15 minutes |
| Blood Pressure (systolic) | `.bloodPressureSystolic` | hl_vitals (blood_pressure, value) | On new reading |
| Blood Pressure (diastolic) | `.bloodPressureDiastolic` | hl_vitals (blood_pressure, value_secondary) | On new reading |
| Body Temperature | `.bodyTemperature` | hl_vitals (body_temperature) | On new reading |
| Body Mass | `.bodyMass` | hl_vitals (weight) | On new reading |
| Steps | `.stepCount` | hl_vitals (steps) | Every 15 minutes |
| Active Energy | `.activeEnergyBurned` | hl_vitals (active_energy) | Every 15 minutes |
| Respiratory Rate | `.respiratoryRate` | hl_vitals (respiratory_rate) | Daily |
| VO2 Max | `.vo2Max` | hl_vitals (vo2_max) | Weekly |
| Sleep Analysis | `.sleepAnalysis` (category) | hl_sleep_sessions | Daily (morning) |
| Menstrual Flow | `.menstrualFlow` (category) | cy_periods (cycle module) | Daily |
| Body Fat Percentage | `.bodyFatPercentage` | hl_body_composition | On new reading |
| Lean Body Mass | `.leanBodyMass` | hl_body_composition | On new reading |

**Write permissions (export from MyHealth to Apple Health):**

| Data Type | HKQuantityTypeIdentifier | Source |
|-----------|-------------------------|--------|
| Sleep Analysis | `.sleepAnalysis` | hl_sleep_sessions (manual entries only) |
| Body Mass | `.bodyMass` | hl_vitals (manual weight entries) |
| Blood Pressure | `.bloodPressureSystolic` + `.bloodPressureDiastolic` | hl_vitals (manual BP entries) |

**Sync Architecture:**
- Incremental sync using `HKAnchoredObjectQuery` with anchors stored in `hl_sync_log`
- Background delivery enabled for high-frequency types (heart rate, steps, active energy)
- Deduplication: HealthKit samples include a UUID; duplicates are detected by matching UUID or by matching (type, value, timestamp) within a 1-minute window
- Conflict resolution: HealthKit data takes precedence over manual entries with the same timestamp (within 5 minutes). Manual entries outside that window are preserved.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-005: Vitals Tracking - destination for imported vital data
- HL-003: Sleep Session Logging - destination for imported sleep data

**External Dependencies:**
- iOS: HealthKit framework (native module via Expo Health Connect or react-native-health)
- Android: Health Connect API
- User grants HealthKit/Health Connect permissions per data type
- Apple Watch or other HealthKit-contributing device (optional but provides richer data)

**Assumed Capabilities:**
- User can access HealthKit permission prompts from the Health Sync settings screen

#### 3.5 User Interface Requirements

##### Screen: Health Sync Settings

**Layout:**
- Header: "Health Sync"
- Master toggle: "Sync with Apple Health" (or "Sync with Health Connect" on Android)
- When master toggle is ON, show granular toggles grouped by category:

**Read Data (Import):**
| Toggle | Label | Default |
|--------|-------|---------|
| Heart Rate | Import heart rate | ON |
| Resting Heart Rate | Import resting heart rate | ON |
| HRV | Import heart rate variability | ON |
| Blood Oxygen | Import blood oxygen (SpO2) | ON |
| Blood Pressure | Import blood pressure | OFF |
| Body Temperature | Import body temperature | OFF |
| Steps | Import step count | ON |
| Active Energy | Import active calories | ON |
| Sleep | Import sleep data | ON |
| Respiratory Rate | Import respiratory rate | OFF |
| Weight | Import body weight | ON |

**Write Data (Export):**
| Toggle | Label | Default |
|--------|-------|---------|
| Sleep | Share sleep data with Apple Health | OFF |
| Weight | Share weight with Apple Health | OFF |
| Blood Pressure | Share blood pressure with Apple Health | OFF |

- Last sync timestamp: "Last synced: 2 minutes ago"
- "Sync Now" button for manual trigger
- Sync status indicator (syncing spinner, success checkmark, error warning)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not configured | Master toggle OFF | Master toggle with explanation text about what HealthKit sync does |
| Permission needed | Toggle ON but HealthKit permission not granted | Prompt to open Health app permissions |
| Syncing | Sync in progress | Spinner with "Syncing heart rate..." status |
| Synced | Sync complete | Green checkmark with last sync time |
| Error | Sync failed | Red warning with error description and "Retry" button |
| Unavailable | Web platform | Message: "Health sync is available on mobile only" |

#### 3.6 Data Requirements

##### Entity: SyncLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| data_type | string | Primary key | None | HealthKit data type identifier (e.g., "heartRate", "steps") |
| last_sync_at | datetime | Required, ISO 8601 | None | When the last successful sync completed |
| last_anchor | string | Nullable | null | HKAnchoredObjectQuery anchor for incremental sync |
| records_synced | integer | Min: 0 | 0 | Count of records imported in last sync |
| error_message | string | Nullable | null | Error message from last failed sync attempt |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

**Note:** Toggle preferences are stored in `hl_settings` with keys like `healthSync.heartRate`, `healthSync.steps`, etc.

#### 3.7 Business Logic Rules

##### Incremental Sync Algorithm

**Purpose:** Import new HealthKit data since the last sync without duplicating existing records.

**Inputs:**
- dataType: string - which HealthKit type to sync
- enabled: boolean - whether this type is enabled in settings

**Logic:**
```
1. IF not enabled THEN skip
2. Load last_anchor from hl_sync_log for this data_type
3. Create HKAnchoredObjectQuery with:
   - sampleType: corresponding HKQuantityType or HKCategoryType
   - predicate: none (anchor handles incremental)
   - anchor: last_anchor (null for first sync)
   - limit: HKObjectQueryNoLimit
4. Execute query
5. For each new sample:
   a. Check for duplicate: same (vital_type, value, recorded_at within 60 seconds)
   b. IF duplicate exists THEN skip
   c. ELSE insert into hl_vitals or hl_sleep_sessions with source = 'apple_health'
6. Update hl_sync_log: new anchor, last_sync_at, records_synced count
7. IF error occurs THEN update hl_sync_log with error_message
```

##### Sync Frequency Schedule

**Purpose:** Determine how often each data type syncs.

| Frequency | Data Types | Mechanism |
|-----------|-----------|-----------|
| Every 15 minutes | heart_rate, blood_oxygen, steps, active_energy | Background delivery + app foreground |
| Daily (morning) | resting_heart_rate, hrv, sleep, respiratory_rate | Background delivery at 7 AM + app open |
| Weekly | vo2_max | App open check |
| On change | blood_pressure, body_temperature, weight, body_fat | Observer query (immediate on new sample) |

##### Conflict Resolution

**Purpose:** Handle cases where both manual and HealthKit data exist for the same measurement.

**Logic:**
```
1. For a given (vital_type, recorded_at):
   IF a manual entry exists within 5 minutes of a HealthKit sample THEN
     Keep the HealthKit sample (higher fidelity from sensor)
     Mark the manual entry as superseded (do not delete, set flag)
   ELSE
     Keep both entries (they represent different measurements)
```

##### Deduplication

**Purpose:** Prevent importing the same HealthKit sample twice.

**Logic:**
```
1. Primary dedup: HealthKit anchor mechanism ensures only new samples since last anchor
2. Secondary dedup: Check for existing record with same (vital_type, value, recorded_at +/- 60 seconds, source = 'apple_health')
3. IF match found THEN skip insert
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| HealthKit permission denied | Alert explaining how to enable in Settings > Health > MyHealth | Deep link to Health app settings |
| HealthKit unavailable (simulator/web) | "Health sync is available on physical iOS devices" | Feature hidden on unsupported platforms |
| Sync fails mid-batch | Partial data imported, anchor not updated | Next sync retries from same anchor point |
| Health Connect not installed (Android) | Prompt to install Health Connect from Play Store | Link to Play Store listing |
| Background delivery not supported | Sync only occurs when app is open | Note in settings: "Open MyHealth periodically for latest data" |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enables HealthKit sync and grants heart rate permission,
   **When** the first sync runs,
   **Then** historical heart rate data from Apple Health is imported into hl_vitals with source "apple_health".

2. **Given** the user has been wearing an Apple Watch overnight,
   **When** they open MyHealth in the morning,
   **Then** a sleep session appears with stage breakdown (deep, REM, light, awake) from HealthKit data.

3. **Given** the user toggles off "Import steps",
   **When** the next sync runs,
   **Then** no new step data is imported, but existing step data is preserved.

**Edge Cases:**

4. **Given** the user manually logged a heart rate of 72 at 10:00 AM, and HealthKit has a reading of 74 at 10:02 AM,
   **When** sync processes the HealthKit sample,
   **Then** the HealthKit sample (74) is kept and the manual entry (72) is marked as superseded.

5. **Given** the sync fails due to a database error,
   **When** the next scheduled sync runs,
   **Then** it retries from the same anchor (no data loss, no gaps).

**Negative Tests:**

6. **Given** the user denies HealthKit permissions,
   **When** they try to enable a data type toggle,
   **Then** the system shows a permission prompt explaining why access is needed.
   **And** no data is imported.

7. **Given** the app is running on web,
   **When** the user navigates to Health Sync settings,
   **Then** the screen shows "Health sync is available on mobile only" and no toggles are visible.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| deduplicates identical records | same type, value, timestamp within 60s | Second insert skipped |
| allows non-duplicate records | same type, different timestamp (> 60s apart) | Both records kept |
| conflict resolution: HealthKit wins | manual entry at 10:00, HealthKit at 10:02 | Manual marked superseded |
| conflict resolution: both kept | manual entry at 10:00, HealthKit at 10:30 | Both records kept |
| respects disabled toggle | heartRate toggle OFF | Zero heart rate records imported |
| updates sync log on success | 15 records imported | sync_log: records_synced=15, error_message=null |
| updates sync log on error | sync throws error | sync_log: error_message set, anchor unchanged |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full initial sync | 1. Enable all toggles, 2. Run sync with mock HealthKit data | All vital types imported, sleep sessions created, sync_log updated |
| Incremental sync | 1. Run initial sync, 2. Add new mock data, 3. Run sync again | Only new data imported, no duplicates |

---

### HL-013: Breathing Exercises

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-013 |
| **Feature Name** | Breathing Exercises |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As an Anxiety/Stress Sufferer, I want to follow guided breathing exercises with visual animations, so that I can calm down during stressful moments without paying $80/year for Calm.

**Secondary:**
> As a Sleep Optimizer, I want to do a relaxation breathing exercise before bed, so that I can fall asleep faster.

#### 3.3 Detailed Description

Breathing Exercises provides three evidence-based breathing patterns with animated visual guides. The exercises require no content licensing (breathing patterns are not copyrightable) and no network access. Each exercise displays a visual guide (expanding/contracting circle) with phase labels (Inhale, Hold, Exhale), haptic feedback on phase transitions, and an optional background sound (gentle tone).

**Breathing Patterns:**

1. **Box Breathing (4-4-4-4):** Military/tactical breathing. Inhale 4 seconds, hold 4 seconds, exhale 4 seconds, hold 4 seconds. Total cycle: 16 seconds. Recommended duration: 4 minutes (15 cycles).

2. **4-7-8 Relaxation:** Dr. Andrew Weil's technique. Inhale 4 seconds, hold 7 seconds, exhale 8 seconds. Total cycle: 19 seconds. Recommended duration: 4 cycles (76 seconds) for beginners, up to 8 cycles.

3. **Coherent Breathing (5.5/5.5):** Resonance frequency breathing. Inhale 5.5 seconds, exhale 5.5 seconds. No hold. Total cycle: 11 seconds. Rate: ~5.5 breaths per minute. Recommended duration: 5-20 minutes.

Each exercise is logged as a completed session in `hl_breathing_sessions` with duration, pattern type, and completion status. Completed sessions contribute to the wellness timeline and can satisfy MyHabits habit tracking.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone feature)

**External Dependencies:**
- Haptic feedback engine (optional, degrades gracefully)
- Audio output (optional, for ambient tone)

#### 3.5 User Interface Requirements

##### Screen: Breathing Exercise Picker

**Layout:**
- Header: "Breathe" with a calming gradient background (dark teal to dark blue)
- Three exercise cards stacked vertically:
  1. **Box Breathing** - Icon: square outline. Subtitle: "4-4-4-4 tactical breathing. Calm and focus." Duration: "4 min"
  2. **4-7-8 Relaxation** - Icon: crescent moon. Subtitle: "Deep relaxation for sleep and anxiety." Duration: "~80 sec"
  3. **Coherent Breathing** - Icon: wave. Subtitle: "Steady rhythm for balance and calm." Duration: "5-20 min"
- Each card shows: pattern name, subtitle, typical duration, a "Start" button
- Below the cards: session history (last 5 sessions with date, pattern, duration)

##### Screen: Active Breathing Session

**Layout:**
- Full-screen view with calming dark background
- Central animated circle:
  - **Inhale phase:** circle expands from 40% to 100% of max size over the inhale duration
  - **Hold phase:** circle remains at current size, subtle glow pulse
  - **Exhale phase:** circle contracts from 100% to 40% over the exhale duration
- Phase label below circle: "Inhale", "Hold", "Exhale" in large text
- Timer: current phase countdown (e.g., "4s") and total elapsed time
- Cycle counter: "Cycle 3 of 15"
- Duration picker (before starting): slider or preset buttons for session length
- "Pause" button (bottom center) and "End" button (top-left)
- Optional: ambient tone toggle (gentle sine wave that rises with inhale, falls with exhale)

**Animation Timing (exact):**

| Pattern | Phase | Duration | Circle Size |
|---------|-------|----------|-------------|
| Box Breathing | Inhale | 4.0s | 40% to 100% |
| Box Breathing | Hold (in) | 4.0s | 100% (glow pulse) |
| Box Breathing | Exhale | 4.0s | 100% to 40% |
| Box Breathing | Hold (out) | 4.0s | 40% (glow pulse) |
| 4-7-8 | Inhale | 4.0s | 40% to 100% |
| 4-7-8 | Hold | 7.0s | 100% (glow pulse) |
| 4-7-8 | Exhale | 8.0s | 100% to 40% |
| Coherent | Inhale | 5.5s | 40% to 100% |
| Coherent | Exhale | 5.5s | 100% to 40% |

**Haptic Feedback:**
- Phase transition: medium impact haptic
- Cycle completion: success haptic (two taps)
- Session end: notification haptic

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Pre-start | User selected a pattern, adjusting duration | Duration picker visible, "Begin" button |
| Active | Exercise in progress | Animated circle, phase label, timer, cycle counter |
| Paused | User tapped Pause | Circle frozen, "Resume" and "End Session" buttons |
| Completed | All cycles finished or user ended session | Summary card: duration, cycles completed, pattern name. "Done" button |

#### 3.6 Data Requirements

##### Entity: BreathingSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| pattern | enum | One of: box, four_seven_eight, coherent | None | Breathing pattern used |
| target_cycles | integer | Min: 1 | None | Number of cycles planned |
| completed_cycles | integer | Min: 0 | 0 | Number of cycles actually completed |
| duration_seconds | integer | Min: 0 | 0 | Total session duration in seconds |
| completed | boolean | - | false | Whether the user completed the full planned session |
| started_at | datetime | Required, ISO 8601 | Current timestamp | Session start time |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Table:** `hl_breathing_sessions` (new table, requires schema migration v2)

**Indexes:**
- `started_at` - for chronological listing and timeline integration

**Example Data:**
```json
{
  "id": "hl_br_1709676000_m3n5p7",
  "pattern": "box",
  "target_cycles": 15,
  "completed_cycles": 15,
  "duration_seconds": 240,
  "completed": true,
  "started_at": "2026-03-06T22:00:00Z",
  "created_at": "2026-03-06T22:04:00Z"
}
```

#### 3.7 Business Logic Rules

##### Cycle Timing Engine

**Purpose:** Drive the breathing animation and phase transitions with precise timing.

**Inputs:**
- pattern: BreathingPattern
- targetCycles: number

**Logic:**
```
1. Load phase durations for the selected pattern:
   box: [{phase: 'inhale', duration: 4.0}, {phase: 'hold', duration: 4.0}, {phase: 'exhale', duration: 4.0}, {phase: 'hold', duration: 4.0}]
   four_seven_eight: [{phase: 'inhale', duration: 4.0}, {phase: 'hold', duration: 7.0}, {phase: 'exhale', duration: 8.0}]
   coherent: [{phase: 'inhale', duration: 5.5}, {phase: 'exhale', duration: 5.5}]

2. Start animation loop:
   FOR cycle = 1 TO targetCycles:
     FOR each phase in pattern:
       a. Update phase label
       b. Start circle animation (expand or contract over phase.duration seconds)
       c. Fire haptic on phase transition
       d. Wait phase.duration seconds
     END FOR
     Increment completed_cycles
     Fire cycle completion haptic
   END FOR

3. On completion:
   a. Fire session end haptic
   b. Show summary card
   c. Save BreathingSession to database
```

##### Session Completion Rules

**Purpose:** Determine if a session counts as "completed."

**Logic:**
```
1. IF completed_cycles >= target_cycles THEN completed = true
2. IF user tapped "End Session" before finishing THEN completed = false
3. IF user paused and never resumed (app backgrounded > 5 minutes) THEN auto-end, completed = false
4. Partial sessions (completed = false) are still saved for tracking purposes
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Haptic engine unavailable | Exercise works without haptics; no error shown | Visual-only feedback |
| App backgrounded during session | Session pauses automatically; timer freezes | Resume on app foreground within 5 minutes; auto-end after 5 minutes |
| Audio output busy | Exercise works without ambient tone | Visual-only feedback |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects Box Breathing with 15 cycles,
   **When** they tap "Begin",
   **Then** the circle animates through inhale (4s expand), hold (4s pulse), exhale (4s contract), hold (4s pulse) for 15 cycles (4 minutes total).

2. **Given** the user completes a 4-7-8 session (4 cycles),
   **When** the session ends,
   **Then** a summary card shows "4-7-8 Relaxation - 4 cycles - 76 seconds" and the session is saved to the database.

3. **Given** the user starts Coherent Breathing for 5 minutes,
   **When** they tap "End Session" after 3 minutes,
   **Then** the session is saved with completed = false, duration = 180 seconds, and the actual cycle count.

**Edge Cases:**

4. **Given** the user backgrounds the app during a breathing session,
   **When** they return within 5 minutes,
   **Then** the session is paused and they can resume from where they left off.

5. **Given** the user backgrounds the app for more than 5 minutes,
   **When** the timeout occurs,
   **Then** the session is auto-ended with completed = false and saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| box breathing cycle duration | 1 cycle | 16.0 seconds |
| 4-7-8 cycle duration | 1 cycle | 19.0 seconds |
| coherent cycle duration | 1 cycle | 11.0 seconds |
| box breathing full session | 15 cycles | 240 seconds (4 minutes) |
| 4-7-8 recommended session | 4 cycles | 76 seconds |
| marks completed when all cycles done | target: 10, completed: 10 | completed = true |
| marks incomplete when ended early | target: 10, completed: 6 | completed = false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete breathing session and verify persistence | 1. Start box breathing (2 cycles for test), 2. Complete, 3. Query database | Session saved with correct pattern, cycles, duration, completed = true |
| Partial session saves correctly | 1. Start 10-cycle session, 2. End after 3 cycles | Session saved with completed_cycles = 3, completed = false |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| First-time user completes box breathing | 1. Open Breathe tab (empty history), 2. Tap Box Breathing, 3. Set 2 cycles, 4. Tap Begin, 5. Wait 32 seconds (2 full cycles) | Summary card shows "Box Breathing - 2 cycles - 32 seconds", session appears in history list, empty state is gone |
| User does partial 4-7-8 then views history | 1. Start 4-7-8 (4 cycles), 2. Tap End after 2 cycles, 3. Return to Breathe picker | History shows partial session with completed = false, 2/4 cycles. Next visit shows updated history. |
| Breathing session survives app background | 1. Start coherent breathing (5 min), 2. Background app for 2 minutes, 3. Return to app | Session is paused, resume button visible, timer reflects elapsed time before pause |

---

### HL-014: Sleep Stage Analysis

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-014 |
| **Feature Name** | Sleep Stage Analysis |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Sleep Optimizer, I want to see a breakdown of my sleep stages (deep, REM, light, awake) as a stacked bar chart, so that I can understand the quality composition of each night and optimize for more deep and REM sleep.

**Secondary:**
> As a Fitness Recovery Tracker, I want to compare my deep sleep percentages over weeks, so that I can determine whether my recovery protocols (cold exposure, magnesium supplementation) are improving deep sleep.

#### 3.3 Detailed Description

Sleep Stage Analysis provides a detailed visual breakdown of sleep architecture for sessions that include stage data. Stage data comes from HealthKit (Apple Watch, Oura Ring, or other HealthKit-contributing wearables) or from manual entry. The feature displays a horizontal stacked bar showing the proportion of each stage, a hypnogram (timeline chart showing stage transitions throughout the night), stage-specific statistics, and multi-night stage trend charts.

Sleep stages are categorized into four buckets: Deep (N3/slow wave), REM, Light (N1+N2), and Awake. The system uses clinical sleep science benchmarks for contextual scoring:

| Stage | Optimal Range (% of total sleep time) | Below Target | Above Target |
|-------|----------------------------------------|-------------|-------------|
| Deep | 15-25% | < 15% ("Low deep sleep") | > 25% (unusual but not harmful) |
| REM | 20-30% | < 20% ("Low REM sleep") | > 30% (unusual but not harmful) |
| Light | 45-60% | < 45% (rare) | > 60% ("High proportion of light sleep") |
| Awake | 0-10% | N/A | > 10% ("Elevated awake time") |

When stage data is unavailable (manual entry without stages), the system displays a duration-only view with a prompt: "Connect a wearable via Apple Health for detailed sleep stage analysis."

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-003: Sleep Session Logging - provides raw session data with optional stage fields
- HL-012: Apple Health / HealthKit Integration - provides automatic stage data from wearables

**External Dependencies:**
- Wearable device contributing sleep stage data to HealthKit (Apple Watch Series 8+, Oura Ring, etc.)

**Assumed Capabilities:**
- Sleep sessions may or may not include stage breakdown data
- Stage data is stored as minute counts in hl_sleep_sessions (deep_minutes, rem_minutes, light_minutes, awake_minutes)

#### 3.5 User Interface Requirements

##### Screen: Sleep Detail (Stage Analysis Section)

**Layout:**
- This section appears within the Sleep Detail screen for a specific session, below the quality score ring
- **Stacked Bar Chart:** Horizontal bar divided into four colored segments:
  - Deep: Indigo (#6366F1)
  - REM: Cyan (#06B6D4)
  - Light: Sky Blue (#38BDF8)
  - Awake: Amber (#F59E0B)
- Each segment shows the stage name and percentage label inside or above the segment
- **Stage Stats Table:** Below the bar, a 4-row table:
  - Stage name | Duration (e.g., "1h 32m") | Percentage | Benchmark indicator (checkmark if within optimal range, warning if outside)
- **Hypnogram:** Timeline chart showing stage transitions through the night:
  - X-axis: time from bedtime to wake time
  - Y-axis: stage levels (Awake at top, Light, REM, Deep at bottom)
  - Step chart connecting stage transitions, each segment colored by stage
  - This requires per-interval stage data (stored as hl_sleep_stage_intervals for HealthKit-sourced sessions)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full stage data | deep, REM, light, awake minutes all present | Stacked bar + stats table + hypnogram (if interval data available) |
| Summary stage data | Minute counts present but no interval data | Stacked bar + stats table, no hypnogram. Note: "Hypnogram available with Apple Watch data" |
| No stage data | All stage fields null | Message: "No sleep stage data for this night. Connect a wearable for stage analysis." |

##### Screen: Stage Trends

**Layout:**
- Accessed via "View Trends" link on the Sleep Detail stage section
- Time range selector: 7d, 30d, 90d
- Stacked bar chart showing nightly stage composition (one bar per night, stacked vertically)
- Below the chart, four mini sparklines: one per stage showing that stage's percentage over time
- Average stats for the selected range: "Avg Deep: 18% (1h 26m), Avg REM: 22% (1h 46m)"
- Benchmark comparison: text note if averages fall outside optimal ranges

#### 3.6 Data Requirements

##### Entity: SleepStageInterval

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| session_id | string | Foreign key to SleepSession.id, cascade delete | None | Parent sleep session |
| stage | enum | One of: deep, rem, light, awake | None | Sleep stage for this interval |
| start_time | datetime | Required, ISO 8601 | None | When this stage interval began |
| end_time | datetime | Required, ISO 8601, must be after start_time | None | When this stage interval ended |
| duration_minutes | float | Computed: (end_time - start_time) in minutes | Computed | Duration of this stage interval |
| source | enum | One of: apple_health, health_connect, manual | None | Data source |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Table:** `hl_sleep_stage_intervals` (new table, requires schema migration v3)

**Relationships:**
- SleepSession has many SleepStageInterval (one-to-many via session_id)
- SleepStageInterval belongs to SleepSession

**Indexes:**
- `session_id` - querying intervals for a specific session
- `(session_id, start_time)` - ordered interval retrieval

**Example Data:**
```json
{
  "id": "hl_ssi_1709676000_a1b2",
  "session_id": "hl_slp_1709676000_a3b7c9d2",
  "stage": "light",
  "start_time": "2026-03-05T22:30:00Z",
  "end_time": "2026-03-05T23:15:00Z",
  "duration_minutes": 45.0,
  "source": "apple_health",
  "created_at": "2026-03-06T06:20:00Z"
}
```

#### 3.7 Business Logic Rules

##### Stage Percentage Calculation

**Purpose:** Compute the percentage of each sleep stage relative to total sleep time.

**Inputs:**
- deepMinutes: number
- remMinutes: number
- lightMinutes: number
- awakeMinutes: number

**Logic:**
```
1. totalSleepMinutes = deepMinutes + remMinutes + lightMinutes
   (awake is excluded from "total sleep time" per sleep science convention)
2. totalTimeInBed = deepMinutes + remMinutes + lightMinutes + awakeMinutes
3. IF totalTimeInBed == 0 THEN RETURN all percentages as 0

4. deepPct = (deepMinutes / totalSleepMinutes) * 100
5. remPct = (remMinutes / totalSleepMinutes) * 100
6. lightPct = (lightMinutes / totalSleepMinutes) * 100
7. awakePct = (awakeMinutes / totalTimeInBed) * 100
   (awake is expressed as % of time in bed, not % of sleep time)

8. RETURN { deepPct, remPct, lightPct, awakePct }
```

**Formulas:**
- `deepPct = (deepMinutes / (deepMinutes + remMinutes + lightMinutes)) * 100`
- `remPct = (remMinutes / (deepMinutes + remMinutes + lightMinutes)) * 100`
- `lightPct = (lightMinutes / (deepMinutes + remMinutes + lightMinutes)) * 100`
- `awakePct = (awakeMinutes / (deepMinutes + remMinutes + lightMinutes + awakeMinutes)) * 100`

##### Benchmark Evaluation

**Purpose:** Determine if each stage falls within the clinically optimal range.

**Logic:**
```
1. IF deepPct < 15 THEN deepStatus = 'below_target', label = "Low deep sleep"
   ELSE IF deepPct > 25 THEN deepStatus = 'above_target', label = "High deep sleep"
   ELSE deepStatus = 'optimal', label = "On target"

2. IF remPct < 20 THEN remStatus = 'below_target', label = "Low REM sleep"
   ELSE IF remPct > 30 THEN remStatus = 'above_target', label = "High REM sleep"
   ELSE remStatus = 'optimal', label = "On target"

3. IF lightPct > 60 THEN lightStatus = 'above_target', label = "High light sleep"
   ELSE lightStatus = 'optimal', label = "On target"

4. IF awakePct > 10 THEN awakeStatus = 'above_target', label = "Elevated awake time"
   ELSE awakeStatus = 'optimal', label = "On target"

5. RETURN array of stage statuses with labels
```

##### Hypnogram Assembly

**Purpose:** Build the hypnogram step chart from interval data.

**Inputs:**
- sessionId: string

**Logic:**
```
1. Query hl_sleep_stage_intervals WHERE session_id = sessionId ORDER BY start_time ASC
2. IF no intervals THEN RETURN null (hypnogram unavailable)
3. Map each interval to a chart segment: { x1: start_time, x2: end_time, y: stageLevel }
   stageLevel mapping: awake = 3, light = 2, rem = 1, deep = 0
4. RETURN array of segments for step chart rendering
```

**Edge Cases:**
- Gaps between intervals (no data for a period): render as "unknown" with a dashed line
- Overlapping intervals: merge by taking the last-written interval
- Single interval covering entire night: valid (some devices report coarse data)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Stage data partially missing (e.g., deep = null, REM = 85) | Show available stages, mark missing as "No data" in stats table | No action needed |
| Stage minutes exceed session duration | Display data as-is with a note: "Stage data exceeds session duration. This may indicate a data sync issue." | Re-sync from HealthKit |
| Interval data corrupted (overlapping times) | Hypnogram rendered with merged intervals | Note: "Some stage intervals overlap. Data may be approximate." |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a sleep session with deep: 95min, REM: 110min, light: 220min, awake: 40min,
   **When** the user views the Sleep Detail screen,
   **Then** the stacked bar shows Deep 22.4%, REM 25.9%, Light 51.8%, and the awake indicator shows 8.6% of time in bed.

2. **Given** a session with HealthKit interval data (15 stage transitions),
   **When** the user views the Sleep Detail screen,
   **Then** a hypnogram chart displays showing stage transitions throughout the night.

3. **Given** 30 nights of stage data,
   **When** the user taps "View Trends" and selects 30d,
   **Then** a stacked bar chart shows nightly composition and average stats are displayed.

**Edge Cases:**

4. **Given** a manually entered session with no stage data,
   **When** the user views the Sleep Detail screen,
   **Then** the stage section shows "No sleep stage data for this night" with a prompt to connect a wearable.

5. **Given** a session where deep sleep is 30% (above optimal range),
   **When** the benchmark evaluation runs,
   **Then** the deep sleep row shows an info indicator with "High deep sleep" (not a warning, since above-optimal deep is not harmful).

**Negative Tests:**

6. **Given** stage data where deep + REM + light + awake exceeds total session duration by 20 minutes,
   **When** the stage section renders,
   **Then** the data is displayed with a note about the discrepancy.
   **And** no data is modified or deleted.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates stage percentages correctly | deep: 95, rem: 110, light: 220, awake: 40 | deepPct: 22.4, remPct: 25.9, lightPct: 51.8, awakePct: 8.6 |
| handles zero total sleep time | deep: 0, rem: 0, light: 0, awake: 60 | all percentages: 0 |
| benchmark: low deep sleep | deepPct: 10 | status: below_target, label: "Low deep sleep" |
| benchmark: optimal deep sleep | deepPct: 20 | status: optimal |
| benchmark: high awake time | awakePct: 15 | status: above_target, label: "Elevated awake time" |
| benchmark: optimal awake | awakePct: 7 | status: optimal |
| hypnogram assembly with 5 intervals | 5 intervals covering full night | 5 chart segments with correct stage levels |
| hypnogram returns null when no intervals | sessionId with no interval records | null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| HealthKit sync creates intervals | 1. Sync HealthKit sleep data with stage transitions, 2. Query intervals | Intervals stored with correct session_id, stages, and timestamps |
| Stage trends over 7 nights | 1. Seed 7 sessions with stage data, 2. Query stage trends for 7d | Nightly breakdown and averages computed correctly |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User views sleep stages after Apple Watch sync | 1. HealthKit sync imports sleep with stages, 2. Open Sleep tab, 3. Tap last night's session, 4. Scroll to stage section | Stacked bar, stats table, and hypnogram all visible with correct data |
| User views stage trends | 1. Have 14 nights of stage data, 2. Open session detail, 3. Tap "View Trends", 4. Select 7d | Stacked bar trend chart and average stats for last 7 nights displayed |

---

### HL-015: Heart Rate During Sleep

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-015 |
| **Feature Name** | Heart Rate During Sleep |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Sleep Optimizer, I want to see my heart rate curve throughout the night overlaid on my sleep stages, so that I can identify whether my heart rate follows a healthy dipping pattern during deep sleep.

**Secondary:**
> As a Chronic Condition Manager, I want to see my average overnight heart rate trend over weeks, so that I can detect early signs of illness or medication side effects (resting heart rate elevation precedes many health events by 24-48 hours).

#### 3.3 Detailed Description

Heart Rate During Sleep displays overnight heart rate data as a continuous line chart overlaid on the sleep session's hypnogram. Heart rate data comes from HealthKit (Apple Watch samples taken during the sleep window). The feature computes overnight metrics: overnight average HR, overnight minimum HR, overnight maximum HR, HR dip percentage (difference between daytime resting HR and overnight minimum), and a per-stage heart rate average (average HR during deep, REM, light, and awake stages).

Clinical context: a healthy sleeper's heart rate "dips" 10-20% below their daytime resting heart rate during deep sleep. Non-dipping patterns (< 10% dip) are associated with cardiovascular risk. Elevated overnight HR relative to personal baseline can indicate illness onset, overtraining, or alcohol consumption.

The overnight HR chart is displayed on the Sleep Detail screen below the stage analysis section. A multi-night trend chart shows average overnight HR over time, accessible from the Sleep Trends screen.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-012: Apple Health / HealthKit Integration - provides heart rate samples
- HL-003: Sleep Session Logging - provides sleep window boundaries

**External Dependencies:**
- Apple Watch or other HealthKit-contributing device that records heart rate during sleep
- Heart rate samples must exist in HealthKit for the sleep session's time window

**Assumed Capabilities:**
- HealthKit sync has imported heart rate data
- Sleep session has start_time and end_time defining the overnight window

#### 3.5 User Interface Requirements

##### Component: Overnight Heart Rate Chart (within Sleep Detail)

**Layout:**
- Section title: "Heart Rate During Sleep" with a heart icon
- Line chart:
  - X-axis: time from bedtime to wake time
  - Y-axis: heart rate in bpm (auto-scaled to data range with 10 bpm padding)
  - Line: smooth interpolated heart rate curve colored by stage (indigo during deep, cyan during REM, sky blue during light, amber during awake), or a single color (red/pink) if no stage interval data
  - Background: optional faint hypnogram overlay showing stage bands
- Below the chart, a stats row:
  - Overnight Avg: XX bpm
  - Min: XX bpm (with timestamp, e.g., "at 3:14 AM")
  - Max: XX bpm (with timestamp)
  - Dip: XX% (colored green if 10-20%, yellow if < 10% or > 20%)
- Per-stage averages (if stage interval data exists):
  - Deep: XX bpm | REM: XX bpm | Light: XX bpm | Awake: XX bpm

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full data | HR samples exist during sleep window | Line chart + all stats |
| Sparse data | Fewer than 10 HR samples in window | Scatter plot (dots only), stats computed from available samples, note: "Limited heart rate data for this night" |
| No data | Zero HR samples during sleep window | Message: "No heart rate data for this night. Wear your Apple Watch to bed for overnight tracking." |
| No HealthKit | HealthKit integration not enabled | Message: "Connect Apple Health to see overnight heart rate" |

##### Component: Overnight HR Trend (within Sleep Trends)

**Layout:**
- Line chart showing average overnight heart rate per night over the selected range (7d, 30d, 90d)
- Horizontal reference line at user's average resting HR (from daytime samples)
- Tooltips showing individual night's avg HR, min HR, and dip percentage

#### 3.6 Data Requirements

No new entities. Overnight HR data is computed from existing `hl_vitals` records (vital_type = 'heart_rate', source = 'apple_health') filtered to the sleep session's time window (start_time to end_time).

**Computed Values (not persisted, calculated on demand):**

| Metric | Computation |
|--------|-------------|
| overnight_avg_hr | AVG(value) WHERE vital_type = 'heart_rate' AND recorded_at BETWEEN session.start_time AND session.end_time |
| overnight_min_hr | MIN(value) from same query |
| overnight_max_hr | MAX(value) from same query |
| hr_dip_pct | ((resting_hr - overnight_min_hr) / resting_hr) * 100 |

#### 3.7 Business Logic Rules

##### Overnight Heart Rate Extraction

**Purpose:** Extract heart rate samples that fall within a sleep session's time window.

**Inputs:**
- sessionStartTime: datetime
- sessionEndTime: datetime

**Logic:**
```
1. Query hl_vitals WHERE vital_type = 'heart_rate'
   AND recorded_at >= sessionStartTime
   AND recorded_at <= sessionEndTime
   ORDER BY recorded_at ASC
2. IF result count < 1 THEN RETURN null (no overnight HR data)
3. Compute:
   overnightAvg = AVG(all values)
   overnightMin = MIN(all values), with timestamp
   overnightMax = MAX(all values), with timestamp
4. RETURN { samples, overnightAvg, overnightMin, overnightMax }
```

##### Heart Rate Dip Calculation

**Purpose:** Compute the nocturnal HR dip percentage.

**Inputs:**
- restingHR: number (user's average daytime resting heart rate, from most recent resting_heart_rate vital)
- overnightMinHR: number (minimum heart rate during sleep)

**Logic:**
```
1. IF restingHR is null OR restingHR == 0 THEN RETURN null (insufficient data)
2. dipPct = ((restingHR - overnightMinHR) / restingHR) * 100
3. CLAMP dipPct to range [-50, 50] (sanity bound)
4. RETURN dipPct
```

**Formulas:**
- `hrDipPct = ((restingHR - overnightMinHR) / restingHR) * 100`

**Classification:**
- Dip >= 10% and <= 20%: "Normal dipper" (green)
- Dip < 10% and >= 0%: "Non-dipper" (yellow, associated with cardiovascular risk)
- Dip < 0% (overnight HR higher than resting): "Reverse dipper" (red, may indicate illness, alcohol, or overtraining)
- Dip > 20%: "Extreme dipper" (yellow, may indicate excessive drop)

##### Per-Stage Heart Rate Average

**Purpose:** Compute average heart rate during each sleep stage.

**Inputs:**
- hrSamples: array of {value, recorded_at}
- stageIntervals: array of {stage, start_time, end_time}

**Logic:**
```
1. IF stageIntervals is empty THEN RETURN null
2. For each stage in [deep, rem, light, awake]:
   a. Collect HR samples whose recorded_at falls within any interval of that stage
   b. Compute AVG(value) for those samples
   c. IF no samples fall in that stage THEN set to null
3. RETURN { deepAvgHR, remAvgHR, lightAvgHR, awakeAvgHR }
```

**Edge Cases:**
- Stage interval with zero HR samples inside it: report as null for that stage
- HR sample exactly on stage boundary: assign to the stage that starts at that time

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No resting HR baseline available | Dip percentage not shown, note: "Log resting heart rate for dip analysis" | User logs resting HR manually or waits for HealthKit sync |
| Very sparse HR data (< 3 samples) | Stats shown with caveat: "Based on limited data" | Encourage wearing watch during sleep |
| HR samples outside plausible range (< 25 or > 200 during sleep) | Outliers excluded from avg/min/max, note if outliers were removed | Automatic outlier filtering |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a sleep session from 10:30 PM to 6:00 AM with 200 HR samples from Apple Watch,
   **When** the user views the Sleep Detail screen,
   **Then** the Overnight HR chart displays a smooth line, and stats show avg, min (with time), max (with time), and dip percentage.

2. **Given** the user's resting HR is 68 bpm and overnight minimum is 55 bpm,
   **When** dip is calculated,
   **Then** dip = ((68 - 55) / 68) * 100 = 19.1%, displayed as "Normal dipper" in green.

3. **Given** stage interval data exists and HR samples span all stages,
   **When** per-stage averages are computed,
   **Then** each stage shows its average HR (e.g., Deep: 54 bpm, REM: 62 bpm, Light: 58 bpm, Awake: 72 bpm).

**Edge Cases:**

4. **Given** a session with only 5 HR samples in the overnight window,
   **When** the chart renders,
   **Then** dots are displayed (no line), stats are computed from 5 samples, and a note reads "Limited heart rate data for this night."

5. **Given** HealthKit is not enabled,
   **When** the user views Sleep Detail,
   **Then** the overnight HR section shows "Connect Apple Health to see overnight heart rate."

**Negative Tests:**

6. **Given** no resting HR data exists in hl_vitals,
   **When** dip calculation is attempted,
   **Then** dip is not shown, and a note reads "Log resting heart rate for dip analysis."
   **And** the rest of the overnight HR stats (avg, min, max) are still displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes overnight avg correctly | HR samples: [60, 55, 58, 62, 57] | avg: 58.4 |
| computes overnight min with timestamp | HR samples with timestamps | min value and its timestamp |
| computes HR dip: normal dipper | resting: 70, overnight min: 58 | dipPct: 17.1% |
| computes HR dip: non-dipper | resting: 70, overnight min: 65 | dipPct: 7.1% |
| computes HR dip: reverse dipper | resting: 65, overnight min: 68 | dipPct: -4.6% |
| returns null dip when no resting HR | resting: null | dipPct: null |
| filters outlier HR during sleep | samples include HR of 15 bpm | outlier excluded from statistics |
| per-stage avg with intervals | 4 stages with HR samples in each | correct per-stage averages |
| per-stage avg with empty stage | deep stage has zero HR samples | deepAvgHR: null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Overnight HR from HealthKit sync | 1. Sync HR data from HealthKit, 2. Log sleep session overlapping HR timestamps, 3. Query overnight HR | HR samples matched to session window, stats computed |
| Multi-night trend | 1. Seed 7 nights with HR data, 2. Query overnight avg trend | 7 data points with correct nightly averages |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews overnight HR after wearing watch | 1. Wear Apple Watch to bed, 2. HealthKit sync in morning, 3. Open Sleep tab, 4. Tap last night, 5. Scroll to HR section | Line chart of overnight HR, stats row (avg/min/max/dip), per-stage averages if stage data available |

---

### HL-016: Blood Oxygen (SpO2) Trending

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-016 |
| **Feature Name** | Blood Oxygen (SpO2) Trending |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Manager, I want to track my blood oxygen levels over time and receive alerts when readings fall below clinically significant thresholds, so that I can identify respiratory issues early and share trends with my pulmonologist.

**Secondary:**
> As a Sleep Optimizer, I want to see my overnight SpO2 readings alongside my sleep data, so that I can identify desaturation events that may indicate sleep apnea.

#### 3.3 Detailed Description

Blood Oxygen (SpO2) Trending provides dedicated visualization and alerting for blood oxygen saturation data. While SpO2 readings are already stored in `hl_vitals` (vital_type = 'blood_oxygen') via manual entry or HealthKit sync, this feature adds clinical context overlays, threshold alerting, overnight SpO2 analysis, and desaturation event detection.

Normal SpO2 is 95-100%. Readings between 90-94% are considered "below normal" and warrant medical attention. Readings below 90% are clinically significant hypoxemia. Overnight desaturation events (SpO2 drops of 4% or more below baseline) are a key indicator of obstructive sleep apnea when occurring repeatedly (> 5 events per hour = mild OSA risk, > 15 per hour = moderate, > 30 per hour = severe).

The SpO2 detail screen displays a trend chart with clinical threshold bands, overnight SpO2 overlay on sleep sessions, desaturation event counts per night, and a 30-day rolling average with trend direction.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-012: Apple Health / HealthKit Integration - provides SpO2 data from Apple Watch or pulse oximeter

**External Dependencies:**
- Apple Watch Series 6+ or later (has SpO2 sensor), or manual SpO2 entry from external pulse oximeter

**Assumed Capabilities:**
- SpO2 readings stored in hl_vitals with vital_type = 'blood_oxygen'

#### 3.5 User Interface Requirements

##### Screen: SpO2 Detail

**Layout:**
- Header: "Blood Oxygen" with a lungs icon
- Large current reading display: latest SpO2 value with classification badge:
  - 95-100%: "Normal" (green)
  - 90-94%: "Below Normal" (yellow)
  - < 90%: "Low" (red)
- Trend chart:
  - X-axis: dates
  - Y-axis: SpO2 percentage (90-100% range, auto-scaled)
  - Colored horizontal bands: green (95-100%), yellow (90-94%), red (< 90%)
  - Time range selector: 7d, 30d, 90d
- Summary stats for selected range:
  - Average SpO2
  - Minimum SpO2 (with date)
  - Number of readings below 95%
  - Number of readings below 90%
- Overnight SpO2 section (if overnight data exists):
  - Mini chart showing SpO2 during last night's sleep
  - Desaturation event count (drops >= 4% from baseline)
  - Estimated desaturation index (events per hour)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No data | Zero SpO2 readings | Empty state: "No blood oxygen data. Use a pulse oximeter or wear Apple Watch to track SpO2." |
| Manual only | Only manual daytime readings | Trend chart with readings, no overnight section |
| Full data | Daytime + overnight readings from wearable | Full trend chart + overnight SpO2 section |

##### Component: Overnight SpO2 (within Sleep Detail)

**Layout:**
- Section title: "Blood Oxygen During Sleep"
- Mini line chart showing SpO2 samples during the sleep window
- Stats: Overnight avg, overnight min, desaturation events (count), desaturation index (events/hour)
- If desaturation index > 5: info note "Elevated desaturation events may warrant discussion with a healthcare provider"

#### 3.6 Data Requirements

No new entities. SpO2 data is stored in `hl_vitals` (vital_type = 'blood_oxygen'). Desaturation events are computed on-the-fly from SpO2 samples during sleep windows.

**Computed Values (not persisted):**

| Metric | Computation |
|--------|-------------|
| overnight_avg_spo2 | AVG(value) WHERE vital_type = 'blood_oxygen' AND recorded_at BETWEEN session.start_time AND session.end_time |
| overnight_min_spo2 | MIN(value) from same query |
| desaturation_events | Count of SpO2 drops >= 4% from session baseline |
| desaturation_index | desaturation_events / (session.duration_minutes / 60) |

#### 3.7 Business Logic Rules

##### SpO2 Classification

**Purpose:** Classify a blood oxygen reading using clinical thresholds.

**Inputs:**
- spo2Value: number (percentage, 0-100)

**Logic:**
```
1. IF spo2Value >= 95 THEN classification = "Normal", color = green
2. IF spo2Value >= 90 AND spo2Value < 95 THEN classification = "Below Normal", color = yellow
3. IF spo2Value < 90 THEN classification = "Low", color = red
4. RETURN { classification, color }
```

##### Desaturation Event Detection

**Purpose:** Identify overnight SpO2 drops that may indicate sleep-disordered breathing.

**Inputs:**
- spo2Samples: array of {value, recorded_at} sorted by time ASC
- sessionDurationHours: number

**Logic:**
```
1. IF spo2Samples.length < 10 THEN RETURN { events: 0, index: 0, insufficient: true }
2. Compute baseline = PERCENTILE_90(spo2Samples.values)
   (90th percentile is used as baseline to represent the user's normal level)
3. threshold = baseline - 4.0

4. Initialize: events = 0, inDesaturation = false
5. FOR each sample in spo2Samples:
   a. IF sample.value <= threshold AND NOT inDesaturation THEN
        events += 1
        inDesaturation = true
   b. IF sample.value > threshold AND inDesaturation THEN
        inDesaturation = false
6. desaturationIndex = events / sessionDurationHours
7. RETURN { events, desaturationIndex, baseline }
```

**Formulas:**
- `desaturationIndex = desaturationEvents / (sessionDurationMinutes / 60)`
- `baseline = percentile90(spo2Values)`
- `threshold = baseline - 4.0`

**Desaturation Index Classification:**
- < 5 events/hour: "Normal"
- 5-14 events/hour: "Mild" (info note about discussing with healthcare provider)
- 15-29 events/hour: "Moderate" (stronger recommendation to consult provider)
- >= 30 events/hour: "Severe" (urgent recommendation)

**Edge Cases:**
- Fewer than 10 SpO2 samples: insufficient for desaturation analysis, show note
- All samples identical: zero events (no drops detected)
- Baseline < 90%: still use the same algorithm but note "Your baseline SpO2 appears low"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| SpO2 sensor not available on device | "SpO2 tracking requires Apple Watch Series 6 or later, or a pulse oximeter" | Manual entry still available |
| Too few overnight samples for desaturation analysis | Desaturation section shows "Insufficient data for desaturation analysis" | Encourage continuous wear during sleep |
| SpO2 value outside 50-100% range | Reading excluded from analysis | Automatic outlier filtering |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 30 days of SpO2 readings averaging 97%,
   **When** they open the SpO2 Detail screen,
   **Then** the trend chart shows readings within the green "Normal" band, and average is displayed as 97%.

2. **Given** overnight SpO2 data with 8 desaturation events over 7 hours of sleep,
   **When** the overnight SpO2 section renders,
   **Then** desaturation index = 8/7 = 1.14 events/hour, classified as "Normal."

3. **Given** a reading of 92%,
   **When** the classification runs,
   **Then** the badge shows "Below Normal" in yellow.

**Edge Cases:**

4. **Given** only 5 overnight SpO2 samples,
   **When** the desaturation analysis runs,
   **Then** the section shows "Insufficient data for desaturation analysis" instead of event counts.

5. **Given** an overnight desaturation index of 12 events/hour,
   **When** the analysis completes,
   **Then** the section shows "Mild" classification with an info note: "Elevated desaturation events may warrant discussion with a healthcare provider."

**Negative Tests:**

6. **Given** a manually entered SpO2 value of 45% (outside valid range),
   **When** the user attempts to save,
   **Then** inline validation shows "Blood oxygen must be between 50% and 100%."
   **And** no reading is saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| classifies normal SpO2 | value: 97 | "Normal", green |
| classifies below normal SpO2 | value: 93 | "Below Normal", yellow |
| classifies low SpO2 | value: 88 | "Low", red |
| detects zero desaturation events | all samples at 97-98% | events: 0, index: 0 |
| detects 3 desaturation events | samples with 3 drops of 5% below baseline | events: 3 |
| computes desaturation index | 6 events over 8 hours | index: 0.75 |
| returns insufficient for < 10 samples | 5 samples | insufficient: true |
| computes correct baseline | samples: [96, 97, 98, 97, 96, 95, 97, 98, 97, 96] | baseline (p90): 98 |
| handles all-identical samples | 20 samples at 97% | events: 0, baseline: 97 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Overnight SpO2 with sleep session | 1. Seed SpO2 samples during sleep window, 2. Query overnight stats | Correct avg, min, events, index |
| SpO2 trend chart data | 1. Seed 30 days of SpO2 readings, 2. Query daily aggregates | 30 daily averages returned |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User views SpO2 trend after Apple Watch sync | 1. HealthKit sync imports SpO2 data, 2. Open Vitals grid, 3. Tap Blood Oxygen card | SpO2 Detail screen shows trend chart with clinical bands and current reading classification |
| User views overnight SpO2 in sleep detail | 1. Have overnight SpO2 data, 2. Open Sleep tab, 3. Tap a session | Overnight SpO2 section shows mini chart, avg, min, and desaturation index |

---

### HL-017: Readiness Score

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-017 |
| **Feature Name** | Readiness Score |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Fitness Recovery Tracker, I want a daily readiness score (0-100) that tells me whether my body is recovered and ready for intense training, so that I can plan my workout intensity and avoid overtraining.

**Secondary:**
> As a Health-Conscious Professional, I want to understand which factors (sleep, HRV, resting HR, activity load) are driving my readiness score up or down, so that I can take targeted action to improve my recovery.

#### 3.3 Detailed Description

The Readiness Score is a daily composite metric (0-100) that estimates the user's recovery state and physical readiness. It replaces Whoop's Recovery Score ($360/yr) and Garmin's Body Battery by using the same underlying signals (sleep, HRV, resting heart rate, recent activity load) sourced from HealthKit data or manual entries.

The score is computed each morning using data from the previous night's sleep and the latest physiological readings. It is displayed prominently on the Today Dashboard as a large circular ring with contextual guidance:

- **80-100 (Green - "Ready"):** Fully recovered. Good day for high-intensity training.
- **60-79 (Blue - "Moderate"):** Partially recovered. Moderate activity recommended.
- **40-59 (Yellow - "Low"):** Under-recovered. Light activity or active recovery recommended.
- **0-39 (Red - "Rest"):** Significantly under-recovered. Rest day recommended.

The score algorithm uses a weighted composite of five components, each normalized to 0-100:

| Component | Weight | Source | What It Measures |
|-----------|--------|--------|-----------------|
| Sleep Quality | 30% | HL-004 sleep quality score | How well the user slept last night |
| Sleep Duration | 15% | HL-003 session duration vs target | Whether sleep met the user's target hours |
| HRV Status | 25% | HL-020 HRV data | HRV relative to 7-day rolling baseline |
| Resting HR Status | 15% | HL-005 resting heart rate | Resting HR relative to 14-day rolling baseline |
| Activity Load Balance | 15% | HL-019 activity data | Recent activity load vs recovery capacity |

When fewer components are available (e.g., no HRV data), the algorithm redistributes weights proportionally among available components. The minimum requirement for a readiness score is at least one sleep session from the previous night.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-004: Sleep Quality Scoring - provides sleep quality component
- HL-012: Apple Health / HealthKit Integration - provides HRV, resting HR, activity data

**External Dependencies:**
- At least one sleep session logged the previous night (manual or HealthKit)
- HealthKit data significantly enhances accuracy but is not strictly required

**Assumed Capabilities:**
- Sleep data is available for the previous night
- Optionally, HRV, resting HR, and activity data are available from HealthKit

#### 3.5 User Interface Requirements

##### Component: Readiness Score Ring (Dashboard)

**Layout:**
- Large circular progress ring (120x120 points), centered at the top of the Today Dashboard
- Score number (0-100) displayed large and bold inside the ring
- Ring color matches classification: green (80-100), blue (60-79), yellow (40-59), red (0-39)
- Classification label below the ring: "Ready", "Moderate", "Low", or "Rest"
- Guidance text below label: brief actionable recommendation
- Tap the ring to navigate to Readiness Detail screen

##### Screen: Readiness Detail

**Layout:**
- Header: "Today's Readiness" with the score ring (smaller, 80x80)
- Component breakdown section: 5 rows, one per component:
  - Component name (e.g., "Sleep Quality")
  - Component score (0-100) with a horizontal bar
  - Bar colored: green (75+), yellow (50-74), red (< 50)
  - Brief context text (e.g., "78/100 - Good sleep last night")
  - Weight percentage shown as label (e.g., "30%")
- If a component is unavailable (e.g., no HRV), the row shows "No data" with a dimmed bar and a note about how to enable it
- 7-day readiness trend chart below the breakdown: line chart with daily readiness scores
- Historical readiness calendar: scrollable month view where each day cell is colored by readiness score

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full score | All 5 components available | Ring + all 5 component bars + trend chart |
| Partial score | 2-4 components available | Ring + available bars + note "Accuracy improves with more data sources" |
| Sleep-only score | Only sleep data available | Ring (based on sleep alone) + note "Connect Apple Health for a more accurate readiness score" |
| No score | No sleep session from last night | No ring on dashboard. Readiness Detail shows "No readiness score today. Log last night's sleep to generate a score." |

#### 3.6 Data Requirements

##### Entity: ReadinessScore

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| score_date | date | Required, unique | None | The date this score is for (today's date) |
| overall_score | float | 0.0 to 100.0 | None | Composite readiness score |
| sleep_quality_score | float | 0.0 to 100.0, nullable | null | Sleep quality component (0-100) |
| sleep_duration_score | float | 0.0 to 100.0, nullable | null | Sleep duration component (0-100) |
| hrv_score | float | 0.0 to 100.0, nullable | null | HRV status component (0-100) |
| resting_hr_score | float | 0.0 to 100.0, nullable | null | Resting HR status component (0-100) |
| activity_load_score | float | 0.0 to 100.0, nullable | null | Activity load balance component (0-100) |
| components_used | integer | 1 to 5 | None | Number of components with data |
| classification | enum | One of: ready, moderate, low, rest | None | Score classification |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Table:** `hl_readiness_scores` (new table, requires schema migration v4)

**Indexes:**
- `score_date` (unique) - one score per day, fast date-based lookup

**Example Data:**
```json
{
  "id": "hl_rdy_20260306_a1b2",
  "score_date": "2026-03-06",
  "overall_score": 74,
  "sleep_quality_score": 78,
  "sleep_duration_score": 88,
  "hrv_score": 65,
  "resting_hr_score": 70,
  "activity_load_score": 60,
  "components_used": 5,
  "classification": "moderate",
  "created_at": "2026-03-06T07:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Readiness Score Algorithm

**Purpose:** Compute a daily 0-100 readiness score from available health components.

**Inputs:**
- sleepQualityScore: number | null (from HL-004, last night's sleep quality 0-100)
- sleepDurationMinutes: number | null (from HL-003, last night's duration)
- targetSleepMinutes: number (from user settings, default 480)
- currentHRV: number | null (most recent HRV reading in ms)
- hrvBaseline: number | null (7-day rolling average HRV)
- currentRestingHR: number | null (most recent resting HR in bpm)
- restingHRBaseline: number | null (14-day rolling average resting HR)
- recentActivityLoad: number | null (sum of active energy kcal over last 3 days)
- baselineActivityLoad: number | null (average 3-day active energy over last 28 days)

**Logic:**
```
1. Initialize components array (empty)

2. Sleep Quality Component (weight: 0.30):
   IF sleepQualityScore is not null THEN
     sleepQualComp = sleepQualityScore  // already 0-100
     ADD {name: 'sleep_quality', score: sleepQualComp, weight: 0.30} to components

3. Sleep Duration Component (weight: 0.15):
   IF sleepDurationMinutes is not null THEN
     durationRatio = sleepDurationMinutes / targetSleepMinutes
     IF durationRatio >= 1.0 THEN
       sleepDurComp = MIN(100, 100 - (durationRatio - 1.0) * 15)
     ELSE
       sleepDurComp = durationRatio * 100
     ADD {name: 'sleep_duration', score: sleepDurComp, weight: 0.15} to components

4. HRV Status Component (weight: 0.25):
   IF currentHRV is not null AND hrvBaseline is not null AND hrvBaseline > 0 THEN
     hrvRatio = currentHRV / hrvBaseline
     IF hrvRatio >= 1.0 THEN
       hrvComp = MIN(100, 50 + hrvRatio * 50)
       // Above baseline: score 100 at ratio 1.0, scales up but caps at 100
     ELSE
       hrvComp = MAX(0, hrvRatio * 100)
       // Below baseline: linear scale. 50% of baseline = 50 score.
     ADD {name: 'hrv', score: hrvComp, weight: 0.25} to components

5. Resting HR Status Component (weight: 0.15):
   IF currentRestingHR is not null AND restingHRBaseline is not null AND restingHRBaseline > 0 THEN
     // Lower resting HR is better. Higher than baseline = worse recovery.
     hrDeviation = (currentRestingHR - restingHRBaseline) / restingHRBaseline
     IF hrDeviation <= 0 THEN
       restHRComp = MIN(100, 100 + hrDeviation * 50)
       // At or below baseline = 100. 10% below = 95.
     ELSE
       restHRComp = MAX(0, 100 - hrDeviation * 200)
       // 5% above baseline = 90. 25% above = 50. 50% above = 0.
     ADD {name: 'resting_hr', score: restHRComp, weight: 0.15} to components

6. Activity Load Balance Component (weight: 0.15):
   IF recentActivityLoad is not null AND baselineActivityLoad is not null AND baselineActivityLoad > 0 THEN
     loadRatio = recentActivityLoad / baselineActivityLoad
     IF loadRatio <= 1.2 THEN
       activityComp = 100  // Within normal range
     ELSE IF loadRatio <= 2.0 THEN
       activityComp = MAX(0, 100 - (loadRatio - 1.2) * 125)
       // 1.2x baseline = 100. 2.0x = 0.
     ELSE
       activityComp = 0  // Significantly overloaded
     ADD {name: 'activity_load', score: activityComp, weight: 0.15} to components

7. IF components is empty THEN RETURN null (no score possible)

8. Redistribute weights proportionally:
   totalWeight = SUM(component.weight for all components)
   FOR each component:
     adjustedWeight = component.weight / totalWeight

9. Compute weighted score:
   overallScore = SUM(component.score * adjustedWeight for all components)
   overallScore = ROUND(CLAMP(overallScore, 0, 100))

10. Classify:
    IF overallScore >= 80 THEN classification = 'ready'
    ELSE IF overallScore >= 60 THEN classification = 'moderate'
    ELSE IF overallScore >= 40 THEN classification = 'low'
    ELSE classification = 'rest'

11. Persist to hl_readiness_scores (upsert by score_date)
12. RETURN { overallScore, classification, components, componentsUsed }
```

**Formulas:**
- `sleepDurComp = durationRatio >= 1.0 ? min(100, 100 - (durationRatio - 1.0) * 15) : durationRatio * 100`
- `hrvComp = hrvRatio >= 1.0 ? min(100, 50 + hrvRatio * 50) : max(0, hrvRatio * 100)`
- `restHRComp = hrDeviation <= 0 ? min(100, 100 + hrDeviation * 50) : max(0, 100 - hrDeviation * 200)`
- `activityComp = loadRatio <= 1.2 ? 100 : max(0, 100 - (loadRatio - 1.2) * 125)`
- `overallScore = round(clamp(sum(score_i * adjustedWeight_i), 0, 100))`

**Edge Cases:**
- Only sleep data available (2 components): weights redistribute to sleep_quality: 0.667, sleep_duration: 0.333
- User slept 12 hours (150% of target): duration component = 100 - (1.5 - 1.0) * 15 = 92.5
- HRV 50% above baseline: score = min(100, 50 + 1.5 * 50) = 100 (caps at 100)
- Resting HR 25% above baseline: score = max(0, 100 - 0.25 * 200) = 50
- All components available with perfect scores: overall = 100

##### Score Recalculation Trigger

**Purpose:** Determine when to recalculate the readiness score.

**Logic:**
```
1. Recalculate when:
   a. App opens and no score exists for today
   b. New sleep session for last night is logged or synced
   c. New HRV reading is synced from HealthKit
   d. User manually triggers "Refresh" on the readiness screen
2. Do NOT recalculate more than once per hour (debounce)
3. Score for a past date is never recalculated (immutable once the day passes)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No sleep data for last night | No readiness score displayed, prompt: "Log last night's sleep for today's readiness score" | User logs sleep session |
| HRV baseline insufficient (< 7 days of data) | HRV component excluded, note: "7 days of HRV data needed for full accuracy" | Score computed without HRV component |
| Activity load baseline insufficient (< 14 days) | Activity component excluded, note: "2 weeks of activity data needed" | Score computed without activity component |
| All component scores are zero | Score = 0, classification = "rest" | Guidance: "Consider resting today. Multiple recovery factors are low." |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user slept 8 hours with quality score 85, HRV is 10% above baseline, resting HR is at baseline, and activity load is normal,
   **When** the readiness score is computed,
   **Then** all components score high, overall score is approximately 88-92, classification is "Ready."

2. **Given** the user slept 5 hours with quality score 45, HRV is 20% below baseline,
   **When** the readiness score is computed,
   **Then** sleep and HRV components are low, overall score is approximately 40-55, classification is "Low."

3. **Given** only sleep data is available (no HRV, no resting HR, no activity),
   **When** the readiness score is computed,
   **Then** the score uses sleep quality (66.7% weight) and sleep duration (33.3% weight) only, with a note about limited accuracy.

**Edge Cases:**

4. **Given** no sleep session exists for last night,
   **When** the user opens the dashboard,
   **Then** no readiness ring is shown, and a prompt says "Log last night's sleep for today's readiness score."

5. **Given** the user has only 3 days of HRV data (baseline requires 7),
   **When** the readiness score is computed,
   **Then** the HRV component is excluded and its weight is redistributed to other components.

**Negative Tests:**

6. **Given** all available component scores are 0 (terrible sleep, crashed HRV, elevated resting HR, massive overtraining),
   **When** the readiness score is computed,
   **Then** the overall score is 0, classification is "Rest."
   **And** guidance text says "Consider resting today."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| perfect readiness all components | sleepQual: 100, sleepDur: 480/480, hrv: 1.0x baseline, restHR: baseline, load: 1.0x | score ~100, classification: ready |
| poor readiness all components | sleepQual: 20, sleepDur: 240/480, hrv: 0.5x baseline, restHR: 1.3x baseline, load: 2.0x | score ~15-25, classification: rest |
| sleep-only score (no HRV/HR/activity) | sleepQual: 80, sleepDur: 420/480 | score ~82 (weights redistributed), classification: ready |
| oversleep duration component | duration: 720, target: 480 (1.5x) | sleepDurComp: 92.5 |
| HRV above baseline | hrv: 60, baseline: 50 (1.2x) | hrvComp: min(100, 50 + 1.2*50) = 100 |
| HRV well below baseline | hrv: 25, baseline: 50 (0.5x) | hrvComp: max(0, 0.5*100) = 50 |
| resting HR elevated 10% | restHR: 77, baseline: 70 (1.1x) | restHRComp: max(0, 100 - 0.1*200) = 80 |
| activity overloaded 1.5x | load: 1500, baseline: 1000 (1.5x) | activityComp: max(0, 100 - 0.3*125) = 62.5 |
| weight redistribution with 3 components | sleep_quality + sleep_duration + hrv only | weights: 0.43, 0.21, 0.36 (proportional to 0.30, 0.15, 0.25) |
| classifies score 80 as ready | overall: 80 | classification: ready |
| classifies score 79 as moderate | overall: 79 | classification: moderate |
| classifies score 39 as rest | overall: 39 | classification: rest |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full readiness computation | 1. Seed sleep, HRV, resting HR, activity data, 2. Compute readiness | Score persisted in hl_readiness_scores with all component scores |
| Readiness trend over 7 days | 1. Seed 7 days of health data, 2. Compute daily scores | 7 readiness scores with correct dates and values |
| Score not recomputed within debounce | 1. Compute score, 2. Immediately compute again | Second call returns cached score, no duplicate insert |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Morning readiness check | 1. Sleep tracked overnight via Apple Watch, 2. Open app in morning, 3. Dashboard loads | Readiness ring at top of dashboard with score, classification, and guidance text |
| User drills into readiness breakdown | 1. See readiness ring on dashboard, 2. Tap ring | Readiness Detail screen shows 5 component bars with scores, weights, and context text |

---

### HL-018: Guided Meditation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-018 |
| **Feature Name** | Guided Meditation |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an Anxiety/Stress Sufferer, I want guided meditation sessions with audio instructions and a timer, so that I can practice mindfulness without paying $80/year for Calm or $70/year for Headspace.

**Secondary:**
> As a Sleep Optimizer, I want a sleep meditation that guides me through progressive muscle relaxation before bed, so that I can fall asleep faster.

#### 3.3 Detailed Description

Guided Meditation provides a library of built-in meditation sessions with text-based guidance cues and an integrated timer. The initial library includes 8 meditation types across 4 categories. No audio recordings are required at launch; sessions use on-screen text prompts with timed transitions. Future versions may add text-to-speech or recorded audio guides.

**Meditation Categories and Sessions:**

| Category | Session | Duration | Description |
|----------|---------|----------|-------------|
| Mindfulness | Body Scan | 5, 10, 15 min | Progressive attention through body regions head to toe |
| Mindfulness | Mindful Breathing | 3, 5, 10 min | Focus attention on breath without controlling rhythm |
| Mindfulness | Open Awareness | 5, 10 min | Observe thoughts, sounds, sensations without attachment |
| Relaxation | Progressive Muscle Relaxation (PMR) | 10, 15, 20 min | Tense and release muscle groups systematically |
| Relaxation | Visualization | 5, 10 min | Guided imagery (peaceful place, healing light) |
| Sleep | Sleep Body Scan | 10, 15, 20 min | Slow body scan designed to induce sleep onset |
| Sleep | Counting Down | 5, 10 min | Backward counting with breath synchronization |
| Focus | Concentration | 5, 10, 15 min | Single-point focus (candle, breath count, mantra) |

Each session consists of a sequence of timed instruction steps. An instruction step has: a text cue displayed on screen, a duration in seconds, and an optional haptic cue at the start. The session engine advances through steps automatically, pausing between cues with silent intervals.

Completed sessions are logged as meditation entries in `hl_meditation_sessions` and contribute to the wellness timeline and MyHabits tracking.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone feature)

**External Dependencies:**
- Haptic feedback engine (optional)
- Screen wake lock to prevent device sleep during session

**Assumed Capabilities:**
- User can navigate to the Meditate section from the Mind tab

#### 3.5 User Interface Requirements

##### Screen: Meditation Library

**Layout:**
- Header: "Meditate" with total sessions completed counter (e.g., "42 sessions")
- Category tabs below header: All, Mindfulness, Relaxation, Sleep, Focus
- Scrollable grid of session cards (2-column layout)
- Each card shows: session name, category badge, available durations (e.g., "5 / 10 / 15 min"), an abstract illustration or icon representing the type
- Below the grid: "Recent Sessions" section showing last 3 completed sessions with date and duration

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| First visit | No sessions completed | All cards shown with a welcome banner: "Start your meditation journey. Pick any session to begin." |
| Populated | Sessions completed | Cards shown with "Recent Sessions" section |

**Interactions:**
- Tap session card: Navigate to Session Setup screen
- Tap category tab: Filter cards by category

##### Screen: Session Setup

**Layout:**
- Session name and description (2-3 sentences explaining the technique)
- Duration picker: horizontal row of duration buttons (e.g., 5, 10, 15 min) with the default highlighted
- Optional: ambient background toggle (gentle ambient tone during session)
- "Begin" button (large, centered)
- "How it works" expandable section explaining the technique in detail

##### Screen: Active Meditation Session

**Layout:**
- Full-screen view with calming gradient background (dark, minimal visual distraction)
- Central text area: current instruction cue in large, readable font (e.g., "Focus on the sensation in your feet. Notice any tension or warmth.")
- Progress bar at top: shows elapsed time relative to total session duration
- Timer: remaining time display (e.g., "8:42 remaining")
- "Pause" button (bottom center) and "End" button (top-left X icon)
- Subtle fade transition between instruction cues (0.5s crossfade)

**Haptic Feedback:**
- Gentle tap at the start of each new instruction cue
- Double tap at session midpoint
- Success pattern at session completion

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active | Session in progress | Instruction text, timer, progress bar |
| Paused | User tapped Pause | Timer frozen, "Resume" and "End Session" buttons |
| Completed | Timer reached zero | Completion card: session name, duration, a brief closing message ("Take a moment before returning to your day."), "Done" button |

#### 3.6 Data Requirements

##### Entity: MeditationSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| session_type | enum | One of: body_scan, mindful_breathing, open_awareness, pmr, visualization, sleep_body_scan, counting_down, concentration | None | Type of meditation |
| category | enum | One of: mindfulness, relaxation, sleep, focus | None | Meditation category |
| target_duration_seconds | integer | Min: 60 | None | Planned session duration |
| actual_duration_seconds | integer | Min: 0 | 0 | Actual time spent meditating |
| completed | boolean | - | false | Whether the user completed the full session |
| started_at | datetime | Required, ISO 8601 | Current timestamp | Session start time |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Table:** `hl_meditation_sessions` (new table, requires schema migration v5)

**Indexes:**
- `started_at` - chronological listing and timeline integration
- `session_type` - filtering by type

**Example Data:**
```json
{
  "id": "hl_med_1709676000_q9r3",
  "session_type": "body_scan",
  "category": "mindfulness",
  "target_duration_seconds": 600,
  "actual_duration_seconds": 600,
  "completed": true,
  "started_at": "2026-03-06T07:00:00Z",
  "created_at": "2026-03-06T07:10:05Z"
}
```

##### Entity: MeditationStep (static content, bundled with app)

| Field | Type | Description |
|-------|------|-------------|
| session_type | string | References the meditation type |
| step_index | integer | Order within the session |
| instruction_text | string | Text displayed to the user |
| duration_seconds | integer | How long this step is shown |
| duration_pct | float | Percentage of total session time (for variable-length sessions) |
| haptic | boolean | Whether to fire haptic at step start |

**Note:** MeditationStep data is bundled as static content in the app, not stored in the database. It is a configuration array, not a user-generated entity.

#### 3.7 Business Logic Rules

##### Session Step Engine

**Purpose:** Advance through meditation instruction steps with precise timing.

**Inputs:**
- sessionType: MeditationType
- totalDurationSeconds: number

**Logic:**
```
1. Load step definitions for the session type
2. For each step:
   a. Compute step duration:
      IF step has fixed duration_seconds THEN use that
      ELSE stepDuration = totalDurationSeconds * step.duration_pct
   b. Display instruction_text with fade-in animation
   c. IF step.haptic THEN fire gentle haptic
   d. Wait stepDuration seconds
   e. Fade out instruction text
3. On completion:
   a. Fire success haptic
   b. Display completion card
   c. Save MeditationSession to database
```

##### Session Completion Rules

**Purpose:** Determine if a meditation session counts as completed.

**Logic:**
```
1. IF actual_duration_seconds >= target_duration_seconds * 0.90 THEN completed = true
   (90% threshold accounts for minor timing variations)
2. IF user tapped "End Session" before 90% THEN completed = false
3. IF app backgrounded > 3 minutes THEN auto-end, completed = false
4. Partial sessions (completed = false) are still saved for tracking
```

##### Meditation Statistics

**Purpose:** Compute meditation usage statistics.

**Logic:**
```
1. totalSessions = COUNT(*) FROM hl_meditation_sessions
2. totalMinutes = SUM(actual_duration_seconds) / 60
3. currentStreak = count consecutive days with at least one session, starting from today backward
4. longestStreak = maximum consecutive days with sessions
5. favoriteType = session_type with highest COUNT(*)
6. RETURN { totalSessions, totalMinutes, currentStreak, longestStreak, favoriteType }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Screen auto-locks during session | Session pauses, instruction and timer freeze | Request screen wake lock before session start; resume on unlock |
| App backgrounded during session | Session pauses after 30 seconds in background | Resume within 3 minutes; auto-end after 3 minutes |
| Haptic engine unavailable | Session works without haptics | Visual cue transitions only |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects Body Scan (10 min) and taps Begin,
   **When** the session runs,
   **Then** instruction cues transition with fade animations, timer counts down from 10:00, and the session completes with a summary card.

2. **Given** the user completes a 5-minute Mindful Breathing session,
   **When** the session ends,
   **Then** the session is saved with completed = true, and it appears in the Meditation Library "Recent Sessions" and in the Wellness Timeline.

3. **Given** the user has completed 10 meditation sessions,
   **When** they open the Meditation Library,
   **Then** the header shows "10 sessions" and the Recent Sessions section shows the last 3.

**Edge Cases:**

4. **Given** the user ends a session at 85% completion (below the 90% threshold),
   **When** the session saves,
   **Then** completed = false, but actual_duration_seconds reflects the time spent.

5. **Given** the user backgrounds the app for 4 minutes during a session,
   **When** the timeout fires,
   **Then** the session auto-ends with completed = false and is saved.

**Negative Tests:**

6. **Given** the device has no haptic engine (some iPads),
   **When** a session runs,
   **Then** the session works normally with visual-only cue transitions.
   **And** no error is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes step durations for 10-min body scan | totalDuration: 600, steps with duration_pct values | step durations sum to 600 |
| marks session completed at 90% | target: 600, actual: 540 | completed = true |
| marks session incomplete at 89% | target: 600, actual: 530 | completed = false |
| computes meditation streak | sessions on 3 consecutive days, gap, then 2 days | currentStreak: 2, longestStreak: 3 |
| computes total minutes | 5 sessions: 300s, 600s, 300s, 900s, 600s | totalMinutes: 45 |
| identifies favorite type | 3 body_scan, 2 breathing, 1 pmr | favoriteType: body_scan |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete session and verify persistence | 1. Start body scan (60s for test), 2. Complete, 3. Query | Session saved with correct type, duration, completed = true |
| Meditation appears in wellness timeline | 1. Complete a session, 2. Query timeline | Timeline entry with domain = 'meditation', correct timestamp |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| First-time meditation | 1. Open Meditate tab (no history), 2. Tap Body Scan, 3. Select 5 min, 4. Tap Begin, 5. Wait for completion | Summary card displayed, session in Recent Sessions, meditation counter shows "1 session" |
| User browses meditation categories | 1. Open Meditate tab, 2. Tap "Sleep" category tab | Only Sleep category sessions shown (Sleep Body Scan, Counting Down) |

---

### HL-019: Activity Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-019 |
| **Feature Name** | Activity Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Health-Conscious Professional, I want to see my daily step count, active calories, and active minutes on the Health Dashboard, so that I have a complete picture of my daily activity without opening a separate fitness app.

**Secondary:**
> As a Fitness Recovery Tracker, I want to see my activity load over the past 7 and 28 days, so that I can balance training volume and avoid overtraining.

#### 3.3 Detailed Description

Activity Tracking aggregates and displays movement data from HealthKit (steps, active energy burned, exercise minutes) and presents it on the Health Dashboard activity card and a dedicated Activity Detail screen. This feature does not introduce new sensors or tracking mechanisms; it consumes data already flowing through HealthKit Integration (HL-012) and organizes it into an activity-focused view.

The Activity card on the dashboard shows today's progress: steps (with daily goal progress ring), active energy (kcal), and active minutes. The Activity Detail screen shows historical data: daily bar charts for steps and active energy, weekly and monthly summaries, goal tracking, and streak counting.

Activity load (total active energy over a rolling window) feeds into the readiness score (HL-017) as the activity load balance component. Daily step counts are also available as a metric for health goals (HL-008).

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-012: Apple Health / HealthKit Integration - provides steps, active energy, and exercise minutes data

**External Dependencies:**
- iPhone motion coprocessor (steps without watch) or Apple Watch (more accurate steps + active energy + exercise minutes)

**Assumed Capabilities:**
- HealthKit sync has been enabled and step/active energy data is flowing into hl_vitals

#### 3.5 User Interface Requirements

##### Component: Activity Card (Dashboard)

**Layout:**
- Card title: "Activity" with a flame icon
- Three metric circles arranged horizontally:
  - **Steps:** Circular progress ring showing steps / daily goal. Number in center. Default goal: 10,000.
  - **Active Energy:** Number with "kcal" label. No ring (unless goal set).
  - **Active Minutes:** Number with "min" label. Apple Watch "green ring" equivalent.
- Below the circles: comparison text (e.g., "1,200 more than yesterday" or "2,000 fewer than average")

##### Screen: Activity Detail

**Layout:**
- Header: "Activity"
- Summary card: Today's steps, active energy, active minutes with daily goal progress
- Time range selector: Day, Week, Month
- **Day view:** Hourly bar chart showing step distribution throughout the day
- **Week view:** 7-day bar chart (one bar per day) for steps, with daily goal line
- **Month view:** Daily bars for the month, with weekly averages annotated
- Below chart: statistics for selected range:
  - Total steps / avg daily steps
  - Total active energy / avg daily
  - Total active minutes / avg daily
  - Best day (highest steps)
  - Current streak (consecutive days meeting step goal)
- Activity Load section:
  - 7-day load: total active energy kcal over last 7 days
  - 28-day average: average weekly active energy
  - Load ratio: 7-day / 28-day average (training load balance)
  - Load status: "Building" (ratio > 1.2), "Maintaining" (0.8-1.2), "Deloading" (< 0.8)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No data | Zero activity readings | Empty state: "No activity data yet. Walk with your phone or wear Apple Watch to start tracking." |
| Manual only | No HealthKit, user logging steps manually | Basic step display without hourly breakdown or active minutes |
| Full data | HealthKit providing steps + active energy + exercise minutes | Complete activity view with all charts and stats |

**Interactions:**
- Tap any bar in chart: Tooltip with exact value and date
- Tap step goal number: Edit daily step goal (numeric input, default 10,000)
- Tap time range: Switch chart view

#### 3.6 Data Requirements

No new entities. Activity data is stored in `hl_vitals` with vital_type values: `steps`, `active_energy`. Exercise minutes come from HealthKit as a separate type mapped to `hl_vitals` with vital_type `active_minutes`.

**Daily step goal is stored in `hl_settings`** with key `activity.dailyStepGoal` (integer, default: 10000).

**Computed Values:**

| Metric | Computation |
|--------|-------------|
| daily_steps | SUM(value) WHERE vital_type = 'steps' AND DATE(recorded_at) = target_date |
| daily_active_energy | SUM(value) WHERE vital_type = 'active_energy' AND DATE(recorded_at) = target_date |
| 7_day_load | SUM(daily_active_energy) over last 7 days |
| 28_day_avg_weekly | AVG(weekly_active_energy) over last 4 weeks |
| load_ratio | 7_day_load / 28_day_avg_weekly |

#### 3.7 Business Logic Rules

##### Daily Activity Aggregation

**Purpose:** Compute daily activity totals from potentially multiple readings.

**Inputs:**
- date: date
- vitalType: 'steps' | 'active_energy' | 'active_minutes'

**Logic:**
```
1. Query hl_vitals WHERE vital_type = vitalType
   AND DATE(recorded_at) = date
2. IF vitalType == 'steps' THEN
     // HealthKit reports cumulative steps; avoid double-counting from multiple sources
     // Group by source, take MAX per source, then SUM across sources
     dailyTotal = SUM(MAX(value) GROUP BY source)
   ELSE
     dailyTotal = SUM(value)
3. RETURN dailyTotal
```

**Edge Cases:**
- Multiple HealthKit sources (iPhone + Apple Watch): deduplicated by HealthKit before import
- Manual step entry + HealthKit steps on same day: both counted (user explicitly logged additional steps)
- Zero steps at end of day: valid (user did not move or did not carry device)

##### Step Goal Streak

**Purpose:** Count consecutive days meeting the daily step goal.

**Logic:**
```
1. Load dailyStepGoal from hl_settings (default: 10000)
2. Starting from today, go backward day by day:
   a. Compute daily_steps for that date
   b. IF daily_steps >= dailyStepGoal THEN streak += 1
   c. ELSE BREAK
3. RETURN streak
```

##### Activity Load Ratio

**Purpose:** Compute the acute:chronic training load ratio.

**Logic:**
```
1. acute_load = SUM(daily active energy) over last 7 days
2. chronic_load = AVG(weekly active energy) over last 28 days (4 weeks)
3. IF chronic_load == 0 THEN RETURN { ratio: null, status: 'insufficient_data' }
4. ratio = acute_load / chronic_load
5. IF ratio > 1.2 THEN status = 'building'
   ELSE IF ratio >= 0.8 THEN status = 'maintaining'
   ELSE status = 'deloading'
6. RETURN { ratio, status, acute_load, chronic_load }
```

**Formulas:**
- `loadRatio = acuteLoad7d / chronicLoadAvgWeekly28d`

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| HealthKit step data unavailable | Activity card shows manual-only mode or empty state | Prompt to enable HealthKit sync |
| Step goal set to zero | Validation prevents: "Step goal must be at least 1" | User enters valid goal |
| Insufficient data for load ratio (< 14 days) | Load section shows "Need 2+ weeks of data for load analysis" | Data accumulates naturally |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** HealthKit reports 8,500 steps for today and the daily goal is 10,000,
   **When** the dashboard Activity card renders,
   **Then** the steps ring shows 85% filled (8,500/10,000) with the step count centered.

2. **Given** 7 days of activity data with varying daily energy,
   **When** the user opens Activity Detail and selects Week view,
   **Then** a 7-day bar chart displays with daily totals and the daily goal line.

3. **Given** the user has met their step goal for 5 consecutive days,
   **When** they view the Activity Detail screen,
   **Then** the streak counter shows "5-day streak."

**Edge Cases:**

4. **Given** no HealthKit data and no manual entries,
   **When** the Activity card renders,
   **Then** it shows the empty state with a prompt to enable tracking.

5. **Given** the load ratio is 1.5 (building),
   **When** the Activity Load section renders,
   **Then** it shows "Building" status with a note about increased training volume.

**Negative Tests:**

6. **Given** the user tries to set a step goal of 0,
   **When** they confirm,
   **Then** validation prevents saving: "Step goal must be at least 1."
   **And** the previous goal is preserved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates daily steps | 3 step readings: 3000, 2500, 2000 | daily total: 7500 |
| computes step streak | 5 days above goal, then 1 day below | streak: 5 (starting from most recent above-goal day) |
| load ratio: building | acute: 3500 kcal, chronic avg: 2500 kcal/week | ratio: 1.4, status: building |
| load ratio: maintaining | acute: 2400, chronic: 2500 | ratio: 0.96, status: maintaining |
| load ratio: deloading | acute: 1500, chronic: 2500 | ratio: 0.6, status: deloading |
| load ratio: no chronic data | chronic: 0 | ratio: null, status: insufficient_data |
| rejects zero step goal | goal: 0 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Daily aggregation from HealthKit | 1. Sync step data (multiple readings per day), 2. Query daily total | Correct total, no double-counting |
| Activity card data flow | 1. Seed steps + energy + minutes, 2. Query activity card data | All three metrics returned with correct values |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User views activity after walking | 1. HealthKit syncs 6,000 steps, 2. Open dashboard | Activity card shows 6,000 steps with 60% ring fill (10k goal) |
| User changes step goal | 1. Open Activity Detail, 2. Tap step goal, 3. Change to 8,000, 4. Save | Step goal updated, ring recalculates to reflect new target |

---

### HL-020: HRV Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-020 |
| **Feature Name** | HRV Tracking |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Fitness Recovery Tracker, I want to see my heart rate variability (HRV) trends with RMSSD, SDNN, and pNN50 metrics, so that I can monitor my autonomic nervous system health and optimize recovery.

**Secondary:**
> As a Chronic Condition Manager, I want to see how my HRV changes relative to my personal baseline, so that I can detect early signs of stress, illness, or medication effects.

#### 3.3 Detailed Description

HRV Tracking provides comprehensive heart rate variability analysis using data from HealthKit (which reports SDNN in milliseconds) and optional raw RR-interval data when available. HRV is one of the most important biomarkers for overall health, recovery, and autonomic nervous system balance. Higher HRV generally indicates better cardiovascular fitness, lower stress, and better recovery.

The feature displays three standard HRV metrics:

| Metric | Full Name | Formula | Clinical Significance |
|--------|-----------|---------|----------------------|
| RMSSD | Root Mean Square of Successive Differences | sqrt(mean(diff(RR_intervals)^2)) | Short-term vagal tone indicator. Primary metric for recovery assessment. |
| SDNN | Standard Deviation of NN intervals | stdev(RR_intervals) | Overall HRV reflecting all cyclic components. HealthKit's default HRV metric. |
| pNN50 | Percentage of NN intervals differing by > 50ms | (count(abs(diff(RR)) > 50) / total_diffs) * 100 | Parasympathetic activity indicator. Higher = more relaxed. |

Since HealthKit provides SDNN directly (via `.heartRateVariabilitySDNN`), SDNN is the primary metric. RMSSD and pNN50 require raw RR-interval data, which is available from some HealthKit sources (Apple Watch when sampling in specific contexts). When raw RR data is unavailable, the system estimates RMSSD from SDNN using the empirical relationship: RMSSD is approximately 1.5x SDNN for healthy adults at rest.

The HRV Detail screen displays: current HRV value with trend arrow, 7-day rolling average with baseline comparison, daily HRV chart over 30/90/365 days, morning vs. nighttime HRV comparison (if data exists for both), and contextual interpretation text.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-012: Apple Health / HealthKit Integration - provides SDNN data and optionally RR intervals

**External Dependencies:**
- Apple Watch or other HealthKit-contributing device that records HRV
- HRV samples in HealthKit (Apple Watch takes periodic HRV readings, typically overnight and during Breathe app sessions)

**Assumed Capabilities:**
- HRV readings stored in hl_vitals with vital_type = 'hrv' and unit = 'ms'

#### 3.5 User Interface Requirements

##### Screen: HRV Detail

**Layout:**
- Header: "Heart Rate Variability" with a wave icon
- Current HRV display: large value (e.g., "42 ms SDNN"), trend arrow (up/down/stable vs. yesterday), percentage change
- 7-day rolling average: displayed below current value (e.g., "7-day avg: 45 ms")
- Baseline comparison bar: horizontal bar showing current vs. 30-day baseline
  - Current above baseline: green bar extending right
  - Current below baseline: red bar extending left
  - At baseline: centered marker
- Trend chart:
  - X-axis: dates
  - Y-axis: HRV in ms
  - Primary line: daily HRV value (single reading or daily average if multiple)
  - Secondary line (dashed): 7-day rolling average
  - Time range selector: 7d, 30d, 90d, 1y
- Metrics section (if raw RR data available):
  - RMSSD: value in ms
  - SDNN: value in ms
  - pNN50: value as percentage
  - If no raw RR data: show SDNN only with note "RMSSD and pNN50 require raw RR interval data"
- Context section: interpretation text based on current HRV:
  - Above 7-day avg: "Your HRV is above your recent average, suggesting good recovery."
  - Below 7-day avg by > 15%: "Your HRV is below average. Consider prioritizing rest and sleep."
  - Stable (within 15%): "Your HRV is within your normal range."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No data | Zero HRV readings | Empty state: "No HRV data yet. Wear Apple Watch to track heart rate variability." |
| Limited data (< 7 days) | 1-6 readings | Current value + chart (no 7-day average line), note: "Collecting baseline data (need 7+ days)" |
| Full data | 7+ days of readings | All components displayed |

#### 3.6 Data Requirements

No new entities for SDNN. SDNN values are stored in `hl_vitals` (vital_type = 'hrv').

##### Entity: RRInterval (optional, for advanced HRV metrics)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| session_id | string | Nullable | null | Optional: links to a specific measurement session |
| rr_ms | float | Required, > 0 | None | RR interval duration in milliseconds |
| recorded_at | datetime | Required, ISO 8601 | None | When this RR interval was recorded |
| source | enum | One of: apple_health, health_connect, manual | None | Data source |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Table:** `hl_rr_intervals` (new table, requires schema migration v6. Only populated if raw RR data is available from HealthKit.)

**Indexes:**
- `recorded_at` - chronological queries
- `session_id` - grouping intervals by measurement session

#### 3.7 Business Logic Rules

##### HRV Metrics Calculation

**Purpose:** Compute RMSSD, SDNN, and pNN50 from raw RR interval data.

**Inputs:**
- rrIntervals: number[] (RR intervals in milliseconds, chronologically ordered)

**Logic:**
```
1. IF rrIntervals.length < 2 THEN RETURN null (insufficient data)

2. Compute successive differences:
   diffs = []
   FOR i = 1 TO rrIntervals.length - 1:
     diffs.push(rrIntervals[i] - rrIntervals[i-1])

3. SDNN (Standard Deviation of NN intervals):
   mean_rr = MEAN(rrIntervals)
   sdnn = SQRT(MEAN((rrIntervals - mean_rr)^2))

4. RMSSD (Root Mean Square of Successive Differences):
   rmssd = SQRT(MEAN(diffs^2))

5. pNN50 (Percentage of successive differences > 50ms):
   nn50_count = COUNT(diffs WHERE ABS(diff) > 50)
   pnn50 = (nn50_count / diffs.length) * 100

6. RETURN { sdnn, rmssd, pnn50 }
```

**Formulas:**
- `SDNN = sqrt(sum((rr_i - mean_rr)^2) / N)`
- `RMSSD = sqrt(sum((rr_i - rr_(i-1))^2) / (N-1))`
- `pNN50 = (count(|rr_i - rr_(i-1)| > 50) / (N-1)) * 100`

##### RMSSD Estimation from SDNN

**Purpose:** Estimate RMSSD when raw RR interval data is unavailable.

**Inputs:**
- sdnn: number (SDNN value from HealthKit)

**Logic:**
```
1. IF raw RR data exists for this measurement THEN compute RMSSD directly (see above)
2. ELSE estimatedRMSSD = sdnn * 1.5
3. Mark the RMSSD value as estimated (display with "est." label)
4. RETURN estimatedRMSSD
```

**Note:** The 1.5x multiplier is an empirical approximation. It is reasonably accurate for resting measurements in healthy adults but less reliable during exercise or in individuals with cardiac arrhythmias.

##### HRV Baseline and Trend

**Purpose:** Compute rolling baselines for trend comparison.

**Inputs:**
- days: number (lookback period)

**Logic:**
```
1. Query hl_vitals WHERE vital_type = 'hrv' AND recorded_at >= (now - days)
   ORDER BY recorded_at ASC
2. 7-day rolling average: for each day, AVG of that day and previous 6 days
3. 30-day baseline: AVG of all readings in the last 30 days
4. Trend direction:
   IF today's value > 7-day avg * 1.05 THEN trend = 'up'
   ELSE IF today's value < 7-day avg * 0.95 THEN trend = 'down'
   ELSE trend = 'stable'
5. RETURN { rollingAvg7d, baseline30d, trend }
```

**Edge Cases:**
- Fewer than 7 readings: rolling average uses all available readings
- Zero readings: baseline = null, trend = null
- HRV of 0 ms: invalid, filter out (device error)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No HRV data from HealthKit | Empty state with setup guidance | Enable HealthKit HRV sync |
| Single HRV reading (no trend) | Current value shown, no trend arrow, note: "More data needed for trend analysis" | Data accumulates over time |
| HRV value of 0 ms | Reading excluded from display and calculations | Automatic filtering |
| Raw RR data unavailable | SDNN shown, RMSSD estimated with "est." label, pNN50 not shown | Note explains data source requirements |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 14 days of HRV data with a 30-day baseline of 45 ms and today's reading is 52 ms,
   **When** the HRV Detail screen loads,
   **Then** it shows "52 ms SDNN" with an up arrow, "7-day avg: 48 ms", and the baseline bar shifted right (above baseline).

2. **Given** raw RR interval data is available for a measurement session with 300 intervals,
   **When** HRV metrics are computed,
   **Then** SDNN, RMSSD, and pNN50 are all displayed with exact calculated values.

3. **Given** only SDNN data from HealthKit (no raw RR),
   **When** the metrics section renders,
   **Then** SDNN shows the actual value, RMSSD shows an estimated value with "est." label, and pNN50 shows "Requires raw RR data."

**Edge Cases:**

4. **Given** the user has only 3 days of HRV data,
   **When** the HRV Detail screen loads,
   **Then** the 7-day average line is absent from the chart, with a note: "Collecting baseline data (need 7+ days)."

5. **Given** today's HRV is 30% below the 7-day average,
   **When** the context section renders,
   **Then** it shows "Your HRV is below average. Consider prioritizing rest and sleep."

**Negative Tests:**

6. **Given** an HRV reading of 0 ms exists in the database,
   **When** the chart and averages are computed,
   **Then** the 0 ms reading is excluded from all calculations and chart display.
   **And** no error is shown to the user.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes SDNN correctly | RR intervals: [800, 810, 795, 820, 805] | SDNN: ~9.3 ms |
| computes RMSSD correctly | RR intervals: [800, 810, 795, 820, 805] | RMSSD: ~16.6 ms |
| computes pNN50 correctly | RR intervals: [800, 860, 790, 850, 780] | diffs: [60, -70, 60, -70], all > 50, pNN50: 100% |
| computes pNN50 with no large diffs | RR intervals: [800, 810, 815, 820, 825] | diffs: [10, 5, 5, 5], none > 50, pNN50: 0% |
| estimates RMSSD from SDNN | sdnn: 40 | estimatedRMSSD: 60 (40 * 1.5) |
| computes 7-day rolling average | 7 daily values: [40, 42, 38, 45, 43, 41, 44] | avg: 41.86 |
| trend direction: up | today: 50, 7d avg: 42 | trend: up (50 > 42 * 1.05 = 44.1) |
| trend direction: stable | today: 43, 7d avg: 42 | trend: stable (43 within 5% of 42) |
| trend direction: down | today: 35, 7d avg: 42 | trend: down (35 < 42 * 0.95 = 39.9) |
| filters zero HRV readings | values: [42, 0, 45, 0, 38] | avg computed from [42, 45, 38] only |
| handles < 2 RR intervals | 1 interval | returns null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| HRV trend over 30 days | 1. Seed 30 days of HRV data, 2. Query trend | 30 data points with correct rolling averages |
| RR interval import and metric computation | 1. Import RR data from HealthKit mock, 2. Compute metrics | SDNN, RMSSD, pNN50 computed correctly from stored intervals |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User views HRV after 2 weeks of tracking | 1. 14 days of HealthKit HRV sync, 2. Open Vitals, 3. Tap HRV card | HRV Detail with trend chart, 7-day rolling average, baseline comparison, and context text |

---

### HL-021: Smart Alarm

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-021 |
| **Feature Name** | Smart Alarm |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Sleep Optimizer, I want to be woken up during a light sleep phase within a configurable window before my target alarm time, so that I feel more refreshed and less groggy than being jolted awake during deep sleep.

#### 3.3 Detailed Description

The Smart Alarm monitors sleep stages in near-real-time (via HealthKit background delivery or Apple Watch complications) and triggers the alarm during the lightest sleep phase within a user-defined window before the target wake time. For example, if the alarm is set for 7:00 AM with a 30-minute smart window, the alarm may trigger as early as 6:30 AM if the user enters light sleep or is briefly awake during that window.

If no light sleep phase is detected within the smart window, the alarm fires at the exact target time. The alarm uses the device's alarm/notification system with a progressive wake sound (gradually increasing volume) and haptic feedback.

**Smart Window Options:** 10 minutes, 20 minutes, 30 minutes (default), 45 minutes.

This feature requires near-real-time sleep stage data, which depends on Apple Watch running watchOS 9+ with sleep tracking enabled and HealthKit background delivery for sleep analysis samples.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-012: Apple Health / HealthKit Integration - provides sleep stage data
- HL-014: Sleep Stage Analysis - provides stage detection logic

**External Dependencies:**
- Apple Watch with sleep tracking enabled (for real-time stage detection)
- Device notification/alarm system
- HealthKit background delivery for sleep analysis samples

**Assumed Capabilities:**
- Sleep stage data is available in near-real-time during the smart window
- Device can trigger local notifications with custom sounds

#### 3.5 User Interface Requirements

##### Screen: Smart Alarm Setup

**Layout:**
- Header: "Smart Alarm"
- Toggle: "Enable Smart Alarm" (master on/off)
- When enabled:
  - Target wake time picker (scrollable time picker, default: 7:00 AM)
  - Smart window picker: 10 min, 20 min, 30 min (default), 45 min
  - Alarm sound picker: list of built-in progressive wake sounds (5 options: Gentle Rise, Sunrise, Forest, Waves, Chimes)
  - Repeat days selector: Mon-Sun toggles (like standard iOS alarm)
  - Vibration toggle (default: ON)
- "Test Alarm" button: plays the selected alarm sound at low volume for 5 seconds
- Status section: shows next scheduled alarm (e.g., "Next alarm: Tomorrow 6:30 AM - 7:00 AM")

##### Screen: Alarm Triggered

**Layout:**
- Full-screen alarm view (similar to standard alarm)
- Current time prominently displayed
- "Stop" button (large, centered) and "Snooze" button (smaller, below)
- Stage badge: "Woke you during light sleep at 6:42 AM" or "Alarm time reached" if no light phase found
- Snooze duration: 5 minutes (not configurable)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Disabled | Smart alarm off | Toggle with description of the feature |
| Set | Alarm configured and active | Next alarm time, smart window, alarm details |
| Monitoring | Within smart window, watching for light sleep | Status: "Monitoring sleep stages..." (background) |
| Triggered | Alarm fired | Full-screen alarm with stop/snooze |
| Fired at target | No light phase found in window | Full-screen alarm with note "No light sleep detected in window" |

#### 3.6 Data Requirements

##### Entity: SmartAlarmConfig

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, fixed value "alarm_config" | "alarm_config" | Singleton config |
| enabled | boolean | - | false | Whether the smart alarm is active |
| target_time | string | HH:MM format (24-hour) | "07:00" | Target wake time |
| smart_window_minutes | integer | One of: 10, 20, 30, 45 | 30 | How early the alarm can trigger |
| alarm_sound | string | One of: gentle_rise, sunrise, forest, waves, chimes | gentle_rise | Alarm sound |
| vibration | boolean | - | true | Whether to vibrate |
| repeat_days | string | JSON array of integers 0-6 (0 = Sunday) | "[]" | Which days to repeat |
| updated_at | datetime | Auto-set | Current timestamp | Last modification |

**Table:** Stored in `hl_settings` as individual key-value pairs (e.g., `smartAlarm.enabled`, `smartAlarm.targetTime`).

#### 3.7 Business Logic Rules

##### Smart Wake Algorithm

**Purpose:** Determine the optimal wake time within the smart window.

**Inputs:**
- targetTime: datetime (e.g., 7:00 AM today)
- smartWindowMinutes: number (e.g., 30)

**Logic:**
```
1. windowStart = targetTime - smartWindowMinutes minutes
2. Start monitoring at windowStart

3. DURING monitoring (windowStart to targetTime):
   a. Check latest sleep stage data from HealthKit (polled every 2 minutes or via background delivery)
   b. IF current stage is 'light' OR 'awake' THEN
        Trigger alarm immediately
        Record actual_trigger_time and trigger_reason = 'light_sleep_detected'
        EXIT monitoring loop
   c. IF current time >= targetTime THEN
        Trigger alarm at target time
        Record trigger_reason = 'target_time_reached'
        EXIT monitoring loop

4. IF no sleep data available during window THEN
   Fall back to triggering at target time
   Record trigger_reason = 'no_sleep_data'
```

##### Snooze Logic

**Purpose:** Handle snooze button behavior.

**Logic:**
```
1. When user taps "Snooze":
   a. Dismiss alarm UI
   b. Schedule new alarm notification for now + 5 minutes
   c. Maximum 3 snoozes per alarm
   d. After 3rd snooze, only "Stop" button is shown
```

**Edge Cases:**
- Apple Watch not worn: no sleep stage data available, alarm fires at target time
- HealthKit background delivery delayed: fall back to target time
- User is already awake (phone in use) at window start: alarm still fires to confirm wakefulness
- Device in Do Not Disturb: alarm overrides DND (critical notification category)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No sleep data during smart window | Alarm fires at target time with note "No sleep data available" | Ensure Apple Watch is worn and sleep tracking is enabled |
| HealthKit background delivery fails | Fall back to target time alarm | Works like a standard alarm |
| Notification permission denied | Alert: "Alarm requires notification permission" | Link to device Settings |
| App killed by OS during monitoring | Alarm fires via pre-scheduled local notification at target time | Smart window optimization lost, but alarm still fires |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the alarm is set for 7:00 AM with a 30-minute window, and the user enters light sleep at 6:42 AM,
   **When** the smart alarm detects light sleep,
   **Then** the alarm triggers at 6:42 AM with a badge "Woke you during light sleep."

2. **Given** the alarm is set for 7:00 AM with a 30-minute window, and the user remains in deep sleep from 6:30 to 7:00 AM,
   **When** no light sleep is detected in the window,
   **Then** the alarm fires at exactly 7:00 AM with a note "No light sleep detected in window."

3. **Given** the user taps Snooze,
   **When** 5 minutes pass,
   **Then** the alarm fires again.

**Edge Cases:**

4. **Given** the Apple Watch is not worn and no sleep data exists,
   **When** the smart window passes,
   **Then** the alarm fires at the target time as a standard alarm.

5. **Given** the user has snoozed 3 times,
   **When** the alarm fires for the 4th time,
   **Then** only the "Stop" button is shown (no more snooze).

**Negative Tests:**

6. **Given** notification permissions are denied,
   **When** the user tries to enable the smart alarm,
   **Then** an alert explains that notification permission is required and offers a link to Settings.
   **And** the alarm is not enabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| triggers on light sleep in window | light sleep at 6:42, target 7:00, window 30min | trigger at 6:42, reason: light_sleep_detected |
| triggers at target when no light sleep | deep sleep throughout window, target 7:00 | trigger at 7:00, reason: target_time_reached |
| triggers at target with no data | no sleep data, target 7:00 | trigger at 7:00, reason: no_sleep_data |
| computes window start | target: 7:00 AM, window: 30 min | windowStart: 6:30 AM |
| enforces snooze limit | snooze count: 3 | snooze disabled, stop only |
| snooze duration | snooze triggered | next alarm at now + 5 minutes |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Smart alarm with mock sleep data | 1. Set alarm for target time, 2. Inject light sleep stage at window_start + 15 min | Alarm triggers at injection time |
| Alarm fires without watch data | 1. Set alarm, 2. No HealthKit sleep data | Alarm fires at target time |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User configures smart alarm | 1. Open Smart Alarm, 2. Enable, 3. Set 7:00 AM, 4. Set 30 min window, 5. Select "Gentle Rise" sound | Status shows "Next alarm: Tomorrow 6:30 AM - 7:00 AM" |

---

### HL-022: Snore Detection and Recording

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-022 |
| **Feature Name** | Snore Detection and Recording |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a Sleep Optimizer, I want to detect and record my snoring episodes during sleep, so that I can understand how much I snore, share recordings with my doctor, and track whether interventions (nasal strips, sleep position) reduce snoring.

#### 3.3 Detailed Description

Snore Detection uses the device microphone to monitor ambient sound during sleep sessions. The system listens for audio patterns characteristic of snoring (low-frequency, rhythmic sound bursts in the 100-800 Hz range) and records short clips of detected events. It does not perform continuous recording; it uses an energy-threshold trigger to start/stop recording clips.

Each snore event captures: start time, duration, intensity estimate (mild, moderate, loud based on decibel level), and an optional audio clip (10-second recording centered on the event). At the end of the sleep session, a snore summary is generated: total snore time, number of events, percentage of sleep spent snoring, and a timeline showing when snoring occurred during the night.

**Privacy:** Audio processing happens entirely on-device. Recordings are stored locally in the database as audio BLOBs. No audio is ever transmitted off-device. Users can delete recordings at any time. The microphone permission prompt clearly states that audio is processed locally.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-003: Sleep Session Logging - provides sleep session boundaries

**External Dependencies:**
- Microphone access permission
- Audio session management (must coexist with alarm sounds)
- Sufficient device storage for audio clips

**Assumed Capabilities:**
- User places device near their bed (nightstand) during sleep

#### 3.5 User Interface Requirements

##### Component: Snore Detection Toggle (Sleep Setup)

**Layout:**
- Toggle on the sleep logging screen: "Detect Snoring" with a microphone icon
- Below toggle: note about privacy ("Audio is processed on-device and never uploaded")
- When enabled: microphone permission is requested if not already granted

##### Screen: Snore Report (within Sleep Detail)

**Layout:**
- Section title: "Snoring" with a wave icon
- Summary metrics:
  - Snore events: count (e.g., "23 events")
  - Total snore time: minutes (e.g., "47 min")
  - % of sleep: percentage (e.g., "10.4%")
  - Intensity breakdown: mild / moderate / loud counts
- Snore timeline: horizontal bar showing when snoring occurred during the night (aligned with hypnogram if available)
- Recorded clips section: scrollable list of saved audio clips with:
  - Timestamp (e.g., "2:34 AM")
  - Duration (e.g., "8 sec")
  - Intensity badge
  - Play button
  - Delete button (trash icon)
- "Delete All Recordings" button at the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not enabled | Snore detection was off for this session | Note: "Snore detection was not enabled for this session" |
| No snoring | Detection was active, zero events detected | "No snoring detected. Great night!" |
| Snoring detected | Events recorded | Full snore report with timeline and clips |

#### 3.6 Data Requirements

##### Entity: SnoreEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| session_id | string | Foreign key to SleepSession.id, cascade delete | None | Parent sleep session |
| start_time | datetime | Required, ISO 8601 | None | When the snore event started |
| duration_seconds | float | Min: 0.5 | None | Duration of the snore event |
| intensity | enum | One of: mild, moderate, loud | None | Snore intensity classification |
| decibel_level | float | Min: 0, nullable | null | Estimated decibel level |
| audio_clip | blob | Nullable, max 500 KB | null | Optional audio recording (10s clip, compressed) |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Table:** `hl_snore_events` (new table, requires schema migration v7)

**Indexes:**
- `session_id` - querying events for a specific session
- `start_time` - chronological ordering

#### 3.7 Business Logic Rules

##### Snore Detection Algorithm

**Purpose:** Detect snoring from ambient audio during sleep.

**Logic:**
```
1. Start audio monitoring when sleep session begins and snore detection is enabled
2. Sample audio in 2-second windows with 1-second overlap
3. For each window:
   a. Compute RMS energy level
   b. IF energy > ambient_threshold (calibrated in first 5 minutes) THEN
      c. Apply bandpass filter: 100-800 Hz
      d. Compute spectral centroid and periodicity
      e. IF spectral centroid in snore range AND periodicity indicates rhythmic pattern THEN
           Mark as snore candidate
      f. IF snore candidate persists for >= 3 consecutive windows THEN
           Create SnoreEvent with start_time = first candidate window
   g. IF energy drops below threshold for >= 3 windows THEN
        End current event, set duration
4. Classify intensity:
   IF peak_decibel < 40 dB THEN intensity = 'mild'
   ELSE IF peak_decibel < 55 dB THEN intensity = 'moderate'
   ELSE intensity = 'loud'
5. IF audio recording is enabled AND event.intensity >= 'moderate' THEN
   Save 10-second audio clip (5s before + 5s after event peak)
```

##### Snore Summary Computation

**Purpose:** Generate per-session snoring summary statistics.

**Logic:**
```
1. Query hl_snore_events WHERE session_id = current session
2. eventCount = COUNT(*)
3. totalSnoreSeconds = SUM(duration_seconds)
4. snoringPercentage = (totalSnoreSeconds / session.duration_minutes / 60) * 100
5. intensityBreakdown = GROUP BY intensity, COUNT each
6. RETURN { eventCount, totalSnoreSeconds, snoringPercentage, intensityBreakdown }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Microphone permission denied | Alert: "Microphone access is needed for snore detection" | Link to Settings |
| Audio session interrupted (phone call) | Detection pauses during interruption, resumes after | Gap in timeline noted |
| Storage insufficient for clips | Events still tracked (without audio), warning: "Low storage - audio clips disabled" | User frees storage |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enables snore detection and sleeps for 8 hours,
   **When** the sleep session ends and 15 snore events were detected,
   **Then** the Snore Report shows 15 events with total time, percentage, and intensity breakdown.

2. **Given** a moderate snore event is detected at 2:34 AM,
   **When** the event is recorded,
   **Then** a 10-second audio clip is saved and playable from the Snore Report.

**Edge Cases:**

3. **Given** snore detection is enabled but no snoring occurs,
   **When** the session ends,
   **Then** the Snore Report shows "No snoring detected. Great night!"

4. **Given** the user deletes all recordings for a session,
   **When** the deletion completes,
   **Then** audio clips are removed but event metadata (times, counts, intensities) is preserved.

**Negative Tests:**

5. **Given** microphone permission is denied,
   **When** the user tries to enable snore detection,
   **Then** an alert explains that microphone access is required.
   **And** the toggle remains off.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| classifies mild snore | peak: 35 dB | intensity: mild |
| classifies moderate snore | peak: 50 dB | intensity: moderate |
| classifies loud snore | peak: 60 dB | intensity: loud |
| computes snoring percentage | snore time: 30 min, session: 480 min | percentage: 6.25% |
| counts events by intensity | 5 mild, 3 moderate, 2 loud | breakdown: {mild: 5, moderate: 3, loud: 2} |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Snore events linked to session | 1. Create session, 2. Create 5 snore events, 3. Delete session | Snore events cascade deleted |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews snore report | 1. Enable snore detection, 2. Sleep, 3. Wake, 4. Open session detail | Snore section shows events, timeline, playable clips |

---

### HL-023: Sleep Bank

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-023 |
| **Feature Name** | Sleep Bank |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Sleep Optimizer, I want to track my cumulative sleep surplus or deficit relative to my target, so that I can see whether I am "paying back" sleep debt or building up a sleep credit over weeks.

#### 3.3 Detailed Description

Sleep Bank tracks the cumulative difference between actual sleep duration and the user's target sleep duration over a rolling period. Inspired by AutoSleep's "Sleep Bank" concept, it visualizes whether the user is in sleep "credit" (surplus) or sleep "debt" (deficit).

Each night, the difference (actual - target) is added to the bank balance. A surplus night adds credit; a deficit night adds debt. The balance is displayed as a signed number (positive = credit, negative = debt) with visual indicators.

**Examples:**
- Target: 8 hours. Slept 9 hours. Bank change: +1 hour. If previous balance was -2h, new balance: -1h.
- Target: 8 hours. Slept 6 hours. Bank change: -2 hours. If previous balance was +1h, new balance: -1h.

The Sleep Bank is displayed on the Sleep tab as a summary card and on the Health Dashboard sleep card.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-003: Sleep Session Logging - provides nightly sleep duration
- HL-004: Sleep Quality Scoring - provides target sleep hours from user settings

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Component: Sleep Bank Card

**Layout:**
- Card title: "Sleep Bank" with a bank/piggy bank icon
- Balance display: large signed number with unit (e.g., "+2h 30m" or "-4h 15m")
- Balance color: green for positive (credit), red for negative (debt), white for zero
- Sub-text: interpretation (e.g., "You're 2.5 hours ahead of your target this week" or "You owe 4.25 hours of sleep")
- Mini bar chart: last 7 nights showing daily surplus/deficit bars (green bars up for surplus, red bars down for deficit)
- Rolling period selector: 7 days (default), 14 days, 30 days

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No data | Fewer than 2 nights of sleep data | "Track at least 2 nights to see your sleep bank balance" |
| Credit | Balance > 0 | Green balance with credit interpretation |
| Debt | Balance < 0 | Red balance with debt interpretation |
| Even | Balance within +/- 15 minutes of zero | White balance: "You're right on target" |

#### 3.6 Data Requirements

No new entities. Sleep Bank balance is computed on-the-fly from `hl_sleep_sessions` and the user's target sleep hours (stored in `hl_settings` as `sleep.targetHours`, default: 8).

#### 3.7 Business Logic Rules

##### Sleep Bank Balance Calculation

**Purpose:** Compute cumulative sleep surplus/deficit over a rolling period.

**Inputs:**
- rollingDays: number (7, 14, or 30)
- targetHours: number (from user settings, default: 8)

**Logic:**
```
1. targetMinutes = targetHours * 60
2. Query hl_sleep_sessions WHERE start_time >= (now - rollingDays days)
   GROUP BY DATE(start_time) to get one session per night
   (if multiple sessions per night, use the longest one)
3. FOR each night in the rolling period:
   a. actualMinutes = session.duration_minutes (or 0 if no session)
   b. diff = actualMinutes - targetMinutes
   c. Add diff to running balance
4. balance = SUM(diffs) in minutes
5. Convert to hours and minutes for display
6. RETURN { balanceMinutes, dailyDiffs[] }
```

**Formulas:**
- `nightlyDiff = actualSleepMinutes - targetSleepMinutes`
- `balance = sum(nightlyDiff for each night in rolling period)`

**Edge Cases:**
- Night with no sleep session: counts as 0 hours (full deficit of targetMinutes)
- Multiple sessions per night (nap + overnight): use the longest session as the primary
- Balance within +/- 15 minutes: treated as "even" for display purposes

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Fewer than 2 nights of data | "Track at least 2 nights to see your sleep bank balance" | Data accumulates naturally |
| No session for a specific night | Night treated as 0 sleep (full deficit) | User can retroactively log sleep |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user's target is 8 hours and they slept 9h, 7h, 8h, 6h, 10h, 8h, 7.5h over 7 nights,
   **When** the 7-day sleep bank is computed,
   **Then** balance = (9+7+8+6+10+8+7.5 - 8*7) = 55.5 - 56 = -0.5 hours = -30 minutes (slight debt).

2. **Given** a positive balance of +3 hours,
   **When** the Sleep Bank card renders,
   **Then** the balance shows "+3h 0m" in green with text "You're 3 hours ahead of your target this week."

**Edge Cases:**

3. **Given** a night with no logged sleep session,
   **When** the bank calculates that night,
   **Then** it counts as 0 sleep, adding a full 8-hour deficit.

4. **Given** a balance of +10 minutes,
   **When** the card renders,
   **Then** it shows "You're right on target" (within 15-minute even threshold).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| positive balance | 7 nights: 9h each, target: 8h | balance: +420 min (+7h) |
| negative balance | 7 nights: 6h each, target: 8h | balance: -840 min (-14h) |
| mixed balance | nights: [9, 7, 8, 6, 10], target: 8 | balance: +120 min (+2h) |
| night with no session | 5 nights logged out of 7 | missing nights count as 0h, full deficit |
| even threshold | balance: +10 min | display: "right on target" |
| even threshold: debt side | balance: -10 min | display: "right on target" |
| outside threshold | balance: +20 min | display: credit |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| 7-day balance from sessions | 1. Seed 7 sleep sessions, 2. Query balance | Correct cumulative balance |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User checks sleep debt | 1. Track sleep for 5 nights (below target), 2. Open Sleep tab | Sleep Bank card shows negative balance in red with debt interpretation |

---

### HL-024: CBT Exercises

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-024 |
| **Feature Name** | CBT Exercises |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an Anxiety/Stress Sufferer, I want to complete cognitive behavioral therapy (CBT) worksheets like thought records and cognitive restructuring, so that I can challenge negative thinking patterns without paying $30/year for Stoic or $70/year for Headspace.

#### 3.3 Detailed Description

CBT Exercises provides structured cognitive behavioral therapy worksheets for self-guided mental wellness. CBT is the gold-standard psychological treatment for anxiety, depression, and stress. The feature offers three core CBT tools:

1. **Thought Record:** Capture a triggering situation, automatic thought, emotion, evidence for/against the thought, and a balanced alternative thought. This is the foundational CBT worksheet used in clinical practice.

2. **Cognitive Distortion Identifier:** Present a list of 10 common cognitive distortions (all-or-nothing thinking, catastrophizing, mind reading, etc.). The user selects which distortions apply to their current thought pattern, and the system provides reframing prompts.

3. **Behavioral Activation Planner:** Schedule pleasant or meaningful activities to counteract avoidance behaviors common in depression and anxiety. Track completion and mood impact.

Completed worksheets are stored locally and can be reviewed over time. No audio, no gamification, no paid content. Pure self-guided CBT tools based on publicly available therapeutic frameworks (not copyrightable).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone)

**External Dependencies:**
- None (fully offline)

**Assumed Capabilities:**
- User can navigate to the Mind tab

#### 3.5 User Interface Requirements

##### Screen: CBT Library

**Layout:**
- Header: "CBT Tools" with a brain icon
- Three tool cards:
  1. **Thought Record** - Icon: thought bubble. Subtitle: "Challenge negative thoughts with evidence." Count: "12 entries"
  2. **Cognitive Distortions** - Icon: magnifying glass. Subtitle: "Identify unhelpful thinking patterns."
  3. **Activity Planner** - Icon: calendar check. Subtitle: "Schedule activities to boost mood."
- Recent entries section: last 3 completed exercises with date and type

##### Screen: New Thought Record

**Layout:**
- Step-by-step form (one section visible at a time, "Next" to advance):
- **Step 1 - Situation:** "What happened?" text area (max 500 chars). Date/time auto-filled.
- **Step 2 - Automatic Thought:** "What went through your mind?" text area (max 500 chars). "How strongly do you believe this? (0-100%)" slider.
- **Step 3 - Emotion:** Emotion picker (grid of labeled emotion chips: Anxious, Sad, Angry, Guilty, Ashamed, Frustrated, Hopeless, Other). Intensity slider (0-100%).
- **Step 4 - Evidence For:** "What evidence supports this thought?" text area (max 500 chars).
- **Step 5 - Evidence Against:** "What evidence contradicts this thought?" text area (max 500 chars).
- **Step 6 - Balanced Thought:** "What is a more balanced way to see this?" text area (max 500 chars). "How strongly do you believe the new thought? (0-100%)" slider.
- **Step 7 - Outcome:** "How do you feel now?" Emotion re-rating (same picker, same intensity slider). "How strongly do you believe the original thought now? (0-100%)" slider.
- "Save" button on final step. "Back" navigation on each step.

##### Screen: Cognitive Distortions Checker

**Layout:**
- "Describe your thought" text area at the top
- Below: grid of 10 cognitive distortion cards, each tappable:

| Distortion | Description |
|-----------|-------------|
| All-or-Nothing | Seeing things in black and white, no middle ground |
| Catastrophizing | Expecting the worst possible outcome |
| Mind Reading | Assuming you know what others are thinking |
| Fortune Telling | Predicting negative outcomes without evidence |
| Emotional Reasoning | Believing something is true because it feels true |
| "Should" Statements | Rigid rules about how things should be |
| Labeling | Assigning global labels to yourself or others |
| Personalization | Blaming yourself for things outside your control |
| Mental Filtering | Focusing only on the negative, ignoring positives |
| Discounting Positives | Dismissing positive experiences as not counting |

- Tapping a distortion highlights it (toggle selection)
- "Reframe" button appears when 1+ distortions selected
- Reframe screen shows the original thought, selected distortions, and a prompt for each: "Consider: [reframing question specific to the distortion]"

#### 3.6 Data Requirements

##### Entity: ThoughtRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| situation | string | Required, max 500 chars | None | What happened |
| automatic_thought | string | Required, max 500 chars | None | The automatic negative thought |
| belief_initial | integer | 0-100 | None | Initial belief strength (%) |
| emotion | string | Required | None | Primary emotion identified |
| emotion_intensity | integer | 0-100 | None | Emotion intensity (%) |
| evidence_for | string | Max 500 chars, nullable | null | Evidence supporting the thought |
| evidence_against | string | Max 500 chars, nullable | null | Evidence contradicting the thought |
| balanced_thought | string | Max 500 chars, nullable | null | Reframed balanced thought |
| belief_balanced | integer | 0-100, nullable | null | Belief in balanced thought (%) |
| emotion_after | string | Nullable | null | Emotion after exercise |
| emotion_intensity_after | integer | 0-100, nullable | null | Emotion intensity after |
| belief_after | integer | 0-100, nullable | null | Belief in original thought after exercise (%) |
| distortions | string | Nullable, JSON array of strings | null | Identified cognitive distortions |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Table:** `hl_thought_records` (new table, requires schema migration v8)

**Indexes:**
- `created_at` - chronological listing

#### 3.7 Business Logic Rules

##### Thought Record Effectiveness Score

**Purpose:** Measure how effectively the CBT exercise shifted the user's belief and emotion.

**Logic:**
```
1. IF belief_initial AND belief_after are both provided THEN
     beliefShift = belief_initial - belief_after
     (positive = thought belief decreased, which is the goal)
2. IF emotion_intensity AND emotion_intensity_after are both provided THEN
     emotionShift = emotion_intensity - emotion_intensity_after
     (positive = emotion intensity decreased)
3. effectivenessScore = (beliefShift + emotionShift) / 2
4. IF effectivenessScore > 20 THEN label = "Significant shift"
   ELSE IF effectivenessScore > 0 THEN label = "Some shift"
   ELSE label = "No shift detected"
5. RETURN { beliefShift, emotionShift, effectivenessScore, label }
```

**Edge Cases:**
- User skips the "after" ratings: effectiveness not computed, no label shown
- Belief or emotion increases after exercise: effectivenessScore is negative, label = "No shift detected"

##### CBT Usage Statistics

**Logic:**
```
1. totalRecords = COUNT(*) FROM hl_thought_records
2. avgBeliefReduction = AVG(belief_initial - belief_after) WHERE both are non-null
3. mostCommonDistortion = mode of all distortions across records
4. RETURN { totalRecords, avgBeliefReduction, mostCommonDistortion }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Required field left blank | Inline validation: "Please describe the situation" | User fills in field |
| Database write fails | Toast: "Could not save. Please try again." | User retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Thought Record form and completes all 7 steps,
   **When** they tap Save,
   **Then** the record is saved and appears in the CBT Library recent entries with date and emotion.

2. **Given** the user's initial belief was 90% and after the exercise it dropped to 40%,
   **When** effectiveness is computed,
   **Then** beliefShift = 50, label = "Significant shift."

3. **Given** the user selects "Catastrophizing" and "Mind Reading" on the distortion checker,
   **When** they tap "Reframe",
   **Then** specific reframing prompts are shown for each selected distortion.

**Edge Cases:**

4. **Given** the user completes steps 1-4 but skips steps 5-7,
   **When** they tap Save,
   **Then** the partial record is saved (evidence_against, balanced_thought, and outcome fields are null), and no effectiveness score is computed.

**Negative Tests:**

5. **Given** the user leaves the "Situation" field blank,
   **When** they tap "Next",
   **Then** inline validation shows "Please describe the situation."
   **And** the form does not advance.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| effectiveness: significant shift | belief_initial: 90, belief_after: 30, emotion: 80, emotion_after: 40 | effectivenessScore: 50, label: "Significant shift" |
| effectiveness: some shift | belief_initial: 70, belief_after: 60, emotion: 60, emotion_after: 50 | effectivenessScore: 10, label: "Some shift" |
| effectiveness: no shift | belief_initial: 50, belief_after: 60, emotion: 40, emotion_after: 50 | effectivenessScore: -10, label: "No shift detected" |
| effectiveness: partial data | belief_after: null | effectiveness not computed |
| most common distortion | 5 records: 3 with catastrophizing, 2 with mind_reading | mostCommonDistortion: catastrophizing |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Save and retrieve thought record | 1. Create record with all fields, 2. Query by id | All fields persisted correctly |
| CBT stats across multiple records | 1. Create 5 records with varying effectiveness, 2. Query stats | Correct count, average belief reduction, most common distortion |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User completes first thought record | 1. Open CBT Tools, 2. Tap Thought Record, 3. Complete all 7 steps, 4. Save | Record appears in CBT Library, effectiveness label shown, wellness timeline has entry |

---

### HL-025: SOS / Panic Button

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-025 |
| **Feature Name** | SOS / Panic Button |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an Anxiety/Stress Sufferer, I want a one-tap panic button that immediately launches a calming sequence (guided breathing, grounding exercise, haptic feedback), so that I have an accessible tool during acute anxiety or panic episodes without fumbling through menus.

**Secondary:**
> As any user experiencing sudden stress, I want to reach a calming tool in under 2 seconds from anywhere in the app, so that I do not lose precious coping time navigating screens during a crisis moment.

#### 3.3 Detailed Description

The SOS / Panic Button provides instant access to a curated calming sequence designed for acute anxiety or panic attacks. A persistent floating SOS button appears on all MyHealth screens (opt-in via settings). Tapping it immediately launches a full-screen calming experience with three sequential phases: 1) guided breathing with haptic heartbeat pattern, 2) a grounding exercise (5-4-3-2-1 senses technique), and 3) an affirmation card with a timer showing how long the user has been calming down.

The SOS session is designed to work even when the user is in a heightened stress state. The UI uses large text, minimal elements, high contrast, and simple one-tap interactions. Audio cues are optional (can be muted). Haptic patterns simulate a slow heartbeat to encourage physiological calming. The breathing pattern starts at 4-4 (inhale-exhale) and gradually slows to 4-7-8 (inhale-hold-exhale) over the first 2 minutes, guiding the user from rapid shallow breathing to deep slow breathing.

Each SOS session is logged to `hl_sos_sessions` with start time, end time, duration, initial distress level (optional 1-10 scale pre-prompt), and post-session distress level (optional 1-10 scale post-prompt). This data enables the user to see trends in anxiety frequency and whether the calming exercises are effective over time.

Headspace offers a similar "SOS" feature behind an $70/yr paywall. This implementation is free, integrated with the full health dashboard, and correlates SOS usage with sleep quality, medication timing, and other health data.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-013: Breathing Exercises - SOS breathing phase reuses the breathing engine and visual animation system

**External Dependencies:**
- Haptic feedback hardware (graceful degradation if unavailable)
- Optional: audio playback for calming sounds

**Assumed Capabilities:**
- User can access the SOS button from any MyHealth screen

#### 3.5 User Interface Requirements

##### Component: SOS Floating Button

**Layout:**
- Circular button, 56dp diameter, with a heart/pulse icon
- Positioned in the bottom-left corner of the screen (to avoid conflicting with the dashboard FAB in the bottom-right)
- Semi-transparent background with the module's accent color
- Subtle pulse animation (1-second cycle) to indicate availability without being distracting
- Visibility is controlled by a setting: `sos.showFloatingButton` (default: false). Users enable it in Settings.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Hidden | Setting disabled (default) | Button not rendered |
| Visible | Setting enabled, no active session | Pulsing button in bottom-left corner |
| Active | SOS session in progress | Button hidden (full-screen SOS experience takes over) |

##### Screen: SOS Session

**Layout:**
- Full-screen dark overlay (near-black background, #0A0A0A) with minimal UI
- Phase indicator at top: three dots showing current phase (breathing / grounding / affirmation)
- Timer at top-right corner showing elapsed session time (mm:ss)
- Center content changes by phase (see below)
- "End Session" button at the bottom (text only, no aggressive styling so the user is not prompted to leave too early)
- Optional "Mute" toggle for audio cues in top-left corner

**Phase 1 - Breathing (0:00 to ~3:00):**
- Large expanding/contracting circle animation (reuses HL-013 breathing visual)
- Text instruction below circle: "Breathe in..." / "Hold..." / "Breathe out..."
- Haptic heartbeat pattern: two short vibrations every 1.5 seconds for the first minute, slowing to every 2 seconds by minute 2, and every 2.5 seconds by minute 3
- Breathing cadence progression:
  - 0:00 - 0:30: 4-count inhale, 4-count exhale (rapid calming)
  - 0:30 - 1:30: 4-count inhale, 4-count hold, 6-count exhale (transitional)
  - 1:30 - 3:00: 4-count inhale, 7-count hold, 8-count exhale (deep calming)
- After 3 minutes, auto-advances to Phase 2 (user can also tap "Next" to skip early)

**Phase 2 - Grounding (3:00 to ~6:00):**
- 5-4-3-2-1 senses exercise displayed as a stepped countdown
- Each step is a large card:
  - Step 5: "Name 5 things you can SEE" (eye icon)
  - Step 4: "Name 4 things you can TOUCH" (hand icon)
  - Step 3: "Name 3 things you can HEAR" (ear icon)
  - Step 2: "Name 2 things you can SMELL" (nose icon)
  - Step 1: "Name 1 thing you can TASTE" (tongue icon)
- User taps the card to advance to the next step (no text input required - the exercise is mental)
- Estimated 30-60 seconds per step, auto-advance after 60 seconds if user does not tap
- After all 5 steps, auto-advances to Phase 3

**Phase 3 - Affirmation (6:00+):**
- A randomly selected affirmation from a built-in set of 20 affirmations displayed in large centered text
- Below the affirmation: "You've been calming for X minutes" with elapsed time
- Soft gradient background animation (slow color shifts between calming tones: dark blue, deep purple, midnight green)
- "Shuffle" button to show a different affirmation
- This phase has no auto-advance - the user stays until they tap "I'm Ready" or "End Session"

##### Modal: Distress Check (Pre and Post)

**Layout:**
- Pre-session (appears before Phase 1): "How are you feeling right now?" with a horizontal slider 1-10 (1 = calm, 10 = extremely distressed). "Skip" option available. On submit, session begins.
- Post-session (appears after ending): "How are you feeling now?" with the same 1-10 slider. "Skip" option available. On submit, session is saved and the user returns to the previous screen.

**Interactions:**
- Tap SOS button: Open pre-session distress check (or skip directly to Phase 1 if distress checks are disabled in settings)
- Tap "Next" during any phase: Skip to next phase
- Tap "End Session": Show post-session distress check, then save and close
- Swipe down: Also ends session (with post-session check)

**Transitions/Animations:**
- Phase transitions use a 500ms crossfade
- Breathing circle uses smooth scale animation matching the current breathing cadence
- Affirmation text fades in over 300ms
- Gradient background shifts use 10-second animation cycles

#### 3.6 Data Requirements

##### Entity: SOSSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| started_at | datetime | Required, ISO 8601 | None | When the SOS session began |
| ended_at | datetime | Required, ISO 8601 | None | When the user ended the session |
| duration_seconds | integer | Computed: (ended_at - started_at) in seconds | Computed | Total session length |
| distress_before | integer | Min: 1, Max: 10, nullable | null | Self-reported distress level before session |
| distress_after | integer | Min: 1, Max: 10, nullable | null | Self-reported distress level after session |
| phases_completed | integer | Min: 1, Max: 3 | 1 | How many phases the user reached (1 = breathing only, 2 = + grounding, 3 = all) |
| affirmation_shown | string | nullable | null | Text of the affirmation displayed in Phase 3 |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- `started_at` - date range queries for trend analysis

**Example Data:**
```json
{
  "id": "hl_sos_1709676000_f2a9b1c4",
  "started_at": "2026-03-05T14:30:00Z",
  "ended_at": "2026-03-05T14:38:22Z",
  "duration_seconds": 502,
  "distress_before": 8,
  "distress_after": 4,
  "phases_completed": 3,
  "affirmation_shown": "This feeling is temporary. You have survived every difficult moment so far.",
  "created_at": "2026-03-05T14:38:22Z"
}
```

#### 3.7 Business Logic Rules

##### Breathing Cadence Progression

**Purpose:** Gradually slow the user's breathing from rapid to deep calming pattern.

**Inputs:**
- elapsedSeconds: number - seconds since Phase 1 started

**Logic:**
```
1. IF elapsedSeconds < 30 THEN
     pattern = { inhale: 4, hold: 0, exhale: 4 }   // 8-second cycle
   ELSE IF elapsedSeconds < 90 THEN
     pattern = { inhale: 4, hold: 4, exhale: 6 }    // 14-second cycle
   ELSE
     pattern = { inhale: 4, hold: 7, exhale: 8 }    // 19-second cycle
2. RETURN pattern
```

##### Haptic Heartbeat Pattern

**Purpose:** Simulate a slowing heartbeat via haptic feedback to encourage physiological calming.

**Inputs:**
- elapsedSeconds: number - seconds since session started

**Logic:**
```
1. IF elapsedSeconds < 60 THEN
     interval = 1500ms between heartbeat pairs
   ELSE IF elapsedSeconds < 120 THEN
     interval = 2000ms
   ELSE
     interval = 2500ms
2. Each heartbeat = two short vibrations 150ms apart
3. Repeat at computed interval
4. IF haptic hardware unavailable THEN skip silently (no error)
```

##### Distress Reduction Score

**Purpose:** Measure how effective the SOS session was for the user.

**Inputs:**
- distress_before: number | null (1-10)
- distress_after: number | null (1-10)

**Logic:**
```
1. IF distress_before IS NULL OR distress_after IS NULL THEN
     RETURN null (not enough data)
2. reduction = distress_before - distress_after
3. IF reduction >= 4 THEN label = "Significant relief"
   ELSE IF reduction >= 2 THEN label = "Some relief"
   ELSE IF reduction >= 0 THEN label = "Stable"
   ELSE label = "Distress increased"
4. RETURN { reduction, label }
```

**Edge Cases:**
- User skips both distress checks: session is still logged with null distress values
- User ends session during Phase 1 (under 30 seconds): session is still logged with phases_completed = 1
- Haptic engine unavailable: all haptic calls are no-ops, no error shown

##### Affirmation Pool

**Purpose:** Provide a set of calming affirmations for Phase 3.

**Pool size:** 20 affirmations, stored as a static array in the module code (not in the database).

**Selection:**
```
1. Select a random affirmation from the pool
2. Track the index so "Shuffle" does not repeat the same one consecutively
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Haptic engine unavailable | Session continues without haptics, no error shown | None needed |
| Audio playback fails | Session continues silently, no error shown | None needed |
| Database write fails on session save | Toast: "Session data could not be saved" (session still functioned) | Data loss is acceptable - the calming experience was delivered |
| User force-quits during session | No session saved (partial sessions are not persisted) | User can start a new session |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has enabled the SOS floating button in Settings,
   **When** they tap the SOS button from any MyHealth screen,
   **Then** the pre-session distress check appears, and after rating (or skipping), the full-screen breathing phase begins.

2. **Given** the user completes all 3 phases and rates distress before as 8 and after as 3,
   **When** the session saves,
   **Then** the session record shows duration, phases_completed = 3, reduction = 5, label = "Significant relief."

3. **Given** the user is in Phase 2 (grounding) and taps the step 5 card,
   **When** they tap through all 5 grounding steps,
   **Then** Phase 3 (affirmation) begins with a random affirmation and elapsed time display.

**Edge Cases:**

4. **Given** the user ends the session after only 15 seconds (during Phase 1),
   **When** the session saves,
   **Then** phases_completed = 1 and duration_seconds = 15.

5. **Given** the device does not have haptic feedback capability,
   **When** the SOS session runs,
   **Then** the session works identically but without vibration (no error shown).

**Negative Tests:**

6. **Given** the user enters a distress level of 0,
   **When** they try to submit,
   **Then** inline validation shows "Please select a level from 1 to 10."
   **And** the session does not start until a valid level is selected or skipped.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| breathing cadence at 0s | elapsedSeconds: 0 | pattern: { inhale: 4, hold: 0, exhale: 4 } |
| breathing cadence at 60s | elapsedSeconds: 60 | pattern: { inhale: 4, hold: 4, exhale: 6 } |
| breathing cadence at 120s | elapsedSeconds: 120 | pattern: { inhale: 4, hold: 7, exhale: 8 } |
| haptic interval at 30s | elapsedSeconds: 30 | interval: 1500ms |
| haptic interval at 90s | elapsedSeconds: 90 | interval: 2000ms |
| haptic interval at 150s | elapsedSeconds: 150 | interval: 2500ms |
| distress reduction: significant | before: 9, after: 3 | reduction: 6, label: "Significant relief" |
| distress reduction: some | before: 7, after: 5 | reduction: 2, label: "Some relief" |
| distress reduction: stable | before: 5, after: 5 | reduction: 0, label: "Stable" |
| distress reduction: increased | before: 4, after: 6 | reduction: -2, label: "Distress increased" |
| distress reduction: null inputs | before: null, after: 5 | null |
| affirmation shuffle no repeat | current index: 5 | next index != 5 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full SOS session lifecycle | 1. Tap SOS, 2. Rate distress 8, 3. Complete all 3 phases, 4. Rate distress 3, 5. Save | Session persisted with correct distress values, duration, and phases_completed = 3 |
| SOS session appears in wellness timeline | 1. Complete SOS session, 2. Open wellness timeline | SOS event entry visible with timestamp and distress reduction |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User uses SOS during panic | 1. Enable SOS button in settings, 2. Navigate to dashboard, 3. Tap SOS, 4. Rate distress 9, 5. Breathe through Phase 1, 6. Complete grounding, 7. Read affirmation, 8. Tap "I'm Ready", 9. Rate distress 4 | Session saved, distress reduction of 5 ("Significant relief"), session visible in wellness timeline |

---

### HL-026: Body Composition

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-026 |
| **Feature Name** | Body Composition |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a Fitness Recovery Tracker, I want to log my weight, body fat percentage, and body measurements over time, so that I can track body composition changes alongside my workout and nutrition data.

**Secondary:**
> As a Health-Conscious Professional, I want the app to estimate my body fat percentage from simple body measurements (waist, neck, height) using the US Navy method, so that I do not need expensive equipment like a DEXA scan or smart scale.

#### 3.3 Detailed Description

Body Composition provides a comprehensive body measurement tracking system. Users log weight, body fat percentage (measured or estimated), muscle mass, and circumference measurements (waist, hip, neck, chest, bicep, thigh, calf). Each entry is timestamped, enabling trend analysis over weeks and months.

The feature includes a built-in body fat estimator using the US Navy method, which calculates body fat percentage from waist circumference, neck circumference, height, and biological sex. This provides a free, equipment-independent estimation that is reasonably accurate (within 3-4% of hydrostatic weighing for most people).

BMI is auto-calculated from weight and height. The system displays BMI alongside body fat percentage to provide context, since BMI alone is a poor indicator of body composition (a muscular person can have a high BMI but low body fat). All measurements support both metric (kg, cm) and imperial (lbs, in) units, with conversion happening at the display layer.

Samsung Health and Garmin Connect offer similar body composition features. This implementation adds cross-correlation with sleep quality, workout load, and fasting patterns, which neither competitor provides.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-005: Vitals Tracking - weight data is stored in vitals; body composition extends this with additional measurements

**External Dependencies:**
- None (all manual entry; HealthKit body composition data import is a future enhancement)

**Assumed Capabilities:**
- User can navigate to body composition from the Vitals tab or Insights tab

#### 3.5 User Interface Requirements

##### Screen: Body Composition Overview

**Layout:**
- Top header: "Body Composition" with "+" button to log a new entry
- Summary card showing latest values:
  - Weight: value with unit (e.g., "175.2 lbs" or "79.5 kg")
  - Body Fat: percentage with category badge (e.g., "18.5% - Fitness")
  - BMI: value with WHO category (e.g., "24.1 - Normal")
  - Muscle Mass: value with unit if tracked
- Below the summary, a mini trend chart showing weight over the last 30 days
- Below the chart, a scrollable list of recent body composition entries (most recent first)
- Each entry row shows: date, weight, body fat %, BMI, and change arrows (up/down vs. previous entry)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No body composition entries exist | Illustration with text: "Start tracking your body composition. Log your first measurement." with "Log Now" button |
| Populated | At least one entry exists | Summary card + trend chart + entry list |
| Goal active | User has set a weight or body fat goal | Goal line overlaid on trend chart with progress percentage |

**Interactions:**
- Tap "+": Open Log Body Composition modal
- Tap an entry row: Navigate to entry detail with full measurements
- Tap summary card weight: Jump to weight trend chart (full screen)
- Tap summary card body fat: Jump to body fat trend chart (full screen)
- Swipe left on entry: Reveal delete button (with confirmation)

##### Modal: Log Body Composition

**Layout:**
- Title: "Log Measurements"
- Date picker (default: today)
- **Required section:**
  - Weight input: numeric with unit toggle (lbs / kg)
  - Height input: numeric with unit toggle (in / cm) - auto-filled from last entry, editable
- **Body fat section (optional, expandable):**
  - Toggle: "I have a measured body fat %" vs. "Estimate from measurements"
  - If measured: body fat percentage input (0.1 - 70.0%)
  - If estimate: waist, neck inputs (and hip for female users) with unit toggle. "Calculate" button runs US Navy formula and displays result.
  - Sex selector (male / female) for estimation formula differences
- **Muscle mass (optional):**
  - Muscle mass input: numeric with unit toggle (lbs / kg)
- **Circumference measurements (optional, expandable):**
  - Waist, Hip, Neck, Chest, Bicep (L/R), Thigh (L/R), Calf (L/R) - all numeric with unit toggle
- Notes text area (optional, max 500 chars)
- Save and Cancel buttons

**Validation:**
- Weight: 20 - 1000 lbs (9 - 454 kg)
- Height: 24 - 108 in (61 - 274 cm)
- Body fat: 0.1% - 70.0%
- Waist: 15 - 80 in (38 - 203 cm)
- Neck: 8 - 30 in (20 - 76 cm)
- Hip: 20 - 80 in (51 - 203 cm)
- All circumference measurements: positive numbers only

#### 3.6 Data Requirements

##### Entity: BodyCompositionEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| recorded_at | datetime | Required, ISO 8601 | Current timestamp | When the measurement was taken |
| weight_kg | float | Min: 9.0, Max: 454.0, nullable | null | Weight in kilograms (stored in metric, converted for display) |
| height_cm | float | Min: 61.0, Max: 274.0, nullable | null | Height in centimeters |
| body_fat_pct | float | Min: 0.1, Max: 70.0, nullable | null | Body fat percentage (measured or estimated) |
| body_fat_source | enum | One of: measured, estimated_navy, healthkit, null | null | How body fat was determined |
| muscle_mass_kg | float | Min: 0.1, nullable | null | Muscle mass in kilograms |
| bmi | float | Computed, nullable | Computed | BMI = weight_kg / (height_cm / 100)^2 |
| waist_cm | float | Min: 38.0, Max: 203.0, nullable | null | Waist circumference |
| hip_cm | float | Min: 51.0, Max: 203.0, nullable | null | Hip circumference |
| neck_cm | float | Min: 20.0, Max: 76.0, nullable | null | Neck circumference |
| chest_cm | float | nullable | null | Chest circumference |
| bicep_left_cm | float | nullable | null | Left bicep circumference |
| bicep_right_cm | float | nullable | null | Right bicep circumference |
| thigh_left_cm | float | nullable | null | Left thigh circumference |
| thigh_right_cm | float | nullable | null | Right thigh circumference |
| calf_left_cm | float | nullable | null | Left calf circumference |
| calf_right_cm | float | nullable | null | Right calf circumference |
| notes | string | Max 500 chars, nullable | null | User notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- `recorded_at` - date range queries for trend charts
- `weight_kg` - sorting by weight

**Example Data:**
```json
{
  "id": "hl_bc_1709676000_d4e5f6a7",
  "recorded_at": "2026-03-05T08:00:00Z",
  "weight_kg": 79.5,
  "height_cm": 178.0,
  "body_fat_pct": 18.5,
  "body_fat_source": "estimated_navy",
  "muscle_mass_kg": null,
  "bmi": 25.1,
  "waist_cm": 84.0,
  "hip_cm": null,
  "neck_cm": 38.0,
  "chest_cm": null,
  "bicep_left_cm": null,
  "bicep_right_cm": null,
  "thigh_left_cm": null,
  "thigh_right_cm": null,
  "calf_left_cm": null,
  "calf_right_cm": null,
  "notes": "Post morning weigh-in",
  "created_at": "2026-03-05T08:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### BMI Calculation

**Purpose:** Calculate Body Mass Index from weight and height.

**Inputs:**
- weight_kg: number
- height_cm: number

**Logic:**
```
1. IF weight_kg IS NULL OR height_cm IS NULL THEN RETURN null
2. height_m = height_cm / 100
3. bmi = weight_kg / (height_m * height_m)
4. ROUND to 1 decimal place
5. RETURN bmi
```

**BMI Categories (WHO):**

| Range | Category |
|-------|----------|
| < 18.5 | Underweight |
| 18.5 - 24.9 | Normal |
| 25.0 - 29.9 | Overweight |
| 30.0 - 34.9 | Obese (Class I) |
| 35.0 - 39.9 | Obese (Class II) |
| >= 40.0 | Obese (Class III) |

##### US Navy Body Fat Estimation

**Purpose:** Estimate body fat percentage from circumference measurements.

**Inputs:**
- sex: 'male' | 'female'
- waist_cm: number
- neck_cm: number
- height_cm: number
- hip_cm: number (required for female, ignored for male)

**Logic:**
```
1. Convert all measurements to inches for formula:
   waist_in = waist_cm / 2.54
   neck_in = neck_cm / 2.54
   height_in = height_cm / 2.54
   hip_in = hip_cm / 2.54 (female only)

2. IF sex == 'male' THEN
     bodyFatPct = 86.010 * log10(waist_in - neck_in) - 70.041 * log10(height_in) + 36.76
   ELSE IF sex == 'female' THEN
     bodyFatPct = 163.205 * log10(waist_in + hip_in - neck_in) - 97.684 * log10(height_in) - 78.387

3. CLAMP bodyFatPct to range [0.1, 70.0]
4. ROUND to 1 decimal place
5. RETURN bodyFatPct
```

**Body Fat Categories (ACE):**

| Category | Male | Female |
|----------|------|--------|
| Essential fat | 2-5% | 10-13% |
| Athletes | 6-13% | 14-20% |
| Fitness | 14-17% | 21-24% |
| Average | 18-24% | 25-31% |
| Obese | 25%+ | 32%+ |

**Edge Cases:**
- Waist <= Neck (male): formula produces NaN from log10 of zero/negative. Return null with message "Waist must be larger than neck for estimation."
- Waist + Hip <= Neck (female): same issue. Return null with message.
- Result < 0.1%: clamp to 0.1%
- Result > 70%: clamp to 70%

##### Weight Change Tracking

**Purpose:** Show weight change relative to previous entry.

**Logic:**
```
1. Query the most recent previous entry (by recorded_at, before current entry)
2. IF no previous entry THEN change = null
3. ELSE change_kg = current.weight_kg - previous.weight_kg
4. Display as "+X.X" (red arrow up) or "-X.X" (green arrow down) or "0.0" (gray dash)
5. Color convention: weight loss = green (down arrow), weight gain = red (up arrow)
   (NOTE: users pursuing muscle gain may reverse this convention in settings)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Weight out of range (< 9 kg or > 454 kg) | Inline validation: "Weight must be between 20 lbs and 1000 lbs" | User corrects input |
| Body fat estimation impossible (waist <= neck) | Inline message: "Waist must be larger than neck for estimation" | User re-measures or enters measured body fat |
| Missing hip measurement for female estimation | Inline validation: "Hip measurement is required for female body fat estimation" | User enters hip measurement |
| Database write fails | Toast: "Could not save. Please try again." | User retries |
| Unit conversion rounding error | Values stored in metric; display uses consistent rounding to 1 decimal | None needed |

**Validation Timing:**
- Weight and height validated on blur
- Body fat estimation runs on tap of "Calculate" button
- Full form validation on Save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens Log Body Composition and enters weight 175.2 lbs and height 5'10" (70 in),
   **When** they tap Save,
   **Then** weight is stored as 79.5 kg, height as 177.8 cm, BMI is computed as 25.1, and the entry appears in the list.

2. **Given** a male user enters waist 33.1 in, neck 15.0 in, height 70 in, and taps "Calculate",
   **When** the US Navy formula runs,
   **Then** body fat is estimated as approximately 17.7% with source "estimated_navy" and category "Fitness."

3. **Given** the user has 10 weight entries over 30 days,
   **When** they view the Body Composition Overview,
   **Then** the mini trend chart shows all 10 data points, and the latest entry's change arrow reflects the difference from the 9th entry.

**Edge Cases:**

4. **Given** a male user enters waist = 14 in and neck = 15 in,
   **When** they tap "Calculate",
   **Then** the estimation returns null with message "Waist must be larger than neck for estimation."

5. **Given** the user switches units from lbs to kg,
   **When** the display updates,
   **Then** all weight values are converted and displayed in kg with 1 decimal precision.

**Negative Tests:**

6. **Given** the user enters a weight of 5 lbs,
   **When** they attempt to save,
   **Then** inline validation shows "Weight must be between 20 lbs and 1000 lbs."
   **And** no entry is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| BMI normal | weight: 70 kg, height: 175 cm | BMI: 22.9 |
| BMI overweight | weight: 90 kg, height: 175 cm | BMI: 29.4 |
| BMI null when missing data | weight: null, height: 175 | null |
| Navy body fat male | waist: 33.1 in, neck: 15 in, height: 70 in | approx 17.7% |
| Navy body fat female | waist: 30 in, hip: 38 in, neck: 13 in, height: 65 in | approx 28.7% |
| Navy body fat: waist <= neck | waist: 14, neck: 15 | null (error message) |
| body fat clamp low | formula result: -2.0 | clamped to 0.1% |
| body fat clamp high | formula result: 75.0 | clamped to 70.0% |
| weight change: loss | current: 79.0 kg, previous: 80.5 kg | change: -1.5 kg (green) |
| weight change: gain | current: 81.0 kg, previous: 80.0 kg | change: +1.0 kg (red) |
| weight change: no previous | current: 80.0 kg, previous: null | change: null |
| WHO BMI category normal | BMI: 22.0 | "Normal" |
| WHO BMI category obese I | BMI: 32.0 | "Obese (Class I)" |
| ACE body fat category male fitness | body_fat: 15.0, sex: male | "Fitness" |
| unit conversion lbs to kg | 175.2 lbs | 79.5 kg |
| unit conversion in to cm | 70 in | 177.8 cm |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Save and retrieve body composition entry | 1. Log entry with weight, height, body fat, 2. Query by id | All fields persisted, BMI computed correctly |
| Weight trend across entries | 1. Create 5 entries over 5 days with varying weights, 2. Query trend | 5 data points with correct dates and values |
| Body fat estimation and save | 1. Enter measurements, 2. Tap Calculate, 3. Save | body_fat_pct populated with estimated value, body_fat_source = "estimated_navy" |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks body composition for first time | 1. Open Body Composition, 2. Tap "+", 3. Enter weight and height, 4. Expand body fat section, 5. Enter measurements, 6. Tap Calculate, 7. Save | Entry appears in list with weight, BMI, estimated body fat %, and category label |

---

### HL-027: Health Insights (AI Summary)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-027 |
| **Feature Name** | Health Insights (AI Summary) |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Health-Conscious Professional, I want the app to generate weekly health insights from my data (sleep trends, vital patterns, medication adherence, activity levels), so that I can understand my health trajectory without manually analyzing charts and numbers.

**Secondary:**
> As a Chronic Condition Manager, I want AI-generated summaries that highlight correlations between my medications, sleep quality, and vitals, so that I can have informed conversations with my doctor about treatment effectiveness.

#### 3.3 Detailed Description

Health Insights generates periodic natural-language summaries of the user's health data. The system analyzes data across all tracked domains (sleep, vitals, activity, medications, fasting, body composition, SOS usage, breathing exercises, goals) and produces a structured health summary with observations, correlations, trends, and actionable suggestions.

Insights are generated entirely on-device using a rule-based analysis engine (not cloud AI). The engine applies a library of 40+ insight rules that pattern-match against the user's data to produce relevant observations. Rules are categorized as: trend alerts (a metric is trending up or down), correlation observations (two metrics appear related), milestone celebrations (goal reached, streak achieved), risk flags (vital entering concerning range), and behavior patterns (consistent bedtime improves sleep score).

Insights are generated on three schedules:
- **Daily:** A brief morning summary of yesterday's health data (2-4 bullet points)
- **Weekly:** A comprehensive week-in-review delivered Monday morning (8-12 bullet points across domains)
- **On-demand:** User taps "Generate Insights" for an instant analysis of any custom date range

Each insight has a confidence level (high, medium, low) based on the amount of data supporting it. Insights with fewer than 7 days of supporting data are tagged as "Preliminary" with a note that more data will improve accuracy.

This feature differentiates MyHealth from competitors by providing cross-domain health intelligence that no single-purpose app can offer. Whoop provides recovery insights but only from wearable data. Garmin provides Body Battery but only from Garmin data. MyHealth correlates sleep + medications + fasting + activity + vitals + mood into unified insights.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-001: Health Dashboard - insights are displayed on the dashboard and accessible from the Insights tab
- HL-002: Wellness Timeline - insight generation reads from the same data sources as the timeline

**External Dependencies:**
- None (all processing is on-device)

**Assumed Capabilities:**
- At least 3 days of health data across at least 2 domains for meaningful insights

#### 3.5 User Interface Requirements

##### Screen: Insights Feed

**Layout:**
- Top header: "Insights" with a filter icon and a "Generate" button
- Date range indicator below header: "This Week" (default), tappable to change range
- Insight cards displayed as a vertically scrollable list
- Each insight card contains:
  - Icon representing the insight category (trend arrow, link icon for correlation, trophy for milestone, warning for risk)
  - Insight title (bold, 1 line)
  - Insight body (2-4 sentences, secondary text)
  - Confidence badge: "High" (green), "Medium" (amber), "Low" (gray), or "Preliminary" (blue)
  - Domains involved: small colored dots for each domain referenced (e.g., blue dot for sleep, red for vitals)
  - "Explore" link that navigates to the relevant trend chart or detail screen
- Below the insight cards, a "How Insights Work" expandable section explaining the rule-based engine and confidence levels

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Insufficient data | Fewer than 3 days of data or only 1 domain tracked | "Track health data for at least 3 days across 2 categories to unlock insights. You're X days away!" |
| Generating | Insight engine is processing | Skeleton cards with shimmer animation, "Analyzing your health data..." |
| Populated | Insights generated | Scrollable list of insight cards |
| No insights | Data exists but no rules matched | "Everything looks stable! No notable patterns detected this period." |

**Interactions:**
- Tap insight card: Expand to show full detail text and "Explore" link
- Tap "Explore": Navigate to the relevant trend chart, filtered to the insight's date range
- Tap "Generate": Run the insight engine for the selected date range (with loading state)
- Pull-to-refresh: Regenerate insights for the current range

##### Component: Daily Insight Banner (Dashboard)

**Layout:**
- Compact card on the Today dashboard (between the readiness score and domain cards)
- Shows the top 1-2 daily insights as brief bullet points
- "See all insights" link navigates to the full Insights Feed
- Dismissible (swipe right or tap X). Reappears the next day with new insights.

#### 3.6 Data Requirements

##### Entity: HealthInsight

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| generated_at | datetime | Required, ISO 8601 | None | When the insight was generated |
| period_start | date | Required, ISO date | None | Start of the analysis period |
| period_end | date | Required, ISO date | None | End of the analysis period |
| schedule | enum | One of: daily, weekly, on_demand | None | Generation schedule type |
| rule_id | string | Required | None | Which insight rule produced this (e.g., "sleep_trend_declining") |
| category | enum | One of: trend, correlation, milestone, risk, pattern | None | Insight classification |
| title | string | Required, max 120 chars | None | Short insight headline |
| body | string | Required, max 1000 chars | None | Detailed insight explanation |
| confidence | enum | One of: high, medium, low, preliminary | None | Confidence level based on data quantity |
| domains | string | JSON array of domain names | None | Which domains this insight references |
| metadata | string | JSON, nullable | null | Rule-specific data (values, thresholds, trend direction) |
| dismissed | boolean | - | false | Whether the user has dismissed this insight |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- `generated_at` - sort by recency
- `schedule, period_start` - query insights by schedule and period
- `dismissed` - filter out dismissed insights

**Example Data:**
```json
{
  "id": "hl_ins_1709676000_a1b2c3d4",
  "generated_at": "2026-03-03T07:00:00Z",
  "period_start": "2026-02-24",
  "period_end": "2026-03-02",
  "schedule": "weekly",
  "rule_id": "sleep_medication_correlation",
  "category": "correlation",
  "title": "Melatonin nights show 12% better sleep",
  "body": "On nights when you took melatonin, your average sleep quality was 82 compared to 70 on nights without it. This pattern has been consistent for 3 weeks. Consider discussing with your doctor whether continued use is appropriate.",
  "confidence": "high",
  "domains": "[\"sleep\", \"meds\"]",
  "metadata": "{\"with_med_avg\": 82, \"without_med_avg\": 70, \"med_name\": \"Melatonin\", \"weeks_observed\": 3}",
  "dismissed": false,
  "created_at": "2026-03-03T07:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Insight Rule Engine

**Purpose:** Apply a library of rules against user health data to generate insights.

**Inputs:**
- periodStart: date
- periodEnd: date
- schedule: 'daily' | 'weekly' | 'on_demand'

**Logic:**
```
1. Load all health data for [periodStart, periodEnd]:
   - sleep sessions, vitals, medication doses, fasting sessions,
     activity data, body composition, SOS sessions, breathing sessions, goals
2. For each rule in the INSIGHT_RULES library:
   a. Check if the rule's required domains have data
   b. Execute the rule's analysis function against the loaded data
   c. If the rule fires (pattern matches), create a HealthInsight record
   d. Assign confidence based on data quantity:
      - High: 14+ days of relevant data
      - Medium: 7-13 days of data
      - Low: 4-6 days of data
      - Preliminary: 3 days of data
3. Deduplicate: if the same rule_id fired in the last 7 days with similar values, skip
4. Sort insights by priority: risk > correlation > trend > pattern > milestone
5. Cap at 12 insights per weekly summary, 4 per daily summary
6. Persist to hl_insights table
7. RETURN generated insights
```

##### Sample Insight Rules (10 of 40+)

| Rule ID | Category | Condition | Output Template |
|---------|----------|-----------|-----------------|
| `sleep_trend_declining` | trend | Average sleep quality dropped 10+ points over 7 days | "Your sleep quality has declined {diff} points this week (from {prev_avg} to {curr_avg})." |
| `sleep_trend_improving` | trend | Average sleep quality improved 10+ points over 7 days | "Your sleep quality improved {diff} points this week. Keep it up!" |
| `sleep_medication_correlation` | correlation | Sleep quality on nights with a specific medication differs by 10+ points from nights without | "{med_name} nights show {diff}% {better/worse} sleep quality." |
| `bp_entering_elevated` | risk | Average BP moved from Normal to Elevated range | "Your average blood pressure has moved into the Elevated range ({avg_systolic}/{avg_diastolic}). Consider monitoring more frequently." |
| `resting_hr_trend_up` | trend | Resting heart rate increased 5+ bpm over 14 days | "Your resting heart rate has increased {diff} bpm over the past 2 weeks. This could indicate stress, dehydration, or illness." |
| `weight_milestone` | milestone | Weight crossed a round-number threshold (e.g., dropped below 180 lbs) | "You crossed the {threshold} mark! Current weight: {weight}." |
| `fasting_sleep_correlation` | correlation | Sleep quality on fasting days differs 10+ points from non-fasting days | "Fasting days show {diff}% {better/worse} sleep quality compared to non-fasting days." |
| `consistent_bedtime` | pattern | Bedtime standard deviation < 30 minutes over 7 days | "Your bedtime has been consistent this week (within {std_dev} minutes). Consistent sleep schedules improve sleep quality." |
| `sos_frequency_increase` | risk | SOS session count increased 50%+ compared to previous period | "You used the SOS tool {count} times this week, up from {prev_count} last week. Consider talking to a professional if anxiety is increasing." |
| `goal_on_track` | milestone | Active goal is 75%+ complete for current period | "You're {pct}% toward your {goal_name} goal this {period}!" |

##### Confidence Assignment

**Purpose:** Determine how much data supports each insight.

**Inputs:**
- dataPoints: number - count of relevant data points for the rule
- daysCovered: number - number of distinct days with data

**Logic:**
```
1. IF daysCovered >= 14 THEN confidence = "high"
2. ELSE IF daysCovered >= 7 THEN confidence = "medium"
3. ELSE IF daysCovered >= 4 THEN confidence = "low"
4. ELSE IF daysCovered >= 3 THEN confidence = "preliminary"
5. ELSE rule does not fire (insufficient data)
```

**Edge Cases:**
- Zero health data: no insights generated, show "insufficient data" state
- Only one domain tracked: only single-domain rules can fire (no correlations)
- User has dismissed an insight: do not regenerate the same rule_id + period combination
- Insight engine takes > 5 seconds: cancel and show partial results with "Some insights could not be generated"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insight engine timeout (> 5 seconds) | Show partial results with note: "Some insights could not be generated" | Reduce date range or try again later |
| No rules match | "Everything looks stable! No notable patterns detected this period." | Normal state, not an error |
| Database query fails during insight generation | Toast: "Could not analyze health data. Please try again." | User taps "Generate" to retry |
| Insight references deleted data | Insight is silently removed from the feed | No action needed |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 14 days of sleep data and medication logs,
   **When** the weekly insight engine runs,
   **Then** insights are generated including sleep trend analysis and medication-sleep correlation, each with "High" confidence.

2. **Given** a daily insight shows "Your sleep quality declined 15 points this week",
   **When** the user taps "Explore",
   **Then** they navigate to the sleep quality trend chart filtered to the last 7 days.

3. **Given** the user taps "Generate" with a custom date range of March 1-15,
   **When** the engine processes,
   **Then** on-demand insights are generated for that specific range and displayed in the feed.

**Edge Cases:**

4. **Given** the user has only 3 days of sleep data and no other domains,
   **When** insights are generated,
   **Then** any sleep-only insights are tagged "Preliminary" and correlation insights are not generated.

5. **Given** the insight engine takes 6 seconds,
   **When** the timeout is reached at 5 seconds,
   **Then** partial results are shown with a note "Some insights could not be generated."

**Negative Tests:**

6. **Given** the user has fewer than 3 days of data across all domains,
   **When** they open the Insights tab,
   **Then** the insufficient data state is shown: "Track health data for at least 3 days across 2 categories to unlock insights."
   **And** no insights are generated or stored.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| confidence: high | daysCovered: 14 | "high" |
| confidence: medium | daysCovered: 10 | "medium" |
| confidence: low | daysCovered: 5 | "low" |
| confidence: preliminary | daysCovered: 3 | "preliminary" |
| confidence: insufficient | daysCovered: 2 | rule does not fire |
| sleep trend declining | 7-day avg: 82, prev 7-day avg: 68 (dropped 14) | fires with diff = 14 |
| sleep trend stable | 7-day avg: 75, prev 7-day avg: 73 (diff = 2) | does not fire (< 10 threshold) |
| medication correlation | with_med_avg: 85, without_med_avg: 70 | fires with diff = 15 |
| deduplication | same rule_id fired 3 days ago with similar values | insight skipped |
| cap at 12 weekly | 15 rules fire | only top 12 by priority returned |
| cap at 4 daily | 6 rules fire | only top 4 by priority returned |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Weekly insight generation | 1. Seed 14 days of sleep + vitals + meds data, 2. Run weekly engine | Multiple insights generated, persisted to hl_insights, correct confidence levels |
| Insight deduplication | 1. Generate weekly insights, 2. Generate again next day | Same rule_id insights not duplicated within 7-day window |
| Insight dismissal | 1. Generate insight, 2. Dismiss it, 3. Regenerate | Dismissed insight does not reappear |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews weekly health insights | 1. Track sleep + meds for 14 days, 2. Open Insights tab on Monday, 3. Review generated insights, 4. Tap "Explore" on sleep trend insight | Insights feed shows 4-8 insights with correct confidence, tapping Explore navigates to sleep trend chart |

---

### HL-028: Clinical Health Records Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-028 |
| **Feature Name** | Clinical Health Records Import |
| **Priority** | P3 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Chronic Condition Manager, I want to import my clinical health records from healthcare providers (lab results, diagnoses, immunizations, procedures), so that I have a complete medical history in one place without manually retyping everything.

**Secondary:**
> As a Privacy-First Health Tracker, I want my imported clinical records stored only on my device, so that I do not need to rely on a patient portal that could be breached or shut down.

#### 3.3 Detailed Description

Clinical Health Records Import allows users to import structured health records from supported formats into the Health Document Vault and into structured data tables. The feature supports three import pathways:

1. **Apple Health Clinical Records (FHIR R4):** On iOS, Apple Health aggregates clinical records from participating healthcare providers via the Health Records feature. MyHealth reads these records through HealthKit's `HKClinicalRecord` API, importing lab results, immunization records, vital signs, conditions, allergies, medications, and procedures. Each record includes the provider name, date, and structured data fields.

2. **C-CDA (Consolidated Clinical Document Architecture):** Users can import XML-based C-CDA files (.xml or .ccda) downloaded from patient portals (e.g., MyChart, Cerner). The parser extracts sections: allergies, medications, problems (diagnoses), procedures, results (lab tests), immunizations, and vital signs.

3. **PDF/Image import (unstructured):** Users can import PDF lab results or clinical documents directly into the Document Vault (see HL-007). No structured data extraction occurs - the documents are stored as-is for reference.

Imported structured records are stored in a new `hl_clinical_records` table with the original record data preserved as JSON. Key fields are extracted into indexed columns for searching and filtering (record type, date, provider, description). The import process is idempotent: re-importing the same record (matched by source_id + source_type + date) updates rather than duplicates.

Apple Health is the only major consumer health app that currently supports clinical records import. By matching this capability, MyHealth provides an alternative for users who want their records portable beyond the Apple ecosystem.

#### 3.4 Prerequisites

**Feature Dependencies:**
- HL-007: Health Document Vault - imported PDFs and unstructured documents are stored in the vault

**External Dependencies:**
- HealthKit Clinical Records API (iOS only, requires user authorization per provider)
- C-CDA XML parser (on-device)
- File system access for importing C-CDA and PDF files

**Assumed Capabilities:**
- User has enrolled healthcare providers in Apple Health Records (for FHIR pathway)
- User can export C-CDA files from their patient portal (for C-CDA pathway)

#### 3.5 User Interface Requirements

##### Screen: Import Clinical Records

**Layout:**
- Header: "Import Health Records"
- Three import pathway cards arranged vertically:
  1. **Apple Health Records** (iOS only): Heart icon with green accent. "Import lab results, immunizations, and conditions from Apple Health." Tap to begin HealthKit clinical authorization flow.
  2. **Patient Portal File (C-CDA):** Document icon with blue accent. "Import a C-CDA file from your patient portal (MyChart, Cerner, etc.)." Tap to open file picker for .xml / .ccda files.
  3. **PDF / Image:** Camera icon with gray accent. "Store a clinical document in your vault." Tap to capture photo, select from library, or import file. Routes to HL-007 Add Document flow with type pre-set to "lab_result."
- Below the pathway cards, a section "Imported Records" showing a count of records by type (e.g., "12 Lab Results, 3 Immunizations, 5 Conditions")

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No imports | No clinical records imported | Three pathway cards with zero count in "Imported Records" section |
| Importing | Import in progress | Progress bar with count of records processed ("Importing... 15 of 42 records") |
| Complete | Import finished | Success banner: "Imported X new records (Y updated, Z skipped as duplicates)" |
| Partial failure | Some records failed to parse | Warning banner listing failures: "3 records could not be imported" with details expandable |
| iOS restriction | Android or web platform | Apple Health Records card shows "Available on iOS only." Other pathways remain active. |

**Interactions:**
- Tap Apple Health Records card: Trigger HealthKit clinical records authorization. On success, import begins automatically.
- Tap Patient Portal File card: Open system file picker filtered to .xml, .ccda extensions
- Tap PDF/Image card: Navigate to HL-007 Add Document flow
- Tap "Imported Records" section: Navigate to Clinical Records List screen

##### Screen: Clinical Records List

**Layout:**
- Header: "Clinical Records" with filter icon
- Filter chips: All, Lab Results, Immunizations, Conditions, Medications, Procedures, Allergies, Vital Signs
- Scrollable list of records, grouped by date (newest first)
- Each record row shows: record type icon, description/title, provider name (if available), date, source badge (FHIR / C-CDA / Manual)
- Tapping a record opens Record Detail (full view of the structured data)

#### 3.6 Data Requirements

##### Entity: ClinicalRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| source_type | enum | One of: fhir_r4, ccda, manual | None | Import pathway |
| source_id | string | nullable | null | Original record identifier from the source system (for deduplication) |
| record_type | enum | One of: lab_result, immunization, condition, medication, procedure, allergy, vital_sign | None | Clinical record category |
| description | string | Required, max 500 chars | None | Human-readable title (e.g., "Complete Blood Count", "Influenza Vaccine") |
| provider | string | Max 255 chars, nullable | null | Healthcare provider or facility name |
| recorded_date | date | Required, ISO date | None | Date the clinical event occurred |
| result_value | string | nullable | null | Extracted result value (e.g., "135 mg/dL", "Positive", "Normal") |
| result_unit | string | Max 50 chars, nullable | null | Unit of the result value |
| reference_range | string | Max 100 chars, nullable | null | Normal reference range (e.g., "70-100 mg/dL") |
| status | enum | One of: final, preliminary, amended, cancelled, null | null | Result status from source |
| raw_data | string | JSON, required | None | Full original record data preserved as JSON |
| notes | string | Max 1000 chars, nullable | null | User-added notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last modification time |

**Indexes:**
- `record_type, recorded_date` - filter by type and sort by date
- `source_type, source_id` - deduplication lookups
- `provider` - filter by provider
- `description` - text search on record titles

**Relationships:**
- ClinicalRecord has no direct foreign key relationships. It is a standalone entity. Lab results that correspond to vitals (e.g., blood glucose) are cross-referenced by the insight engine (HL-027) but not linked at the schema level.

**Example Data:**
```json
{
  "id": "hl_cr_1709676000_b3c4d5e6",
  "source_type": "fhir_r4",
  "source_id": "obs-12345-labcorp",
  "record_type": "lab_result",
  "description": "Hemoglobin A1c",
  "provider": "LabCorp",
  "recorded_date": "2026-02-15",
  "result_value": "5.7",
  "result_unit": "%",
  "reference_range": "4.0-5.6%",
  "status": "final",
  "raw_data": "{\"resourceType\": \"Observation\", \"code\": {\"coding\": [{\"system\": \"http://loinc.org\", \"code\": \"4548-4\"}]}, \"valueQuantity\": {\"value\": 5.7, \"unit\": \"%\"}}",
  "notes": null,
  "created_at": "2026-03-05T10:00:00Z",
  "updated_at": "2026-03-05T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### FHIR R4 Record Import

**Purpose:** Import clinical records from Apple Health's FHIR R4 data.

**Inputs:**
- clinicalRecords: array of HKClinicalRecord objects from HealthKit

**Logic:**
```
1. Request HealthKit authorization for clinical record types:
   allergyRecord, conditionRecord, immunizationRecord,
   labResultRecord, medicationRecord, procedureRecord, vitalSignRecord
2. FOR each authorized record type:
   a. Query HKClinicalRecord samples
   b. Parse FHIR JSON from each record's fhirResource
   c. Extract: description (from code.display), recorded_date (from effectiveDateTime),
      provider (from performer or contained Organization), result_value, result_unit,
      reference_range (from referenceRange)
   d. Check deduplication: SELECT WHERE source_type = 'fhir_r4' AND source_id = record.id
      IF exists THEN update fields (upsert)
      ELSE insert new record
3. RETURN { imported: count, updated: count, skipped: count }
```

##### C-CDA XML Import

**Purpose:** Parse a C-CDA document and import structured sections.

**Inputs:**
- xmlContent: string - raw C-CDA XML content

**Logic:**
```
1. Parse XML document
2. Validate root element is ClinicalDocument with templateId matching C-CDA 2.1
3. Extract sections by templateId:
   - Allergies: 2.16.840.1.113883.10.20.22.2.6.1
   - Medications: 2.16.840.1.113883.10.20.22.2.1.1
   - Problems/Conditions: 2.16.840.1.113883.10.20.22.2.5.1
   - Procedures: 2.16.840.1.113883.10.20.22.2.7.1
   - Results (labs): 2.16.840.1.113883.10.20.22.2.3.1
   - Immunizations: 2.16.840.1.113883.10.20.22.2.2.1
   - Vital Signs: 2.16.840.1.113883.10.20.22.2.4.1
4. FOR each entry in each section:
   a. Extract description, date, result_value, result_unit, reference_range
   b. Generate source_id from section OID + entry index
   c. Check deduplication by source_type = 'ccda' AND source_id
   d. Insert or update
5. RETURN import summary
```

**Edge Cases:**
- Malformed XML: reject with error "File is not a valid C-CDA document"
- Missing required sections: import available sections, skip missing ones
- Duplicate source_id: update existing record (upsert behavior)
- File size > 50 MB: reject with error "File is too large (maximum 50 MB)"
- Non-C-CDA XML file: reject with error "File does not appear to be a C-CDA clinical document"

##### Import Deduplication

**Purpose:** Prevent duplicate records on re-import.

**Logic:**
```
1. For each incoming record, compute a dedup key: (source_type, source_id, recorded_date)
2. Query existing records with matching dedup key
3. IF match found THEN
     Update all mutable fields (result_value, status, raw_data)
     Increment "updated" counter
   ELSE
     Insert new record
     Increment "imported" counter
4. Records with identical dedup key and identical field values: skip entirely
   Increment "skipped" counter
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| HealthKit clinical records authorization denied | Alert: "MyHealth needs access to your health records. You can enable this in Settings > Privacy > Health." | User grants permission in iOS Settings |
| C-CDA file is malformed XML | Error: "This file could not be read. It may be corrupted or not a valid C-CDA document." | User exports a new copy from their patient portal |
| C-CDA file exceeds 50 MB | Error: "File is too large (maximum 50 MB)" | User splits the file or contacts provider for smaller export |
| Partial import (some records fail) | Warning: "Imported 39 of 42 records. 3 records could not be parsed." with expandable details | User can retry or manually add failed records |
| No healthcare providers enrolled in Apple Health | Info: "No healthcare providers found. Add providers in Apple Health > Health Records." | User enrolls providers in Apple Health first |
| Database write fails during import | Error: "Import failed. No records were modified." (full rollback) | User retries import |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 3 healthcare providers enrolled in Apple Health with lab results and immunizations,
   **When** they tap "Apple Health Records" and authorize all record types,
   **Then** records are imported with correct descriptions, dates, providers, and result values, and the "Imported Records" section shows accurate counts by type.

2. **Given** the user has a C-CDA XML file exported from MyChart,
   **When** they tap "Patient Portal File" and select the file,
   **Then** the parser extracts lab results, medications, conditions, and immunizations, and displays a summary: "Imported 28 new records."

3. **Given** the user re-imports the same Apple Health records,
   **When** the import completes,
   **Then** existing records are updated (not duplicated) and the summary shows "0 new, 28 updated, 0 skipped."

**Edge Cases:**

4. **Given** the user imports a C-CDA file missing the Immunizations section,
   **When** the import completes,
   **Then** all other sections are imported successfully and the Immunizations section is skipped silently.

5. **Given** the user is on Android,
   **When** they view the Import Clinical Records screen,
   **Then** the Apple Health Records card shows "Available on iOS only" and the other two pathways are functional.

**Negative Tests:**

6. **Given** the user selects a regular XML file that is not a C-CDA document,
   **When** the parser attempts to read it,
   **Then** an error is shown: "File does not appear to be a C-CDA clinical document."
   **And** no records are imported or modified.

7. **Given** the user selects a C-CDA file that is 75 MB,
   **When** the file is selected,
   **Then** an error is shown: "File is too large (maximum 50 MB)."
   **And** the import does not begin.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses FHIR lab result | FHIR Observation JSON with HbA1c | ClinicalRecord with description: "Hemoglobin A1c", result_value: "5.7", result_unit: "%" |
| parses FHIR immunization | FHIR Immunization JSON with Influenza | ClinicalRecord with record_type: "immunization", description contains "Influenza" |
| parses C-CDA allergies section | C-CDA XML with 2 allergies | 2 ClinicalRecord objects with record_type: "allergy" |
| parses C-CDA lab results | C-CDA XML with 5 lab results | 5 ClinicalRecord objects with result_value and reference_range populated |
| rejects malformed XML | invalid XML string | Error: not a valid C-CDA document |
| rejects non-CCDA XML | valid XML but wrong templateId | Error: not a C-CDA document |
| rejects oversized file | 75 MB file | Error: file too large |
| deduplication: new record | no existing record with matching dedup key | insert (imported count: 1) |
| deduplication: update | existing record with matching dedup key, different result_value | update (updated count: 1) |
| deduplication: skip | existing record with identical fields | skip (skipped count: 1) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full FHIR import cycle | 1. Mock 10 FHIR records, 2. Run import, 3. Query hl_clinical_records | 10 records persisted with correct fields |
| C-CDA import with partial sections | 1. Create C-CDA with 3 of 7 sections, 2. Import | Records from 3 available sections imported, no errors for missing sections |
| Re-import deduplication | 1. Import 10 records, 2. Import same 10 again | 0 new, 10 updated (or skipped if identical), no duplicates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User imports records from patient portal | 1. Export C-CDA from MyChart, 2. Open Import screen, 3. Tap Patient Portal File, 4. Select file, 5. Wait for import | Records appear in Clinical Records List grouped by date, filterable by type |

---

### HL-029: Module Absorption Migration

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-029 |
| **Feature Name** | Module Absorption Migration |
| **Priority** | P0 |
| **Category** | Onboarding |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a MyLife user who previously used MyFast, MyMeds, or cycle tracking as standalone modules, I want MyHealth to automatically detect and absorb my existing data, so that I do not lose my history when enabling the consolidated health module.

**Secondary:**
> As a new MyLife user enabling MyHealth for the first time, I want the setup to detect which health-related modules I already have data for and offer to migrate them, so that I start with a complete health picture from day one.

#### 3.3 Detailed Description

Module Absorption Migration handles the data lifecycle when MyHealth absorbs previously independent modules. MyHealth consolidates data from MyFast (fasting sessions), MyMeds (medications, doses, reminders), and cycle tracking into a single health hub. When the user enables MyHealth, the migration system scans for existing data in absorbed module tables and offers a one-time import.

The migration is non-destructive: original module tables are preserved as read-only references. MyHealth reads from them directly rather than copying data, avoiding data duplication. The migration process:

1. **Detection phase:** Scan for the existence and row counts of absorbed module tables (`ft_fasting_sessions`, `md_medications`, `md_dose_logs`, `md_reminders`, `cy_cycles`, `cy_symptoms`, etc.).
2. **Offer phase:** Present the user with a summary of detected data ("Found 45 fasting sessions, 3 medications with 120 dose logs, 6 months of cycle data") and ask for confirmation.
3. **Integration phase:** Register the absorbed tables in `hl_module_links` so that MyHealth queries include them. Create cross-references and indexes for the dashboard and timeline. No data is copied or moved.
4. **Verification phase:** Validate that all absorbed data is accessible via MyHealth queries (dashboard cards, timeline entries, trend charts).
5. **Cleanup phase:** The original modules can optionally be hidden from the module registry (their routes are removed) since MyHealth now provides the UI for their data. Users can re-enable standalone modules if desired.

If the user declines migration, MyHealth starts with empty absorbed domains. They can trigger migration later from Settings.

The migration must be idempotent: running it multiple times produces the same result. If new data is added to an absorbed module table after migration, it is automatically visible in MyHealth (since MyHealth reads the original tables, not copies).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this runs during MyHealth module enable)

**External Dependencies:**
- SQLite database with potential absorbed module tables
- Module registry for detecting which modules are enabled

**Assumed Capabilities:**
- MyHealth module is being enabled via the hub's module management system
- Absorbed module tables follow the standard prefix convention (ft_, md_, cy_)

#### 3.5 User Interface Requirements

##### Screen: Module Absorption Welcome

**Layout:**
- Full-screen onboarding card that appears the first time MyHealth is enabled (and only if absorbed module data is detected)
- Header: health-themed illustration (heart + modules merging into one)
- Title: "Your Health Data, Unified"
- Subtitle: "MyHealth brings together your existing health data into one dashboard."
- Data detection summary displayed as a card list:
  - Each detected module shows: module icon, module name, data summary (e.g., "MyFast - 45 fasting sessions since Jan 2026")
  - Modules with no data are not listed
- Two buttons at the bottom:
  - "Bring It Together" (primary) - starts migration
  - "Start Fresh" (secondary) - skips migration, starts with empty absorbed domains

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Data detected | At least one absorbed module has data | Welcome card with detected modules listed |
| No data detected | No absorbed module tables exist or all are empty | Welcome card skipped entirely, MyHealth opens directly to the dashboard |
| Migration in progress | User tapped "Bring It Together" | Progress screen with checklist of modules being integrated |
| Migration complete | All modules successfully integrated | Success screen: "All set! Your health data is now unified." with "Open Dashboard" button |
| Migration failed | Database error during integration | Error screen: "Something went wrong. Your original data is safe." with "Try Again" and "Skip" buttons |

##### Screen: Migration Progress

**Layout:**
- Centered progress indicator
- Below it, a checklist of modules being integrated:
  - Each line shows: module name, status icon (spinner while processing, green check when done, red X if failed)
  - Example: "[ check ] MyFast - 45 sessions linked" / "[ spinner ] MyMeds - Processing..." / "[ X ] Cycle Tracking - Error (data preserved)"
- Footer text: "Your original data is never deleted or modified."

#### 3.6 Data Requirements

##### Entity: ModuleLink

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| source_module | string | Required | None | The absorbed module ID (e.g., "fast", "meds", "cycle") |
| source_table | string | Required | None | The absorbed table name (e.g., "ft_fasting_sessions") |
| linked_at | datetime | Required, ISO 8601 | None | When the link was established |
| row_count_at_link | integer | Min: 0 | 0 | Number of rows detected at link time (for verification) |
| status | enum | One of: linked, failed, unlinked | linked | Current status of the link |
| error_message | string | Max 500 chars, nullable | null | Error details if linking failed |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- `source_module` - lookup by module
- `status` - filter active links

**Example Data:**
```json
{
  "id": "hl_ml_1709676000_a1b2c3d4",
  "source_module": "fast",
  "source_table": "ft_fasting_sessions",
  "linked_at": "2026-03-05T10:00:00Z",
  "row_count_at_link": 45,
  "status": "linked",
  "error_message": null,
  "created_at": "2026-03-05T10:00:00Z"
}
```

##### Entity: MigrationRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated | Auto | Unique identifier |
| migration_version | integer | Required | None | Schema version of the migration |
| started_at | datetime | Required, ISO 8601 | None | When migration began |
| completed_at | datetime | nullable, ISO 8601 | null | When migration finished (null if in progress or failed) |
| status | enum | One of: pending, running, completed, failed | pending | Migration status |
| modules_detected | string | JSON array | None | Modules detected during scan |
| modules_linked | string | JSON array | None | Modules successfully linked |
| modules_failed | string | JSON array, nullable | null | Modules that failed to link |
| user_choice | enum | One of: migrate, skip, null | null | Whether user chose to migrate or skip |
| error_log | string | JSON, nullable | null | Detailed error information |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

**Indexes:**
- `status` - find active migrations
- `migration_version` - version tracking

#### 3.7 Business Logic Rules

##### Module Detection Scan

**Purpose:** Detect which absorbed modules have data available for integration.

**Logic:**
```
1. Define absorbed module manifest:
   - fast: tables = ['ft_fasting_sessions']
   - meds: tables = ['md_medications', 'md_dose_logs', 'md_reminders']
   - cycle: tables = ['cy_cycles', 'cy_symptoms', 'cy_predictions']
2. FOR each module in manifest:
   a. Check if the table exists in SQLite (SELECT name FROM sqlite_master WHERE type='table')
   b. IF table exists THEN count rows (SELECT COUNT(*) FROM {table})
   c. IF row count > 0 THEN add to detected list with summary
3. RETURN detected modules with table names and row counts
```

**Edge Cases:**
- Table exists but is empty: do not include in detected list
- Table does not exist: skip silently (module was never enabled)
- Multiple tables for one module (e.g., meds has 3 tables): only include in detected list if at least one table has data

##### Integration Process

**Purpose:** Link absorbed module tables to MyHealth queries.

**Inputs:**
- detectedModules: array of { module, tables, rowCounts }

**Logic:**
```
1. Create a MigrationRecord with status = 'running'
2. FOR each module in detectedModules:
   a. FOR each table in module.tables:
      i. Verify table accessibility (run a SELECT 1 FROM {table} LIMIT 1)
      ii. IF accessible THEN
          Create ModuleLink record with status = 'linked'
      iii. ELSE
          Create ModuleLink record with status = 'failed', error_message = reason
          Add module to modules_failed list
   b. Create necessary indexes on absorbed tables for MyHealth queries:
      - ft_fasting_sessions: index on start_time (if not exists)
      - md_dose_logs: index on taken_at (if not exists)
      - cy_cycles: index on start_date (if not exists)
3. Update MigrationRecord:
   IF any module failed THEN status = 'completed' (partial success is still completed)
   ELSE status = 'completed'
   Set completed_at = now
4. Register absorbed data sources in the dashboard card configuration
5. RETURN migration summary
```

##### Idempotency Check

**Purpose:** Ensure migration can run multiple times safely.

**Logic:**
```
1. Before creating ModuleLink, check if one already exists for (source_module, source_table)
2. IF exists AND status = 'linked' THEN skip (already migrated)
3. IF exists AND status = 'failed' THEN retry (update existing record)
4. IF exists AND status = 'unlinked' THEN re-link (user previously unlinked, now wants to re-migrate)
5. RETURN skip/retry/link action taken
```

**Edge Cases:**
- Migration interrupted mid-process (app killed): MigrationRecord stays as 'running'. On next launch, detect incomplete migration and offer to resume.
- Absorbed module data deleted after migration: MyHealth queries return empty results for that domain (graceful degradation, no crash)
- New data added to absorbed tables after migration: automatically visible in MyHealth since it reads original tables

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Absorbed table exists but is corrupt | Module listed as "Error (data preserved)" in progress screen | User can try again or skip that module |
| Index creation fails | Migration continues without the index (slower queries, no data loss) | Performance degrades gracefully |
| Migration interrupted (app killed) | On next launch: "A previous migration was interrupted. Resume?" | User taps "Resume" to continue from last successful module |
| All modules fail | Error screen: "Something went wrong. Your original data is safe." | User taps "Try Again" or "Skip" |
| SQLite disk full during index creation | Toast: "Not enough storage to complete setup. Free up space and try again." | User frees space, retries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has MyFast enabled with 45 fasting sessions and MyMeds with 3 medications,
   **When** they enable MyHealth for the first time,
   **Then** the Module Absorption Welcome screen shows "MyFast - 45 fasting sessions" and "MyMeds - 3 medications with X dose logs."

2. **Given** the user taps "Bring It Together",
   **When** the migration completes,
   **Then** ModuleLink records are created for all detected tables, the dashboard shows Fasting and Medications cards with real data, and the wellness timeline includes fasting and medication events.

3. **Given** the migration has completed and the user adds a new fasting session via MyFast,
   **When** they view the MyHealth dashboard,
   **Then** the new fasting session appears in the Fasting card (because MyHealth reads the original table).

**Edge Cases:**

4. **Given** no absorbed modules have any data,
   **When** the user enables MyHealth,
   **Then** the Module Absorption Welcome screen is skipped and MyHealth opens directly to the empty dashboard.

5. **Given** the migration was interrupted (app killed during processing),
   **When** the user reopens the app,
   **Then** a prompt asks "Resume migration?" and resumes from the last successful module.

6. **Given** the user taps "Start Fresh" to skip migration,
   **When** they later want to import existing data,
   **Then** they can trigger migration from Settings > Data > "Import existing module data."

**Negative Tests:**

7. **Given** the ft_fasting_sessions table is corrupt and unreadable,
   **When** the migration attempts to link it,
   **Then** that module shows "Error (data preserved)" in the progress screen.
   **And** other modules continue to migrate successfully.
   **And** no original data is deleted or modified.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects existing fast table with data | ft_fasting_sessions exists, 45 rows | detected: [{module: "fast", rowCount: 45}] |
| skips empty table | ft_fasting_sessions exists, 0 rows | not included in detected list |
| skips missing table | ft_fasting_sessions does not exist | not included in detected list |
| detects multiple meds tables | md_medications: 3 rows, md_dose_logs: 120 rows | detected: [{module: "meds", tables: 2, totalRows: 123}] |
| idempotency: skip already linked | ModuleLink exists with status: linked | action: skip |
| idempotency: retry failed | ModuleLink exists with status: failed | action: retry |
| idempotency: re-link unlinked | ModuleLink exists with status: unlinked | action: link |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full migration lifecycle | 1. Seed ft_fasting_sessions (10 rows) and md_medications (2 rows), 2. Run migration | ModuleLink records created, MigrationRecord shows completed, data accessible via dashboard queries |
| Idempotent re-run | 1. Complete migration, 2. Run migration again | No duplicate ModuleLink records, same data accessible |
| Partial failure recovery | 1. Corrupt one table, 2. Run migration | Failed module recorded, other modules linked successfully |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User enables MyHealth with existing data | 1. Have 45 fasting sessions and 3 medications, 2. Enable MyHealth, 3. See welcome screen, 4. Tap "Bring It Together", 5. Watch progress, 6. See success screen, 7. Open dashboard | Dashboard shows Fasting card (45 sessions) and Medications card (3 meds), timeline shows recent events from both modules |

---

### HL-030: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | HL-030 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As any MyHealth user, I want to configure my health targets (sleep goal, step goal, weight goal), measurement units (metric/imperial), notification preferences, and privacy settings, so that the app adapts to my personal needs and preferences.

**Secondary:**
> As a Privacy-First Health Tracker, I want granular control over HealthKit permissions and data retention, so that I decide exactly which health data types MyHealth can access and how long data is kept.

#### 3.3 Detailed Description

Settings and Preferences is the configuration hub for MyHealth. It provides controls organized into five groups: Profile (height, sex, date of birth, units), Health Targets (sleep, steps, weight, body fat, active minutes goals), Data Sources (HealthKit permissions, sync frequency, absorbed module links), Notifications (daily summary, goal reminders, medication correlation alerts, insight notifications), and Privacy (biometric lock, data retention period, delete all data).

All settings are stored in the `hl_settings` table as key-value pairs with JSON values. Settings are loaded at app startup and cached in memory. Changes take effect immediately (no "save" button needed - each setting persists on change).

Settings that affect computations (target sleep hours, step goal, unit preferences) propagate to all dependent features: sleep quality scoring recalculates with new targets, dashboard cards update to reflect new goals, trend charts redraw with new units, and the readiness score adjusts its sleep component.

The Settings screen is accessible from the gear icon on the dashboard header and from the dedicated Settings tab.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (foundational feature, but reads/writes settings used by most other features)

**External Dependencies:**
- HealthKit API for managing granular permissions (iOS)
- Biometric authentication API (FaceID, TouchID, fingerprint) for optional app lock
- Local notification scheduling API for reminders

**Assumed Capabilities:**
- User can navigate to Settings from the dashboard gear icon or the Settings tab

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Scrollable settings screen organized into 5 sections with section headers
- Each section is collapsible (all expanded by default)

**Section 1 - Profile:**
- Height: numeric input with unit toggle (ft/in or cm). Default: not set. Used for BMI calculation.
- Biological sex: picker (Male, Female, Not specified). Default: Not specified. Used for body fat estimation and cycle tracking.
- Date of birth: date picker. Default: not set. Used for age display on ICE card.
- Units: segmented control (Imperial / Metric). Default: Imperial (US locale) or Metric (other locales). Affects all measurement displays app-wide.
- Temperature unit: segmented control (Fahrenheit / Celsius). Default: follows units selection.

**Section 2 - Health Targets:**
- Sleep target: stepper, 4.0 to 12.0 hours in 0.5-hour increments. Default: 8.0 hours.
- Step target: stepper, 1,000 to 50,000 in 500-step increments. Default: 10,000 steps.
- Active minutes target: stepper, 10 to 300 in 5-minute increments. Default: 30 minutes.
- Weight goal: numeric input with unit toggle (lbs / kg). Default: not set. Optional.
- Body fat goal: numeric input (0.1% - 70.0%). Default: not set. Optional.

**Section 3 - Data Sources:**
- HealthKit toggle (master switch): on/off. Default: off. When turned on, shows sub-toggles:
  - Heart Rate: on/off
  - Resting Heart Rate: on/off
  - HRV: on/off
  - Blood Oxygen: on/off
  - Steps: on/off
  - Active Energy: on/off
  - Sleep Analysis: on/off
  - Body Mass: on/off
  - Blood Pressure: on/off
  - Body Temperature: on/off
- Sync frequency: picker (Every 15 minutes, Every hour, Every 4 hours, Manual only). Default: Every hour.
- Absorbed module links: read-only list showing linked modules (MyFast, MyMeds, Cycle) with status badges. "Manage" link navigates to a detail screen where users can unlink/re-link modules.

**Section 4 - Notifications:**
- Daily summary: toggle + time picker. Default: off. When on, delivers a push notification each morning with yesterday's health summary.
- Goal reminders: toggle. Default: off. When on, sends reminders for incomplete goals at 8 PM.
- Insight alerts: toggle. Default: off. When on, pushes a notification when new weekly insights are generated.
- SOS button visible: toggle. Default: off. Controls HL-025 floating button visibility.

**Section 5 - Privacy:**
- Biometric lock: toggle. Default: off. When on, requires FaceID/TouchID/fingerprint to open MyHealth.
- Lock screen ICE: toggle. Default: off. When on, emergency info is accessible from the lock screen (via Apple Health Medical ID integration).
- Data retention: picker (Keep forever, 1 year, 2 years, 5 years). Default: Keep forever. When set, data older than the retention period is auto-deleted on app launch.
- "Export All Data": button. Navigates to HL-010 export screen.
- "Delete All Health Data": button (destructive, red text). Requires confirmation dialog: "This will permanently delete all MyHealth data including sleep sessions, vitals, documents, goals, and settings. Absorbed module data (fasting, medications, cycle) will NOT be deleted. This cannot be undone." Two-step confirmation: tap "Delete All", then type "DELETE" to confirm.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | First launch, no changes made | All settings at defaults |
| Customized | User has changed settings | Changed values displayed, changes auto-saved |
| HealthKit unavailable | Android or web platform | HealthKit section shows "Available on iOS only. On Android, use Health Connect." |
| Biometric unavailable | Device lacks biometric hardware | Biometric lock toggle disabled with tooltip: "Not available on this device" |

**Interactions:**
- Change any setting: persists immediately to `hl_settings` (no save button)
- Toggle HealthKit master switch on: triggers HealthKit permission request flow
- Toggle individual HealthKit type: requests/revokes permission for that specific type
- Tap "Delete All Health Data": shows two-step confirmation dialog
- Tap "Manage" on absorbed modules: navigates to module link management screen

#### 3.6 Data Requirements

##### Entity: Setting

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | string | Primary key, unique | None | Setting identifier using dot notation (e.g., "profile.height_cm") |
| value | string | JSON-encoded value | None | Setting value as JSON (string, number, boolean, or object) |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last change time |

**Settings Key Registry:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `profile.height_cm` | number | null | User height in cm |
| `profile.sex` | string | "not_specified" | Biological sex: male, female, not_specified |
| `profile.date_of_birth` | string | null | ISO date string |
| `profile.units` | string | "imperial" | imperial or metric |
| `profile.temp_unit` | string | "fahrenheit" | fahrenheit or celsius |
| `targets.sleep_hours` | number | 8.0 | Target sleep hours |
| `targets.steps` | number | 10000 | Daily step goal |
| `targets.active_minutes` | number | 30 | Daily active minutes goal |
| `targets.weight_kg` | number | null | Weight goal in kg |
| `targets.body_fat_pct` | number | null | Body fat percentage goal |
| `healthkit.enabled` | boolean | false | Master HealthKit toggle |
| `healthkit.heart_rate` | boolean | false | Heart rate permission |
| `healthkit.resting_heart_rate` | boolean | false | Resting HR permission |
| `healthkit.hrv` | boolean | false | HRV permission |
| `healthkit.blood_oxygen` | boolean | false | SpO2 permission |
| `healthkit.steps` | boolean | false | Steps permission |
| `healthkit.active_energy` | boolean | false | Active energy permission |
| `healthkit.sleep` | boolean | false | Sleep analysis permission |
| `healthkit.body_mass` | boolean | false | Weight permission |
| `healthkit.blood_pressure` | boolean | false | BP permission |
| `healthkit.body_temperature` | boolean | false | Temperature permission |
| `healthkit.sync_frequency` | string | "hourly" | 15min, hourly, 4hours, manual |
| `notifications.daily_summary` | boolean | false | Enable daily summary notification |
| `notifications.daily_summary_time` | string | "07:00" | Time for daily summary (HH:mm) |
| `notifications.goal_reminders` | boolean | false | Enable goal reminder notifications |
| `notifications.insight_alerts` | boolean | false | Enable insight notification |
| `sos.show_floating_button` | boolean | false | Show SOS floating button |
| `privacy.biometric_lock` | boolean | false | Require biometric to open module |
| `privacy.lock_screen_ice` | boolean | false | Show ICE card from lock screen |
| `privacy.data_retention` | string | "forever" | forever, 1year, 2years, 5years |
| `dashboard.card_order` | string | null | JSON array of card domain keys |

**Indexes:**
- `key` is the primary key (inherent unique index)

**Example Data:**
```json
[
  { "key": "profile.height_cm", "value": "178.0", "updated_at": "2026-03-05T10:00:00Z" },
  { "key": "targets.sleep_hours", "value": "7.5", "updated_at": "2026-03-05T10:00:00Z" },
  { "key": "healthkit.enabled", "value": "true", "updated_at": "2026-03-05T10:00:00Z" },
  { "key": "privacy.biometric_lock", "value": "false", "updated_at": "2026-03-05T10:00:00Z" }
]
```

#### 3.7 Business Logic Rules

##### Settings Access Pattern

**Purpose:** Provide fast, type-safe access to settings with defaults.

**Logic:**
```
1. On app startup, load all rows from hl_settings into an in-memory cache (Map<string, any>)
2. getSetting(key, defaultValue):
   a. IF key exists in cache THEN RETURN JSON.parse(cache[key])
   b. ELSE RETURN defaultValue
3. setSetting(key, value):
   a. UPSERT into hl_settings (INSERT OR REPLACE)
   b. Update in-memory cache
   c. Emit a setting-changed event for reactive UI updates
4. deleteSetting(key):
   a. DELETE FROM hl_settings WHERE key = ?
   b. Remove from cache
   c. Emit setting-changed event
```

##### Unit Conversion

**Purpose:** Convert displayed values between imperial and metric based on user preference.

**Logic:**
```
1. All values are stored in metric (kg, cm, Celsius) in the database
2. On display:
   IF units = 'imperial' THEN
     weight: kg * 2.20462 = lbs (round to 1 decimal)
     height: cm / 2.54 = inches (display as ft'in")
     temperature: (C * 9/5) + 32 = F (round to 1 decimal)
     distance: km * 0.621371 = miles
   ELSE
     Display metric values as stored
3. On input:
   IF units = 'imperial' THEN
     Convert input to metric before storing:
     lbs / 2.20462 = kg
     inches * 2.54 = cm
     (F - 32) * 5/9 = C
```

##### Data Retention Enforcement

**Purpose:** Auto-delete health data older than the retention period.

**Inputs:**
- retentionSetting: 'forever' | '1year' | '2years' | '5years'

**Logic:**
```
1. On app launch, read privacy.data_retention setting
2. IF retentionSetting = 'forever' THEN skip
3. ELSE
   cutoffDate = now - retentionPeriod
   DELETE FROM hl_sleep_sessions WHERE start_time < cutoffDate
   DELETE FROM hl_vitals WHERE recorded_at < cutoffDate
   DELETE FROM hl_goals WHERE created_at < cutoffDate AND status = 'completed'
   DELETE FROM hl_goal_progress WHERE recorded_at < cutoffDate
   DELETE FROM hl_body_composition WHERE recorded_at < cutoffDate
   DELETE FROM hl_sos_sessions WHERE started_at < cutoffDate
   DELETE FROM hl_breathing_sessions WHERE started_at < cutoffDate
   DELETE FROM hl_thought_records WHERE created_at < cutoffDate
   DELETE FROM hl_insights WHERE generated_at < cutoffDate
   DELETE FROM hl_clinical_records WHERE recorded_date < cutoffDate
   NOTE: hl_emergency_info and hl_settings are NEVER auto-deleted
   NOTE: hl_documents are NEVER auto-deleted (user explicitly manages vault)
   NOTE: Absorbed module tables (ft_*, md_*, cy_*) are NOT affected by retention
4. Log deletion count for each table
```

**Edge Cases:**
- Retention period change from shorter to longer: no action needed (data already deleted is gone)
- Retention period change from longer to shorter: next app launch applies the new cutoff
- Active goals with progress entries older than cutoff: only completed goal progress is deleted; active goal progress is preserved regardless of age

##### Delete All Health Data

**Purpose:** Permanently remove all MyHealth data.

**Logic:**
```
1. Require two-step confirmation (tap button, then type "DELETE")
2. IF confirmed THEN
   DROP TABLE IF EXISTS hl_sleep_sessions
   DROP TABLE IF EXISTS hl_vitals
   DROP TABLE IF EXISTS hl_goals
   DROP TABLE IF EXISTS hl_goal_progress
   DROP TABLE IF EXISTS hl_documents
   DROP TABLE IF EXISTS hl_emergency_info
   DROP TABLE IF EXISTS hl_body_composition
   DROP TABLE IF EXISTS hl_sos_sessions
   DROP TABLE IF EXISTS hl_breathing_sessions
   DROP TABLE IF EXISTS hl_thought_records
   DROP TABLE IF EXISTS hl_insights
   DROP TABLE IF EXISTS hl_clinical_records
   DROP TABLE IF EXISTS hl_module_links
   DROP TABLE IF EXISTS hl_migration_records
   DELETE FROM hl_settings (clear all preferences)
   NOTE: ft_*, md_*, cy_* tables are NOT deleted (they belong to their respective modules)
3. Disable MyHealth module in module registry
4. Navigate user to the hub dashboard
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Setting write fails | Toast: "Could not save setting. Please try again." Setting reverts visually. | User retries the change |
| HealthKit permission denied by OS | Alert: "Permission denied. You can change this in Settings > Privacy > Health." | User adjusts iOS privacy settings |
| Biometric enrollment missing | Toggle disabled with tooltip: "Set up Face ID / Touch ID in device Settings first" | User enrolls biometrics in OS settings |
| Data retention deletion fails | Silent failure; retry on next app launch | Automatic retry |
| Delete all data fails mid-operation | Error: "Could not complete deletion. Some data may remain." | User retries from Settings |

**Validation Timing:**
- All setting changes validate and persist immediately on interaction
- No form-level save button exists

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens Settings and changes sleep target from 8.0 to 7.5 hours,
   **When** they navigate back to the dashboard,
   **Then** the sleep quality score recalculates using 7.5 hours as the target, and the Sleep Bank target adjusts accordingly.

2. **Given** the user switches units from Imperial to Metric,
   **When** all screens update,
   **Then** weight displays in kg, height in cm, temperature in Celsius, and all trend charts re-label their axes.

3. **Given** the user enables HealthKit with Heart Rate and Steps toggled on,
   **When** the HealthKit permission flow completes,
   **Then** the dashboard Activity card populates with step data and the Vitals card shows heart rate data from the watch.

4. **Given** the user enables the daily summary notification at 7:30 AM,
   **When** 7:30 AM arrives the next day,
   **Then** a push notification is delivered with a 2-4 bullet summary of yesterday's health data.

**Edge Cases:**

5. **Given** the user sets data retention to "1 year" and has 2 years of data,
   **When** the app launches,
   **Then** data older than 1 year is deleted, and the user sees only the most recent year of data.

6. **Given** the user changes units to Metric and then back to Imperial within the same session,
   **When** the display updates,
   **Then** values are identical to the original Imperial display (no precision loss from double conversion).

**Negative Tests:**

7. **Given** the user taps "Delete All Health Data" and then taps "Cancel" on the confirmation dialog,
   **When** the dialog closes,
   **Then** no data is deleted.
   **And** all health data remains intact.

8. **Given** the user taps "Delete All Health Data", taps "Delete All", and types "delete" (lowercase),
   **When** the confirmation checks,
   **Then** the deletion is rejected because the input must be exactly "DELETE" (uppercase).
   **And** no data is deleted.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| getSetting with existing key | key: "targets.sleep_hours", stored: "7.5" | 7.5 (number) |
| getSetting with missing key | key: "targets.sleep_hours", no stored value | default: 8.0 |
| setSetting persists value | key: "targets.steps", value: 12000 | stored as "12000", cache updated |
| unit conversion lbs to kg | 175.2 lbs | 79.5 kg |
| unit conversion kg to lbs | 79.5 kg | 175.2 lbs |
| unit conversion roundtrip | 175.2 lbs -> kg -> lbs | 175.2 lbs (no precision loss) |
| unit conversion cm to ft/in | 178 cm | 5'10" |
| unit conversion F to C | 98.6 F | 37.0 C |
| data retention cutoff 1yr | retention: "1year", now: 2026-03-07 | cutoff: 2025-03-07 |
| data retention forever | retention: "forever" | no deletion |
| delete confirmation exact match | input: "DELETE" | confirmed |
| delete confirmation case mismatch | input: "delete" | rejected |
| delete confirmation wrong text | input: "REMOVE" | rejected |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Setting change propagates | 1. Set sleep target to 7.0, 2. Compute sleep quality for an 8h session | Duration score uses 7.0 as target (114% ratio) |
| Unit switch affects display | 1. Log weight 80 kg, 2. Switch to imperial | Weight displays as 176.4 lbs |
| Data retention deletes old records | 1. Seed records from 2024 and 2026, 2. Set retention to 1 year, 3. Restart | Only 2026 records remain |
| Delete all data | 1. Seed all health tables, 2. Execute delete all, 3. Query all tables | All hl_* tables empty or dropped, ft_*/md_*/cy_* tables untouched |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User configures MyHealth for first use | 1. Open Settings, 2. Set height and weight, 3. Set sleep target to 7.5h, 4. Enable HealthKit with heart rate and steps, 5. Enable daily summary at 7:00 AM | All settings persisted, dashboard reflects new targets, HealthKit data flows in, notification scheduled |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the user's health profile, with health data organized into domain-specific tables. Sleep sessions capture nightly sleep with optional stage interval breakdowns. Vitals hold all quantitative health measurements (heart rate, blood pressure, steps, weight, etc.) in a single flexible table keyed by vital_type. Body composition entries extend vitals with circumference measurements and body fat estimations. Readiness scores aggregate sleep, HRV, and activity into a daily composite. Breathing sessions, meditation sessions, SOS sessions, and thought records track mental wellness activities. Health goals and goal progress provide time-bound target tracking. The document vault stores medical files as BLOBs. Emergency info is a singleton profile. Clinical records hold imported FHIR/C-CDA data. Health insights store rule-generated observations. Module links and migration records manage the absorption of standalone modules (MyFast, MyMeds, Cycle). Settings provide key-value configuration. A sync log tracks HealthKit incremental import state.

All tables use the `hl_` prefix. Absorbed module tables retain their original prefixes (`ft_`, `md_`, `cy_`) and are read from directly by MyHealth queries rather than duplicated.

### 4.2 Complete Entity Definitions

#### Table: `hl_sleep_sessions`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Format: `hl_slp_{timestamp}_{random}` |
| start_time | datetime | Required, ISO 8601 | None | Bedtime |
| end_time | datetime | Required, after start_time | None | Wake time |
| duration_minutes | integer | Computed | Computed | (end_time - start_time) in minutes |
| deep_minutes | integer | Min: 0, nullable | null | Deep sleep stage minutes |
| rem_minutes | integer | Min: 0, nullable | null | REM sleep stage minutes |
| light_minutes | integer | Min: 0, nullable | null | Light sleep stage minutes |
| awake_minutes | integer | Min: 0, nullable | null | Awake minutes during session |
| quality_score | float | 0.0-100.0, nullable | Computed | Sleep quality score (HL-004) |
| source | enum | manual, apple_health, health_connect, imported | manual | Data source |
| notes | string | Max 500 chars, nullable | null | User notes |
| snore_detected | boolean | nullable | null | Whether snore events were recorded |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_sleep_stage_intervals`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Format: `hl_ssi_{timestamp}_{random}` |
| session_id | string | FK to hl_sleep_sessions.id, ON DELETE CASCADE | None | Parent sleep session |
| stage | enum | deep, rem, light, awake | None | Sleep stage type |
| start_time | datetime | Required | None | Interval start |
| end_time | datetime | Required, after start_time | None | Interval end |
| duration_minutes | float | Computed | Computed | Interval length |
| source | enum | apple_health, health_connect | None | Data source (only from wearables) |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_vitals`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Format: `hl_vit_{timestamp}_{random}` |
| vital_type | enum | heart_rate, resting_heart_rate, hrv, blood_oxygen, blood_pressure, body_temperature, steps, active_energy, active_minutes, weight, respiratory_rate, vo2_max | None | Measurement type |
| value | float | Required | None | Primary measurement value |
| value_secondary | float | nullable | null | Secondary value (diastolic for BP) |
| unit | string | Required | None | Unit of measurement (bpm, ms, %, mmHg, F, steps, kcal, lbs, breaths/min, mL/kg/min) |
| recorded_at | datetime | Required, ISO 8601 | None | When the measurement was taken |
| source | enum | manual, apple_health, health_connect, imported | manual | Data source |
| notes | string | Max 500 chars, nullable | null | User notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_body_composition`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Format: `hl_bc_{timestamp}_{random}` |
| recorded_at | datetime | Required | Current timestamp | Measurement timestamp |
| weight_kg | float | 9.0-454.0, nullable | null | Weight in kilograms |
| height_cm | float | 61.0-274.0, nullable | null | Height in centimeters |
| body_fat_pct | float | 0.1-70.0, nullable | null | Body fat percentage |
| body_fat_source | enum | measured, estimated_navy, healthkit, null | null | How body fat was determined |
| muscle_mass_kg | float | Min: 0.1, nullable | null | Muscle mass in kg |
| bmi | float | Computed, nullable | Computed | weight_kg / (height_m^2) |
| waist_cm | float | 38.0-203.0, nullable | null | Waist circumference |
| hip_cm | float | 51.0-203.0, nullable | null | Hip circumference |
| neck_cm | float | 20.0-76.0, nullable | null | Neck circumference |
| chest_cm | float | nullable | null | Chest circumference |
| bicep_left_cm | float | nullable | null | Left bicep |
| bicep_right_cm | float | nullable | null | Right bicep |
| thigh_left_cm | float | nullable | null | Left thigh |
| thigh_right_cm | float | nullable | null | Right thigh |
| calf_left_cm | float | nullable | null | Left calf |
| calf_right_cm | float | nullable | null | Right calf |
| notes | string | Max 500 chars, nullable | null | User notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_readiness_scores`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Format: `hl_rdy_{date}_{random}` |
| score_date | date | Required, unique | None | Date this score covers |
| overall_score | integer | 0-100 | None | Final readiness score |
| sleep_score | integer | 0-100 | None | Sleep component (40% weight) |
| hrv_score | integer | 0-100 | None | HRV component (25% weight) |
| resting_hr_score | integer | 0-100 | None | Resting HR component (20% weight) |
| recovery_score | integer | 0-100 | None | Activity recovery (15% weight) |
| label | enum | Excellent, Good, Fair, Poor | None | Human-readable label |
| metadata | string | JSON, nullable | null | Component data and baselines |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_goals`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| name | string | Required, max 255 chars | None | Goal name |
| domain | enum | sleep, vitals, activity, body, breathing, meditation | None | Health domain |
| target_value | float | Required | None | Numeric target |
| target_unit | string | Required | None | Unit for target |
| period | enum | daily, weekly, monthly | None | Goal evaluation period |
| status | enum | active, completed, paused, abandoned | active | Current status |
| start_date | date | Required | None | When goal begins |
| end_date | date | nullable | null | Optional end date |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

#### Table: `hl_goal_progress`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| goal_id | string | FK to hl_goals.id, ON DELETE CASCADE | None | Parent goal |
| recorded_at | datetime | Required | None | When progress was recorded |
| value | float | Required | None | Progress value toward target |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_breathing_sessions`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Format: `hl_br_{timestamp}_{random}` |
| pattern_type | enum | box_4, calm_478, coherent, resonance, custom | None | Breathing pattern |
| started_at | datetime | Required | None | Session start |
| ended_at | datetime | Required | None | Session end |
| duration_seconds | integer | Computed | Computed | Total session length |
| cycles_completed | integer | Min: 0 | 0 | Breathing cycles finished |
| completed | boolean | - | false | Whether user finished the full session |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_meditation_sessions`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Format: `hl_med_{timestamp}_{random}` |
| session_type | enum | body_scan, progressive_relaxation, mindfulness, sleep, gratitude, stress_relief, breath_awareness, loving_kindness, morning_intention, anxiety_relief | None | Meditation type |
| started_at | datetime | Required | None | Session start |
| ended_at | datetime | Required | None | Session end |
| duration_seconds | integer | Computed | Computed | Total session length |
| completed | boolean | - | false | Full session completed |
| rating | integer | 1-5, nullable | null | Post-session rating |
| notes | string | Max 500 chars, nullable | null | Post-session notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_sos_sessions`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Format: `hl_sos_{timestamp}_{random}` |
| started_at | datetime | Required | None | Session start |
| ended_at | datetime | Required | None | Session end |
| duration_seconds | integer | Computed | Computed | Total session length |
| distress_before | integer | 1-10, nullable | null | Pre-session distress rating |
| distress_after | integer | 1-10, nullable | null | Post-session distress rating |
| phases_completed | integer | 1-3 | 1 | Phases reached |
| affirmation_shown | string | nullable | null | Affirmation text displayed |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_thought_records`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| situation | string | Required, max 2000 chars | None | Triggering situation |
| emotions | string | JSON array | None | Emotion names and intensities |
| automatic_thought | string | Required, max 2000 chars | None | Initial automatic thought |
| belief_initial | integer | 0-100 | None | Initial belief strength |
| distortions | string | JSON array of distortion IDs | None | Identified cognitive distortions |
| evidence_for | string | Max 2000 chars, nullable | null | Evidence supporting the thought |
| evidence_against | string | Max 2000 chars, nullable | null | Evidence contradicting the thought |
| balanced_thought | string | Max 2000 chars, nullable | null | Reframed balanced perspective |
| belief_after | integer | 0-100, nullable | null | Post-exercise belief strength |
| emotion_initial | integer | 0-100, nullable | null | Initial emotion intensity |
| emotion_after | integer | 0-100, nullable | null | Post-exercise emotion intensity |
| outcome | string | Max 2000 chars, nullable | null | Reflection on the exercise |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_snore_events`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| session_id | string | FK to hl_sleep_sessions.id, ON DELETE CASCADE | None | Parent sleep session |
| start_time | datetime | Required | None | Snore event start |
| end_time | datetime | Required | None | Snore event end |
| duration_seconds | integer | Computed | Computed | Event length |
| intensity | enum | mild, moderate, loud | None | Snore intensity (mild < 40 dB, moderate 40-55 dB, loud > 55 dB) |
| peak_decibels | float | nullable | null | Peak dB reading |
| audio_clip_path | string | nullable | null | Path to saved audio clip |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_documents`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| title | string | Required, max 255 chars | None | Document title |
| type | enum | lab_result, prescription, insurance, imaging, vaccination, referral, discharge, other | None | Document category |
| document_date | date | nullable | null | Document date |
| file_data | blob | Max 10 MB | None | Document content |
| thumbnail_data | blob | nullable | null | Thumbnail preview |
| file_type | string | Required | None | MIME type |
| file_size_bytes | integer | Required | None | File size |
| notes | string | Max 1000 chars, nullable | null | User notes |
| tags | string | JSON array, nullable | null | User tags |
| starred | boolean | - | false | Starred/favorite flag |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

#### Table: `hl_emergency_info`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, fixed value "profile" | "profile" | Singleton identifier |
| full_name | string | Max 255 chars, nullable | null | Full legal name |
| date_of_birth | date | nullable | null | Date of birth |
| blood_type | enum | A+, A-, B+, B-, AB+, AB-, O+, O-, null | null | Blood type |
| allergies | string | JSON array, nullable | null | Known allergies |
| conditions | string | JSON array, nullable | null | Medical conditions |
| emergency_contacts | string | JSON array of {name, relationship, phone}, max 5 | null | Emergency contacts |
| insurance_provider | string | Max 255 chars, nullable | null | Insurance company |
| insurance_policy_number | string | Max 100 chars, nullable | null | Policy number |
| insurance_group_number | string | Max 100 chars, nullable | null | Group number |
| primary_physician | string | Max 255 chars, nullable | null | Doctor's name |
| physician_phone | string | Max 20 chars, nullable | null | Doctor's phone |
| organ_donor | boolean | nullable | null | Donor status |
| notes | string | Max 1000 chars, nullable | null | Additional notes |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

#### Table: `hl_clinical_records`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| source_type | enum | fhir_r4, ccda, manual | None | Import pathway |
| source_id | string | nullable | null | Original record ID for deduplication |
| record_type | enum | lab_result, immunization, condition, medication, procedure, allergy, vital_sign | None | Clinical record category |
| description | string | Required, max 500 chars | None | Human-readable title |
| provider | string | Max 255 chars, nullable | null | Healthcare provider name |
| recorded_date | date | Required | None | Clinical event date |
| result_value | string | nullable | null | Result value |
| result_unit | string | Max 50 chars, nullable | null | Result unit |
| reference_range | string | Max 100 chars, nullable | null | Normal range |
| status | enum | final, preliminary, amended, cancelled, null | null | Result status |
| raw_data | string | JSON, required | None | Full original record |
| notes | string | Max 1000 chars, nullable | null | User notes |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

#### Table: `hl_insights`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| generated_at | datetime | Required | None | Generation time |
| period_start | date | Required | None | Analysis period start |
| period_end | date | Required | None | Analysis period end |
| schedule | enum | daily, weekly, on_demand | None | Schedule type |
| rule_id | string | Required | None | Rule that produced this insight |
| category | enum | trend, correlation, milestone, risk, pattern | None | Insight type |
| title | string | Required, max 120 chars | None | Short headline |
| body | string | Required, max 1000 chars | None | Detailed explanation |
| confidence | enum | high, medium, low, preliminary | None | Confidence level |
| domains | string | JSON array | None | Referenced domains |
| metadata | string | JSON, nullable | null | Rule-specific data |
| dismissed | boolean | - | false | Dismissed by user |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_module_links`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| source_module | string | Required | None | Absorbed module ID (fast, meds, cycle) |
| source_table | string | Required | None | Absorbed table name |
| linked_at | datetime | Required | None | Link establishment time |
| row_count_at_link | integer | Min: 0 | 0 | Rows at link time |
| status | enum | linked, failed, unlinked | linked | Link status |
| error_message | string | Max 500 chars, nullable | null | Error details |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_migration_records`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| migration_version | integer | Required | None | Schema version |
| started_at | datetime | Required | None | Start time |
| completed_at | datetime | nullable | null | Completion time |
| status | enum | pending, running, completed, failed | pending | Migration status |
| modules_detected | string | JSON array | None | Detected modules |
| modules_linked | string | JSON array | None | Linked modules |
| modules_failed | string | JSON array, nullable | null | Failed modules |
| user_choice | enum | migrate, skip, null | null | User decision |
| error_log | string | JSON, nullable | null | Error details |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_sync_log`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| data_type | string | Primary key | None | HealthKit data type (e.g., "heartRate") |
| last_sync_at | datetime | Required | None | Last successful sync time |
| last_anchor | string | nullable | null | HKAnchoredObjectQuery anchor |
| records_synced | integer | Min: 0 | 0 | Records imported in last sync |
| error_message | string | nullable | null | Last error message |
| updated_at | datetime | Auto-set | Current timestamp | Last update time |

#### Table: `hl_rr_intervals`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| recorded_at | datetime | Required | None | Measurement timestamp |
| interval_ms | float | Required, Min: 200, Max: 2000 | None | R-R interval in milliseconds |
| source | enum | apple_health, health_connect | None | Data source |
| created_at | datetime | Auto-set | Current timestamp | Record creation time |

#### Table: `hl_settings`

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | string | Primary key, unique | None | Dot-notation key (e.g., "profile.height_cm") |
| value | string | JSON-encoded | None | Setting value |
| updated_at | datetime | Auto-set | Current timestamp | Last change time |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| hl_sleep_sessions -> hl_sleep_stage_intervals | one-to-many | A session has zero or more stage intervals (from wearable data) |
| hl_sleep_sessions -> hl_snore_events | one-to-many | A session has zero or more snore events (when detection enabled) |
| hl_goals -> hl_goal_progress | one-to-many | A goal has multiple progress entries over time |
| hl_module_links -> ft_fasting_sessions | reference | MyHealth reads fasting data from the absorbed MyFast table |
| hl_module_links -> md_medications | reference | MyHealth reads medication data from the absorbed MyMeds tables |
| hl_module_links -> md_dose_logs | reference | MyHealth reads dose logs from MyMeds |
| hl_module_links -> md_reminders | reference | MyHealth reads reminders from MyMeds |
| hl_module_links -> cy_cycles | reference | MyHealth reads cycle data from the absorbed cycle tracking tables |
| hl_emergency_info -> md_medications | read-only | ICE card auto-populates active medications from MyMeds |

### 4.4 Indexes

| Table | Index | Fields | Reason |
|-------|-------|--------|--------|
| hl_sleep_sessions | idx_sleep_start | start_time | Date range queries, sort by recency |
| hl_sleep_sessions | idx_sleep_end | end_time | Overlap detection, range queries |
| hl_sleep_stage_intervals | idx_stage_session | session_id | Join to parent session |
| hl_sleep_stage_intervals | idx_stage_time | start_time | Chronological ordering |
| hl_vitals | idx_vitals_type_date | vital_type, recorded_at | Filter by type and date range |
| hl_vitals | idx_vitals_source | source | Filter by data source |
| hl_body_composition | idx_bc_date | recorded_at | Date range trend queries |
| hl_readiness_scores | idx_rdy_date | score_date (unique) | Daily lookup |
| hl_goals | idx_goals_status | status | Filter active/completed goals |
| hl_goal_progress | idx_progress_goal | goal_id, recorded_at | Query progress for a specific goal |
| hl_breathing_sessions | idx_breathing_date | started_at | Date range queries |
| hl_meditation_sessions | idx_meditation_date | started_at | Date range queries |
| hl_sos_sessions | idx_sos_date | started_at | Date range and trend queries |
| hl_thought_records | idx_cbt_date | created_at | Chronological listing |
| hl_snore_events | idx_snore_session | session_id | Join to parent session |
| hl_documents | idx_docs_type | type | Filter by document type |
| hl_documents | idx_docs_starred | starred | Quick access to favorites |
| hl_clinical_records | idx_cr_type_date | record_type, recorded_date | Filter by type and date |
| hl_clinical_records | idx_cr_dedup | source_type, source_id | Deduplication lookups |
| hl_insights | idx_insights_date | generated_at | Sort by recency |
| hl_insights | idx_insights_schedule | schedule, period_start | Query by schedule and period |
| hl_module_links | idx_ml_module | source_module | Lookup by absorbed module |
| hl_rr_intervals | idx_rr_date | recorded_at | Date range queries |

### 4.5 Table Prefix

**MyLife hub table prefix:** `hl_`

All table names in the SQLite database use the `hl_` prefix to avoid collisions with other modules in the MyLife hub. Example: the sleep sessions table is `hl_sleep_sessions`.

**Absorbed module tables retain their original prefixes:**
- `ft_` - MyFast (fasting sessions)
- `md_` - MyMeds (medications, dose logs, reminders)
- `cy_` - Cycle tracking (cycles, symptoms, predictions)

MyHealth reads from absorbed tables directly. It never copies or moves data from absorbed tables.

### 4.6 Migration Strategy

MyHealth uses a versioned migration system. Each migration has a version number and is tracked in `hl_migration_records`.

| Version | Description | Tables Created/Modified |
|---------|-------------|------------------------|
| v1 | Initial schema | hl_sleep_sessions, hl_vitals, hl_goals, hl_goal_progress, hl_documents, hl_emergency_info, hl_settings, hl_sync_log, hl_module_links, hl_migration_records |
| v2 | Breathing exercises | hl_breathing_sessions |
| v3 | Sleep stage intervals | hl_sleep_stage_intervals |
| v4 | Readiness scoring | hl_readiness_scores |
| v5 | Meditation sessions | hl_meditation_sessions |
| v6 | HRV raw intervals | hl_rr_intervals |
| v7 | Snore detection | hl_snore_events |
| v8 | CBT thought records | hl_thought_records |
| v9 | SOS sessions | hl_sos_sessions |
| v10 | Body composition | hl_body_composition |
| v11 | Health insights | hl_insights |
| v12 | Clinical records | hl_clinical_records |

**Migration rules:**
- Tables are created when the module is enabled and the migration version has not been applied
- Schema version is tracked per-migration in hl_migration_records
- Migrations are forward-only; destructive migrations (column removal) are deferred to major version bumps
- Data from standalone apps can be imported via the Module Absorption Migration (HL-029)
- If a migration fails, the status is set to "failed" and the user is prompted to retry

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Today | Heart pulse | Health Dashboard | Aggregated today view with domain cards, readiness score, and quick-log |
| Sleep | Moon | Sleep Log List | Sleep sessions, quality scores, sleep bank, sleep stages |
| Vitals | Activity monitor | Vitals Overview | All tracked vital types with trend charts and categories |
| Insights | Lightbulb | Insights Feed | AI-generated health insights, wellness timeline, correlations |
| Vault | Shield lock | Vault Home | Document vault, emergency info, clinical records, settings |

### 5.2 Navigation Flow

```
[Tab 1: Today]
  ├── Health Dashboard (HL-001)
  │     ├── Sleep Card → Sleep Detail
  │     ├── Activity Card → Activity Detail (HL-019)
  │     ├── Vitals Card → Vital Detail → Trend Chart (HL-009)
  │     ├── Medications Card → Medication List (absorbed MyMeds)
  │     ├── Fasting Card → Fasting Detail (absorbed MyFast)
  │     ├── Goals Card → Goal Detail → Goal Progress
  │     └── Quick-Log FAB → Log Sleep / Log Vital / Mood Check-In / Start Fast
  ├── Readiness Score Detail (HL-017)
  │     └── Component Breakdown → Individual Trend Charts
  └── Daily Insight Banner → Insights Feed

[Tab 2: Sleep]
  ├── Sleep Log List (HL-003)
  │     ├── Log Sleep Modal
  │     └── Sleep Session Detail
  │           ├── Quality Score Breakdown (HL-004)
  │           ├── Sleep Stage Chart (HL-014)
  │           ├── Overnight Heart Rate (HL-015)
  │           └── Snore Report (HL-022)
  ├── Sleep Bank Card (HL-023)
  ├── Sleep Trend Chart (HL-009)
  └── Smart Alarm Settings (HL-021)

[Tab 3: Vitals]
  ├── Vitals Overview (HL-005)
  │     ├── Vital Type Card → Vital Detail
  │     │     ├── Trend Chart (HL-009)
  │     │     └── Medication Correlation Overlay (HL-011)
  │     └── Log Vital Modal
  ├── Body Composition Overview (HL-026)
  │     ├── Log Body Composition Modal
  │     └── Body Composition Entry Detail
  ├── HRV Detail (HL-020)
  │     └── HRV Trend Chart
  ├── Blood Oxygen Detail (HL-016)
  │     └── Overnight SpO2 Chart
  └── Activity Detail (HL-019)
        └── Step/Active Energy Trend Charts

[Tab 4: Insights]
  ├── Insights Feed (HL-027)
  │     ├── Insight Detail → Explore (links to relevant trend chart)
  │     └── Generate Insights (custom date range)
  ├── Wellness Timeline (HL-002)
  │     ├── Domain Filter Chips
  │     ├── Date Range Picker
  │     └── Timeline Entry → Domain Detail Screen
  └── Health Data Export (HL-010)

[Tab 5: Vault]
  ├── Vault Home
  │     ├── Emergency Info (HL-006)
  │     │     └── Emergency Info Edit
  │     ├── Document List (HL-007)
  │     │     ├── Add Document Modal
  │     │     └── Document Viewer
  │     └── Clinical Records List (HL-028)
  │           ├── Import Clinical Records
  │           └── Record Detail
  ├── Breathing Exercises (HL-013)
  │     └── Breathing Session (full-screen)
  ├── Guided Meditation (HL-018)
  │     └── Meditation Session (full-screen)
  ├── CBT Exercises (HL-024)
  │     ├── Thought Record Form
  │     ├── Distortion Checker
  │     └── CBT Library
  └── Settings (HL-030)
        ├── Profile Settings
        ├── Health Targets
        ├── Data Sources (HealthKit / HL-012)
        ├── Notifications
        └── Privacy (including Delete All Data)
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Health Dashboard | `/(health)/` | Aggregated today view with domain cards | Tab 1 tap |
| Sleep Log List | `/(health)/sleep` | List of sleep sessions with summary stats | Tab 2 tap |
| Sleep Session Detail | `/(health)/sleep/[id]` | Detailed view of a single sleep session | Tap session card |
| Log Sleep Modal | `/(health)/sleep/log` | Manual sleep entry form | "+" button on Sleep tab, Quick-log FAB |
| Vitals Overview | `/(health)/vitals` | All vital type cards with latest values | Tab 3 tap |
| Vital Detail | `/(health)/vitals/[type]` | Single vital type with trend chart | Tap vital card |
| Log Vital Modal | `/(health)/vitals/log` | Manual vital entry form | "+" button on Vitals tab, Quick-log FAB |
| Body Composition | `/(health)/body` | Body composition entries and trends | Vitals tab section |
| Log Body Comp Modal | `/(health)/body/log` | Body measurement entry form | "+" on Body Composition screen |
| Activity Detail | `/(health)/activity` | Steps, active minutes, active energy | Activity card tap |
| HRV Detail | `/(health)/hrv` | HRV trends and analysis | Vitals tab section |
| Blood Oxygen Detail | `/(health)/spo2` | SpO2 trends and overnight analysis | Vitals tab section |
| Readiness Score | `/(health)/readiness` | Daily readiness with component breakdown | Dashboard readiness ring tap |
| Insights Feed | `/(health)/insights` | AI-generated health insights | Tab 4 tap |
| Wellness Timeline | `/(health)/timeline` | Chronological health event feed | Insights tab section |
| Health Data Export | `/(health)/export` | Export health data in JSON/CSV/PDF | Insights tab, Settings |
| Vault Home | `/(health)/vault` | Document vault and emergency info hub | Tab 5 tap |
| Emergency Info View | `/(health)/vault/ice` | ICE card display | Vault home |
| Emergency Info Edit | `/(health)/vault/ice/edit` | Edit emergency medical info | Edit button on ICE view |
| Document List | `/(health)/vault/docs` | Medical document grid/list | Vault home |
| Document Viewer | `/(health)/vault/docs/[id]` | Full-screen document view | Tap document card |
| Add Document Modal | `/(health)/vault/docs/add` | Capture/import a document | "+" on Document List |
| Clinical Records List | `/(health)/vault/records` | Imported clinical records | Vault home |
| Import Clinical Records | `/(health)/vault/records/import` | FHIR/C-CDA/PDF import flow | Clinical Records List |
| Clinical Record Detail | `/(health)/vault/records/[id]` | Structured record view | Tap record row |
| Breathing Exercises | `/(health)/breathe` | Exercise picker | Vault tab section |
| Breathing Session | `/(health)/breathe/session` | Full-screen breathing guide | Tap exercise card |
| Guided Meditation | `/(health)/meditate` | Meditation session picker | Vault tab section |
| Meditation Session | `/(health)/meditate/session` | Full-screen meditation guide | Tap session card |
| CBT Exercises | `/(health)/cbt` | CBT tools hub | Vault tab section |
| Thought Record Form | `/(health)/cbt/thought-record` | 7-step CBT worksheet | Tap Thought Record card |
| Distortion Checker | `/(health)/cbt/distortions` | Cognitive distortion identifier | Tap Distortion Checker card |
| CBT Library | `/(health)/cbt/library` | Saved thought records and stats | CBT hub |
| SOS Session | `/(health)/sos` | Full-screen panic calming sequence | SOS floating button |
| Settings | `/(health)/settings` | Configuration hub | Gear icon, Tab 5 section |
| Health Sync Settings | `/(health)/settings/sync` | HealthKit/Health Connect config | Settings > Data Sources |
| Smart Alarm Settings | `/(health)/sleep/alarm` | Configure smart alarm window | Sleep tab |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://health` | Health Dashboard | None |
| `mylife://health/sleep` | Sleep Log List | None |
| `mylife://health/sleep/:id` | Sleep Session Detail | id: session UUID |
| `mylife://health/vitals/:type` | Vital Detail | type: vital_type enum value |
| `mylife://health/body` | Body Composition | None |
| `mylife://health/readiness` | Readiness Score | None |
| `mylife://health/insights` | Insights Feed | None |
| `mylife://health/timeline` | Wellness Timeline | None |
| `mylife://health/vault/ice` | Emergency Info | None |
| `mylife://health/vault/docs/:id` | Document Viewer | id: document UUID |
| `mylife://health/vault/records/:id` | Clinical Record Detail | id: record UUID |
| `mylife://health/breathe` | Breathing Exercises | None |
| `mylife://health/meditate` | Guided Meditation | None |
| `mylife://health/cbt` | CBT Exercises | None |
| `mylife://health/sos` | SOS Session | None (launches immediately) |
| `mylife://health/settings` | Settings | None |
| `mylife://health/export` | Health Data Export | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Medication impact on sleep/vitals | MyMeds (md_*) | MyHealth | MyHealth reads md_dose_logs to correlate medication timing with sleep quality and vital trends | On dashboard load, insight generation, trend chart overlay |
| Fasting impact on vitals/sleep | MyFast (ft_*) | MyHealth | MyHealth reads ft_fasting_sessions to overlay fasting windows on vital charts and correlate with sleep | On dashboard load, insight generation |
| Cycle phase health overlay | Cycle (cy_*) | MyHealth | MyHealth reads cy_cycles to display menstrual cycle phase on the dashboard for symptom context | On dashboard load, timeline assembly |
| Sleep as habit metric | MyHealth | MyHabits | MyHealth exposes sleep duration and quality as auto-completable habits | On sleep session save, via module event |
| Breathing/meditation as habit | MyHealth | MyHabits | Completed breathing and meditation sessions are logged as habit completions | On session completion, via module event |
| Recovery input for workouts | MyHealth | MyWorkouts | Readiness score and sleep quality inform workout recovery recommendations | On readiness score computation |
| Workout load for readiness | MyWorkouts | MyHealth | Recent workout intensity factors into the readiness score's recovery component | On readiness score computation (reads workout data) |
| Sleep-mood correlation | MyMood | MyHealth | MyHealth reads mood entries to correlate with sleep quality trends in insights | On insight generation |
| Drowsiness risk warning | MyHealth | MyCar | Accumulated sleep debt (Sleep Bank) flags potential driving risk | On Sleep Bank balance update |
| Nutrition-health correlation | MyNutrition | MyHealth | MyHealth reads dietary intake data to correlate with energy, sleep quality, and vitals | On insight generation |
| HealthKit shared infrastructure | MyHealth | All health modules | HealthKit integration built in MyHealth provides data access to MyWorkouts, MyHabits, and MyMeds | On HealthKit sync completion |
| Activity to baby milestones | MyHealth | MyBaby | Mom's health vitals and sleep data provide context for postnatal recovery tracking | On dashboard display, if MyBaby is enabled |

**Integration Architecture:**

All cross-module data flows are read-only queries against local SQLite tables. MyHealth never writes to absorbed module tables. Cross-module reads happen at three trigger points:

1. **Dashboard load:** Queries absorbed module tables (ft_*, md_*, cy_*) to populate domain cards
2. **Timeline assembly:** Aggregates events from all absorbed tables into the unified timeline
3. **Insight generation:** The rule engine reads from all available domains to find correlations

If an absorbed module's tables do not exist (module never enabled), the integration point is silently skipped. No errors are surfaced for missing cross-module data.

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Sleep sessions and stage data | Local SQLite (hl_sleep_sessions, hl_sleep_stage_intervals) | At rest (OS-level) | No | Never leaves device |
| Vital measurements | Local SQLite (hl_vitals) | At rest (OS-level) | No | Includes HealthKit-imported data |
| Body composition | Local SQLite (hl_body_composition) | At rest (OS-level) | No | Weight, body fat, measurements |
| Readiness scores | Local SQLite (hl_readiness_scores) | At rest (OS-level) | No | Computed on-device |
| Medical documents | Local SQLite (hl_documents, BLOB) | At rest (OS-level) | No | Protected by device encryption and optional biometric lock |
| Emergency info | Local SQLite (hl_emergency_info) | At rest (OS-level) | No | Optionally visible from lock screen (user opt-in) |
| Clinical records | Local SQLite (hl_clinical_records) | At rest (OS-level) | No | FHIR/C-CDA data stays local |
| Breathing/meditation sessions | Local SQLite | At rest (OS-level) | No | Session metadata only |
| SOS sessions | Local SQLite (hl_sos_sessions) | At rest (OS-level) | No | Distress ratings are sensitive |
| CBT thought records | Local SQLite (hl_thought_records) | At rest (OS-level) | No | Highly sensitive mental health data |
| Snore audio recordings | Local file system | At rest (OS-level) | No | Audio never uploaded |
| Health insights | Local SQLite (hl_insights) | At rest (OS-level) | No | Generated and stored locally |
| HealthKit sync state | Local SQLite (hl_sync_log) | At rest (OS-level) | No | Anchor data only, no health values |
| User settings | Local SQLite (hl_settings) | At rest (OS-level) | No | Preferences and configuration |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| HealthKit read | Import health data from Apple Health | None (local API) | Health samples (HR, steps, sleep, etc.) | Explicit per-type authorization |
| Health Connect read | Import health data on Android | None (local API) | Health samples | Explicit per-type authorization |

This module operates almost entirely offline. The only "network-adjacent" activity is reading from the OS health data store (HealthKit/Health Connect), which is a local on-device API. No data is transmitted over any network.

### 7.3 Data That Never Leaves the Device

- Sleep sessions, quality scores, and sleep stage breakdowns
- All vital measurements (heart rate, blood pressure, HRV, SpO2, weight, etc.)
- Body composition entries and body fat estimations
- Readiness scores and component data
- Medical documents (lab results, prescriptions, insurance cards, imaging)
- Emergency medical information
- Clinical health records (imported FHIR/C-CDA data)
- Breathing exercise and meditation session logs
- SOS/panic session data and distress ratings
- CBT thought records and cognitive distortion data
- Snore detection audio recordings and event data
- Health goals and progress tracking
- Wellness timeline and health insights
- All HealthKit-imported data (stays in local SQLite after import)
- User preferences and settings

### 7.4 User Data Ownership

- **Export:** Users can export all health data in JSON (full fidelity), CSV (one file per domain), or PDF (formatted doctor report) via HL-010
- **Delete:** Users can delete all MyHealth data from Settings via a two-step confirmation (tap + type "DELETE"). Absorbed module data (ft_*, md_*, cy_*) is not affected.
- **Retention:** Configurable data retention periods (forever, 1 year, 2 years, 5 years). Data older than the retention period is auto-deleted on app launch.
- **Portability:** Export formats are documented and human-readable. JSON export includes schema version for forward compatibility.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Biometric lock | Optional FaceID/TouchID/fingerprint lock for MyHealth module | Enabled in Settings > Privacy. Requires biometric enrollment on device. |
| Lock screen ICE | Optional display of emergency info without unlocking device | Off by default. Mirrors Apple Medical ID concept. Only shows ICE card, not full app. |
| Document vault protection | Medical documents protected by OS-level file encryption | SQLite BLOB storage inherits device encryption. No additional app-level encryption layer. |
| HealthKit permissions | Granular per-data-type authorization | Each HealthKit data type (HR, steps, sleep, etc.) requires independent user authorization. Revocable at any time via iOS Settings. |
| Sensitive data handling | CBT thought records and SOS sessions contain sensitive mental health data | These tables are included in biometric lock scope. Export of these tables requires explicit selection. |
| Data deletion safeguard | Two-step confirmation for bulk deletion (tap + type "DELETE") | Prevents accidental data loss. Confirmation is case-sensitive. |
| Snore audio isolation | Audio recordings stored locally, never transmitted | Recordings are saved to app-private storage. Deleted when parent sleep session is deleted (cascade). User can delete individual recordings. |
| Export file security | Exported files are not encrypted | Users are responsible for securing exported files. Export produces local files only. No cloud upload. |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Absorbed module | A previously standalone module (MyFast, MyMeds, Cycle) whose data MyHealth reads directly from its original tables |
| AHA classification | American Heart Association blood pressure categories: Normal, Elevated, Stage 1, Stage 2, Hypertensive Crisis |
| BMI | Body Mass Index. Calculated as weight_kg / (height_m^2). Used as a general screening tool; not a diagnostic measure. |
| Body fat (US Navy method) | Body fat percentage estimation using circumference measurements (waist, neck, height, hip). Formula: men = 86.010*log10(waist-neck) - 70.041*log10(height) + 36.76 |
| C-CDA | Consolidated Clinical Document Architecture. An HL7 standard for structured clinical documents exported from healthcare provider systems (e.g., MyChart, Cerner). |
| CBT | Cognitive Behavioral Therapy. A structured approach to identifying and reframing negative thought patterns using techniques like thought records and distortion identification. |
| Cognitive distortion | A pattern of biased thinking (e.g., catastrophizing, mind reading, all-or-nothing thinking) that CBT exercises help identify and challenge. |
| Coherent breathing | A breathing pattern at 5.5 breaths per minute (5.5-second inhale, 5.5-second exhale) designed to synchronize heart rate variability with respiratory rhythm. |
| Deep link | A URL pattern (e.g., mylife://health/sleep) that navigates directly to a specific screen within the app. |
| Desaturation event | A drop in blood oxygen (SpO2) of 3% or more from the session baseline, lasting at least 10 seconds. Used as an indicator of potential sleep-disordered breathing. |
| Domain | A category of health data (sleep, vitals, activity, medications, fasting, mood, goals). Each domain maps to one or more database tables. |
| Domain card | A collapsible UI component on the Health Dashboard that summarizes data for a single health domain. |
| FHIR R4 | Fast Healthcare Interoperability Resources, Release 4. A standard for exchanging healthcare information electronically. Used by Apple Health for clinical records. |
| Grounding exercise | The 5-4-3-2-1 technique: naming 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste. Used during panic episodes to redirect attention to the present. |
| HealthKit | Apple's framework for reading and writing health and fitness data on iOS. MyHealth imports data from HealthKit but stores it locally. |
| Health Connect | Google's unified API for health and fitness data on Android. The Android equivalent of HealthKit. |
| HRV | Heart Rate Variability. The variation in time intervals between consecutive heartbeats, measured as RMSSD (Root Mean Square of Successive Differences) in milliseconds. Higher HRV generally indicates better cardiovascular fitness and stress resilience. |
| ICE card | In Case of Emergency card. A singleton record containing critical medical information (blood type, allergies, emergency contacts) accessible to first responders. |
| Idempotent | An operation that produces the same result whether executed once or multiple times. Applied to migrations and clinical record imports. |
| Insight rule | A predefined pattern-matching rule in the Health Insights engine that analyzes user data and generates natural-language observations when its conditions are met. |
| Module link | A record in hl_module_links that registers an absorbed module's table for inclusion in MyHealth queries. |
| Readiness score | A daily 0-100 composite score indicating physical and mental readiness, computed from sleep quality (40%), HRV (25%), resting heart rate (20%), and activity recovery (15%). |
| RMSSD | Root Mean Square of Successive Differences. The standard measure for short-term HRV, computed from beat-to-beat interval data. |
| Sleep bank | Cumulative sleep surplus or deficit tracked as the running difference between actual and target sleep hours over a rolling period. |
| Sleep quality score | A 0-100 composite score for each sleep session, weighted: duration adequacy (40%), deep sleep proportion (30%), REM sleep proportion (20%), awake time penalty (10%). |
| Sleep stages | Phases of sleep detected by wearable devices: Deep (slow-wave), REM (rapid eye movement), Light (N1/N2), and Awake. |
| SOS session | An on-demand calming sequence (breathing, grounding, affirmation) triggered by the panic button for acute anxiety episodes. |
| SpO2 | Peripheral oxygen saturation. The percentage of hemoglobin in the blood that is carrying oxygen. Normal range is 95-100%. |
| Table prefix | A short string prepended to all table names for a module (e.g., `hl_` for MyHealth) to prevent naming collisions in the shared SQLite database. |
| Thought record | A structured CBT worksheet with 7 steps: situation, emotions, automatic thought, evidence for, evidence against, balanced thought, and outcome. |
| Timeline entry | A normalized event record assembled at query time from multiple source tables for display in the Wellness Timeline. Not persisted as its own table. |
| Vital | Any quantitative health measurement: heart rate, blood pressure, blood oxygen, weight, steps, active energy, body temperature, HRV, respiratory rate, VO2 max. |
| Wellness timeline | A unified chronological feed of all health events across domains (sleep, vitals, medications, fasting, mood, activity, goals). |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification - Sections 1-2 and features HL-001 through HL-024 |
| 1.1 | 2026-03-07 | Claude (Spec Writer Agent) | Added features HL-025 through HL-030, Sections 4-8 (Data Architecture, Screen Map, Cross-Module Integration, Privacy and Security, Glossary) |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should HealthKit write-back be supported for manually entered vitals? | Currently HL-012 defines write support for sleep, weight, and BP. Other vitals could be written back too. | Write-back is opt-in per type; initial scope is sleep, weight, BP. Expand based on user feedback. | 2026-03-06 |
| 2 | Should the readiness score algorithm use absolute HRV thresholds or personal baselines? | Garmin and Whoop use personal baselines (rolling 30-day average). Absolute thresholds are simpler but less personalized. | Personal baselines (rolling 30-day average) per HL-017 specification. | 2026-03-06 |
| 3 | What is the minimum Apple Watch model required for sleep stage data? | Apple Watch Series 8+ and Ultra provide native sleep stages. Earlier models only track time asleep. | Document as a capability note in HL-014. Feature degrades gracefully without stage data. | 2026-03-06 |
| 4 | Should the document vault support encrypted BLOBs beyond OS-level encryption? | Adding app-level encryption would require a key management strategy and could complicate export. | Defer app-level encryption to Phase 6 (Polish). OS-level encryption is sufficient for MVP. | 2026-03-07 |
| 5 | How should the insight engine handle contradictory rules? | Two rules might fire with opposing observations (e.g., "sleep is improving" and "sleep debt is increasing"). | Priority ranking resolves conflicts. Higher-priority category wins. Both can appear if they reference different metrics. | 2026-03-07 |
| 6 | Should data retention auto-deletion apply to absorbed module tables (ft_*, md_*, cy_*)? | Currently specified as NOT affecting absorbed tables. Users might expect unified retention. | Absorbed tables are excluded from retention enforcement. Those modules manage their own data lifecycle. | 2026-03-07 |
