# MyMood - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyMood
- **Tagline:** "Track your emotional wellness"
- **Module ID:** `mood`
- **Feature ID Prefix:** MM
- **Table Prefix:** `mo_`
- **Accent Color:** #FB923C (warm orange)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Alex, Self-Awareness Seeker | 22-38, interested in understanding emotional patterns, reads psychology subreddits, has tried journaling apps but found them too open-ended | Track moods quickly throughout the day, identify emotional triggers, visualize patterns over weeks and months |
| Sam, Therapy-Supported User | 25-55, attends regular therapy sessions, therapist has asked them to track moods between sessions, wants to bring data to appointments | Log granular emotions (not just "good" or "bad"), generate reports for therapist, correlate mood with daily activities and sleep |
| Jordan, Wellness Optimizer | 22-40, tracks workouts and nutrition, wants to understand how lifestyle choices affect emotional wellbeing, data-driven mindset | Correlate exercise, fasting, and sleep with mood, view statistical significance of lifestyle-mood relationships, run personal experiments |
| Riley, Anxiety & Stress Manager | 18-45, experiences periodic anxiety or stress, wants accessible coping tools alongside mood tracking, values privacy for sensitive mental health data | Access breathing exercises during high-anxiety moments, log panic episodes with context, track anxiety trends over time, never expose mental health data to cloud services |
| Morgan, Mindful Parent | 30-50, juggling work and family, wants to be more emotionally present, uses mood tracking as a mindfulness practice | Quick one-tap mood logging during busy days, evening reflection prompts, understand how work vs. family time affects emotional state |

### 1.3 Core Value Proposition

MyMood is a privacy-first emotional wellness tracker that combines granular mood logging with scientific emotion categorization (Plutchik's wheel of emotions), statistical correlation analysis (Pearson r coefficient), and guided breathing exercises in a single offline-first app. It replaces Daylio ($36/yr), Bearable ($35/yr), and the mood-tracking portions of Calm ($80/yr) and Headspace ($70/yr). All mood data, emotion logs, activity correlations, and breathing session history stays exclusively on-device. No cloud account, no behavioral analytics, no data monetization. Users can generate therapist-ready reports and export all data without any information ever leaving their device involuntarily.

The cross-module correlation engine lets users discover mood patterns (mood + exercise via MyWorkouts, mood + fasting via MyFast, mood + medication via MyMeds, mood + habits via MyHabits, mood + reading via MyBooks) without any of that data leaving their device.

### 1.4 Competitive Landscape

| Competitor | Price | Strengths | Weaknesses | Our Differentiator |
|-----------|-------|-----------|------------|-------------------|
| Daylio | $36/yr | Clean micro-journaling, Year in Pixels, activity tracking, 5-point mood scale | Cloud sync exposes mood data, no emotion granularity beyond 5 moods, no correlation engine, no breathing exercises | 10-point scale + Plutchik's 32 emotions for granularity, Pearson r correlation engine, guided breathing, fully offline |
| Bearable | $35/yr | Powerful symptom-mood correlation, factor tracking, health focus | Complex UI, clinical data access concerns, subscription wall for correlations | Correlation engine included free, simpler UI with equal depth, zero clinical data exposure |
| Reflectly | $60/yr | AI-generated journal prompts, beautiful design, reflective focus | AI requires cloud processing (privacy risk), no statistical correlation, prompts feel generic | Local-only guided prompts with no AI cloud dependency, statistical correlations instead of AI guesses |
| Calm | $80/yr | Meditation, breathing exercises, sleep stories, premium content library | Primarily meditation app (mood tracking is secondary), expensive, collects behavioral analytics | Breathing exercises integrated with mood tracking, no behavioral analytics, included in MyLife Pro |
| Headspace | $70/yr | Guided meditation, SOS exercises, structured programs | Mood tracking is minimal, primarily a meditation platform, collects usage data | Full mood tracking suite with breathing as a complement, not the core product |
| Finch | $15-70/yr | Gamified self-care, virtual pet, gentle encouragement | Cloud-required, limited mood granularity, monetized through pet cosmetics | Local-only gamification potential via MyHabits integration, deeper mood analytics |
| Pixels - Year in Pixels | Free | Beautiful Year in Pixels visualization, simple and focused | Pixel grid only, no correlation, no activities, no breathing exercises, limited to 5 moods | Year in Pixels as one feature among many, with full activity tagging and correlation |
| MoodFlow | Free | Open source, basic mood tracking, simple charts | Minimal features, no correlation engine, no guided exercises, dated UI | Comprehensive feature set with modern UI, correlation engine, breathing exercises |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full CSV and JSON export and complete delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export

**MyMood-specific privacy notes:**

- **Mood logs are deeply personal.** Emotional state data can reveal mental health conditions, relationship problems, workplace dissatisfaction, substance use patterns, and other sensitive information. MyMood ensures this data never leaves the device. No insurer, employer, or data broker can access it.
- **Emotion descriptors can be clinically sensitive.** Logging emotions like "despair," "rage," or "panic" creates a pattern that could be used against a user in insurance, custody, or employment contexts. The local-only architecture eliminates this risk entirely.
- **Activity correlations reveal lifestyle details.** Knowing that a user's mood drops after "work meetings" or improves after "therapy" exposes private behavioral patterns. These correlations are computed and stored exclusively on-device.
- **Breathing exercise usage patterns** could indicate anxiety or panic disorder frequency. Session history never leaves the device.
- **Therapist reports** are generated locally and exported as files. They are never uploaded to any server. The user controls exactly what data appears in reports and who receives them.
- **Journal entries** attached to mood logs may contain the most private thoughts a person has. They are stored locally, never synced, and deleted when the user requests deletion.

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| MM-001 | Mood Logging | P0 | Core | None | Not Started |
| MM-002 | Emotion Wheel (Plutchik) | P0 | Core | MM-001 | Not Started |
| MM-003 | Activity Tagging | P0 | Core | MM-001 | Not Started |
| MM-004 | Mood Notes & Micro-Journal | P0 | Core | MM-001 | Not Started |
| MM-005 | Daily Mood Timeline | P0 | Core | MM-001 | Not Started |
| MM-006 | Mood Trends & Charts | P0 | Analytics | MM-001 | Not Started |
| MM-007 | Streak Tracking | P0 | Core | MM-001 | Not Started |
| MM-008 | Customizable Activity Categories | P1 | Data Management | MM-003 | Not Started |
| MM-009 | Year in Pixels | P1 | Analytics | MM-001 | Not Started |
| MM-010 | Correlation Engine | P1 | Analytics | MM-001, MM-003 | Not Started |
| MM-011 | Guided Breathing Exercises | P1 | Core | None | Not Started |
| MM-012 | Guided Journaling Prompts | P1 | Core | MM-004 | Not Started |
| MM-013 | Mood Reminders | P1 | Settings | MM-001 | Not Started |
| MM-014 | Photo Attachments | P1 | Core | MM-001 | Not Started |
| MM-015 | PIN/Biometric Lock | P1 | Settings | None | Not Started |
| MM-016 | Custom Experiments | P1 | Analytics | MM-010 | Not Started |
| MM-017 | Data Export | P1 | Import/Export | MM-001 | Not Started |
| MM-018 | Data Import | P1 | Import/Export | MM-001 | Not Started |
| MM-019 | Weekly & Monthly Reports | P2 | Analytics | MM-006, MM-010 | Not Started |
| MM-020 | SOS / Panic Button | P2 | Core | MM-011 | Not Started |
| MM-021 | Self-Care Suggestions | P2 | Core | MM-001, MM-003 | Not Started |
| MM-022 | Ambient Sounds | P2 | Core | MM-011 | Not Started |
| MM-023 | Widgets | P2 | Core | MM-001 | Not Started |
| MM-024 | Settings & Preferences | P0 | Settings | None | Not Started |

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

### MM-001: Mood Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-001 |
| **Feature Name** | Mood Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to log my current mood on a 1-10 numeric scale with a single tap, so that I can quickly capture how I feel throughout the day without friction.

**Secondary:**
> As a busy parent, I want to log my mood in under 5 seconds, so that I can track my emotional state even during hectic moments.

**Tertiary:**
> As a therapy-supported user, I want to log multiple mood entries per day with timestamps, so that I can show my therapist how my emotional state changed throughout a single day.

#### 3.3 Detailed Description

Mood Logging is the foundational feature of MyMood. It provides a simple, fast mechanism for recording a mood score on a scale of 1 to 10, where 1 represents the most negative emotional state and 10 represents the most positive. Each mood entry records the score, a timestamp, and an optional context note. Users can log mood as many times per day as they wish - there is no artificial limit on entries per day.

The logging interface presents a visual slider or tappable scale from 1 to 10, with color gradients transitioning from red (1) through orange (3-4), yellow (5-6), green (7-8), to blue (9-10). Each score value has a corresponding emoji face that animates when selected. The user taps or slides to their current mood, optionally adds a note, and taps "Log" to save.

Mood entries are immutable after creation - they cannot be edited, only deleted. This design choice ensures the historical record reflects genuine in-the-moment emotional states rather than retrospective rationalizations. If a user made a mistake, they delete the entry and log a new one. This matches how apps like Daylio handle mood entry integrity.

The 10-point scale (rather than Daylio's 5-point) provides more granularity for users who want to distinguish between "slightly below average" (4) and "noticeably bad" (2), or between "quite good" (8) and "euphoric" (10). Competitors like Bearable use similar granular scales.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local SQLite database initialized and writable
- UUID generation for entry IDs

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized via module migration system

#### 3.5 User Interface Requirements

##### Screen: Quick Log

**Layout:**
- The screen is the primary entry point, accessible from the first tab
- A top navigation bar shows "How are you feeling?" as the title
- The center of the screen displays a large emoji face (120x120px) that changes expression based on the selected mood score
- Below the emoji is a horizontal mood scale showing numbers 1 through 10, each as a tappable circular button (44x44px minimum)
- The mood scale uses a color gradient background: red (1-2), orange (3-4), yellow (5-6), green (7-8), blue (9-10)
- The currently selected score is highlighted with a larger circle (56x56px) and a subtle bounce animation
- Below the scale is a text label showing the mood descriptor (e.g., "Awful", "Bad", "Meh", "Okay", "Good", "Great", "Amazing")
- Below the label is a collapsible "Add a note..." text area (max 500 characters)
- At the bottom is a "Log Mood" button, enabled once a score is selected
- Below the button is a small "Today so far" section showing up to 5 most recent entries as colored dots with timestamps

**Mood Score Descriptors:**

| Score | Descriptor | Emoji | Color |
|-------|-----------|-------|-------|
| 1 | Awful | Distressed face | #EF4444 (red) |
| 2 | Terrible | Very sad face | #F87171 (light red) |
| 3 | Bad | Sad face | #F97316 (orange) |
| 4 | Poor | Slightly frowning face | #FB923C (light orange) |
| 5 | Meh | Neutral face | #EAB308 (yellow) |
| 6 | Okay | Slightly smiling face | #FACC15 (light yellow) |
| 7 | Good | Smiling face | #22C55E (green) |
| 8 | Great | Happy face | #4ADE80 (light green) |
| 9 | Amazing | Very happy face | #3B82F6 (blue) |
| 10 | Incredible | Star-struck face | #60A5FA (light blue) |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Selection | Screen just opened | Emoji shows neutral face, no score highlighted, Log button disabled |
| Score Selected | User tapped a score | Emoji updates, score highlighted, descriptor shown, Log button enabled |
| Note Expanded | User tapped "Add a note..." | Text area expands with keyboard, Log button remains visible above keyboard |
| Saving | User tapped Log Mood | Brief loading indicator (200ms min), then success feedback |
| Saved | Entry persisted | Toast: "Mood logged" with checkmark, form resets, new entry appears in "Today so far" |
| Error | Database write fails | Toast: "Could not save. Please try again." |

**Interactions:**
- Tap score button: selects that score, updates emoji and descriptor, enables Log button
- Swipe horizontally across scale: scrubs through scores with haptic feedback at each step
- Tap "Add a note...": expands text area with keyboard
- Tap "Log Mood": saves entry, resets form to No Selection state
- Tap a dot in "Today so far": scrolls to that entry in the Timeline (MM-005)

**Transitions/Animations:**
- Emoji face cross-fades between expressions (150ms duration)
- Selected score button scales up with spring animation (200ms)
- "Today so far" dots slide in from the right when a new entry is logged
- Success checkmark animates in with a scale + fade (300ms)

#### 3.6 Data Requirements

##### Entity: MoodEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| score | integer | Required, min 1, max 10 | None | Mood score on 1-10 scale |
| note | string or null | Max 500 chars | null | Optional text note providing context |
| loggedAt | datetime | ISO 8601, required | Current timestamp | Exact time the mood was logged |
| date | string | YYYY-MM-DD format | Derived from loggedAt | Date portion for daily aggregation queries |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- MoodEntry has many EmotionTags (one-to-many via entryId, from MM-002)
- MoodEntry has many ActivityTags (one-to-many via entryId, from MM-003)
- MoodEntry has many PhotoAttachments (one-to-many via entryId, from MM-014)

**Indexes:**
- `date` - Date-range queries for daily timeline, trends, and Year in Pixels
- `logged_at` - Chronological ordering within a day
- `score` - Filtering by mood level
- `date, logged_at` - Composite index for sorted daily listing

**Validation Rules:**
- `score`: must be an integer between 1 and 10 inclusive
- `note`: if provided, must not exceed 500 characters
- `loggedAt`: must not be in the future (tolerance of 60 seconds for clock drift)
- `date`: must be a valid date string in YYYY-MM-DD format

**Example Data:**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "score": 7,
  "note": "Good morning walk with the dog. Feeling energized.",
  "loggedAt": "2026-03-06T08:15:00Z",
  "date": "2026-03-06",
  "createdAt": "2026-03-06T08:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Mood Score Validation

**Purpose:** Ensure all mood entries have a valid score within the 1-10 range.

**Inputs:**
- score: integer - the mood score to validate

**Logic:**

```
1. IF score is not an integer THEN reject with "Score must be a whole number"
2. IF score < 1 THEN reject with "Score must be at least 1"
3. IF score > 10 THEN reject with "Score must be at most 10"
4. RETURN valid
```

**Edge Cases:**
- Score of 0: rejected (minimum is 1)
- Score of 11: rejected (maximum is 10)
- Floating point score (e.g., 7.5): rejected, must be integer

##### Daily Average Calculation

**Purpose:** Compute the average mood for a given date, used by Year in Pixels and trend charts.

**Inputs:**
- date: string (YYYY-MM-DD) - the date to compute the average for

**Logic:**

```
1. Query all MoodEntry records WHERE date = input date
2. IF no entries exist THEN RETURN null (no data for this day)
3. Sum all score values
4. Divide by the count of entries
5. Round to 1 decimal place
6. RETURN average
```

**Formulas:**
- `daily_average = sum(scores) / count(scores)`, rounded to 1 decimal

**Edge Cases:**
- No entries for a date: return null (not 0)
- Single entry: average equals that entry's score
- Multiple entries: arithmetic mean, rounded to 1 decimal place

##### Mood Entry Deletion

**Purpose:** Allow users to remove a mood entry and cascade to related tags.

**Inputs:**
- entryId: string - the mood entry to delete

**Logic:**

```
1. Begin transaction
2. DELETE all EmotionTag records WHERE entryId = input entryId
3. DELETE all ActivityTag records WHERE entryId = input entryId
4. DELETE all PhotoAttachment records WHERE entryId = input entryId
5. DELETE the MoodEntry record WHERE id = input entryId
6. Commit transaction
7. Recalculate daily average for the affected date
```

**Edge Cases:**
- Deleting the only entry for a day: daily average becomes null
- Deleting an entry with no tags: steps 2-4 are no-ops, no error

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save your mood. Please try again." | User taps Log Mood again; form state is preserved |
| Database write fails on delete | Toast: "Could not delete entry. Please try again." | User retries delete from context menu |
| No score selected and Log tapped | Log button is disabled; no action possible | User selects a score first |
| Note exceeds 500 characters | Character counter turns red at 500, input stops accepting | User shortens note |
| Future timestamp detected | Entry is saved with current time instead of future time | Automatic correction, no user action needed |

**Validation Timing:**
- Score validation runs on selection (immediate feedback via UI state)
- Note length validation runs on each keystroke (character counter)
- Timestamp validation runs on save

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Quick Log screen,
   **When** they tap score 7,
   **Then** the emoji shows a smiling face, the descriptor reads "Good", the score 7 button is highlighted in green, and the Log Mood button is enabled.

2. **Given** a score of 8 is selected,
   **When** the user taps "Log Mood",
   **Then** the entry is saved with score 8 and the current timestamp, the form resets, and a "Mood logged" toast appears.

3. **Given** a score is selected and the user taps "Add a note...",
   **When** they type "Feeling great after my run" and tap Log Mood,
   **Then** the entry is saved with score and note, and the note is visible on the timeline.

4. **Given** the user has logged 3 moods today,
   **When** they open the Quick Log screen,
   **Then** the "Today so far" section shows 3 colored dots with timestamps.

**Edge Cases:**

5. **Given** the user logs mood entry number 50 in a single day,
   **When** the entry is saved,
   **Then** all 50 entries are preserved and the daily average is correctly computed.

6. **Given** the user has never logged a mood,
   **When** they open the Quick Log screen,
   **Then** the "Today so far" section shows "No entries yet today" with no dots.

**Negative Tests:**

7. **Given** no score is selected,
   **When** the user attempts to tap Log Mood,
   **Then** the button is disabled and nothing happens.

8. **Given** the database is in an error state,
   **When** the user taps Log Mood,
   **Then** the error toast appears, the form state is preserved, and no partial data is written.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates score in range | score: 7 | valid |
| rejects score below minimum | score: 0 | error: "Score must be at least 1" |
| rejects score above maximum | score: 11 | error: "Score must be at most 10" |
| rejects non-integer score | score: 7.5 | error: "Score must be a whole number" |
| calculates daily average single entry | scores: [8] | average: 8.0 |
| calculates daily average multiple entries | scores: [3, 7, 5] | average: 5.0 |
| returns null average for no entries | scores: [] | average: null |
| truncates note at 500 characters | note: 501-char string | error: note too long |
| accepts null note | note: null | valid |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log mood and verify persistence | 1. Select score 8, 2. Tap Log, 3. Query database | Entry exists with score 8 and current timestamp |
| Log mood with note | 1. Select score 5, 2. Type note, 3. Tap Log, 4. Query database | Entry exists with score 5 and note text |
| Delete mood entry cascades | 1. Log mood with emotions and activities, 2. Delete entry, 3. Query related tables | Entry and all related tags are deleted |
| Daily average updates on new entry | 1. Log score 4, 2. Log score 8, 3. Query daily average | Average is 6.0 |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| First mood log | 1. Open app (empty), 2. Tap score 6, 3. Tap Log Mood | Timeline shows 1 entry, dashboard shows today's mood as 6 |
| Multiple logs in one day | 1. Log score 3 at 9am, 2. Log score 7 at 2pm, 3. Log score 8 at 8pm | Timeline shows 3 entries, daily average is 6.0 |

---

### MM-002: Emotion Wheel (Plutchik)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-002 |
| **Feature Name** | Emotion Wheel (Plutchik) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a self-awareness seeker, I want to tag my mood entries with specific emotions from Plutchik's emotion wheel, so that I can understand the nuances of what I feel beyond a simple numeric score.

**Secondary:**
> As a therapy-supported user, I want to identify whether my "bad mood" is rooted in anger, sadness, fear, or disgust, so that I can communicate more precisely with my therapist about my emotional patterns.

#### 3.3 Detailed Description

The Emotion Wheel provides granular emotion classification based on Plutchik's psychoevolutionary theory of emotions. Robert Plutchik identified 8 primary emotions, each existing at 3 intensity levels, yielding 24 named emotions. The wheel also defines 8 composite emotions formed by combining adjacent primary emotions.

The 8 primary emotions are: joy, trust, fear, surprise, sadness, disgust, anger, and anticipation. Each primary emotion has a mild, moderate, and intense form. For example, the joy family spans serenity (mild) to joy (moderate) to ecstasy (intense). The anger family spans annoyance (mild) to anger (moderate) to rage (intense).

Users can select one or more emotions per mood entry. The emotion selection screen presents a visual wheel or structured list organized by primary emotion families. Users tap to select emotions, and each selection is stored as an EmotionTag linked to the mood entry. Over time, emotion frequency data powers the correlation engine (MM-010) and trend charts (MM-006).

Most mood tracking apps use simplistic emotion labels (Daylio offers only 5 custom moods). MyMood's Plutchik-based system provides 32 distinct emotions (24 intensity-graded + 8 composite), enabling users and their therapists to identify precise emotional patterns. For instance, a user might discover that their low moods are predominantly characterized by "apprehension" (mild fear) rather than "sadness," which has different therapeutic implications.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001: Mood Logging - Emotion tags are attached to mood entries

**External Dependencies:**
- None (emotion data is static, bundled with the app)

**Assumed Capabilities:**
- MoodEntry entity exists and is writable

#### 3.5 User Interface Requirements

##### Screen: Emotion Picker

**Layout:**
- The screen is presented as a modal sheet during the mood logging flow, after score selection
- A top bar shows "What emotions are you feeling?" with a Done button on the right
- The main area displays the emotion wheel as either:
  - **Wheel View** (default): A circular visualization with 8 color-coded petals, each petal divided into 3 intensity bands (mild on the outer edge, intense at the center). Tapping a segment selects that emotion.
  - **List View** (toggle): A grouped list with 8 collapsible sections (one per primary emotion), each containing 3 intensity levels. More accessible for users who find the wheel difficult to parse.
- A view toggle button (wheel/list icon) in the top-left switches between views
- Selected emotions appear as colored chips below the wheel/list, each with an "x" to deselect
- The chip area scrolls horizontally if more than 4 emotions are selected
- A "Common" quick-select section at the bottom shows the user's 8 most frequently logged emotions as tappable chips

**Plutchik Emotion Families:**

| Primary Emotion | Mild | Moderate | Intense | Color | Composite (with neighbor) |
|----------------|------|----------|---------|-------|--------------------------|
| Joy | Serenity | Joy | Ecstasy | #FACC15 (yellow) | Love (joy + trust) |
| Trust | Acceptance | Trust | Admiration | #4ADE80 (green) | Submission (trust + fear) |
| Fear | Apprehension | Fear | Terror | #22C55E (dark green) | Awe (fear + surprise) |
| Surprise | Distraction | Surprise | Amazement | #3B82F6 (blue) | Disapproval (surprise + sadness) |
| Sadness | Pensiveness | Sadness | Grief | #6366F1 (indigo) | Remorse (sadness + disgust) |
| Disgust | Boredom | Disgust | Loathing | #A855F7 (purple) | Contempt (disgust + anger) |
| Anger | Annoyance | Anger | Rage | #EF4444 (red) | Aggressiveness (anger + anticipation) |
| Anticipation | Interest | Anticipation | Vigilance | #F97316 (orange) | Optimism (anticipation + joy) |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Selection | Picker just opened | Wheel displayed, no segments highlighted, chip area empty |
| Emotions Selected | 1+ emotions tapped | Selected segments highlighted with a check icon, chips shown below |
| List View | User toggled to list | Grouped list replaces wheel, selections preserved |
| Common Populated | User has prior log history | Bottom section shows top 8 most-used emotions |
| Common Empty | First-time user | Bottom section hidden |

**Interactions:**
- Tap wheel segment: toggles selection of that emotion (selected/deselected)
- Tap list row: toggles selection of that emotion
- Tap chip "x": deselects that emotion
- Tap "Common" chip: selects that emotion (adds to chip area)
- Tap "Done": saves emotion tags and returns to mood log flow
- Tap view toggle: switches between wheel and list view, preserving selections
- Long press wheel segment: shows a tooltip with the emotion name and intensity level

**Transitions/Animations:**
- Wheel segment pulses briefly on selection (scale 1.0 to 1.1, 150ms)
- Chips animate in from the left with a slide + fade (200ms)
- View switch cross-fades between wheel and list (250ms)

#### 3.6 Data Requirements

##### Entity: EmotionTag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| entryId | string | Foreign key to MoodEntry.id, required | None | The mood entry this emotion belongs to |
| emotionFamily | enum | One of: joy, trust, fear, surprise, sadness, disgust, anger, anticipation | None | Primary emotion category |
| emotionName | string | Required, one of 32 valid Plutchik emotions | None | Specific emotion name (e.g., "serenity", "rage", "love") |
| intensityLevel | enum | One of: mild, moderate, intense, composite | None | Intensity band within the family |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- EmotionTag belongs to MoodEntry (many-to-one via entryId)

**Indexes:**
- `entry_id` - Fast lookup of emotions for a given mood entry
- `emotion_family` - Filtering and aggregation by primary emotion
- `emotion_name` - Frequency counting for "Common" section and correlation

**Validation Rules:**
- `entryId`: must reference an existing MoodEntry
- `emotionName`: must be one of the 32 valid Plutchik emotion names
- `emotionFamily`: must be one of the 8 primary emotion families
- `intensityLevel`: must match the expected level for the given emotionName (e.g., "serenity" must be "mild")
- Uniqueness: no duplicate (entryId, emotionName) pairs

**Example Data:**

```json
{
  "id": "c3d4e5f6-a1b2-3456-7890-abcdef123456",
  "entryId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "emotionFamily": "joy",
  "emotionName": "serenity",
  "intensityLevel": "mild",
  "createdAt": "2026-03-06T08:15:00Z"
}
```

##### Reference Data: Plutchik Emotions (Static)

| emotionName | emotionFamily | intensityLevel |
|------------|---------------|----------------|
| serenity | joy | mild |
| joy | joy | moderate |
| ecstasy | joy | intense |
| acceptance | trust | mild |
| trust | trust | moderate |
| admiration | trust | intense |
| apprehension | fear | mild |
| fear | fear | moderate |
| terror | fear | intense |
| distraction | surprise | mild |
| surprise | surprise | moderate |
| amazement | surprise | intense |
| pensiveness | sadness | mild |
| sadness | sadness | moderate |
| grief | sadness | intense |
| boredom | disgust | mild |
| disgust | disgust | moderate |
| loathing | disgust | intense |
| annoyance | anger | mild |
| anger | anger | moderate |
| rage | anger | intense |
| interest | anticipation | mild |
| anticipation | anticipation | moderate |
| vigilance | anticipation | intense |
| love | joy + trust | composite |
| submission | trust + fear | composite |
| awe | fear + surprise | composite |
| disapproval | surprise + sadness | composite |
| remorse | sadness + disgust | composite |
| contempt | disgust + anger | composite |
| aggressiveness | anger + anticipation | composite |
| optimism | anticipation + joy | composite |

#### 3.7 Business Logic Rules

##### Emotion Frequency Ranking

**Purpose:** Rank emotions by usage frequency to populate the "Common" quick-select section.

**Inputs:**
- userId: implicit (local device, single user)
- limit: integer (default 8)

**Logic:**

```
1. Query all EmotionTag records
2. GROUP BY emotionName
3. COUNT each group
4. ORDER BY count DESC
5. TAKE top [limit] results
6. RETURN list of {emotionName, emotionFamily, count}
```

**Edge Cases:**
- No emotion history: return empty list, hide "Common" section
- Fewer than 8 unique emotions used: return only the ones that exist
- Tie in count: break ties alphabetically by emotionName

##### Composite Emotion Resolution

**Purpose:** Map composite emotions to their constituent primary emotion families for analytics.

**Inputs:**
- emotionName: string - a composite emotion name

**Logic:**

```
1. Look up emotionName in the composite emotion table
2. IF found THEN RETURN the two constituent families
3. IF not found THEN RETURN the single primary family
```

**Composite Mappings:**
- love -> [joy, trust]
- submission -> [trust, fear]
- awe -> [fear, surprise]
- disapproval -> [surprise, sadness]
- remorse -> [sadness, disgust]
- contempt -> [disgust, anger]
- aggressiveness -> [anger, anticipation]
- optimism -> [anticipation, joy]

**Edge Cases:**
- Unknown emotion name: reject at validation layer before reaching this logic

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails when saving emotion tags | Toast: "Could not save emotions. Please try again." | User taps Done again; selections are preserved in memory |
| Invalid emotion name in data | Should never occur (UI constrains to valid options) | If detected during read, skip the invalid tag and log warning |
| Duplicate emotion tag for same entry | Silently ignored (upsert behavior) | No user action needed |

**Validation Timing:**
- Emotion name validation: at selection time (invalid names cannot be selected from the UI)
- Foreign key validation: at save time (entryId must exist)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is logging a mood with score 3,
   **When** they open the emotion picker and tap "Sadness",
   **Then** the sadness segment highlights, a "Sadness" chip appears below the wheel, and the emotion is saved with the mood entry.

2. **Given** the user selects "Serenity" and "Acceptance",
   **When** they tap Done,
   **Then** both emotion tags are saved and visible on the mood entry in the timeline.

3. **Given** the user has logged 20 mood entries with emotions,
   **When** they open the emotion picker,
   **Then** the "Common" section shows their top 8 most frequently used emotions.

**Edge Cases:**

4. **Given** the user selects 10 emotions for a single entry,
   **When** they tap Done,
   **Then** all 10 are saved and displayed as scrollable chips.

5. **Given** the user switches from wheel view to list view,
   **When** they had 3 emotions selected in wheel view,
   **Then** the same 3 emotions are checked in the list view.

**Negative Tests:**

6. **Given** the user has selected "Anger",
   **When** they tap "Anger" again,
   **Then** the emotion is deselected and the chip is removed.

7. **Given** no emotions are selected,
   **When** the user taps Done,
   **Then** no emotion tags are saved (emotions are optional).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates known emotion name | emotionName: "serenity" | valid |
| rejects unknown emotion name | emotionName: "happiness" | error: invalid emotion |
| maps serenity to joy family | emotionName: "serenity" | family: "joy", level: "mild" |
| maps rage to anger family | emotionName: "rage" | family: "anger", level: "intense" |
| resolves composite love | emotionName: "love" | families: ["joy", "trust"] |
| ranks emotions by frequency | 5x anger, 3x joy, 1x fear | ["anger", "joy", "fear"] |
| prevents duplicate tag | same (entryId, emotionName) twice | only 1 tag created |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Save emotions with mood entry | 1. Log mood score 5, 2. Select sadness + pensiveness, 3. Save | MoodEntry + 2 EmotionTag records in database |
| Delete mood entry cascades emotions | 1. Log mood with 3 emotions, 2. Delete entry | Entry and all 3 EmotionTag records deleted |
| Common section populates | 1. Log 10 entries with "joy", 2. Log 5 with "anger", 3. Open picker | Common section shows joy first, anger second |

---

### MM-003: Activity Tagging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-003 |
| **Feature Name** | Activity Tagging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to tag my mood entries with what I was doing when I logged my mood, so that I can later discover which activities correlate with higher or lower moods.

**Secondary:**
> As a wellness optimizer, I want to see whether activities like exercise, socializing, or work meetings consistently affect my mood, so that I can make data-driven lifestyle adjustments.

#### 3.3 Detailed Description

Activity Tagging allows users to associate one or more activities with each mood entry. The app ships with a curated set of default activities organized into categories (e.g., Exercise, Work, Social, Rest, Health, Chores, Entertainment, Self-Care). Users can also create custom activities (see MM-008).

When logging a mood, after selecting a score and optionally choosing emotions, the user is presented with an activity picker showing categorized activity buttons. Each activity has a name and an emoji icon. Users tap to select one or more activities. Selected activities are stored as ActivityTag records linked to the mood entry.

Activity data is the primary input for the Correlation Engine (MM-010). By tracking activities alongside mood scores, users can discover statistically significant relationships between what they do and how they feel. This is a key differentiator from simple mood-only trackers.

Daylio offers similar activity tagging but limits the analysis to simple averages. Bearable provides deeper factor analysis but requires a subscription. MyMood includes activity-mood correlation in the base experience.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001: Mood Logging - Activity tags are attached to mood entries

**External Dependencies:**
- None (activity data is user-defined, stored locally)

**Assumed Capabilities:**
- MoodEntry entity exists and is writable

#### 3.5 User Interface Requirements

##### Screen: Activity Picker

**Layout:**
- The screen is presented as a step in the mood logging flow, after the emotion picker (or directly after score selection if the user skips emotions)
- A top bar shows "What have you been doing?" with a Done button on the right and a Skip button on the left
- The main area displays categorized activity grids
- Each category has a header label (e.g., "Exercise", "Work", "Social")
- Within each category, activities are displayed as square buttons (64x64px) in a 4-column grid
- Each button shows an emoji icon (24px) above a short label (12px text, max 10 characters)
- Selected activities have a highlighted background (accent color at 20% opacity) and a small checkmark overlay
- At the top, a "Recent" section shows the 6 most recently used activities for quick access
- A search bar above the categories filters activities by name

**Default Activity Categories and Items:**

| Category | Activities |
|----------|-----------|
| Exercise | Running, Walking, Gym, Yoga, Swimming, Cycling, Hiking, Sports |
| Work | Office, Meeting, Deadline, Commute, WFH, Presentation, Email, Break |
| Social | Friends, Family, Dating, Party, Phone Call, Texting, Video Call, Alone Time |
| Rest | Sleeping, Napping, Relaxing, Meditation, Bath, Spa, Nothing, Vacation |
| Health | Doctor, Therapy, Medication, Cooking, Healthy Meal, Junk Food, Caffeine, Alcohol |
| Chores | Cleaning, Laundry, Groceries, Errands, Cooking, Gardening, Repairs, Organizing |
| Entertainment | Reading, TV, Movies, Gaming, Music, Podcast, Social Media, Browsing |
| Self-Care | Journaling, Breathing, Skincare, Haircut, Shopping, Creativity, Learning, Gratitude |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Picker opened | All categories shown, recent section populated (or hidden if first use) |
| Selections Made | 1+ activities tapped | Selected items highlighted, count shown on Done button ("Done (3)") |
| Search Active | User types in search bar | Categories collapse, matching activities shown in flat list |
| No Search Results | Search query has no matches | "No matching activities. Create custom?" with a button to add custom activity |
| Skipped | User taps Skip | No activities saved, returns to mood log flow |

**Interactions:**
- Tap activity button: toggles selection (highlight on/off, checkmark on/off)
- Tap Done: saves selected ActivityTag records, returns to mood log flow
- Tap Skip: skips activity tagging (activities are optional), returns to mood log flow
- Type in search bar: filters activities across all categories by name substring match (case-insensitive)
- Long press activity: shows tooltip with full name and usage count

#### 3.6 Data Requirements

##### Entity: ActivityTag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| entryId | string | Foreign key to MoodEntry.id, required | None | The mood entry this activity belongs to |
| activityId | string | Foreign key to Activity.id, required | None | Reference to the activity definition |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- ActivityTag belongs to MoodEntry (many-to-one via entryId)
- ActivityTag belongs to Activity (many-to-one via activityId)

**Indexes:**
- `entry_id` - Fast lookup of activities for a given mood entry
- `activity_id` - Frequency counting and correlation queries
- `entry_id, activity_id` - Uniqueness constraint

**Validation Rules:**
- `entryId`: must reference an existing MoodEntry
- `activityId`: must reference an existing Activity
- Uniqueness: no duplicate (entryId, activityId) pairs

##### Entity: Activity

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, max 50 chars, unique within category | None | Display name of the activity |
| icon | string | Required, valid emoji | None | Emoji icon for display |
| categoryId | string | Foreign key to ActivityCategory.id, required | None | Category this activity belongs to |
| isDefault | boolean | - | false | Whether this is a bundled default activity |
| isArchived | boolean | - | false | Whether this activity is hidden from the picker |
| sortOrder | integer | Min: 0 | 0 | Position within its category |
| usageCount | integer | Min: 0 | 0 | Cached count of how many times this activity has been tagged |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |
| updatedAt | datetime | ISO 8601, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Activity belongs to ActivityCategory (many-to-one via categoryId)
- Activity has many ActivityTags (one-to-many via activityId)

##### Entity: ActivityCategory

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, max 50 chars, unique | None | Category display name |
| icon | string | Required, valid emoji | None | Category emoji icon |
| isDefault | boolean | - | false | Whether this is a bundled default category |
| sortOrder | integer | Min: 0 | 0 | Position in the category list |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Example Data:**

```json
{
  "id": "d4e5f6a1-b2c3-4567-890a-bcdef1234567",
  "entryId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "activityId": "a1b2c3d4-0001-0000-0000-000000000001",
  "createdAt": "2026-03-06T08:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Activity Usage Count Update

**Purpose:** Keep a cached usage count on each activity for "Recent" section ordering.

**Inputs:**
- activityId: string - the activity that was tagged

**Logic:**

```
1. Increment Activity.usageCount by 1
2. Set Activity.updatedAt to now
```

**Edge Cases:**
- Activity tagged multiple times in the same entry: count increments once per entry, not per tap

##### Recent Activities Ranking

**Purpose:** Determine which activities to show in the "Recent" section.

**Inputs:**
- limit: integer (default 6)

**Logic:**

```
1. Query all ActivityTag records
2. JOIN with Activity
3. ORDER BY ActivityTag.createdAt DESC
4. SELECT DISTINCT activityId (preserving most-recent-first order)
5. TAKE top [limit] results
6. RETURN list of Activity objects
```

**Edge Cases:**
- No activity history: hide "Recent" section
- Fewer than 6 unique activities used: show only those that exist

##### Default Activity Seeding

**Purpose:** Populate the database with default activities and categories on first module enable.

**Logic:**

```
1. IF no ActivityCategory records exist THEN
   a. Insert 8 default categories (Exercise, Work, Social, Rest, Health, Chores, Entertainment, Self-Care)
   b. For each category, insert its default activities (8 per category, 64 total)
   c. Set isDefault = true on all seeded records
2. ELSE skip seeding (user has existing data)
```

**Edge Cases:**
- Module disabled and re-enabled: seeding does not run (data already exists)
- User deletes all categories: seeding does not re-run (check is for zero rows, and deleting categories does not remove activities)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | Toast: "Could not save activities. Please try again." | User taps Done again; selections preserved in memory |
| Referenced activity was deleted | Should never occur (UI only shows existing activities) | If detected, skip the orphaned tag silently |
| Default seeding fails | Activities section is empty; "Add custom activity" prompt shown | User creates custom activities manually |

**Validation Timing:**
- Activity existence validation: at save time (activityId must exist)
- Duplicate pair validation: at save time (upsert behavior)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is logging a mood,
   **When** they open the activity picker and tap "Running" and "Friends",
   **Then** both activities are highlighted with checkmarks, and the Done button shows "Done (2)".

2. **Given** the user selects 3 activities and taps Done,
   **When** the mood entry is saved,
   **Then** all 3 ActivityTag records are persisted and visible on the timeline entry.

3. **Given** the user has tagged "Gym" in their last 5 entries,
   **When** they open the activity picker,
   **Then** "Gym" appears in the "Recent" section.

**Edge Cases:**

4. **Given** the user searches for "yoga" in the activity picker,
   **When** results are shown,
   **Then** only the "Yoga" activity from the Exercise category appears.

5. **Given** the user selects no activities and taps Skip,
   **When** the mood entry is saved,
   **Then** the entry has no ActivityTag records and is still valid.

**Negative Tests:**

6. **Given** the user searches for "xyznotanactivity",
   **When** no results match,
   **Then** the screen shows "No matching activities. Create custom?" with a button.

7. **Given** the database fails during save,
   **When** the user taps Done,
   **Then** the error toast appears and all selections remain in the picker.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| seeds 64 default activities | first module enable | 8 categories, 64 activities in database |
| increments usage count | activityId tagged | usageCount + 1 |
| returns recent activities | 3 distinct activities used | 3 activities in recency order |
| prevents duplicate tag | same (entryId, activityId) twice | only 1 ActivityTag created |
| filters activities by search | query: "run" | returns "Running" |
| case-insensitive search | query: "RUN" | returns "Running" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Tag activities with mood entry | 1. Log mood score 7, 2. Select "Gym" and "Friends", 3. Save | MoodEntry + 2 ActivityTag records in database |
| Delete mood entry cascades activities | 1. Log mood with 3 activities, 2. Delete entry | Entry and all 3 ActivityTag records deleted |
| Recent section updates after logging | 1. Log with "Yoga", 2. Open picker again | "Yoga" appears in Recent section |

---

### MM-004: Mood Notes & Micro-Journal

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-004 |
| **Feature Name** | Mood Notes & Micro-Journal |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to attach a short text note to my mood entry, so that I can capture what is happening in my life at that moment and review the context later.

**Secondary:**
> As a therapy-supported user, I want to write a longer micro-journal entry when I have time, so that I can reflect on my emotions in more depth and share meaningful context with my therapist.

**Tertiary:**
> As a self-awareness seeker, I want to browse past notes alongside mood scores, so that I can identify recurring themes and narratives connected to specific emotional states.

#### 3.3 Detailed Description

Mood Notes & Micro-Journal extends the basic note field from MM-001 into a richer journaling surface. While MM-001 provides a simple 500-character note field for quick context, this feature adds a dedicated micro-journal mode with formatting support, a word counter, and the ability to view and search past journal entries. The micro-journal is accessible from the mood log flow (as an expandable area below the quick note) and also from a dedicated "Journal" section within the mood timeline.

The quick note (up to 500 characters) remains the default. When the user taps "Write more..." below the quick note area, the interface transitions to the micro-journal editor, which supports up to 5,000 characters. The micro-journal editor provides basic text formatting: bold, italic, and bullet lists. Formatting is stored as Markdown syntax in the database for portability.

Past journal entries are searchable via a full-text search interface. Users can filter entries by date range, mood score range, or keyword. The search results show a preview snippet (first 100 characters) alongside the mood score, emotion tags, and timestamp. Tapping a result navigates to the full entry in the timeline.

The micro-journal is entirely optional. Users who prefer quick mood logging can ignore it completely and never see the extended editor unless they tap "Write more..."

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): journal entries attach to MoodEntry records

**External Dependencies:**
- SQLite FTS5 extension for full-text search
- Markdown-to-display renderer (client-side only)

**Assumed Capabilities:**
- MoodEntry table exists and is writable
- Keyboard management for multi-line text editing

#### 3.5 User Interface Requirements

##### Screen: Quick Note (Inline in Mood Log)

**Layout:**
- A collapsible text area below the mood score selector
- Placeholder text: "What's on your mind?"
- Character counter in bottom-right corner: "42 / 500"
- Below the text area, a "Write more..." link styled in the accent color (#FB923C)
- When collapsed, shows as a single-line "Add a note..." prompt

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Collapsed | User has not tapped | Single-line "Add a note..." prompt |
| Expanded Quick | User tapped prompt | Multi-line text area (3 lines visible), 500-char limit, character counter |
| Overflow Warning | 450+ characters typed | Character counter turns orange |
| At Limit | 500 characters reached | Character counter turns red, input stops accepting characters |

##### Screen: Micro-Journal Editor

**Layout:**
- Full-screen editor opened via "Write more..." link
- Top bar: "Micro-Journal" title, Back button (saves draft), Done button
- Below top bar: the mood score and emotion tags displayed as a read-only summary row
- Formatting toolbar: Bold (B), Italic (I), Bullets (list icon), fixed at top of keyboard area
- Main text area: fills remaining screen space, scrollable
- Character counter bottom-right: "1,240 / 5,000"
- Word counter bottom-left: "187 words"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Editor just opened, no content | Placeholder: "Take a moment to reflect..." |
| Has Quick Note | Quick note content exists | Quick note text pre-populated, cursor at end |
| Editing | User is typing | Keyboard visible, formatting toolbar above keyboard |
| Overflow Warning | 4,500+ characters typed | Character counter turns orange |
| At Limit | 5,000 characters reached | Character counter turns red, input stops |
| Draft Saved | User taps Back | Content auto-saved as draft, toast: "Draft saved" |

**Interactions:**
- Tap "Write more...": opens micro-journal editor with any existing quick note content pre-loaded
- Tap formatting button: applies Markdown formatting at cursor position
- Tap Done: saves journal content to MoodEntry, returns to mood log flow
- Tap Back: auto-saves draft, returns to mood log flow
- Swipe down from top: collapses keyboard but stays in editor

##### Screen: Journal Search

**Layout:**
- Search bar at top with magnifying glass icon
- Filter pills below search bar: "All Time", "This Week", "This Month", "Custom Range"
- Score filter: tappable row of colored dots representing scores 1-10, tap to toggle filter
- Results list: each result card shows:
  - Date and time (left-aligned)
  - Mood score with colored circle (right-aligned)
  - Note preview (first 100 characters, truncated with ellipsis)
  - Emotion tag chips (max 3 visible, "+N more" if additional)
- Empty state: "No entries match your search" with search tips

**Interactions:**
- Type in search bar: results filter in real-time after 300ms debounce
- Tap filter pill: applies date range filter
- Tap score dot: toggles that score in/out of filter
- Tap result card: navigates to full entry in timeline
- Pull to refresh: re-runs search query

#### 3.6 Data Requirements

##### Entity: MoodEntry (Extended Fields)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| journalContent | string or null | Max 5,000 chars | null | Extended micro-journal text in Markdown format |
| journalWordCount | integer or null | Min 0 | null | Computed word count for display and stats |
| hasDraft | boolean | Required | false | Whether unsaved draft content exists |
| draftContent | string or null | Max 5,000 chars | null | Auto-saved draft content before explicit save |

**Note:** These fields extend the MoodEntry entity defined in MM-001. They are nullable columns added to the existing `mo_entries` table.

##### FTS Virtual Table: mo_entries_fts

| Column | Source | Description |
|--------|--------|-------------|
| rowid | mo_entries.rowid | Links back to the main entry |
| note | mo_entries.note | Quick note text |
| journalContent | mo_entries.journalContent | Extended micro-journal text |

**FTS Configuration:**
- Tokenizer: unicode61
- Content table: mo_entries (content-sync mode)
- Triggers: INSERT, UPDATE, DELETE on mo_entries auto-sync FTS index

**Indexes:**
- FTS5 implicit index on note + journalContent

**Validation Rules:**
- `journalContent`: if provided, must not exceed 5,000 characters
- `journalWordCount`: auto-computed, must match actual word count of journalContent
- `draftContent`: cleared to null when journalContent is explicitly saved
- Markdown content: only bold (**), italic (*), and unordered lists (-) are supported markers

**Example Data:**

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "score": 4,
  "note": "Tough day at work.",
  "journalContent": "Had a difficult conversation with my manager about the project timeline. I felt **unprepared** and could not articulate my concerns clearly.\n\n- Need to prepare better for 1:1s\n- Should write down talking points before meetings\n- The anxiety before the meeting was worse than the meeting itself",
  "journalWordCount": 47,
  "hasDraft": false,
  "draftContent": null,
  "loggedAt": "2026-03-06T17:30:00Z",
  "date": "2026-03-06",
  "createdAt": "2026-03-06T17:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Word Count Calculation

**Purpose:** Compute the word count for a journal entry, displayed in the editor and used for stats.

**Inputs:**
- text: string - the journal content (Markdown)

**Logic:**

```
1. Strip Markdown formatting characters (**, *, -)
2. Split text by whitespace (spaces, tabs, newlines)
3. Filter out empty strings from the split result
4. RETURN count of remaining tokens
```

**Edge Cases:**
- Empty string: returns 0
- Only whitespace: returns 0
- Only Markdown formatting characters: returns 0
- Hyphenated words (e.g., "well-being"): counted as 1 word
- Numbers: counted as words
- Emoji-only content: each emoji counted as 1 word

##### Full-Text Search

**Purpose:** Search across all note and journal content to find matching entries.

**Inputs:**
- query: string - the search text
- dateRange: optional {start: string, end: string} - YYYY-MM-DD bounds
- scoreFilter: optional integer[] - list of scores to include

**Logic:**

```
1. Sanitize the query: escape FTS special characters (AND, OR, NOT, *)
2. Build FTS5 MATCH query from sanitized input
3. IF dateRange provided THEN add WHERE date BETWEEN start AND end
4. IF scoreFilter provided THEN add WHERE score IN (scoreFilter)
5. Execute query with ORDER BY rank (FTS relevance), then by loggedAt DESC
6. FOR each result:
   a. Extract snippet (first 100 chars of matching field)
   b. Highlight matched terms in snippet
   c. Include mood score, emotion tags, date
7. RETURN list of {entryId, snippet, score, emotionTags, loggedAt, matchField}
```

**Edge Cases:**
- Empty query: return all entries ordered by loggedAt DESC (no FTS filtering)
- Query with only special characters: treat as empty query
- No results: return empty list
- Very long query (100+ chars): truncate to first 100 characters before searching

##### Draft Auto-Save

**Purpose:** Preserve unsaved journal content when the user navigates away.

**Inputs:**
- entryId: string - the mood entry being edited
- draftText: string - current editor content

**Logic:**

```
1. IF draftText is empty THEN clear hasDraft and draftContent, RETURN
2. IF draftText equals the saved journalContent THEN no draft needed, RETURN
3. SET draftContent = draftText
4. SET hasDraft = true
5. Persist to database
6. Auto-save triggers every 10 seconds while the user is typing
7. Auto-save also triggers on navigate-away (Back button, app background)
```

**Edge Cases:**
- App crashes during typing: last auto-save is preserved (at most 10 seconds of content lost)
- User deletes all content and leaves: draft cleared, hasDraft set to false
- Draft exists but user opens editor and saves without changes: draft cleared

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails when saving journal | Toast: "Could not save journal. Your draft has been preserved." | Draft auto-save retains content; user can retry |
| FTS index corrupted | Search returns no results, fallback to LIKE query | Background task rebuilds FTS index on next app launch |
| Draft content exceeds 5,000 chars (data corruption) | Content truncated to 5,000 chars silently | Log warning, truncated content saved |
| Markdown rendering fails | Display raw Markdown text | User sees unformatted text but content is preserved |

**Validation Timing:**
- Character limit: enforced at input time (keyboard stops accepting characters)
- Word count: computed on every keystroke, debounced by 500ms
- FTS sync: triggered by database triggers, no user-facing validation

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is logging a mood entry,
   **When** they tap "Add a note..." and type "Feeling great after lunch",
   **Then** the text appears in the note field with character counter "24 / 500".

2. **Given** the user has typed a quick note,
   **When** they tap "Write more...",
   **Then** the micro-journal editor opens with the quick note text pre-loaded and cursor at the end.

3. **Given** the user types 200 words in the micro-journal editor and taps Done,
   **When** the entry is saved,
   **Then** the journalContent field contains the Markdown text, journalWordCount is 200, and hasDraft is false.

4. **Given** the user has 50 entries with notes,
   **When** they search for "work meeting" in the journal search screen,
   **Then** all entries containing "work" or "meeting" in note or journalContent are shown with highlighted snippets.

**Edge Cases:**

5. **Given** the user is typing in the micro-journal editor,
   **When** they navigate away with the Back button,
   **Then** the content is auto-saved as a draft and a "Draft saved" toast appears.

6. **Given** the user returns to an entry with a saved draft,
   **When** they open the micro-journal editor,
   **Then** the draft content is loaded (not the last saved journalContent) with a banner: "You have an unsaved draft."

7. **Given** the user applies bold formatting to "important",
   **When** they view the entry in the timeline,
   **Then** the word "important" is rendered in bold.

**Negative Tests:**

8. **Given** the user has typed exactly 5,000 characters,
   **When** they try to type one more character,
   **Then** the character is not accepted and the counter shows "5,000 / 5,000" in red.

9. **Given** the FTS index is empty,
   **When** the user searches for any term,
   **Then** the search returns no results and shows "No entries match your search."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates word count for plain text | "Hello world today" | 3 |
| calculates word count with Markdown | "**Bold** and *italic*" | 3 |
| word count for empty string | "" | 0 |
| word count for whitespace only | "   \n\t  " | 0 |
| word count for hyphenated words | "well-being is important" | 3 |
| enforces 5000 char limit | 5001-char string | truncated to 5000 |
| sanitizes FTS query | "test AND OR" | escaped special operators |
| builds date range filter | {start: "2026-01-01", end: "2026-01-31"} | WHERE date BETWEEN clause |
| draft auto-save detects changes | original != draft | hasDraft = true |
| draft auto-save skips unchanged | original == draft | hasDraft = false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Save journal with mood entry | 1. Log mood score 6, 2. Write 100-word journal, 3. Save | MoodEntry has journalContent, journalWordCount = 100 |
| FTS search finds note content | 1. Log mood with note "beach day", 2. Search "beach" | Entry appears in search results with highlighted snippet |
| FTS search finds journal content | 1. Log mood with journal mentioning "meditation", 2. Search "meditation" | Entry appears in results |
| Draft preserved on navigate away | 1. Open editor, 2. Type 50 words, 3. Tap Back | Draft saved, re-opening shows draft with banner |
| Draft cleared on explicit save | 1. Have draft, 2. Open editor, 3. Tap Done | hasDraft = false, draftContent = null |
| Delete entry removes FTS record | 1. Log mood with note, 2. Delete entry, 3. Search for note text | No results found |

---

### MM-005: Daily Mood Timeline

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-005 |
| **Feature Name** | Daily Mood Timeline |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to see all my mood entries for today arranged on a vertical timeline, so that I can observe how my emotional state changed throughout the day.

**Secondary:**
> As a therapy-supported user, I want to swipe between days to review my mood history, so that I can prepare for therapy sessions by reviewing the past week.

**Tertiary:**
> As a self-awareness seeker, I want to see the daily average score and emotion distribution at a glance, so that I can quickly assess whether a day was generally positive or negative.

#### 3.3 Detailed Description

The Daily Mood Timeline is the primary history view in MyMood. It displays all mood entries for a selected day in chronological order, from earliest to latest, on a vertical timeline. Each entry is rendered as a card connected to a vertical line, with the time displayed on the left and the entry content on the right.

Each timeline card shows the mood score (as a colored circle with the number), the emotion tags (as small chips), the first line of any note (truncated with ellipsis), and activity tags (as icons). Tapping a card expands it to show the full note, full emotion list, full activity list, and a timestamp.

The top of the screen shows a date header with left/right arrows for day navigation, plus a "Today" shortcut button. Below the date header is a summary bar showing: the number of entries logged that day, the daily average mood score (rounded to one decimal), and a small sparkline of scores for that day.

Users can swipe left/right to navigate between days. Days with no entries show an encouraging empty state: "No entries for [Day]. Tap + to log your mood."

A floating action button (FAB) with a "+" icon is always visible in the bottom-right corner, providing quick access to the mood logging flow (MM-001).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): entries to display
- MM-002 (Emotion Wheel): emotion tags on timeline cards
- MM-003 (Activity Tagging): activity tags on timeline cards

**External Dependencies:**
- Date/time formatting library for locale-aware display
- Gesture handler for swipe navigation between days

**Assumed Capabilities:**
- MoodEntry, EmotionTag, and ActivityTag tables populated

#### 3.5 User Interface Requirements

##### Screen: Daily Timeline

**Layout:**
- Date header bar: left arrow | "Thursday, Mar 6" | right arrow | "Today" pill button
- Summary bar below date header:
  - Left: entry count ("4 entries")
  - Center: daily average score in colored circle ("6.8")
  - Right: mini sparkline of scores plotted across the day (width: 80px, height: 24px)
- Vertical timeline line: 2px wide, color matches the daily average score color
- Timeline cards arranged vertically with time labels on the left side of the line
- Each card:
  - Time label: "8:15 AM" (12h or 24h based on device settings)
  - Score circle: 36x36px, colored per score table, number inside
  - Note preview: first line of note, max 60 characters, truncated with "..."
  - Emotion chips: up to 3 visible, "+N" for overflow
  - Activity icons: up to 4 visible, "+N" for overflow
  - Journal indicator: small notebook icon if journalContent exists
- FAB: 56x56px, bottom-right, accent color (#FB923C), "+" icon

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Today with Entries | Current date, entries exist | Full timeline with summary bar |
| Today Empty | Current date, no entries | Empty state: "How are you feeling today?" with Log button |
| Past Day with Entries | Past date, entries exist | Full timeline with summary bar, no FAB |
| Past Day Empty | Past date, no entries | Empty state: "No entries for [Day]." |
| Future Day | Date is in the future | Empty state: "Future dates cannot have entries" with Today button |
| Loading | Fetching entries | Skeleton placeholders for 3 cards |

**Interactions:**
- Tap left arrow: navigate to previous day
- Tap right arrow: navigate to next day
- Swipe left on timeline: navigate to next day
- Swipe right on timeline: navigate to previous day
- Tap "Today" pill: jump to current date
- Tap timeline card: expand card to show full details
- Tap expanded card: collapse back to preview
- Long press timeline card: show context menu (Delete)
- Tap FAB: open mood logging flow (MM-001)
- Pull down: refresh entries for current day

**Transitions/Animations:**
- Day navigation: horizontal slide transition (250ms)
- Card expand/collapse: height animation with content fade (200ms)
- FAB entrance: scale up from 0 with bounce (300ms, on first load only)
- Sparkline draws left-to-right on day load (400ms)
- New entry added: card slides in from bottom with fade (300ms)

#### 3.6 Data Requirements

##### Queries

**Daily Entries Query:**

```
SELECT e.*,
  GROUP_CONCAT(DISTINCT et.emotionName) as emotions,
  GROUP_CONCAT(DISTINCT at.activityName) as activities
FROM mo_entries e
LEFT JOIN mo_emotion_tags et ON et.entryId = e.id
LEFT JOIN mo_activity_tags at ON at.entryId = e.id
WHERE e.date = :selectedDate
GROUP BY e.id
ORDER BY e.loggedAt ASC
```

**Daily Summary Query:**

```
SELECT
  COUNT(*) as entryCount,
  ROUND(AVG(score), 1) as avgScore,
  MIN(score) as minScore,
  MAX(score) as maxScore
FROM mo_entries
WHERE date = :selectedDate
```

No new entities are introduced by this feature. It reads from MoodEntry, EmotionTag, ActivityTag, and (optionally) the journal fields from MM-004.

**Indexes Used:**
- `mo_entries(date, loggedAt)` composite index for sorted daily listing
- `mo_emotion_tags(entryId)` for emotion tag joins
- `mo_activity_tags(entryId)` for activity tag joins

#### 3.7 Business Logic Rules

##### Daily Average Computation

**Purpose:** Compute the average mood score for a given day, used in the summary bar and sparkline.

**Inputs:**
- date: string (YYYY-MM-DD)

**Logic:**

```
1. Query all MoodEntry records WHERE date = input
2. IF no entries THEN RETURN null
3. Sum all score values
4. Divide by count
5. Round to 1 decimal place
6. RETURN { avgScore, entryCount, minScore, maxScore }
```

**Edge Cases:**
- Single entry: average equals that entry's score
- No entries: return null (not 0)

##### Sparkline Data Generation

**Purpose:** Generate data points for the mini sparkline graph showing mood variation within a day.

**Inputs:**
- entries: list of MoodEntry records for a single day, sorted by loggedAt

**Logic:**

```
1. IF entries count < 2 THEN RETURN null (sparkline needs at least 2 points)
2. FOR each entry:
   a. Compute x-position as fraction of day elapsed: (loggedAt hour * 60 + loggedAt minute) / 1440
   b. Compute y-position as normalized score: (score - 1) / 9 (maps 1-10 to 0.0-1.0)
3. RETURN list of {x, y} points
```

**Edge Cases:**
- All entries at the same time: sparkline shows a single point (no line)
- All entries with the same score: sparkline shows a flat horizontal line
- Single entry: sparkline not rendered, show score circle only

##### Day Navigation Bounds

**Purpose:** Determine which days the user can navigate to.

**Logic:**

```
1. Earliest navigable date: the date of the user's first-ever MoodEntry, or 30 days before today if no entries exist
2. Latest navigable date: today (cannot navigate to future)
3. Left arrow disabled when at earliest date
4. Right arrow disabled when at today
5. "Today" pill hidden when already viewing today
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database query fails | Toast: "Could not load entries." | Pull to refresh retries the query |
| Entry deletion fails | Toast: "Could not delete entry. Please try again." | Entry remains visible, user can retry |
| Date parsing error | Fallback to today's date | Log warning |
| Corrupted entry (missing required fields) | Skip entry, do not show on timeline | Log warning, entry excluded from average |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged 3 mood entries today (scores 4, 7, 8),
   **When** they open the timeline,
   **Then** they see 3 cards in chronological order, summary shows "3 entries" and average "6.3".

2. **Given** the user swipes left on today's timeline,
   **When** yesterday has 2 entries,
   **Then** the screen slides to show yesterday's date header and 2 timeline cards.

3. **Given** the user taps a timeline card,
   **When** the card has a note, 2 emotions, and 3 activities,
   **Then** the card expands to show the full note, all emotions as chips, and all activity names.

**Edge Cases:**

4. **Given** today has no mood entries,
   **When** the user views the timeline,
   **Then** the empty state shows "How are you feeling today?" with a prominent Log button.

5. **Given** the user is viewing the earliest entry date,
   **When** they try to swipe right,
   **Then** the left arrow is disabled and the swipe bounces back.

6. **Given** a day has only 1 entry,
   **When** the summary bar renders,
   **Then** the sparkline is not shown (only score circle), and the average equals the single score.

**Negative Tests:**

7. **Given** the user long-presses a timeline card and selects Delete,
   **When** the deletion is confirmed,
   **Then** the card is removed from the timeline and the daily average recalculates.

8. **Given** an entry has corrupted data (null score),
   **When** the timeline loads,
   **Then** the corrupted entry is skipped and the remaining entries display correctly.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes daily average | scores [4, 7, 8] | 6.3 |
| daily average with single entry | scores [5] | 5.0 |
| daily average with no entries | scores [] | null |
| generates sparkline points | 3 entries at 8am, noon, 6pm | 3 {x,y} points with correct fractions |
| sparkline with single entry | 1 entry | null |
| day navigation lower bound | first entry on 2026-01-15 | left arrow disabled on 2026-01-15 |
| day navigation upper bound | today is 2026-03-06 | right arrow disabled on 2026-03-06 |
| truncates note preview | 80-char note | 60 chars + "..." |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Timeline shows new entry | 1. Log mood score 7, 2. View timeline | New card appears at correct time position |
| Delete entry updates average | 1. Log 3 entries (4, 7, 8), 2. Delete score-8 entry | Average recalculates to 5.5, 2 entries shown |
| Day navigation loads data | 1. Log entries on 3 different days, 2. Swipe between days | Each day shows correct entries and average |
| Empty day shows empty state | 1. Navigate to day with no entries | Empty state displayed with Log button |

---

### MM-006: Mood Trends & Charts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-006 |
| **Feature Name** | Mood Trends & Charts |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to see my mood trends over the past week, month, and quarter as a line chart, so that I can identify upward or downward patterns in my emotional wellbeing.

**Secondary:**
> As a wellness optimizer, I want to see moving averages overlaid on my daily scores, so that I can distinguish between normal day-to-day variation and genuine trend shifts.

**Tertiary:**
> As a therapy-supported user, I want to see my emotion distribution over a time period as a pie or bar chart, so that I can discuss dominant emotional patterns with my therapist.

#### 3.3 Detailed Description

Mood Trends & Charts provides visual analytics for mood data over time. The feature includes three chart types: a line chart for mood score trends, a bar chart for emotion family distribution, and a heatmap for day-of-week and time-of-day patterns.

The primary view is the Trend Line chart, which plots daily average mood scores over a selected time range. Three moving average lines are optionally overlaid:
- 7-day moving average (MA(7)): short-term trend
- 30-day moving average (MA(30)): monthly trend
- 90-day moving average (MA(90)): quarterly trend

The moving average formula for MA(n) at day d is:

```
MA(n, d) = (1/n) * SUM(avgScore(d-i)) for i = 0 to n-1
```

Where avgScore(d) is the daily average score for day d. Days with no entries are excluded from the sum and the divisor is adjusted to count only days with data.

The Emotion Distribution chart shows a donut chart (or horizontal bar chart, user-togglable) of the 8 Plutchik emotion families over the selected time period. Each family is colored distinctly. Composite emotions contribute fractionally to their constituent families (e.g., "love" adds 0.5 to joy and 0.5 to trust).

The Heatmap shows a 7-column (days of week) by 4-row (6-hour time blocks: morning 6-12, afternoon 12-18, evening 18-24, night 0-6) grid. Each cell is colored by the average mood score for entries logged during that day-of-week and time-of-day combination. This helps users identify when they tend to feel best and worst.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood score data
- MM-002 (Emotion Wheel): emotion tag data for distribution chart

**External Dependencies:**
- Chart rendering library (platform-native or cross-platform)
- Date/time utilities for week and month boundaries

**Assumed Capabilities:**
- Sufficient mood data for meaningful visualization (minimum 7 entries for trends, 14 for moving averages)

#### 3.5 User Interface Requirements

##### Screen: Trends

**Layout:**
- Top: "Trends" title with time range selector pills: "1W", "1M", "3M", "6M", "1Y", "All"
- Chart area: 85% of screen width, aspect ratio 16:9
- Below chart: chart type selector tabs: "Trend Line", "Emotions", "Heatmap"
- Below tabs: summary statistics row

**Trend Line Chart:**
- X-axis: dates (auto-formatted: days for 1W, weeks for 1M, months for 3M+)
- Y-axis: mood score 1-10
- Daily average plotted as dots connected by lines
- Moving average lines toggleable via legend: MA(7) blue dashed, MA(30) green dashed, MA(90) purple dashed
- Tap on data point: tooltip shows date, average score, entry count
- Pinch to zoom: horizontal zoom to focus on a date range

**Emotion Distribution Chart:**
- Donut chart with 8 segments, one per Plutchik primary emotion family
- Center of donut shows total emotion tag count
- Legend below chart with emotion name, color, percentage, count
- Toggle between donut and horizontal bar chart via icon button

**Heatmap:**
- 7 columns (Mon-Sun) by 4 rows (Morning, Afternoon, Evening, Night)
- Each cell colored on a gradient from red (low avg) through yellow (mid) to green (high avg)
- Cell label shows average score rounded to 1 decimal, or "--" if fewer than 2 data points
- Tap cell: shows tooltip with exact average, entry count, and most common emotion

**Summary Statistics Row (below chart):**

| Statistic | Description |
|-----------|-------------|
| Overall Average | Average of all daily averages in the selected period |
| Trend Direction | "Improving", "Stable", or "Declining" based on MA(7) slope |
| Best Day | Day of week with the highest average score |
| Worst Day | Day of week with the lowest average score |
| Entries | Total number of mood entries in the period |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Sufficient Data | 7+ entries in period | Full chart with data |
| Insufficient Data | Fewer than 7 entries | Chart area shows: "Log at least 7 moods to see trends" with progress bar |
| No Data | Zero entries in period | Empty state: "No mood data for this period" |
| Loading | Computing aggregates | Skeleton chart placeholder |
| MA Insufficient | Fewer than n entries for MA(n) | MA line not shown, legend item grayed out with "Need n+ days" |

**Interactions:**
- Tap time range pill: reloads chart with new date range
- Tap chart type tab: switches chart type with cross-fade animation
- Tap MA legend item: toggles that moving average line on/off
- Tap data point: shows tooltip
- Pinch/zoom trend line: horizontal zoom
- Tap heatmap cell: shows tooltip
- Tap summary stat: no action (informational only)

**Transitions/Animations:**
- Chart data transition: line morphs smoothly when time range changes (500ms)
- Tab switch: cross-fade (250ms)
- Data point tooltip: fade in (150ms)

#### 3.6 Data Requirements

##### Aggregated Views (Computed, Not Stored)

**Daily Aggregation:**

| Field | Type | Description |
|-------|------|-------------|
| date | string | YYYY-MM-DD |
| avgScore | float | Average score for the day, rounded to 2 decimals |
| entryCount | integer | Number of entries logged |
| minScore | integer | Lowest score of the day |
| maxScore | integer | Highest score of the day |

**Moving Average Data:**

| Field | Type | Description |
|-------|------|-------------|
| date | string | YYYY-MM-DD |
| ma7 | float or null | 7-day moving average at this date |
| ma30 | float or null | 30-day moving average at this date |
| ma90 | float or null | 90-day moving average at this date |

**Emotion Distribution:**

| Field | Type | Description |
|-------|------|-------------|
| emotionFamily | enum | One of 8 Plutchik primary families |
| count | float | Count of tags, with composites contributing 0.5 each |
| percentage | float | Percentage of total emotion tags |

**Heatmap Cell:**

| Field | Type | Description |
|-------|------|-------------|
| dayOfWeek | integer | 0 (Monday) through 6 (Sunday) |
| timeBlock | enum | morning, afternoon, evening, night |
| avgScore | float or null | Average score, null if fewer than 2 data points |
| entryCount | integer | Number of entries in this cell |

No new database tables required. All data is computed from existing MoodEntry and EmotionTag records.

#### 3.7 Business Logic Rules

##### Moving Average Computation

**Purpose:** Compute rolling moving averages to smooth daily score variations and reveal trends.

**Inputs:**
- dailyAverages: list of {date, avgScore} sorted by date ascending
- window: integer (7, 30, or 90)

**Logic:**

```
1. FOR each day d in the date range:
   a. Collect avgScore values for the window [d - (window-1)...d]
   b. Exclude days with no data (null avgScore)
   c. IF fewer than ceil(window * 0.5) days have data THEN MA = null for this day
   d. ELSE MA = sum of available avgScores / count of available avgScores
2. RETURN list of {date, ma} pairs
```

The formula, restated: MA(n) at day d = (1/k) * SUM(avgScore(d_i)) for i in [d-(n-1)...d] where d_i has data, and k is the count of days with data. The MA is null if k < ceil(n * 0.5).

**Edge Cases:**
- First 6 days of data: MA(7) is null for these days
- Gaps in data (e.g., user skipped 5 days): excluded from sum and count
- Window has zero data days: MA is null

##### Trend Direction Classification

**Purpose:** Classify whether the user's mood is improving, stable, or declining.

**Inputs:**
- ma7Values: list of 7-day MA values for the last 14 days (or fewer if insufficient data)

**Logic:**

```
1. IF fewer than 7 non-null MA(7) values exist THEN RETURN "Insufficient data"
2. Compute the slope of the MA(7) line using linear regression (least squares fit)
3. IF slope > 0.1 THEN RETURN "Improving"
4. IF slope < -0.1 THEN RETURN "Declining"
5. ELSE RETURN "Stable"
```

**Edge Cases:**
- Perfectly flat MA(7): "Stable"
- Slope of exactly 0.1: "Stable" (threshold is exclusive)
- Fewer than 7 MA(7) values: do not classify, show "Not enough data yet"

##### Emotion Distribution with Composite Weighting

**Purpose:** Compute emotion family distribution for the donut/bar chart.

**Inputs:**
- emotionTags: list of EmotionTag records in the date range

**Logic:**

```
1. Initialize counts for all 8 primary families to 0
2. FOR each emotionTag:
   a. IF intensityLevel != "composite":
      i. Increment counts[emotionFamily] by 1
   b. IF intensityLevel == "composite":
      i. Look up the two constituent families
      ii. Increment counts[family1] by 0.5
      iii. Increment counts[family2] by 0.5
3. Compute total = sum of all counts
4. FOR each family:
   a. percentage = (count / total) * 100, rounded to 1 decimal
5. RETURN list sorted by count DESC
```

**Edge Cases:**
- No emotion tags in period: show empty state for emotion chart
- Only composite emotions: each family gets 0.5-weight contributions
- Single emotion family dominates (90%+): chart still shows all 8 families

##### Heatmap Cell Computation

**Purpose:** Compute average mood scores bucketed by day-of-week and time-of-day.

**Inputs:**
- entries: list of MoodEntry records in the date range

**Logic:**

```
1. Define time blocks:
   - morning: 06:00 to 11:59
   - afternoon: 12:00 to 17:59
   - evening: 18:00 to 23:59
   - night: 00:00 to 05:59
2. FOR each entry:
   a. Extract dayOfWeek from loggedAt (0 = Monday, 6 = Sunday)
   b. Extract hour from loggedAt
   c. Determine timeBlock from hour
   d. Add score to bucket[dayOfWeek][timeBlock]
3. FOR each cell:
   a. IF entryCount < 2 THEN avgScore = null
   b. ELSE avgScore = sum / count, rounded to 1 decimal
4. RETURN 7x4 matrix of cells
```

**Edge Cases:**
- Entry at exactly midnight (00:00): classified as "night"
- Entry at exactly noon (12:00): classified as "afternoon"
- Cell with 1 entry: shows "--" (minimum 2 needed for meaningful average)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Chart rendering fails | Fallback to text-based summary statistics | Log error, show "Chart unavailable" with stats below |
| Moving average computation timeout | Show raw data points without MA lines | Reduce date range or skip MA |
| Insufficient data for selected range | Show "Not enough data" with guidance | Suggest a wider time range pill |
| Memory pressure from large dataset | Downsample data points (max 365) | Aggregate to weekly averages if >365 data points |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged moods daily for the past 30 days,
   **When** they tap "1M" on the Trends screen,
   **Then** a line chart shows 30 data points with MA(7) and MA(30) lines overlaid.

2. **Given** the user has tagged emotions on 50 entries,
   **When** they view the Emotion Distribution chart for "All" time,
   **Then** a donut chart shows all 8 families with correct percentages.

3. **Given** the user views the heatmap,
   **When** they tap the cell for "Tuesday afternoon",
   **Then** a tooltip shows the average score, entry count, and most common emotion for Tuesday afternoons.

**Edge Cases:**

4. **Given** the user has only 3 mood entries,
   **When** they open the Trends screen,
   **Then** the chart shows "Log at least 7 moods to see trends" with a progress bar showing 3/7.

5. **Given** the user has entries spanning 2 years,
   **When** they select "All" time range,
   **Then** the x-axis auto-formats to monthly labels and data is downsampled if exceeding 365 points.

6. **Given** a heatmap cell has only 1 data point,
   **When** the heatmap renders,
   **Then** that cell shows "--" instead of the single score.

**Negative Tests:**

7. **Given** the user has zero emotion tags in the selected period,
   **When** they switch to the Emotion Distribution tab,
   **Then** the chart shows an empty state: "No emotions tagged in this period."

8. **Given** the chart rendering library crashes,
   **When** the Trends screen loads,
   **Then** a text-based fallback shows the summary statistics without a chart.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes MA(7) basic | 7 days of data [5,6,7,6,5,8,7] | MA(7) = 6.29 |
| computes MA(7) with gaps | days 1,2,3,5,6,7 (day 4 missing) | MA(7) at day 7 uses 6 data points |
| MA null when insufficient data | 3 days of data for MA(7) | MA(7) = null (need at least 4) |
| classifies improving trend | MA(7) slope = 0.2 | "Improving" |
| classifies stable trend | MA(7) slope = 0.05 | "Stable" |
| classifies declining trend | MA(7) slope = -0.3 | "Declining" |
| composite emotion weighting | "love" tag | joy += 0.5, trust += 0.5 |
| heatmap time block assignment | entry at 14:30 | "afternoon" block |
| heatmap midnight classification | entry at 00:00 | "night" block |
| heatmap cell with 1 entry | single entry in cell | avgScore = null |
| downsamples large dataset | 500 data points | reduced to 365 |
| emotion distribution percentages | 10 joy, 5 sadness, 5 anger | joy=50%, sadness=25%, anger=25% |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Trend line renders with real data | 1. Log 14 entries over 14 days, 2. Open Trends, select 1M | Line chart with 14 data points and MA(7) line |
| Time range filter applies | 1. Have 90 days data, 2. Select 1W | Only last 7 days shown |
| Emotion chart updates with range | 1. Have emotions over 60 days, 2. Switch between 1M and 3M | Donut chart recalculates percentages |
| Heatmap populated correctly | 1. Log entries at various times/days, 2. View heatmap | Cells reflect correct averages per bucket |

---

### MM-007: Streak Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-007 |
| **Feature Name** | Streak Tracking |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to see how many consecutive days I have logged at least one mood entry, so that I feel motivated to maintain a daily logging habit.

**Secondary:**
> As a habit-focused user, I want to see my longest-ever streak and know when I achieved it, so that I can try to beat my personal record.

**Tertiary:**
> As a returning user who broke their streak, I want encouraging messaging instead of shame, so that I feel motivated to start logging again rather than giving up.

#### 3.3 Detailed Description

Streak Tracking monitors consecutive days of mood logging and provides motivational feedback. A "streak day" is any calendar day (midnight to midnight in the user's local timezone) during which the user logged at least one mood entry. The streak counter displays prominently on the hub dashboard card and within the mood module's home screen.

The system tracks three streak values:
1. **Current streak:** The number of consecutive days ending today (or yesterday if today has no entry yet) with at least one mood entry
2. **Longest streak:** The all-time maximum consecutive day count with the start and end dates
3. **Total active days:** The cumulative count of days with at least one entry (not necessarily consecutive)

Milestone celebrations trigger at streak thresholds: 3, 7, 14, 30, 60, 90, 180, and 365 days. Each milestone shows a brief celebration animation and an encouraging message. After the celebration, the milestone is recorded and not shown again.

If the user breaks their streak, the next time they open MyMood, they see a warm "Welcome back" message with their total active days (positive framing) rather than "Streak lost" (negative framing). The broken streak date is recorded for historical tracking.

Streak computation runs on app open and after each mood entry. It is a read-only computation from the MoodEntry dates (not a separate counter), so it is always accurate even if past entries are deleted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood entries provide the streak data

**External Dependencies:**
- Device timezone access for day boundary calculation
- Animation framework for milestone celebrations

**Assumed Capabilities:**
- MoodEntry table with date column populated
- User's local timezone available from the device

#### 3.5 User Interface Requirements

##### Component: Streak Display (Inline)

**Layout:**
- A compact horizontal bar shown on the mood home screen below the date header
- Left: flame icon (animated when streak > 0)
- Center: "[N] day streak" text in bold
- Right: trophy icon with longest streak count in smaller text
- Below the bar: progress indicator showing distance to next milestone

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active Streak | Current streak >= 1, today has entry | Flame icon animated, count shown, progress bar filling |
| Pending Today | Streak >= 1, today has no entry yet | Flame icon static, "Log today to keep your streak!" subtext |
| No Streak | Last entry was 2+ days ago | "Start a new streak today!" with grayed-out flame |
| First Entry | User has never logged | "Log your first mood to start a streak!" |
| Milestone Hit | Streak just reached a threshold | Celebration overlay (see below) |

##### Overlay: Milestone Celebration

**Layout:**
- Full-screen semi-transparent overlay
- Center: large animated emoji (confetti, star, trophy depending on milestone)
- Below emoji: milestone message (e.g., "7 Day Streak!")
- Below message: encouraging subtext (e.g., "A whole week of checking in with yourself. Keep it up!")
- Dismiss button: "Continue" at the bottom
- Auto-dismiss after 5 seconds if user does not interact

**Milestone Messages:**

| Threshold | Emoji | Message | Subtext |
|-----------|-------|---------|---------|
| 3 days | Fire | "3 Day Streak!" | "You're building a habit. Three days strong!" |
| 7 days | Star | "1 Week Streak!" | "A full week of self-awareness. Impressive!" |
| 14 days | Sparkles | "2 Week Streak!" | "Two weeks of showing up for yourself." |
| 30 days | Trophy | "30 Day Streak!" | "A full month! This is becoming second nature." |
| 60 days | Medal | "60 Day Streak!" | "Two months strong. You know yourself better than ever." |
| 90 days | Crown | "90 Day Streak!" | "A quarter year of emotional awareness. Remarkable." |
| 180 days | Diamond | "180 Day Streak!" | "Half a year. Your dedication is extraordinary." |
| 365 days | Globe | "365 Day Streak!" | "One full year of daily mood tracking. Legendary." |

**Interactions:**
- Tap "Continue" or tap outside overlay: dismisses celebration
- Auto-dismiss after 5 seconds

**Transitions/Animations:**
- Celebration overlay fades in (300ms) with emoji scale-up bounce
- Confetti particles animate for milestones >= 30 days
- Flame icon flickers continuously when streak is active (CSS animation or Lottie)
- Progress bar fills with animated gradient

#### 3.6 Data Requirements

##### Entity: StreakMilestone

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| threshold | integer | Required, one of [3, 7, 14, 30, 60, 90, 180, 365] | None | The streak day count that was reached |
| achievedAt | datetime | ISO 8601 | Current timestamp | When the milestone was first achieved |
| shown | boolean | Required | false | Whether the celebration has been displayed |

**Note:** Current streak and longest streak are computed values, not stored. They are derived from MoodEntry date data at runtime.

**Indexes:**
- `threshold` - Quick lookup to check if a milestone has been achieved

**Validation Rules:**
- `threshold`: must be one of the valid milestone values
- `achievedAt`: must not be in the future
- Uniqueness: only one record per threshold value

#### 3.7 Business Logic Rules

##### Current Streak Computation

**Purpose:** Calculate the number of consecutive days with at least one mood entry, ending at today or yesterday.

**Inputs:**
- today: string (YYYY-MM-DD) in user's local timezone
- entryDates: list of distinct dates with mood entries, sorted descending

**Logic:**

```
1. IF entryDates is empty THEN RETURN { current: 0, pending: false }
2. SET streak = 0
3. SET checkDate = today
4. IF entryDates[0] == today:
   a. streak = 1
   b. checkDate = today - 1 day
   c. SET pending = false
5. ELSE IF entryDates[0] == today - 1 day:
   a. streak = 1
   b. checkDate = today - 2 days
   c. SET pending = true   // today not yet logged
6. ELSE:
   a. RETURN { current: 0, pending: false }  // streak broken
7. WHILE checkDate is in entryDates:
   a. streak += 1
   b. checkDate -= 1 day
8. RETURN { current: streak, pending: pending }
```

**Edge Cases:**
- User logged at 11:59 PM: counts for that calendar day
- User is in timezone UTC-12 and logs at midnight server time: uses device local day
- User deletes yesterday's entry: streak recomputes and may break
- User logs 3 entries in one day: counts as 1 streak day

##### Longest Streak Computation

**Purpose:** Find the maximum consecutive-day streak in the user's history.

**Inputs:**
- entryDates: list of distinct dates with mood entries, sorted ascending

**Logic:**

```
1. IF entryDates is empty THEN RETURN { longest: 0, startDate: null, endDate: null }
2. SET maxStreak = 1, currentRun = 1
3. SET maxStart = entryDates[0], maxEnd = entryDates[0]
4. SET runStart = entryDates[0]
5. FOR i = 1 to entryDates.length - 1:
   a. IF entryDates[i] == entryDates[i-1] + 1 day:
      i. currentRun += 1
   b. ELSE:
      i. IF currentRun > maxStreak:
         - maxStreak = currentRun
         - maxStart = runStart
         - maxEnd = entryDates[i-1]
      ii. currentRun = 1
      iii. runStart = entryDates[i]
6. IF currentRun > maxStreak:
   a. maxStreak = currentRun
   b. maxStart = runStart
   c. maxEnd = entryDates[entryDates.length - 1]
7. RETURN { longest: maxStreak, startDate: maxStart, endDate: maxEnd }
```

**Edge Cases:**
- All entries on one day: longest streak is 1
- Entries every day for the entire history: longest streak equals total days
- Tie (two streaks of equal length): the earlier streak is returned

##### Milestone Check

**Purpose:** Determine if a newly reached streak count triggers a milestone celebration.

**Inputs:**
- currentStreak: integer
- achievedMilestones: list of StreakMilestone records

**Logic:**

```
1. SET thresholds = [3, 7, 14, 30, 60, 90, 180, 365]
2. FOR each threshold in thresholds (ascending):
   a. IF currentStreak >= threshold:
      i. IF no StreakMilestone record exists for this threshold:
         - Create StreakMilestone record with shown = false
      ii. IF StreakMilestone exists with shown = false:
         - RETURN { celebrate: true, threshold: threshold }
3. RETURN { celebrate: false }
```

**Edge Cases:**
- User reaches 30-day streak without having seen the 14-day milestone (e.g., offline): show the highest unshown milestone only
- User breaks streak and rebuilds past a previously achieved milestone: do not re-celebrate

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Streak computation fails | Show "-- day streak" with static flame | Retry on next screen load |
| Milestone record write fails | Skip celebration, do not block user flow | Retry on next app open |
| Timezone detection fails | Fall back to UTC for day boundaries | Log warning, streak may be off by 1 |
| Clock manipulation detected (date set to future) | Ignore entries with future dates | Streak computation excludes future-dated entries |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged at least one entry each day for the past 5 days,
   **When** they view the streak display,
   **Then** it shows "5 day streak" with an animated flame.

2. **Given** the user reaches a 7-day streak,
   **When** they log today's first entry,
   **Then** the milestone celebration overlay appears with "1 Week Streak!" and a star animation.

3. **Given** the user's longest streak is 14 days (achieved last month),
   **When** they view the streak display with a current 3-day streak,
   **Then** the trophy icon shows "14" and the progress bar shows progress toward the next milestone (7 days).

**Edge Cases:**

4. **Given** the user has not logged today but logged yesterday,
   **When** they view the streak display,
   **Then** the flame is static and subtext reads "Log today to keep your streak!"

5. **Given** the user broke their streak 3 days ago,
   **When** they open MyMood,
   **Then** they see "Start a new streak today!" and their total active days count.

6. **Given** the user deletes their only entry from yesterday,
   **When** the streak recomputes,
   **Then** the current streak drops by the appropriate amount.

**Negative Tests:**

7. **Given** the user has never logged a mood entry,
   **When** they view the streak display,
   **Then** it shows "Log your first mood to start a streak!" with a grayed-out flame.

8. **Given** the user has already seen the 7-day milestone celebration,
   **When** they break and rebuild past 7 days again,
   **Then** the celebration does not show again.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| streak from consecutive dates | [Mar 3, 4, 5, 6] today=Mar 6 | current = 4, pending = false |
| streak pending today | [Mar 3, 4, 5] today=Mar 6 | current = 3, pending = true |
| streak broken | [Mar 1, 2, 3] today=Mar 6 | current = 0 |
| streak with single day | [Mar 6] today=Mar 6 | current = 1 |
| longest streak basic | [Jan 1-10, Feb 1-20] | longest = 20, Feb 1-Feb 20 |
| longest streak tie | [Jan 1-5, Feb 1-5] | longest = 5, Jan 1-Jan 5 (first wins) |
| milestone triggers at threshold | currentStreak=7, no milestones | celebrate 7-day milestone |
| milestone not re-triggered | currentStreak=7, 7-day milestone shown | celebrate = false |
| multiple entries same day | 3 entries on Mar 6 | counts as 1 streak day |
| empty history | no entries | current = 0, longest = 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Streak updates on log | 1. Have 2-day streak, 2. Log today | Streak shows 3 |
| Milestone celebration appears | 1. Have 6-day streak, 2. Log today (day 7) | Celebration overlay shown |
| Streak survives deletion | 1. Have 5-day streak, 2. Delete an entry from day 3 | Streak recomputes to 2 (days 4 and 5) |
| Longest streak persists | 1. Build 10-day streak, 2. Break it, 3. Start new 3-day | Longest shows 10 |

---

### MM-008: Customizable Activity Categories

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-008 |
| **Feature Name** | Customizable Activity Categories |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to create my own custom activities and categories, so that I can track factors specific to my lifestyle that are not covered by the default activity list.

**Secondary:**
> As a wellness optimizer, I want to reorder, rename, and archive activities, so that my activity picker stays organized and relevant as my habits change over time.

**Tertiary:**
> As a returning user, I want to merge two similar custom activities (e.g., "Gym" and "Weight Training") into one, so that my correlation data is consolidated and accurate.

#### 3.3 Detailed Description

Customizable Activity Categories extends the default 64-activity set from MM-003 with user-created activities and categories. Users can create new categories, add custom activities to any category, edit activity names and icons, reorder activities within categories, archive activities they no longer use, and merge duplicate or similar activities.

Custom activities participate fully in the correlation engine (MM-010), streak tracking, and export functions. They appear alongside default activities in the activity picker with no visual distinction (custom activities are first-class citizens).

Categories can be reordered to reflect the user's priorities. For example, if a user primarily tracks social activities, they can move the "Social" category to the top of the picker. Category reorder and activity reorder are persisted per-user.

Archiving an activity hides it from the picker but preserves all historical data. Archived activities still appear in timeline entries, trend charts, and exports. They can be unarchived at any time. Deleting an activity is a separate, destructive action that removes the activity definition and all associated tags (with confirmation).

Merging two activities reassigns all ActivityTag records from the source activity to the target activity, then archives the source. Merge is irreversible and requires explicit confirmation showing the number of affected entries.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-003 (Activity Tagging): activity system to extend

**External Dependencies:**
- Emoji picker or icon selector for custom activity icons
- Drag-and-drop gesture support for reordering

**Assumed Capabilities:**
- ActivityDefinition and ActivityTag tables exist from MM-003

#### 3.5 User Interface Requirements

##### Screen: Manage Activities

**Layout:**
- Top: "Manage Activities" title with "Add Category" button in top-right
- Category sections listed vertically, each collapsible
- Each category header: drag handle (left), category name (center), chevron (right), overflow menu (edit, delete)
- Each activity row: drag handle (left), icon, activity name (center), usage count badge (right), overflow menu
- Bottom: "Archived Activities" section (collapsed by default) showing archived items with "Unarchive" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default View | Normal browsing | Categories with activities listed, no drag handles |
| Edit Mode | User tapped "Edit" in nav bar | Drag handles visible, items reorderable, swipe-to-archive enabled |
| Adding Category | User tapped "Add Category" | Inline text field at top of list with keyboard |
| Adding Activity | User tapped "+" in a category | Inline row with icon picker + name field |
| Merge Mode | User selected "Merge..." from overflow | Target activity picker shown with merge preview |
| Empty Category | Category has no activities | "No activities. Tap + to add one." |

**Interactions:**
- Tap "Edit": enters edit mode with drag handles
- Long press activity row (non-edit mode): enters edit mode
- Drag activity row: reorder within category or move to different category
- Drag category header: reorder category position
- Swipe left on activity (edit mode): reveals Archive and Delete buttons
- Tap overflow on activity: shows Edit Name, Change Icon, Merge, Archive, Delete options
- Tap "+" in category: shows inline add-activity form
- Tap "Add Category": shows inline add-category form
- Tap archived activity: shows Unarchive confirmation

**Transitions/Animations:**
- Drag handles slide in from left on edit mode enter (200ms)
- Reorder animation: items shift with spring physics (300ms)
- Archive: item slides left and fades out (250ms)
- Unarchive: item slides in from left (250ms)

##### Dialog: Merge Activities

**Layout:**
- Title: "Merge Activities"
- Source: the activity being merged (with icon and name, non-editable)
- Target picker: scrollable list of all other activities in the same category
- Preview: "X entries will be reassigned from [Source] to [Target]"
- Warning: "This action cannot be undone."
- Buttons: "Cancel" and "Merge" (destructive red)

#### 3.6 Data Requirements

##### Entity: ActivityDefinition (Extended Fields)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| isCustom | boolean | Required | false | Whether this activity was user-created |
| isArchived | boolean | Required | false | Whether this activity is hidden from the picker |
| sortOrder | integer | Required, min 0 | Auto-incremented | Position within its category |
| archivedAt | datetime or null | ISO 8601 | null | When the activity was archived |

##### Entity: ActivityCategory (Extended Fields)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| isCustom | boolean | Required | false | Whether this category was user-created |
| sortOrder | integer | Required, min 0 | Auto-incremented | Position in the category list |

**Indexes:**
- `mo_activity_defs(categoryId, sortOrder)` - Ordered listing within category
- `mo_activity_categories(sortOrder)` - Category ordering
- `mo_activity_defs(isArchived)` - Filter archived vs active

**Validation Rules:**
- Custom activity name: 1-50 characters, must be unique within its category (case-insensitive)
- Custom category name: 1-30 characters, must be unique (case-insensitive)
- Sort order: non-negative integer, unique within parent (category or category list)
- Cannot archive a default activity (only custom activities can be archived; default activities can be hidden via a separate "hidden" flag)
- Cannot delete a category that contains non-archived activities

**Example Data:**

```json
{
  "id": "custom-act-001",
  "categoryId": "cat-exercise",
  "activityName": "Rock Climbing",
  "icon": "climbing",
  "isDefault": false,
  "isCustom": true,
  "isArchived": false,
  "sortOrder": 9,
  "usageCount": 12,
  "archivedAt": null,
  "createdAt": "2026-02-15T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Activity Merge

**Purpose:** Combine two activities by reassigning all historical tags from source to target.

**Inputs:**
- sourceActivityId: string - the activity being merged away
- targetActivityId: string - the activity absorbing the data

**Logic:**

```
1. Validate sourceActivityId and targetActivityId both exist and are not archived
2. Validate source != target
3. Count ActivityTag records where activityId = sourceActivityId
4. BEGIN transaction:
   a. UPDATE all ActivityTag records SET activityId = targetActivityId WHERE activityId = sourceActivityId
   b. Handle duplicates: if (entryId, targetActivityId) already exists, delete the source tag instead of updating
   c. UPDATE targetActivity SET usageCount = (SELECT COUNT(DISTINCT entryId) FROM mo_activity_tags WHERE activityId = targetActivityId)
   d. SET sourceActivity.isArchived = true, sourceActivity.archivedAt = now
5. COMMIT transaction
6. RETURN { mergedCount: number of tags reassigned, duplicatesSkipped: number of duplicate tags removed }
```

**Edge Cases:**
- Merging activity with itself: rejected at validation
- Source has 0 usage: archive source, no tag updates needed
- Source and target both tagged on the same entry: duplicate tag removed, target retains one tag
- Merge during active mood log: UI should prevent merge while logging flow is open

##### Sort Order Management

**Purpose:** Maintain consistent sort orders when activities or categories are reordered.

**Inputs:**
- itemId: string - the item being moved
- newPosition: integer - the target sort order
- parentId: string or null - the category (for activities) or null (for categories)

**Logic:**

```
1. Get all items in the same parent group, sorted by current sortOrder
2. Remove the moving item from the list
3. Insert the item at newPosition
4. FOR i = 0 to list.length - 1:
   a. SET list[i].sortOrder = i
5. Batch update all changed sort orders in a single transaction
```

**Edge Cases:**
- Moving to the same position: no-op
- Moving to position beyond list end: clamp to list.length - 1
- Moving activity to a different category: update categoryId and recalculate sort orders for both old and new categories

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Merge transaction fails | Toast: "Merge failed. No data was changed." | Transaction rolls back, both activities unchanged |
| Duplicate activity name | Inline error: "An activity with this name already exists in this category" | User changes the name |
| Reorder save fails | Items snap back to previous positions | Retry on next drag |
| Delete category with activities | Dialog: "Move activities to another category or delete them first" | User must empty the category |
| Archive fails | Toast: "Could not archive. Please try again." | Activity remains visible |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "Add Category" and types "Productivity",
   **When** they confirm,
   **Then** a new "Productivity" category appears at the bottom of the list with 0 activities.

2. **Given** the user taps "+" in the "Productivity" category and types "Deep Work",
   **When** they confirm,
   **Then** "Deep Work" appears as a custom activity in the "Productivity" category.

3. **Given** the user selects "Merge..." on "Weight Training" and picks "Gym" as target,
   **When** the merge confirms,
   **Then** all entries tagged "Weight Training" are reassigned to "Gym", and "Weight Training" is archived.

**Edge Cases:**

4. **Given** the user drags "Social" category from position 5 to position 1,
   **When** they drop it,
   **Then** "Social" becomes the first category and all other categories shift down.

5. **Given** an archived activity "Meditation" has 15 historical entries,
   **When** the user taps "Unarchive" on it,
   **Then** "Meditation" reappears in its original category at the bottom with usage count 15.

6. **Given** two entries have both "Gym" and "Weight Training" tagged,
   **When** the user merges "Weight Training" into "Gym",
   **Then** the duplicate tags are removed and each entry retains exactly one "Gym" tag.

**Negative Tests:**

7. **Given** the user tries to create an activity named "Gym" in the Exercise category,
   **When** "Gym" already exists in that category,
   **Then** an inline error appears: "An activity with this name already exists in this category."

8. **Given** the user tries to delete a category with 5 active activities,
   **When** the delete is attempted,
   **Then** a dialog explains they must move or delete the activities first.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates custom activity | name: "Rock Climbing", category: Exercise | new activity with isCustom=true |
| prevents duplicate name | name: "Gym" in Exercise (exists) | validation error |
| case-insensitive duplicate check | name: "gym" in Exercise | validation error |
| merge reassigns tags | source: 10 tags, target: 5 tags | target has up to 15 tags |
| merge handles duplicates | source+target both on entry-1 | entry-1 has 1 tag (target) |
| sort order recalculation | move item from pos 3 to pos 1 | all items renumbered 0-N |
| archive sets fields | archive activity | isArchived=true, archivedAt set |
| unarchive clears fields | unarchive activity | isArchived=false, archivedAt=null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Custom activity appears in picker | 1. Create "Rock Climbing" in Exercise, 2. Open activity picker | "Rock Climbing" visible in Exercise category |
| Merged activity data in trends | 1. Have 10 entries with "Weight Training", 2. Merge into "Gym", 3. View correlation | "Gym" shows combined correlation data |
| Archived activity in timeline | 1. Tag entry with "Yoga", 2. Archive "Yoga", 3. View timeline | Entry still shows "Yoga" tag |
| Reorder persists across sessions | 1. Reorder categories, 2. Close and reopen app | Categories in new order |

---

### MM-009: Year in Pixels

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-009 |
| **Feature Name** | Year in Pixels |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to see an entire year of mood data displayed as a colored grid where each day is one cell, so that I can instantly visualize seasonal patterns, good stretches, and difficult periods at a glance.

**Secondary:**
> As a therapy-supported user, I want to tap on any day in the Year in Pixels grid to see that day's details, so that I can quickly navigate to specific days that stand out visually.

**Tertiary:**
> As a self-awareness seeker, I want to switch between years and compare my mood patterns year over year, so that I can track my long-term emotional growth.

#### 3.3 Detailed Description

Year in Pixels is a calendar-based mood visualization inspired by the popular "Year in Pixels" journaling technique. It renders a 365-cell grid (366 for leap years) where each cell represents one calendar day, colored according to the daily average mood score. The grid provides an immediate, high-density overview of the user's emotional year.

The grid is arranged in a 12-row (months) by 31-column (days) layout. Months with fewer than 31 days have blank cells at the end. Each cell is a small square (approximately 8-10px on phone screens) colored according to the daily average score:

| Score Range | Color | Label |
|-------------|-------|-------|
| 1.0 - 2.0 | #EF4444 (red) | Very Low |
| 2.1 - 4.0 | #F97316 (orange) | Low |
| 4.1 - 6.0 | #EAB308 (yellow) | Moderate |
| 6.1 - 8.0 | #22C55E (green) | Good |
| 8.1 - 10.0 | #3B82F6 (blue) | Excellent |
| No data | #374151 (dark gray) | No Entry |

The grid scrolls horizontally if needed on smaller screens. A color legend is displayed below the grid. Month labels appear on the left side (Y-axis), and day numbers 1-31 appear along the top (X-axis).

Tapping a cell highlights it and shows a popover with that day's summary: average score, entry count, top emotion, and a "View Day" button that navigates to the Daily Timeline (MM-005). Long-pressing a cell on a day with no entry opens the mood log flow (MM-001) pre-set to that date (for backdating).

A year selector at the top allows switching between years. The grid smoothly transitions when switching years.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood entries to visualize
- MM-005 (Daily Mood Timeline): navigation target when tapping a day

**External Dependencies:**
- Canvas or SVG renderer for efficient grid drawing (365+ cells)
- Touch/tap handling for small cell targets

**Assumed Capabilities:**
- Daily average scores computable from MoodEntry data
- Year's worth of data preferred but not required

#### 3.5 User Interface Requirements

##### Screen: Year in Pixels

**Layout:**
- Top: year selector: left arrow | "2026" | right arrow
- Below year selector: day-of-month header row (1, 2, 3 ... 31)
- Grid area: 12 rows (Jan-Dec) x 31 columns, each cell approximately 8-10px square
- Month labels on the left edge of each row ("Jan", "Feb", ... "Dec")
- Color legend below grid: 5 color swatches with labels (Very Low through Excellent)
- Below legend: year summary statistics row

**Year Summary Statistics:**

| Statistic | Description |
|-----------|-------------|
| Days Tracked | Number of days with at least 1 entry |
| Overall Average | Average of all daily averages for the year |
| Best Month | Month with the highest average score |
| Most Active Month | Month with the most entries |
| Dominant Emotion | Most frequently tagged emotion across the year |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Populated Year | Data exists for selected year | Grid with colored cells and summary |
| Sparse Year | Fewer than 30 days tracked | Grid mostly gray, "Keep logging to fill your year!" message |
| Empty Year | No data for selected year | Grid entirely gray, "No mood data for [Year]" |
| Current Year | Viewing current year | Future days shown as slightly lighter gray than no-data days |
| Past Year | Viewing completed past year | All cells final (no future distinction) |
| Cell Selected | User tapped a cell | Cell highlighted with border, popover visible |

**Interactions:**
- Tap colored cell: shows day summary popover
- Tap "View Day" in popover: navigates to Daily Timeline for that date
- Long press gray cell (past date): opens mood log flow for backdating
- Tap left arrow: previous year
- Tap right arrow: next year (max: current year)
- Pinch to zoom: enlarges grid cells for easier tapping
- Tap outside popover: dismisses popover

**Transitions/Animations:**
- Year switch: grid cross-fades (300ms)
- Cell tap: selected cell scales up slightly (1.3x) with border highlight
- Popover: slides up from cell with fade-in (200ms)
- Grid initial load: cells fill in left-to-right, top-to-bottom with staggered fade (30ms per cell, ~11 seconds total for full year; skip animation if returning to screen)

#### 3.6 Data Requirements

##### Query: Year Pixel Data

```
SELECT date, ROUND(AVG(score), 1) as avgScore, COUNT(*) as entryCount
FROM mo_entries
WHERE date >= :yearStart AND date <= :yearEnd
GROUP BY date
ORDER BY date ASC
```

**Result Mapping:**

| Field | Type | Description |
|-------|------|-------------|
| date | string | YYYY-MM-DD |
| avgScore | float | Daily average score |
| entryCount | integer | Number of entries that day |
| colorBucket | enum | Derived from avgScore using the score-range-to-color table |

No new entities required. This feature reads aggregated MoodEntry data.

**Indexes Used:**
- `mo_entries(date)` for date range queries

##### Cache: PixelYearCache

To avoid recomputing daily averages for an entire year on every screen load, an in-memory cache stores the pixel data for the currently viewed year.

| Field | Type | Description |
|-------|------|-------------|
| year | integer | The cached year |
| pixels | map of date to {avgScore, entryCount, colorBucket} | Precomputed pixel data |
| computedAt | datetime | When the cache was last built |
| stale | boolean | Whether the cache needs refresh (set to true on new entry) |

**Cache Invalidation:**
- Any MoodEntry INSERT, UPDATE, or DELETE for the cached year sets stale = true
- On next screen visit, if stale, recompute only the affected date, not the entire year
- On year switch, rebuild entire cache for the new year

#### 3.7 Business Logic Rules

##### Daily Score to Color Bucket Mapping

**Purpose:** Map a daily average score to a display color for the pixel grid.

**Inputs:**
- avgScore: float (1.0 to 10.0) or null

**Logic:**

```
1. IF avgScore is null THEN RETURN "no-data" (#374151)
2. IF avgScore <= 2.0 THEN RETURN "very-low" (#EF4444)
3. IF avgScore <= 4.0 THEN RETURN "low" (#F97316)
4. IF avgScore <= 6.0 THEN RETURN "moderate" (#EAB308)
5. IF avgScore <= 8.0 THEN RETURN "good" (#22C55E)
6. ELSE RETURN "excellent" (#3B82F6)
```

**Edge Cases:**
- Exact boundary (e.g., 4.0): falls into "low" bucket
- Average of 10.0: "excellent"
- Average of 1.0: "very-low"
- Single entry with score 5 on a day: avgScore = 5.0, "moderate"

##### Year Grid Construction

**Purpose:** Build the 12x31 grid data structure for rendering.

**Inputs:**
- year: integer
- pixelData: map of date to pixel info

**Logic:**

```
1. FOR each month m (1-12):
   a. Determine daysInMonth(year, m)
   b. FOR each day d (1-31):
      i. IF d > daysInMonth THEN cell = "blank" (no day exists)
      ii. ELSE:
         - dateString = format(year, m, d) as YYYY-MM-DD
         - IF dateString in pixelData THEN cell = pixelData[dateString]
         - ELSE IF dateString > today THEN cell = "future"
         - ELSE cell = "no-data"
2. RETURN 12x31 matrix of cells
```

**Edge Cases:**
- Leap year (2028): February has 29 days
- February in non-leap year: cells 29-31 are "blank"
- Current date: today's cell may change color if user logs more entries today

##### Year Summary Computation

**Purpose:** Compute aggregate statistics for the year summary row.

**Inputs:**
- pixelData: map of date to pixel info for the year

**Logic:**

```
1. daysTracked = count of entries in pixelData with non-null avgScore
2. overallAverage = average of all avgScore values, rounded to 1 decimal
3. Group by month:
   a. bestMonth = month with highest average of daily averages
   b. mostActiveMonth = month with highest total entry count
4. Query EmotionTag for the year to find dominantEmotion
5. RETURN { daysTracked, overallAverage, bestMonth, mostActiveMonth, dominantEmotion }
```

**Edge Cases:**
- No data for the year: all stats show "--" or "N/A"
- Tie for best month: first month chronologically wins
- Only 1 day of data: all stats reflect that single day

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Grid rendering fails | Fallback to text-based month list with average scores | Log error |
| Year data query timeout | Show skeleton grid, retry in background | Retry with smaller batch (6 months at a time) |
| Cache corruption | Rebuild cache from source data | Clear and recompute |
| Popover fails to load day data | Popover shows score and entry count only, "View Day" still works | Day detail loaded on navigation |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged moods for 45 days in 2026,
   **When** they open Year in Pixels,
   **Then** a grid shows 45 colored cells and 320 gray cells (plus blank cells for short months) with accurate colors.

2. **Given** the user taps a green cell for March 1,
   **When** the popover appears,
   **Then** it shows "Mar 1, 2026", average score "7.2", "3 entries", and top emotion "Joy".

3. **Given** the user switches from 2026 to 2025,
   **When** 2025 has 200 days of data,
   **Then** the grid cross-fades to show 2025 data with correct colors and updated summary statistics.

**Edge Cases:**

4. **Given** February 2028 (leap year) has data for Feb 29,
   **When** the grid renders,
   **Then** Feb 29 shows a colored cell and Feb 30-31 show as blank.

5. **Given** the user views Year in Pixels for the current year,
   **When** today is March 6,
   **Then** dates Mar 7 through Dec 31 show as "future" (lighter gray) rather than "no-data" (dark gray).

6. **Given** the user long-presses a gray cell for Feb 15 (past, no data),
   **When** the mood log opens,
   **Then** the log is pre-set to Feb 15 and the entry will backdate to that date.

**Negative Tests:**

7. **Given** the user navigates to 2020 with zero data,
   **When** the grid renders,
   **Then** all cells are gray and the summary shows "No mood data for 2020."

8. **Given** the user tries to navigate past the current year,
   **When** they tap the right arrow on 2026,
   **Then** the right arrow is disabled and the year does not change.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| color bucket: score 1.0 | avgScore = 1.0 | "very-low" (#EF4444) |
| color bucket: score 4.0 | avgScore = 4.0 | "low" (#F97316) |
| color bucket: score 6.1 | avgScore = 6.1 | "good" (#22C55E) |
| color bucket: score 10.0 | avgScore = 10.0 | "excellent" (#3B82F6) |
| color bucket: null | avgScore = null | "no-data" (#374151) |
| grid Feb non-leap | year = 2026, month = 2 | 28 valid cells, 3 blank |
| grid Feb leap year | year = 2028, month = 2 | 29 valid cells, 2 blank |
| future cell detection | date = tomorrow | cell type = "future" |
| year summary days tracked | 45 days with data | daysTracked = 45 |
| best month computation | Jan avg 6.0, Feb avg 8.0 | bestMonth = "February" |
| cache invalidation on insert | new entry for cached year | stale = true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Grid renders year data | 1. Log 30 entries across Jan-Mar, 2. Open Year in Pixels | 30 colored cells, rest gray/blank |
| Cell tap shows popover | 1. Tap colored cell, 2. Read popover | Correct score, count, emotion |
| New entry updates grid | 1. View grid, 2. Log mood for today, 3. Return to grid | Today's cell updates color |
| Year switch loads data | 1. View 2026, 2. Switch to 2025 | Grid shows 2025 data |

---

### MM-010: Correlation Engine

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-010 |
| **Feature Name** | Correlation Engine |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a wellness optimizer, I want to see which activities are statistically correlated with higher or lower mood scores, so that I can make data-driven decisions about how I spend my time.

**Secondary:**
> As a therapy-supported user, I want to see the strength and direction of correlations between my emotions and activities, so that I can discuss evidence-based patterns with my therapist.

**Tertiary:**
> As a self-awareness seeker, I want to see day-of-week and time-of-day patterns in my mood, so that I can identify when I tend to feel best and worst and plan accordingly.

#### 3.3 Detailed Description

The Correlation Engine is the analytical heart of MyMood. It computes statistical correlations between mood scores and various tracked factors: activities, emotions, day of week, time of day, and (when available) cross-module data from MyWorkouts, MyFast, and other MyLife modules.

The primary statistical measure is the Pearson correlation coefficient (r), computed between a factor's presence/absence (encoded as 1/0) and the mood score:

```
r = SUM((xi - x_bar)(yi - y_bar)) / SQRT(SUM((xi - x_bar)^2) * SUM((yi - y_bar)^2))
```

Where:
- xi = factor value for entry i (1 if activity was tagged, 0 if not)
- yi = mood score for entry i
- x_bar = mean of all x values
- y_bar = mean of all y values

A correlation is considered statistically meaningful when |r| >= 0.3 and the sample size is at least 10 data points. Correlations with |r| < 0.3 are labeled "Weak or no correlation." Correlations with fewer than 10 data points are labeled "Not enough data."

Results are displayed as a ranked list of factors sorted by absolute correlation strength, with visual indicators showing positive (green, upward arrow) or negative (red, downward arrow) direction. Each factor shows the r value, the number of data points, and a mini scatter plot or trend indicator.

The correlation engine runs on-demand when the user opens the Insights tab and caches results until new data is logged. Cross-module correlations require the respective modules to be enabled and have overlapping date data.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood scores
- MM-003 (Activity Tagging): activity factor data

**External Dependencies:**
- None (all computation is local)

**Assumed Capabilities:**
- Sufficient data volume (minimum 10 entries with a given factor for correlation to be computed)

**Cross-Module Dependencies (Optional):**
- MyWorkouts: exercise type and duration data
- MyFast: fasting window data
- MyHabits: habit completion data

#### 3.5 User Interface Requirements

##### Screen: Insights

**Layout:**
- Top: "Insights" title with time range selector: "1M", "3M", "6M", "1Y", "All"
- Insight category tabs: "Activities", "Emotions", "Patterns", "Cross-Module"
- Main area: sorted list of correlation cards

**Correlation Card:**
- Left: factor icon and name
- Center: correlation strength bar (horizontal, centered at 0, extends left for negative, right for positive)
- Right: r value with direction arrow (green up or red down)
- Below bar: "n = 42 entries" sample size
- Tap to expand: shows scatter plot and detailed breakdown

**Correlation Strength Bar Colors:**

| |r| Range | Color | Label |
|-----------|-------|-------|
| 0.0 - 0.29 | Gray | Weak/None |
| 0.3 - 0.49 | Light green/red | Moderate |
| 0.5 - 0.69 | Medium green/red | Strong |
| 0.7 - 1.0 | Dark green/red | Very Strong |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Data Available | 10+ entries with factors | Sorted correlation list |
| Insufficient Data | Fewer than 10 entries total | "Log at least 10 moods with activities to see insights" |
| Computing | Correlation calculation in progress | Loading spinner with "Analyzing your patterns..." |
| No Correlations Found | All |r| < 0.3 | "No strong correlations found yet. Keep logging!" |
| Cross-Module Unavailable | Required module not enabled | "Enable [Module] to see [Factor] correlations" |

##### Expanded Correlation Detail

**Layout (shown below correlation card when tapped):**
- Mini scatter plot: x-axis = factor (0 or 1), y-axis = mood score (1-10)
- Average score with factor present vs absent
- Trend over time: line chart of mood scores on days with vs without the factor
- "What this means" plain-language explanation

**Interactions:**
- Tap correlation card: expand/collapse detail view
- Tap time range pill: recompute correlations for new range
- Tap category tab: switch between factor types
- Pull to refresh: force recompute (clears cache)

**Transitions/Animations:**
- Card expand: height animation with content slide-in (250ms)
- Correlation bars: animate from 0 to value on load (500ms, staggered 50ms per card)
- Tab switch: cross-fade content (200ms)

#### 3.6 Data Requirements

##### Computed: CorrelationResult

| Field | Type | Description |
|-------|------|-------------|
| factorType | enum | activity, emotion, dayOfWeek, timeOfDay, crossModule |
| factorId | string | Activity ID, emotion name, day name, time block name, or module factor ID |
| factorName | string | Human-readable factor name |
| pearsonR | float | Pearson correlation coefficient (-1.0 to 1.0) |
| sampleSize | integer | Number of data points used in computation |
| avgWithFactor | float | Average mood score when factor is present |
| avgWithoutFactor | float | Average mood score when factor is absent |
| strength | enum | none, moderate, strong, veryStrong |
| direction | enum | positive, negative, neutral |
| significant | boolean | Whether |r| >= 0.3 and sampleSize >= 10 |

No persistent storage required. Correlation results are computed on-demand and cached in memory.

##### Cache: CorrelationCache

| Field | Type | Description |
|-------|------|-------------|
| timeRange | string | The time range used for computation |
| results | list of CorrelationResult | Computed correlations |
| computedAt | datetime | When the cache was built |
| dataHash | string | Hash of entry count + latest entry timestamp, used for staleness detection |

**Cache Invalidation:**
- New MoodEntry or ActivityTag inserted: cache marked stale
- Time range changed: cache rebuilt for new range
- Pull to refresh: cache cleared and rebuilt

#### 3.7 Business Logic Rules

##### Pearson Correlation Computation

**Purpose:** Compute the Pearson correlation coefficient between a binary factor and mood scores.

**Inputs:**
- entries: list of MoodEntry records in the date range
- factorPresence: map of entryId to boolean (true if factor was tagged on that entry)

**Logic:**

```
1. Build paired data:
   FOR each entry:
     x = 1 if factorPresence[entry.id] == true, else 0
     y = entry.score
     Add (x, y) to pairs list
2. IF pairs count < 10 THEN RETURN { pearsonR: null, significant: false, reason: "insufficient data" }
3. Compute x_bar = mean of all x values
4. Compute y_bar = mean of all y values
5. Compute numerator = SUM((xi - x_bar) * (yi - y_bar)) for all i
6. Compute denomX = SUM((xi - x_bar)^2) for all i
7. Compute denomY = SUM((yi - y_bar)^2) for all i
8. IF denomX == 0 OR denomY == 0 THEN RETURN { pearsonR: 0, significant: false, reason: "no variance" }
9. r = numerator / SQRT(denomX * denomY)
10. Round r to 3 decimal places
11. SET significant = (ABS(r) >= 0.3 AND pairs count >= 10)
12. SET strength:
    - IF ABS(r) < 0.3 THEN "none"
    - IF ABS(r) < 0.5 THEN "moderate"
    - IF ABS(r) < 0.7 THEN "strong"
    - ELSE "veryStrong"
13. SET direction:
    - IF r > 0.05 THEN "positive"
    - IF r < -0.05 THEN "negative"
    - ELSE "neutral"
14. RETURN { pearsonR: r, sampleSize: pairs count, avgWithFactor, avgWithoutFactor, strength, direction, significant }
```

**Edge Cases:**
- Factor never present (all x = 0): denomX = 0, r = 0, "no variance"
- Factor always present (all x = 1): denomX = 0, r = 0, "no variance"
- All mood scores identical: denomY = 0, r = 0, "no variance"
- Perfect positive correlation (r = 1.0): all entries with factor have same high score, all without have same low score
- Exactly 10 data points: minimum viable sample, computation proceeds

##### Activity Correlation Batch

**Purpose:** Compute correlations for all activities that meet the minimum sample size.

**Inputs:**
- entries: list of MoodEntry records in the date range
- activityTags: list of ActivityTag records in the date range

**Logic:**

```
1. Get distinct activityIds from activityTags
2. FOR each activityId:
   a. Build factorPresence map: for each entry, true if activityId in that entry's tags
   b. Count entries where factor is present
   c. IF presentCount < 5 OR (entries.length - presentCount) < 5 THEN skip (need both groups)
   d. Compute Pearson correlation
   e. Add to results
3. Sort results by ABS(pearsonR) DESC
4. RETURN results
```

**Edge Cases:**
- Activity used on every entry: no variance in factor, r = 0
- Activity used only once: insufficient data, skipped
- 100+ activities: compute all in batch, sort by significance

##### Cross-Module Correlation

**Purpose:** Correlate mood scores with data from other MyLife modules.

**Inputs:**
- moodEntries: list of MoodEntry records with dates
- moduleData: list of {date, factorValue} from the external module

**Logic:**

```
1. Join mood entries with module data on date
2. Only include dates where both mood and module data exist
3. IF joined count < 10 THEN RETURN insufficient data
4. Compute Pearson correlation between factorValue and avgMoodScore per date
5. RETURN result with cross-module metadata
```

**Supported Cross-Module Factors:**

| Module | Factor | x Value |
|--------|--------|---------|
| MyWorkouts | Exercised today | 1 if workout logged, 0 if not |
| MyWorkouts | Workout duration | minutes (continuous variable) |
| MyFast | Fasting today | 1 if in fasting window, 0 if not |
| MyFast | Fast duration | hours (continuous variable) |
| MyHabits | Habit completed | 1 if habit checked, 0 if not |
| MyBooks | Reading session | 1 if reading logged, 0 if not |

**Edge Cases:**
- Module not enabled: factor not computed, shows "Enable [Module]" message
- No date overlap: insufficient data
- Module has data but mood module does not for those dates: those dates excluded

##### Plain-Language Explanation Generator

**Purpose:** Generate a human-readable explanation of what a correlation means.

**Inputs:**
- factorName: string
- pearsonR: float
- avgWithFactor: float
- avgWithoutFactor: float

**Logic:**

```
1. IF ABS(pearsonR) < 0.3:
   RETURN "No strong relationship detected between [factorName] and your mood."
2. SET directionWord = (pearsonR > 0) ? "higher" : "lower"
3. SET strengthWord:
   - ABS(pearsonR) < 0.5: "somewhat"
   - ABS(pearsonR) < 0.7: "noticeably"
   - ELSE: "strongly"
4. SET scoreDiff = ABS(avgWithFactor - avgWithoutFactor), rounded to 1 decimal
5. RETURN "Days with [factorName] tend to have [strengthWord] [directionWord] mood scores. Your average is [avgWithFactor] on days with [factorName] vs [avgWithoutFactor] on days without (a difference of [scoreDiff] points)."
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Correlation computation timeout (>5 seconds) | Show partial results, "Still computing..." for remaining | Background thread continues, updates UI when done |
| Division by zero in Pearson formula | r = 0, labeled "no variance" | Gracefully handled in logic (denominator check) |
| Cross-module data access fails | Show "Could not load [Module] data" for that factor | Other factors still computed and displayed |
| Memory pressure from large dataset | Limit to most recent 365 days of data | Show "Showing correlations for the past year" notice |
| NaN or Infinity in computation | r = 0, flagged as computation error | Log warning, show "Correlation unavailable" for that factor |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 50 mood entries, 30 of which are tagged with "Exercise" (avg score 7.5) and 20 without (avg score 5.2),
   **When** they open the Insights tab,
   **Then** "Exercise" appears as a positive correlation with r approximately 0.5-0.7 and a green bar.

2. **Given** the user taps the "Exercise" correlation card,
   **When** the detail expands,
   **Then** it shows a scatter plot, "avg 7.5 with Exercise vs 5.2 without", and the explanation "Days with Exercise tend to have noticeably higher mood scores."

3. **Given** the user has MyWorkouts enabled with 30 days of overlapping data,
   **When** they view the Cross-Module tab,
   **Then** "Exercised today" shows a correlation result.

**Edge Cases:**

4. **Given** the user has logged 8 entries total,
   **When** they open Insights,
   **Then** the screen shows "Log at least 10 moods with activities to see insights" with a progress indicator.

5. **Given** the user has tagged "Coffee" on every single entry,
   **When** correlations are computed,
   **Then** "Coffee" shows r = 0 with explanation "No variance: Coffee is present on all entries."

6. **Given** all entries have the same mood score of 7,
   **When** correlations are computed,
   **Then** all factors show r = 0 with explanation "No variance in mood scores."

**Negative Tests:**

7. **Given** MyWorkouts is not enabled,
   **When** the user views the Cross-Module tab,
   **Then** it shows "Enable MyWorkouts to see exercise correlations" with an Enable button.

8. **Given** a correlation computation produces NaN due to edge case data,
   **When** results are displayed,
   **Then** that factor shows "Correlation unavailable" and other factors display normally.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Pearson r positive correlation | x=[1,1,1,0,0,0,0,0,0,0], y=[8,9,7,3,4,5,4,3,5,4] | r > 0.5 |
| Pearson r negative correlation | x=[1,1,1,0,0,0,0,0,0,0], y=[2,3,1,7,8,6,7,8,6,7] | r < -0.5 |
| Pearson r no correlation | x=[1,0,1,0,1,0,1,0,1,0], y=[5,5,5,5,5,5,5,5,5,5] | r = 0 |
| Pearson r zero variance x | all x = 1 | r = 0, "no variance" |
| Pearson r zero variance y | all y = 5 | r = 0, "no variance" |
| Pearson r insufficient data | 5 pairs | null, "insufficient data" |
| strength classification moderate | r = 0.35 | "moderate" |
| strength classification strong | r = 0.65 | "strong" |
| strength classification veryStrong | r = 0.85 | "veryStrong" |
| significance check | r = 0.25, n = 15 | significant = false |
| significance check | r = 0.35, n = 15 | significant = true |
| plain-language positive | r = 0.6, "Exercise", avg 7.5 vs 5.2 | contains "noticeably higher" |
| plain-language negative | r = -0.4, "Work meetings", avg 4.0 vs 6.5 | contains "somewhat lower" |
| batch sorts by abs(r) | 5 correlations | sorted by descending |r| |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| End-to-end activity correlation | 1. Log 20 entries, 10 with "Gym" (avg 8), 10 without (avg 5), 2. Open Insights | "Gym" shows strong positive correlation |
| Cross-module correlation | 1. Enable MyWorkouts, 2. Log workouts and moods for 14 days, 3. View Cross-Module | Workout factor shows correlation |
| Cache invalidation | 1. View Insights (cached), 2. Log new entry, 3. Return to Insights | Results recomputed with new entry |
| Time range filter | 1. Have 6 months of data, 2. Switch from "All" to "1M" | Correlations recalculated for last 30 days only |

---

### MM-011: Guided Breathing Exercises

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-011 |
| **Feature Name** | Guided Breathing Exercises |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a stress manager, I want access to guided breathing exercises within my mood tracker, so that I have an immediate coping tool when I notice my mood dropping or anxiety rising.

**Secondary:**
> As a mindfulness beginner, I want step-by-step animated guidance for different breathing techniques, so that I can practice without needing to remember the timing patterns myself.

**Tertiary:**
> As a consistent practitioner, I want to see a history of my breathing sessions with duration and technique used, so that I can track how regularly I practice and correlate breathing with mood improvements.

#### 3.3 Detailed Description

Guided Breathing Exercises provides three evidence-based breathing techniques with visual and haptic guidance. Each technique uses an animated circle that expands (inhale), holds (hold), and contracts (exhale) according to the technique's timing pattern. The exercises are accessible from the mood module home screen and optionally from the SOS/Panic Button (MM-020).

**Technique 1: Box Breathing (4-4-4-4)**
- Inhale for 4 seconds
- Hold for 4 seconds
- Exhale for 4 seconds
- Hold for 4 seconds
- Total cycle: 16 seconds
- Used by Navy SEALs and first responders for acute stress reduction

**Technique 2: 4-7-8 Technique**
- Inhale for 4 seconds
- Hold for 7 seconds
- Exhale for 8 seconds
- Total cycle: 19 seconds
- Developed by Dr. Andrew Weil, promotes relaxation and sleep onset

**Technique 3: Coherent Breathing**
- Inhale for 5 seconds
- Exhale for 5 seconds
- No hold phase
- Total cycle: 10 seconds
- Targets heart rate variability optimization at ~6 breaths per minute

Each session runs for a configurable number of cycles (default: 5 cycles). The user can extend the session at any time by tapping "Add 5 cycles." The session can be ended early by tapping "End." After a session completes, the user is prompted to log a mood entry, enabling correlation between breathing practice and mood improvement.

Sessions are tracked in a local history table showing date, technique, duration, and cycles completed. This data feeds into the correlation engine (MM-010) as a factor.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone feature, but integrates with MM-001 for post-session mood logging and MM-010 for correlation)

**External Dependencies:**
- Haptic feedback API (device vibration for phase transitions)
- Audio engine for optional ambient tones (gentle chime on phase change)
- Animation framework for the breathing circle

**Assumed Capabilities:**
- Device supports haptic feedback
- Screen can remain awake during session (wake lock)

#### 3.5 User Interface Requirements

##### Screen: Breathing Home

**Layout:**
- Top: "Breathing" title
- Three technique cards arranged vertically:
  - Each card: technique name, brief description, cycle timing diagram (e.g., "4-4-4-4"), estimated duration for default 5 cycles
  - Card colors: Box Breathing (blue), 4-7-8 (purple), Coherent (teal)
- Below cards: "Session History" link
- Bottom: session stats summary ("12 sessions this month, 48 minutes total")

**Technique Card Details:**

| Technique | Timing Display | Default Duration | Description |
|-----------|---------------|-----------------|-------------|
| Box Breathing | "4-4-4-4" | 1 min 20 sec (5 cycles) | "Equal inhale, hold, exhale, hold. Calms acute stress." |
| 4-7-8 Technique | "4-7-8" | 1 min 35 sec (5 cycles) | "Extended exhale promotes deep relaxation and sleep." |
| Coherent Breathing | "5-5" | 50 sec (5 cycles) | "Rhythmic breathing optimizes heart rate variability." |

##### Screen: Active Session

**Layout:**
- Full-screen, dimmed background (dark overlay)
- Center: large animated breathing circle (200x200px base size)
  - Expands to 280px during inhale
  - Stays at 280px during hold (inhale-side)
  - Contracts to 200px during exhale
  - Stays at 200px during hold (exhale-side)
- Below circle: current phase label ("Inhale", "Hold", "Exhale") with countdown timer
- Below label: cycle counter ("Cycle 3 of 5")
- Top-left: elapsed time ("1:04")
- Top-right: "End" button
- Bottom-center: "Add 5 Cycles" button (appears after cycle 3)

**Phase Colors:**
- Inhale: circle fills with a soft blue glow
- Hold: circle glows steady amber
- Exhale: circle transitions to soft green
- Between cycles (brief pause): circle is neutral gray

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Technique selected, session not started | "Tap to begin" text over breathing circle |
| Countdown | 3-second countdown before first cycle | "3... 2... 1..." with fade animation |
| Active | Session in progress | Animated circle with phase label and countdown |
| Paused | User tapped the circle | "Paused" overlay, circle frozen, tap to resume |
| Extending | User tapped "Add 5 Cycles" | Cycle total increases, button disappears for 2 more cycles |
| Completing | Final exhale of last cycle | Circle contracts one last time, fade to completion |
| Complete | All cycles finished | Completion screen (see below) |

**Interactions:**
- Tap technique card: opens Active Session with 3-second countdown
- Tap breathing circle (during session): pause/resume toggle
- Tap "End": confirmation dialog, then completion screen with partial data
- Tap "Add 5 Cycles": extends session by 5 cycles
- Swipe down: same as "End" (for quick exit)
- Device shake: no action (prevent accidental interruption)

**Haptic Feedback Pattern:**
- Phase transition (inhale to hold, hold to exhale, etc.): single medium haptic
- Cycle complete: double haptic
- Session complete: triple haptic

**Audio (Optional, respects device silent mode):**
- Phase transition: soft chime (different pitch for inhale vs exhale)
- Session complete: gentle bell

##### Screen: Session Complete

**Layout:**
- Checkmark animation at top
- "Session Complete" title
- Session stats: technique name, total duration, cycles completed
- "How do you feel now?" prompt with mood scale (1-10) from MM-001
- "Log Mood" button
- "Skip" link below button

**Interactions:**
- Log Mood: saves mood entry with a "post-breathing" tag, returns to Breathing Home
- Skip: returns to Breathing Home without logging

#### 3.6 Data Requirements

##### Entity: BreathingSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| technique | enum | Required, one of: box, fourSevenEight, coherent | None | The breathing technique used |
| startedAt | datetime | ISO 8601, required | Current timestamp | When the session began |
| completedAt | datetime or null | ISO 8601 | null | When the session ended (null if abandoned) |
| totalDurationSeconds | integer | Min 0 | 0 | Total elapsed time in seconds |
| cyclesPlanned | integer | Min 1 | 5 | Number of cycles originally planned |
| cyclesCompleted | integer | Min 0 | 0 | Number of cycles actually completed |
| wasCompleted | boolean | Required | false | Whether all planned cycles were finished |
| postMoodEntryId | string or null | Foreign key to MoodEntry.id | null | Mood entry logged after session (if any) |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- BreathingSession optionally links to MoodEntry (one-to-one via postMoodEntryId)

**Indexes:**
- `technique` - Filter sessions by type
- `startedAt` - Chronological listing
- `started_at, technique` - Technique-specific history queries

**Validation Rules:**
- `technique`: must be one of the three valid values
- `cyclesCompleted`: must be <= cyclesPlanned
- `completedAt`: must be >= startedAt
- `totalDurationSeconds`: must match (completedAt - startedAt) within 2-second tolerance

**Example Data:**

```json
{
  "id": "breath-001",
  "technique": "box",
  "startedAt": "2026-03-06T22:00:00Z",
  "completedAt": "2026-03-06T22:01:20Z",
  "totalDurationSeconds": 80,
  "cyclesPlanned": 5,
  "cyclesCompleted": 5,
  "wasCompleted": true,
  "postMoodEntryId": "mood-entry-456",
  "createdAt": "2026-03-06T22:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Breathing Cycle Timer

**Purpose:** Drive the animated breathing circle through the correct phase sequence and timing.

**Inputs:**
- technique: enum (box, fourSevenEight, coherent)
- cycles: integer (number of cycles to complete)

**Logic:**

```
1. Define phase sequences:
   - box: [inhale(4s), hold(4s), exhale(4s), hold(4s)]
   - fourSevenEight: [inhale(4s), hold(7s), exhale(8s)]
   - coherent: [inhale(5s), exhale(5s)]
2. SET currentCycle = 1, currentPhaseIndex = 0, elapsed = 0
3. START countdown: 3, 2, 1
4. LOOP while currentCycle <= cycles:
   a. SET phase = phases[currentPhaseIndex]
   b. Start phase timer (phase.duration seconds)
   c. Emit phaseStart event with {phaseName, duration, cycle, technique}
   d. Wait for phase timer to complete
   e. Emit phaseEnd event
   f. Trigger haptic feedback
   g. currentPhaseIndex = (currentPhaseIndex + 1) % phases.length
   h. IF currentPhaseIndex == 0 THEN:
      - currentCycle += 1
      - Emit cycleComplete event
5. Emit sessionComplete event with total elapsed time and cycles completed
```

**Edge Cases:**
- User pauses mid-phase: timer freezes, resumes from same point
- User ends mid-cycle: record partial cycle (cyclesCompleted = completed full cycles only)
- App goes to background: pause session, resume on foreground
- Phone call interrupts: pause session, show "Session paused" on return

##### Session Statistics Aggregation

**Purpose:** Compute summary statistics for the breathing session history.

**Inputs:**
- sessions: list of BreathingSession records
- period: string (thisWeek, thisMonth, allTime)

**Logic:**

```
1. Filter sessions by period
2. totalSessions = count of sessions
3. completedSessions = count where wasCompleted == true
4. totalMinutes = SUM(totalDurationSeconds) / 60, rounded to 0 decimal
5. avgDuration = totalMinutes / totalSessions
6. favoredTechnique = technique with highest session count
7. completionRate = (completedSessions / totalSessions) * 100
8. RETURN { totalSessions, completedSessions, totalMinutes, avgDuration, favoredTechnique, completionRate }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Haptic feedback unavailable | Session continues without haptics | Visual-only feedback (circle color changes are sufficient) |
| Audio playback fails | Session continues silently | No impact on functionality |
| Wake lock fails (screen turns off) | Session pauses automatically | Resume prompt on screen wake |
| Timer drift (>500ms per cycle) | Recalibrate timer at cycle boundary | Log drift amount for debugging |
| Session record write fails | Toast: "Session completed but could not save history" | Session data lost, mood log still offered |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "Box Breathing" card,
   **When** the 3-second countdown finishes,
   **Then** the breathing circle begins expanding for 4 seconds (inhale), with "Inhale" label and "4... 3... 2... 1..." countdown.

2. **Given** the user completes all 5 cycles of Box Breathing,
   **When** the session ends,
   **Then** the completion screen shows "Session Complete", duration "1:20", and offers mood logging.

3. **Given** the user logs a mood after a breathing session,
   **When** the entry is saved,
   **Then** the BreathingSession record links to the MoodEntry via postMoodEntryId.

**Edge Cases:**

4. **Given** the user taps "Add 5 Cycles" during cycle 4 of 5,
   **When** they continue the session,
   **Then** the cycle counter updates to "Cycle 4 of 10" and the session continues.

5. **Given** the user taps the breathing circle to pause,
   **When** they are in the middle of a 7-second hold,
   **Then** the timer freezes at the current countdown value and the circle stops animating.

6. **Given** the app goes to background during a session,
   **When** the user returns,
   **Then** the session is paused with a "Tap to resume" overlay.

**Negative Tests:**

7. **Given** the user taps "End" after 2 complete cycles,
   **When** they confirm,
   **Then** the session records cyclesCompleted = 2, wasCompleted = false, and offers mood logging.

8. **Given** the user skips mood logging after a session,
   **When** they return to Breathing Home,
   **Then** the session history still records the breathing session with postMoodEntryId = null.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| box breathing cycle duration | 1 cycle | 16 seconds total |
| 4-7-8 cycle duration | 1 cycle | 19 seconds total |
| coherent breathing cycle duration | 1 cycle | 10 seconds total |
| box breathing 5 cycles | 5 cycles | 80 seconds total |
| phase sequence box | technique: box | [inhale(4), hold(4), exhale(4), hold(4)] |
| phase sequence 4-7-8 | technique: fourSevenEight | [inhale(4), hold(7), exhale(8)] |
| phase sequence coherent | technique: coherent | [inhale(5), exhale(5)] |
| add cycles mid-session | planned=5, add 5 at cycle 3 | new planned=10 |
| session stats aggregation | 10 sessions, 8 completed | completionRate = 80% |
| partial session recording | ended at cycle 2 of 5 | cyclesCompleted=2, wasCompleted=false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full session with mood log | 1. Start Box Breathing, 2. Complete 5 cycles, 3. Log mood 7 | Session + MoodEntry linked |
| Session history populates | 1. Complete 3 sessions, 2. View history | 3 sessions listed with correct details |
| Pause and resume | 1. Start session, 2. Pause at cycle 2, 3. Resume | Session continues from pause point |
| Correlation with mood | 1. Complete 10 sessions over 10 days with mood logs, 2. View Insights | "Breathing" appears as a correlatable factor |

---

### MM-012: Guided Journaling Prompts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-012 |
| **Feature Name** | Guided Journaling Prompts |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who finds it hard to know what to write, I want guided prompts that respond to my current mood score, so that I can reflect meaningfully even when I do not know where to start.

**Secondary:**
> As a therapy-supported user, I want CBT-informed reflection prompts when I log a low mood, so that I can practice cognitive reframing techniques between therapy sessions.

**Tertiary:**
> As a long-term user, I want the prompts to rotate and avoid repetition, so that I stay engaged with the journaling practice over months and years.

#### 3.3 Detailed Description

Guided Journaling Prompts provides contextual writing prompts that appear in the micro-journal editor (MM-004) based on the user's current mood score and emotion tags. Prompts are drawn from a local library of 200+ pre-written prompts organized by mood range and theme.

Prompts are categorized into five mood bands:

| Score Range | Band | Prompt Tone |
|-------------|------|-------------|
| 1-2 | Crisis | Grounding, safety, self-compassion. No toxic positivity. |
| 3-4 | Low | Gentle exploration, acknowledging difficulty, identifying small wins |
| 5-6 | Neutral | Self-reflection, values exploration, future orientation |
| 7-8 | Good | Gratitude, savoring, capturing what went well |
| 9-10 | Excellent | Celebration, sharing, identifying peak experiences |

Within each band, prompts are further categorized by theme: Gratitude, Reflection, Relationships, Work, Health, Growth, Creativity, and Nature. Emotion tags influence prompt selection: if the user tagged "anxiety," anxiety-relevant prompts are prioritized.

A rotation system ensures the user does not see the same prompt twice within a 30-day window unless they have exhausted all prompts in their mood band. The system tracks which prompts have been shown and when.

Prompts are displayed as a swipeable carousel of 3 prompts at the top of the micro-journal editor. The user taps a prompt to use it as a writing starter (the prompt text is inserted at the top of the journal, followed by a blank line for their response). Users can also tap "Random prompt" to get a fresh selection or "No prompt" to write freely.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): current mood score for prompt selection
- MM-004 (Mood Notes & Micro-Journal): journal editor where prompts appear
- MM-002 (Emotion Wheel): emotion tags for prompt relevance scoring

**External Dependencies:**
- None (prompts are bundled locally as static data)

**Assumed Capabilities:**
- Mood score available before journal editor opens
- Prompt library loaded into memory at module initialization

#### 3.5 User Interface Requirements

##### Component: Prompt Carousel (Inline in Micro-Journal Editor)

**Layout:**
- Horizontal scrollable carousel at the top of the micro-journal editor
- 3 prompt cards visible, each showing:
  - Prompt text (2-3 lines, ~100 characters max)
  - Theme tag (e.g., "Gratitude", "Reflection") in small muted text
- Dots indicator below carousel showing position (3 dots)
- Below carousel: "Random" button (left) and "No prompt" button (right)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Prompts Available | Score-matched prompts exist | 3-card carousel with swipe |
| Prompt Selected | User tapped a prompt | Prompt text inserted into editor, carousel collapses |
| Random Requested | User tapped "Random" | Carousel refreshes with 3 new prompts |
| No Prompt | User tapped "No prompt" | Carousel collapses, empty editor shown |
| All Prompts Exhausted | User has seen all prompts in band within 30 days | "You've explored all prompts for this mood range! Writing freestyle." |

**Interactions:**
- Swipe carousel: scroll between 3 prompts
- Tap prompt card: insert prompt into editor, collapse carousel
- Tap "Random": shuffle and display 3 new prompts
- Tap "No prompt": collapse carousel, write freely
- Swipe down on carousel: collapse without selecting

**Transitions/Animations:**
- Carousel slide: horizontal scroll with snap points (200ms)
- Prompt insertion: text types in character-by-character (50ms per character, max 2 seconds)
- Carousel collapse: height animates to 0 (250ms)

#### 3.6 Data Requirements

##### Entity: JournalingPrompt (Static/Seed Data)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Assigned | Unique prompt identifier |
| text | string | Required, max 200 chars | None | The prompt text |
| moodBand | enum | crisis, low, neutral, good, excellent | None | Target mood score range |
| theme | enum | gratitude, reflection, relationships, work, health, growth, creativity, nature | None | Thematic category |
| emotionRelevance | string[] | Optional | [] | Emotion names this prompt is especially relevant for |

##### Entity: PromptHistory

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| promptId | string | Foreign key to JournalingPrompt.id | None | The prompt that was shown |
| shownAt | datetime | ISO 8601 | Current timestamp | When the prompt was displayed |
| wasSelected | boolean | Required | false | Whether the user tapped this prompt to write |
| entryId | string or null | Foreign key to MoodEntry.id | null | The mood entry this prompt was used for (if selected) |

**Indexes:**
- `mo_prompt_history(promptId, shownAt)` - Rotation lookups
- `mo_prompt_history(shownAt)` - Recent history queries
- `mo_journaling_prompts(moodBand, theme)` - Filtered prompt selection

**Validation Rules:**
- `promptId`: must reference a valid JournalingPrompt
- `shownAt`: auto-set, not user-editable
- Prompt text: must not exceed 200 characters

**Prompt Count Targets:**

| Mood Band | Target Count |
|-----------|-------------|
| crisis (1-2) | 30 prompts |
| low (3-4) | 40 prompts |
| neutral (5-6) | 50 prompts |
| good (7-8) | 50 prompts |
| excellent (9-10) | 30 prompts |
| **Total** | **200 prompts** |

#### 3.7 Business Logic Rules

##### Prompt Selection Algorithm

**Purpose:** Select 3 relevant, non-repeated prompts for the user's current mood and emotions.

**Inputs:**
- score: integer (1-10) - current mood score
- emotionTags: string[] - emotions tagged on this entry
- showHistory: list of PromptHistory records from the last 30 days

**Logic:**

```
1. Determine moodBand from score:
   - 1-2: "crisis"
   - 3-4: "low"
   - 5-6: "neutral"
   - 7-8: "good"
   - 9-10: "excellent"
2. Get all prompts in this moodBand
3. Exclude prompts shown in the last 30 days (by promptId in showHistory)
4. IF fewer than 3 prompts remaining THEN reset the 30-day window (re-include all)
5. Score remaining prompts:
   a. Base score: 1.0
   b. IF prompt.emotionRelevance intersects emotionTags THEN add 2.0 per match
   c. IF prompt.theme matches a theme the user has not seen in 7 days THEN add 1.0
6. Sort by score DESC, then shuffle ties randomly
7. Take top 3 prompts
8. Record all 3 in PromptHistory with wasSelected = false
9. RETURN 3 prompts
```

**Edge Cases:**
- No emotion tags: skip emotion relevance scoring, use base scores only
- User has seen all 200 prompts in 30 days: reset window, re-include all
- Mood score changes after prompt selection: prompts not refreshed (user keeps current selection)
- Crisis band (1-2): never include prompts that could be perceived as dismissive of pain

##### Prompt Insertion

**Purpose:** Insert the selected prompt text into the micro-journal editor.

**Inputs:**
- promptText: string - the selected prompt
- existingContent: string - current editor content (may be empty or have quick note)

**Logic:**

```
1. IF existingContent is empty:
   a. SET editor content to: promptText + "\n\n"
   b. Place cursor after the two newlines
2. IF existingContent is not empty:
   a. SET editor content to: promptText + "\n\n" + existingContent
   b. Place cursor between prompt and existing content
3. Mark prompt as selected in PromptHistory (wasSelected = true)
4. Link PromptHistory to the MoodEntry (set entryId)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Prompt library not loaded | Carousel hidden, editor opens normally | Retry load on next session |
| Prompt history write fails | Prompts still displayed, rotation may repeat | Log warning, user experience unaffected |
| All prompts exhausted and reset fails | Show "Write freely" state | Editor functions normally without prompts |
| Prompt text corrupted (empty or too long) | Skip corrupted prompt, show next valid one | Log warning |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user logs a mood of 3 and opens the micro-journal,
   **When** the prompt carousel appears,
   **Then** 3 prompts from the "low" mood band are displayed.

2. **Given** the user taps a prompt "What is one small thing that went right today?",
   **When** the prompt is selected,
   **Then** the prompt text appears at the top of the editor, followed by a blank line, and the cursor is positioned for writing.

3. **Given** the user has seen 15 prompts in the "good" band this month,
   **When** they log mood 7 and open the journal,
   **Then** 3 unseen prompts from the remaining 35 "good" prompts are shown.

**Edge Cases:**

4. **Given** the user tagged "anxiety" as an emotion,
   **When** prompts are selected,
   **Then** prompts with "anxiety" in emotionRelevance are prioritized (appear first in carousel).

5. **Given** the user taps "Random",
   **When** new prompts load,
   **Then** 3 different prompts from the same mood band appear (none of the previous 3).

6. **Given** the user has exhausted all 40 "low" prompts in 30 days,
   **When** they log mood 4,
   **Then** the rotation resets and previously shown prompts become available again.

**Negative Tests:**

7. **Given** the user taps "No prompt",
   **When** the carousel collapses,
   **Then** the editor is empty and ready for free writing.

8. **Given** the prompt library fails to load,
   **When** the user opens the micro-journal,
   **Then** the carousel is not shown and the editor opens normally.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| maps score 1 to crisis band | score = 1 | "crisis" |
| maps score 5 to neutral band | score = 5 | "neutral" |
| maps score 10 to excellent band | score = 10 | "excellent" |
| excludes recently shown prompts | 5 shown in last 30 days | those 5 excluded |
| resets window when exhausted | all prompts shown | all prompts available again |
| emotion relevance boosts score | anxiety prompt + anxiety tag | prompt score += 2.0 |
| selects exactly 3 prompts | 50 available | 3 returned |
| handles no emotion tags | empty emotions | base score only, 3 returned |
| inserts prompt into empty editor | empty content + prompt | prompt + "\n\n" |
| inserts prompt above existing | existing content + prompt | prompt + "\n\n" + existing |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Prompt appears for low mood | 1. Log mood 3, 2. Open journal | Crisis/low prompts shown in carousel |
| Prompt selection tracked | 1. Show 3 prompts, 2. Select one | PromptHistory has 3 records, 1 with wasSelected=true |
| Rotation avoids repeats | 1. Use prompts daily for 7 days | No prompt repeated within 30-day window |
| Prompt inserted into journal | 1. Tap prompt, 2. Write response, 3. Save | Entry contains prompt text + user response |

---

### MM-013: Mood Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-013 |
| **Feature Name** | Mood Reminders |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to set reminders that prompt me to log my mood at specific times each day, so that I build a consistent logging habit and do not forget to check in with myself.

**Secondary:**
> As a busy professional, I want to customize different reminder times for weekdays vs weekends, so that the reminders match my different routines.

**Tertiary:**
> As a user with a flexible schedule, I want to set random-window reminders that notify me at a random time within a range (e.g., somewhere between 10 AM and 2 PM), so that I log moods at varied times and avoid routine bias.

#### 3.3 Detailed Description

Mood Reminders sends local push notifications prompting the user to log their mood. Users can configure up to 5 daily reminders, each with a specific time or a random-window range. Reminders support weekday/weekend differentiation and can be individually toggled on/off.

Each reminder fires a local notification with the message "How are you feeling?" (customizable). Tapping the notification opens the mood log flow (MM-001) directly. Notifications include a "Quick Log" action button that opens a compact mood scale (1-10) directly in the notification response (on platforms that support interactive notifications).

Reminders are configured in the Settings screen. A "Smart Reminder" option analyzes the user's existing logging patterns and suggests optimal reminder times based on gaps in their logging history (e.g., "You rarely log in the afternoon. Add a 2 PM reminder?").

All reminder scheduling uses local notifications only (no server-side push). Reminder configuration is stored in the local database and never transmitted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): deep-link target from notification tap

**External Dependencies:**
- Local notification API (Expo Notifications or platform-native)
- Notification permission request flow
- Background scheduling for random-window reminders

**Assumed Capabilities:**
- User has granted (or will be asked to grant) notification permissions
- Device supports local scheduled notifications

#### 3.5 User Interface Requirements

##### Screen: Reminder Settings

**Layout:**
- Top: "Mood Reminders" title with master toggle (enables/disables all reminders)
- Below toggle: permission status banner (if notifications not permitted: "Enable notifications in Settings to receive reminders")
- Reminder list: up to 5 reminder rows, each showing:
  - Time or time range (e.g., "9:00 AM" or "10 AM - 2 PM")
  - Days active (e.g., "Every day", "Weekdays", "Weekends", or custom day chips)
  - Toggle switch to enable/disable individually
  - Swipe to delete
- "Add Reminder" button (disabled when 5 reminders exist)
- Below reminders: "Smart Suggestions" section
- Notification message customization: text field with "How are you feeling?" default

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Reminders | Zero reminders configured | "Set a daily reminder to build your mood tracking habit" with Add button |
| Active Reminders | 1-5 reminders, master toggle on | List of reminders with toggles |
| All Disabled | Master toggle off | Reminders listed but grayed out, banner: "Reminders paused" |
| Permission Denied | Notification permission not granted | Warning banner with "Open Settings" button |
| Max Reminders | 5 reminders configured | "Add Reminder" button disabled, "Maximum 5 reminders" tooltip |

##### Dialog: Add/Edit Reminder

**Layout:**
- Time picker (hour:minute, 12h or 24h based on device)
- "Random window" toggle: when enabled, shows start time and end time pickers
- Day selector: 7 day buttons (M T W T F S S), tap to toggle each day
- Quick presets: "Every day", "Weekdays", "Weekends"
- Save and Cancel buttons

**Interactions:**
- Tap time picker: opens native time selector
- Toggle "Random window": shows two time pickers (earliest and latest)
- Tap day button: toggles that day on/off
- Tap preset: selects the appropriate day buttons
- Tap Save: validates and creates/updates the reminder
- Tap Cancel: discards changes

##### Component: Smart Suggestions

**Layout:**
- Section below reminders list
- Card with light bulb icon: "Suggestion: You rarely log in the evening. Add a 7 PM reminder?"
- "Add" button and "Dismiss" button

#### 3.6 Data Requirements

##### Entity: MoodReminder

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| timeHour | integer | 0-23, required | None | Hour for the reminder (24h format) |
| timeMinute | integer | 0-59, required | 0 | Minute for the reminder |
| isRandomWindow | boolean | Required | false | Whether to randomize within a time range |
| windowEndHour | integer or null | 0-23 | null | End hour for random window |
| windowEndMinute | integer or null | 0-59 | null | End minute for random window |
| daysOfWeek | integer[] | Required, subset of [0-6] | [0,1,2,3,4,5,6] | Days the reminder is active (0=Monday, 6=Sunday) |
| isEnabled | boolean | Required | true | Whether this individual reminder is active |
| message | string | Max 100 chars | "How are you feeling?" | Notification body text |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `isEnabled` - Filter active reminders for scheduling

**Validation Rules:**
- Maximum 5 reminders per user
- `timeHour`: must be 0-23
- `timeMinute`: must be 0-59
- `daysOfWeek`: must have at least 1 day selected
- If `isRandomWindow`: windowEndHour/Minute must be after timeHour/Minute (or wrap past midnight)
- `message`: 1-100 characters

**Example Data:**

```json
{
  "id": "reminder-001",
  "timeHour": 9,
  "timeMinute": 0,
  "isRandomWindow": false,
  "windowEndHour": null,
  "windowEndMinute": null,
  "daysOfWeek": [0, 1, 2, 3, 4],
  "isEnabled": true,
  "message": "How are you feeling?",
  "createdAt": "2026-03-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Notification Scheduling

**Purpose:** Schedule local notifications for all active reminders.

**Inputs:**
- reminders: list of MoodReminder records where isEnabled = true
- masterEnabled: boolean

**Logic:**

```
1. Cancel all previously scheduled MyMood notifications
2. IF masterEnabled == false THEN RETURN (no notifications scheduled)
3. FOR each reminder:
   a. IF not reminder.isEnabled THEN skip
   b. FOR each day in reminder.daysOfWeek:
      i. IF reminder.isRandomWindow:
         - Generate random time between (timeHour:timeMinute) and (windowEndHour:windowEndMinute)
         - Schedule notification for that random time on the next occurrence of this day
      ii. ELSE:
         - Schedule notification for timeHour:timeMinute on the next occurrence of this day
      iii. Set notification content: title "MyMood", body = reminder.message
      iv. Set notification action: opens mood log flow
      v. Set repeat: weekly on this day at the scheduled time
4. Store scheduled notification IDs for future cancellation
```

**Edge Cases:**
- Random window spanning midnight (e.g., 11 PM to 1 AM): wrap around, pick a random time in the valid range
- Multiple reminders at the same time: both fire (system handles deduplication)
- Device restarted: notifications reschedule on app launch (if supported by platform)
- User changes timezone: reschedule all notifications on timezone change detection

##### Smart Suggestion Generation

**Purpose:** Analyze logging patterns and suggest optimal reminder times.

**Inputs:**
- entries: list of MoodEntry records from the last 30 days
- existingReminders: list of MoodReminder records

**Logic:**

```
1. Bucket entries by hour (0-23)
2. Identify "gap hours" where no entries exist in the last 30 days
3. Group gap hours into time blocks: morning (6-11), afternoon (12-17), evening (18-22)
4. Find the largest gap block
5. IF a gap block has 0 entries AND no existing reminder covers it:
   a. Suggest a reminder at the midpoint of the gap block
   b. Generate message: "You rarely log in the [block]. Add a [time] reminder?"
6. IF no gaps found OR all gaps covered by existing reminders:
   a. No suggestion shown
```

**Edge Cases:**
- User has fewer than 7 days of data: do not generate suggestions yet
- User already has 5 reminders: do not suggest (cannot add more)
- All time blocks covered: no suggestion

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Notification permission denied | Banner: "Enable notifications in Settings to receive reminders" with deep link | User must grant permission in OS settings |
| Notification scheduling fails | Toast: "Could not schedule reminder. Please try again." | Retry on next app open |
| Reminder save fails | Toast: "Could not save reminder." | Changes not persisted, user can retry |
| Random window generates invalid time | Fallback to start time of window | Log warning |
| Platform does not support interactive notifications | Standard notification (tap opens app) | Action button not shown |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a reminder for 9:00 AM every weekday,
   **When** 9:00 AM arrives on a Tuesday,
   **Then** a notification appears: "MyMood - How are you feeling?" and tapping it opens the mood log.

2. **Given** the user enables a random-window reminder between 10 AM and 2 PM,
   **When** Monday arrives,
   **Then** the notification fires at a random time within the 10 AM to 2 PM window.

3. **Given** the user has no evening entries in 30 days,
   **When** they open Reminder Settings,
   **Then** a smart suggestion appears: "You rarely log in the evening. Add a 7 PM reminder?"

**Edge Cases:**

4. **Given** the user already has 5 reminders,
   **When** they try to add a 6th,
   **Then** the "Add Reminder" button is disabled with tooltip "Maximum 5 reminders."

5. **Given** the user toggles the master switch off,
   **When** all reminders are disabled,
   **Then** all scheduled notifications are cancelled and the reminder list is grayed out.

6. **Given** the user has not granted notification permissions,
   **When** they open Reminder Settings,
   **Then** a warning banner explains how to enable notifications.

**Negative Tests:**

7. **Given** the user sets a reminder for weekdays only,
   **When** Saturday arrives,
   **Then** no notification fires.

8. **Given** the notification scheduling API fails,
   **When** the user saves a reminder,
   **Then** the reminder is saved locally and rescheduling is retried on next app open.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| schedules notification at exact time | 9:00 AM, weekdays | 5 weekly repeating notifications |
| random window picks valid time | 10 AM - 2 PM | time between 10:00 and 14:00 |
| random window midnight wrap | 11 PM - 1 AM | time in [23:00-23:59] or [0:00-1:00] |
| max 5 reminders enforced | 5 existing, add 1 more | validation error |
| master toggle cancels all | masterEnabled = false | 0 notifications scheduled |
| smart suggestion finds gap | entries only in morning | suggests afternoon reminder |
| smart suggestion none needed | entries spread across day | no suggestion |
| day filter weekdays only | daysOfWeek = [0,1,2,3,4] | 5 notifications (Mon-Fri) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Reminder fires notification | 1. Create 9 AM reminder, 2. Wait for time | Notification received |
| Notification opens mood log | 1. Receive notification, 2. Tap it | Mood log screen opens |
| Disable and re-enable | 1. Disable master, 2. Re-enable | All reminders rescheduled |
| Delete reminder | 1. Create reminder, 2. Swipe to delete | Reminder removed, notification cancelled |

---

### MM-014: Photo Attachments

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-014 |
| **Feature Name** | Photo Attachments |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a mood tracker user, I want to attach a photo to my mood entry, so that I can visually capture the moment and revisit it later with full context.

**Secondary:**
> As a visual thinker, I want to browse past entries by their photos in a gallery view, so that I can see my emotional history as a visual story rather than just numbers and text.

**Tertiary:**
> As a privacy-conscious user, I want all photos stored locally on my device with no cloud upload, so that sensitive images associated with my mood entries remain private.

#### 3.3 Detailed Description

Photo Attachments allows users to attach up to 3 photos to any mood entry. Photos can be captured with the device camera or selected from the photo library. They are stored locally in the app's file system (not in the SQLite database) with references stored in a PhotoAttachment table.

Photos are displayed as thumbnails on timeline cards (MM-005) and as a scrollable full-width gallery when the entry is expanded. A dedicated Photo Gallery view shows all mood entries that have photos, arranged chronologically with their mood scores, enabling visual mood review.

Images are resized on save to a maximum dimension of 1920px (longest edge) to manage storage usage. Thumbnails (200px longest edge) are generated and cached for timeline card display. Original photos from the camera roll are not modified; only copies within the app are resized.

The Photo Gallery view supports filtering by date range and mood score, and each photo shows a small overlay with the mood score, date, and first emotion tag. Tapping a photo navigates to the full mood entry in the timeline.

Storage management shows total photo storage usage in settings and allows bulk deletion of photos older than a selected date range.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood entries to attach photos to

**External Dependencies:**
- Camera access permission
- Photo library access permission
- File system storage for image files
- Image resizing/compression library

**Assumed Capabilities:**
- Device has a camera or photo library
- Sufficient local storage for photo files

#### 3.5 User Interface Requirements

##### Component: Photo Attach (Inline in Mood Log)

**Layout:**
- Below the note field in the mood log flow
- "Add Photo" button with camera icon
- When photos are attached: horizontal scrollable row of thumbnails (80x80px)
- Each thumbnail has an "x" remove button in the top-right corner
- Counter: "1/3 photos" or "2/3 photos" or "3/3" (max reached)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Photos | No photos attached | "Add Photo" button only |
| Has Photos | 1-2 photos attached | Thumbnail row + "Add Photo" button |
| Max Photos | 3 photos attached | Thumbnail row, "Add Photo" disabled, "3/3 photos" label |
| Uploading | Photo being processed (resize) | Thumbnail placeholder with progress ring |

**Interactions:**
- Tap "Add Photo": shows action sheet with "Take Photo" and "Choose from Library"
- Tap "Take Photo": opens camera in photo capture mode
- Tap "Choose from Library": opens photo picker (single selection)
- Tap thumbnail: opens full-size preview
- Tap "x" on thumbnail: removes photo with confirmation
- Long press thumbnail: reorder photos (drag to rearrange)

##### Screen: Photo Gallery

**Layout:**
- Top: "Photo Gallery" title with filter button
- Grid layout: 3 columns of square thumbnails
- Each thumbnail shows:
  - Photo (cropped to square)
  - Bottom overlay: mood score circle (small) + date in compact format
- Pull to load more (paginated, 30 photos per page)
- Empty state: "No photos yet. Attach a photo to a mood entry to start your visual journal."

**Interactions:**
- Tap photo: opens full-screen photo viewer with mood entry details
- Tap filter button: shows date range and mood score filter options
- Scroll to bottom: loads next page

##### Screen: Full-Screen Photo Viewer

**Layout:**
- Full-screen photo with swipe-to-dismiss
- Bottom bar: mood score, date, emotion chips, note preview
- Swipe left/right: navigate between photos in the gallery
- Tap "View Entry": navigates to the full mood entry in timeline

#### 3.6 Data Requirements

##### Entity: PhotoAttachment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| entryId | string | Foreign key to MoodEntry.id, required | None | The mood entry this photo belongs to |
| filePath | string | Required | None | Relative path to the resized photo file |
| thumbnailPath | string | Required | None | Relative path to the thumbnail file |
| originalFileName | string | Required | None | Original file name from camera/library |
| widthPx | integer | Required, min 1 | None | Image width in pixels (resized) |
| heightPx | integer | Required, min 1 | None | Image height in pixels (resized) |
| fileSizeBytes | integer | Required, min 1 | None | File size of the resized image |
| sortOrder | integer | Required, min 0 | Auto-incremented | Display order within the entry |
| capturedAt | datetime or null | ISO 8601 | null | EXIF capture date if available |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- PhotoAttachment belongs to MoodEntry (many-to-one via entryId)

**Indexes:**
- `entryId` - Photos for a given entry
- `entryId, sortOrder` - Ordered photos for an entry
- `createdAt` - Chronological photo gallery listing

**Validation Rules:**
- Maximum 3 PhotoAttachment records per entryId
- `filePath` and `thumbnailPath`: must reference existing files on disk
- `fileSizeBytes`: max 10 MB per photo (after resize)
- Supported formats: JPEG, PNG, HEIF/HEIC (converted to JPEG on save)

**Storage Strategy:**
- Photos stored at: `{appDocumentsDir}/mood-photos/{entryId}/{id}.jpg`
- Thumbnails stored at: `{appDocumentsDir}/mood-photos/{entryId}/{id}_thumb.jpg`
- Resize target: longest edge 1920px, JPEG quality 85%
- Thumbnail target: longest edge 200px, JPEG quality 70%

**Example Data:**

```json
{
  "id": "photo-001",
  "entryId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "filePath": "mood-photos/f47ac10b/photo-001.jpg",
  "thumbnailPath": "mood-photos/f47ac10b/photo-001_thumb.jpg",
  "originalFileName": "IMG_4523.heic",
  "widthPx": 1920,
  "heightPx": 1440,
  "fileSizeBytes": 524288,
  "sortOrder": 0,
  "capturedAt": "2026-03-06T08:10:00Z",
  "createdAt": "2026-03-06T08:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Photo Processing Pipeline

**Purpose:** Resize, compress, and store a photo when attached to a mood entry.

**Inputs:**
- sourceUri: string - URI of the original photo (camera capture or library selection)
- entryId: string - the mood entry to attach to

**Logic:**

```
1. Read source image metadata (dimensions, format, EXIF date)
2. IF format is HEIF/HEIC THEN convert to JPEG
3. Compute resize dimensions:
   a. IF longest edge > 1920px THEN scale down proportionally so longest edge = 1920
   b. ELSE keep original dimensions
4. Resize and compress to JPEG at 85% quality
5. Generate thumbnail: resize so longest edge = 200px, JPEG at 70% quality
6. Generate file paths:
   a. filePath = "mood-photos/{entryId}/{newUUID}.jpg"
   b. thumbnailPath = "mood-photos/{entryId}/{newUUID}_thumb.jpg"
7. Write both files to app documents directory
8. Create PhotoAttachment record with dimensions, file size, paths
9. RETURN PhotoAttachment record
```

**Edge Cases:**
- Very large photo (>20 MB source): resize may take 1-2 seconds, show progress
- Corrupt image file: reject with "Could not process this image"
- Camera cancelled: no photo added, no side effects
- Storage full: reject with "Not enough storage space for this photo"

##### Storage Usage Calculation

**Purpose:** Compute total storage used by mood photos for the settings display.

**Inputs:**
- all PhotoAttachment records

**Logic:**

```
1. SUM(fileSizeBytes) across all PhotoAttachment records for resized images
2. Estimate thumbnail total as approximately 5% of resized total
3. totalBytes = resizedTotal + thumbnailEstimate
4. Format as human-readable: "45.2 MB used by mood photos"
5. RETURN { totalBytes, formattedSize, photoCount }
```

##### Bulk Photo Deletion

**Purpose:** Delete photos older than a specified date to reclaim storage.

**Inputs:**
- cutoffDate: string (YYYY-MM-DD) - delete photos from entries before this date

**Logic:**

```
1. Query all PhotoAttachment records WHERE createdAt < cutoffDate
2. Count records and sum file sizes for confirmation dialog
3. Show confirmation: "Delete N photos (X MB) from before [date]?"
4. IF confirmed:
   a. FOR each attachment:
      i. Delete filePath file from disk
      ii. Delete thumbnailPath file from disk
      iii. Delete PhotoAttachment record from database
   b. Clean up empty entry directories
5. RETURN { deletedCount, freedBytes }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | "Camera access required" with link to Settings | User grants permission in OS settings |
| Photo library permission denied | "Photo library access required" with link to Settings | User grants permission in OS settings |
| Image processing fails | Toast: "Could not process this image. Try another photo." | Photo not attached, user can retry |
| Storage full | Toast: "Not enough storage space. Free up space or delete old photos." | Guide user to storage management in settings |
| Photo file missing on disk | Thumbnail shows "Photo unavailable" placeholder | Database record remains, photo cannot be displayed |
| Disk write fails | Toast: "Could not save photo." | Photo not attached, user can retry |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "Add Photo" and selects "Take Photo",
   **When** they capture a photo and confirm,
   **Then** the photo is resized, a thumbnail appears in the mood log, and the counter shows "1/3 photos."

2. **Given** the user has attached 2 photos to a mood entry,
   **When** they view the entry on the timeline,
   **Then** 2 photo thumbnails appear on the timeline card.

3. **Given** the user opens the Photo Gallery with 50 photos across 30 entries,
   **When** the gallery loads,
   **Then** a 3-column grid shows 30 photos with mood score overlays, and scrolling loads more.

**Edge Cases:**

4. **Given** the user has attached 3 photos,
   **When** they try to add a 4th,
   **Then** the "Add Photo" button is disabled and "3/3 photos" is shown.

5. **Given** the user taps "x" on a photo thumbnail,
   **When** they confirm deletion,
   **Then** the photo file is deleted from disk, the database record is removed, and the counter updates.

6. **Given** a photo file is missing from disk but the database record exists,
   **When** the timeline card renders,
   **Then** a "Photo unavailable" placeholder is shown instead of the thumbnail.

**Negative Tests:**

7. **Given** the user selects a corrupt image file from the library,
   **When** processing fails,
   **Then** a toast shows "Could not process this image. Try another photo." and no photo is attached.

8. **Given** the device has insufficient storage,
   **When** the user tries to attach a photo,
   **Then** a toast shows "Not enough storage space" and suggests managing photos in settings.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| resize large image | 4000x3000px | 1920x1440px |
| no resize small image | 1200x900px | 1200x900px (unchanged) |
| thumbnail generation | 1920x1440px | 200x150px |
| max 3 photos enforced | 3 existing, add 1 | validation error |
| HEIC to JPEG conversion | source: .heic | output: .jpg |
| storage calculation | 3 photos at 500KB each | ~1.5MB + thumbnail estimate |
| bulk delete by date | cutoff = 2026-01-01, 10 photos before | 10 deleted |
| file path generation | entryId + photoId | "mood-photos/{entryId}/{photoId}.jpg" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Attach photo from camera | 1. Open camera, 2. Capture, 3. Confirm | Photo resized, thumbnail generated, record created |
| Attach photo from library | 1. Open picker, 2. Select photo | Photo processed and attached |
| Delete entry cascades photos | 1. Attach 2 photos, 2. Delete mood entry | Both photo files and records deleted |
| Gallery pagination | 1. Have 50 photos, 2. Scroll gallery | First 30 load, scroll loads next 20 |
| Storage management | 1. Attach 10 photos, 2. View storage in settings | Correct total shown |

---

### MM-015: PIN/Biometric Lock

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-015 |
| **Feature Name** | PIN/Biometric Lock |
| **Priority** | P1 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious user, I want to lock MyMood behind a PIN or biometric authentication, so that nobody who picks up my device can read my mood entries, emotion logs, or journal content.

**Secondary:**
> As a user sharing a device with family, I want the lock to engage every time I leave the mood module, so that my mood data is never visible to other household members using the same device.

**Tertiary:**
> As a user who forgets PINs, I want to use Face ID or fingerprint as my primary unlock method, so that I can access my mood data quickly without memorizing a code.

#### 3.3 Detailed Description

PIN/Biometric Lock adds an authentication layer to the MyMood module. When enabled, the user must authenticate before accessing any mood data, including the timeline, trends, insights, journal entries, photos, and settings (except the lock settings screen itself). The lock engages when the user navigates away from the mood module or when the app returns from background after a configurable timeout.

The lock supports three modes:
1. **PIN only:** 4-6 digit numeric PIN
2. **Biometric only:** Face ID, Touch ID, or platform-equivalent fingerprint
3. **Biometric + PIN fallback:** biometric is primary, PIN is fallback if biometric fails

The lock screen shows the MyMood icon and a "Locked" message. For PIN mode, a numeric keypad is displayed. For biometric mode, the biometric prompt appears automatically. After 5 failed PIN attempts, the module locks for 5 minutes (anti-brute-force).

Lock timeout is configurable: Immediately (lock when leaving module), 1 minute, 5 minutes, or 15 minutes. During the timeout window, returning to the module does not require re-authentication.

The PIN is stored as a salted hash (never in plaintext). The salt is generated per-device using a cryptographically secure random generator.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone security feature)

**External Dependencies:**
- Biometric authentication API (Face ID/Touch ID on iOS, BiometricPrompt on Android)
- Secure storage for hashed PIN (Keychain on iOS, Keystore on Android)
- Cryptographic hashing library

**Assumed Capabilities:**
- Device supports at least one biometric method (optional; PIN-only is always available)
- Secure enclave or equivalent for hash storage

#### 3.5 User Interface Requirements

##### Screen: Lock Settings

**Layout:**
- Top: "Privacy Lock" title
- Master toggle: "Enable Lock" (on/off)
- When enabled:
  - Lock method selector: "PIN", "Biometric", "Biometric + PIN"
  - Lock timeout selector: "Immediately", "1 minute", "5 minutes", "15 minutes"
  - "Change PIN" button (if PIN is configured)
  - "Reset Lock" button (requires current PIN or biometric to access)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Disabled | Lock not enabled | Master toggle off, no options shown |
| PIN Setup | User enabling PIN for first time | PIN entry screen (enter + confirm) |
| Configured | Lock enabled with method chosen | Method and timeout selectors, Change PIN button |
| Biometric Unavailable | Device does not support biometrics | "Biometric" options grayed out, "Not available on this device" |

##### Screen: Lock Screen

**Layout:**
- Full-screen overlay covering all mood content
- Center: MyMood icon (mood emoji) + "MyMood is Locked" text
- Below: authentication input based on configured method
  - PIN: 4-6 dot indicators + numeric keypad (0-9)
  - Biometric: "Use [Face ID/Touch ID] to unlock" with biometric icon
  - Biometric + PIN: biometric prompt first, "Use PIN instead" link below

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Awaiting Auth | Lock screen just appeared | PIN keypad or biometric prompt |
| PIN Entry | User typing PIN | Dots fill as digits entered |
| Biometric Prompted | Biometric dialog shown | System biometric UI |
| Failed Attempt | Wrong PIN or biometric failure | "Incorrect PIN" shake animation, attempt counter |
| Locked Out | 5+ failed attempts | "Too many attempts. Try again in 5 minutes." with countdown |
| Unlocked | Authentication succeeded | Lock screen dismisses, mood content visible |

**Interactions:**
- Tap digit: enters digit, dot fills
- Tap backspace: removes last digit
- Tap "Use PIN instead": switches from biometric to PIN input
- Tap biometric icon: re-triggers biometric prompt
- Enter correct PIN: unlock animation, screen dismisses
- Enter wrong PIN: dots shake, "Incorrect PIN" message, attempt counter increments

**Transitions/Animations:**
- Lock screen appears: slide up from bottom (300ms)
- Lock screen dismisses: fade out (200ms)
- Wrong PIN: dots shake horizontally (300ms)
- Lockout countdown: pulsing timer text

#### 3.6 Data Requirements

##### Entity: ModuleLock

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, fixed value "mood_lock" | "mood_lock" | Singleton record |
| isEnabled | boolean | Required | false | Whether the lock is active |
| method | enum or null | pin, biometric, biometricWithPin | null | Authentication method |
| pinHash | string or null | None | null | Salted hash of the PIN (stored in secure storage, not SQLite) |
| pinSalt | string or null | None | null | Cryptographic salt for PIN hash (stored in secure storage) |
| timeoutMinutes | integer | One of [0, 1, 5, 15] | 0 | Lock timeout (0 = immediately) |
| failedAttempts | integer | Min 0 | 0 | Consecutive failed PIN attempts |
| lockedUntil | datetime or null | ISO 8601 | null | Lockout expiry time (set after 5 failed attempts) |
| lastUnlockedAt | datetime or null | ISO 8601 | null | Last successful unlock time (for timeout computation) |

**Storage Notes:**
- `pinHash` and `pinSalt` are stored in the platform secure storage (Keychain/Keystore), NOT in the SQLite database
- Other fields are stored in SQLite for quick access
- The lock state is checked before any mood screen renders

**Validation Rules:**
- PIN must be 4-6 digits, numeric only
- PIN confirmation must match original entry
- Cannot disable lock without authenticating first
- Cannot change method without authenticating first

#### 3.7 Business Logic Rules

##### PIN Hashing

**Purpose:** Securely hash the user's PIN for storage.

**Inputs:**
- pin: string (4-6 digits)

**Logic:**

```
1. Generate a 32-byte cryptographically random salt
2. Hash the PIN using PBKDF2 with:
   - Algorithm: SHA-256
   - Iterations: 100,000
   - Salt: the generated salt
   - Output length: 32 bytes
3. Encode hash and salt as base64 strings
4. Store hash and salt in secure storage (Keychain/Keystore)
5. RETURN success
```

##### PIN Verification

**Purpose:** Verify a user-entered PIN against the stored hash.

**Inputs:**
- enteredPin: string
- storedHash: string (base64)
- storedSalt: string (base64)

**Logic:**

```
1. IF failedAttempts >= 5 AND lockedUntil > now THEN reject with "Locked out"
2. Decode storedSalt from base64
3. Hash enteredPin using PBKDF2 with same parameters as PIN Hashing
4. Compare computed hash with storedHash
5. IF match:
   a. Reset failedAttempts to 0
   b. Set lastUnlockedAt to now
   c. RETURN { authenticated: true }
6. IF no match:
   a. Increment failedAttempts
   b. IF failedAttempts >= 5:
      - Set lockedUntil = now + 5 minutes
   c. RETURN { authenticated: false, remainingAttempts: 5 - failedAttempts }
```

##### Lock Timeout Check

**Purpose:** Determine if the module should be locked based on timeout settings.

**Inputs:**
- timeoutMinutes: integer
- lastUnlockedAt: datetime or null

**Logic:**

```
1. IF lock is not enabled THEN RETURN { locked: false }
2. IF lastUnlockedAt is null THEN RETURN { locked: true }
3. IF timeoutMinutes == 0 THEN RETURN { locked: true } (always lock on re-entry)
4. elapsed = now - lastUnlockedAt (in minutes)
5. IF elapsed >= timeoutMinutes THEN RETURN { locked: true }
6. ELSE RETURN { locked: false }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Biometric hardware unavailable | Fallback to PIN entry automatically | Show "Use PIN instead" |
| Biometric enrollment empty (no face/fingerprint) | "Set up [Face ID/Touch ID] in device Settings or use PIN" | PIN fallback available |
| Secure storage read fails | "Could not verify credentials. Please restart the app." | App restart re-initializes secure storage |
| PIN hash corrupted | "Lock data corrupted. Please reset your PIN." | User re-enters PIN via reset flow (requires biometric or reinstall) |
| 5 failed attempts | "Too many attempts. Try again in 5 minutes." with countdown | Countdown timer, then retry allowed |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enables PIN lock and sets PIN "1234",
   **When** they leave the mood module and return,
   **Then** the lock screen appears and accepts "1234" to unlock.

2. **Given** the user enables biometric lock,
   **When** they return to the mood module after timeout,
   **Then** Face ID/Touch ID prompt appears and successful authentication unlocks the module.

3. **Given** the user sets a 5-minute timeout,
   **When** they leave and return within 3 minutes,
   **Then** the module is accessible without re-authentication.

**Edge Cases:**

4. **Given** the user enters the wrong PIN 4 times,
   **When** they see "1 attempt remaining",
   **Then** entering a 5th wrong PIN locks them out for 5 minutes with a countdown.

5. **Given** the user has biometric + PIN configured and biometric fails,
   **When** they tap "Use PIN instead",
   **Then** the PIN keypad appears and correct PIN unlocks the module.

6. **Given** the device does not support biometrics,
   **When** the user opens lock settings,
   **Then** "Biometric" options are grayed out with "Not available on this device."

**Negative Tests:**

7. **Given** the user tries to disable the lock,
   **When** they toggle the master switch off,
   **Then** they must authenticate first (enter PIN or biometric) before the lock is disabled.

8. **Given** the user is locked out for 5 minutes,
   **When** they try to enter a PIN,
   **Then** the keypad is disabled and only the countdown timer is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| hash PIN with PBKDF2 | "1234" + random salt | 32-byte hash, deterministic for same salt |
| verify correct PIN | "1234" vs stored hash | authenticated = true |
| verify wrong PIN | "5678" vs stored hash | authenticated = false |
| lockout after 5 failures | 5 wrong attempts | lockedUntil set to now + 5 min |
| reset attempts on success | correct PIN after 3 failures | failedAttempts = 0 |
| timeout check immediate | timeout=0 | locked = true (always) |
| timeout check within window | timeout=5, lastUnlock=2 min ago | locked = false |
| timeout check expired | timeout=5, lastUnlock=10 min ago | locked = true |
| PIN length validation | "123" (too short) | validation error |
| PIN length validation | "1234567" (too long) | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full PIN lock flow | 1. Enable, set PIN, 2. Leave module, 3. Return, 4. Enter PIN | Module unlocks |
| Biometric lock flow | 1. Enable biometric, 2. Leave, 3. Return | Biometric prompt appears |
| Lockout and recovery | 1. Enter wrong PIN 5 times, 2. Wait 5 min, 3. Enter correct PIN | Unlocks after timeout |
| Change PIN | 1. Have PIN set, 2. Change to new PIN, 3. Verify old PIN rejected | Old PIN fails, new PIN works |

---

### MM-016: Custom Experiments

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-016 |
| **Feature Name** | Custom Experiments |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a wellness optimizer, I want to create a personal experiment to test whether a lifestyle change (e.g., "Does daily meditation improve my mood?"), so that I can make evidence-based decisions about my habits.

**Secondary:**
> As a data-driven user, I want to see the results of my experiment compared to a baseline period, so that I can determine if the intervention had a statistically meaningful effect on my mood.

**Tertiary:**
> As a curious self-tracker, I want to browse a library of experiment templates (e.g., "Try exercising 3x/week for 2 weeks"), so that I can start experiments without having to design them from scratch.

#### 3.3 Detailed Description

Custom Experiments allows users to set up structured A/B lifestyle experiments. An experiment consists of a hypothesis (e.g., "Meditating for 10 minutes daily improves my average mood"), a baseline period (data before the intervention), an intervention period (data during the behavior change), and a results analysis comparing the two periods.

The experiment lifecycle:
1. **Design:** User defines hypothesis, intervention description, and duration (7-30 days per period)
2. **Baseline:** System collects mood data for the baseline period (user logs mood normally)
3. **Intervention:** User practices the intervention and logs mood normally
4. **Analysis:** System compares baseline vs intervention averages using statistical tests

The comparison uses the Pearson correlation coefficient between the time period (baseline=0, intervention=1) and mood scores, plus a simple difference-of-means analysis. The experiment reports:
- Mean mood score during baseline vs intervention
- Score difference and percentage change
- Pearson r between period and mood
- Whether the result is statistically meaningful (|r| >= 0.3 with sufficient data)
- Plain-language conclusion

A template library provides pre-designed experiments for common lifestyle changes: exercise frequency, sleep duration, meditation practice, social activity levels, screen time reduction, and caffeine intake changes.

Only one experiment can be active at a time to avoid confounding variables (though the user can override this with a warning).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood data for baseline and intervention
- MM-010 (Correlation Engine): statistical analysis functions

**External Dependencies:**
- None

**Assumed Capabilities:**
- User has sufficient mood logging history or willingness to log consistently during experiment periods

#### 3.5 User Interface Requirements

##### Screen: Experiments Home

**Layout:**
- Top: "Experiments" title
- Active experiment card (if one is running):
  - Experiment name and hypothesis
  - Current phase: "Baseline (Day 4 of 14)" or "Intervention (Day 8 of 14)"
  - Progress bar
  - Daily check-in reminder status
- Below: "Start New Experiment" button
- Below: "Templates" section with horizontal scrollable template cards
- Bottom: "Past Experiments" list with results summary

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Experiments | No active or past experiments | Welcome state: "Run your first experiment" with templates |
| Active Experiment | Experiment in progress | Active card with progress, templates below |
| Completed Experiments | Past experiments exist | Active card (if any) + scrollable past results |
| Analysis Ready | Intervention period just completed | "Results are ready!" banner with View button |

##### Screen: Experiment Designer

**Layout:**
- Step 1: Hypothesis
  - Text field: "I believe that..."
  - Text field: "...will [improve/change] my mood"
- Step 2: Intervention
  - Text field: "What will you do differently?"
  - Duration picker: 7, 14, 21, or 30 days per period
  - Start date picker (baseline starts on this date)
- Step 3: Review
  - Summary of hypothesis, intervention, and timeline
  - Start button

##### Screen: Experiment Results

**Layout:**
- Hypothesis statement at top
- Two-column comparison:
  - Left: "Baseline" with average score, entry count, score range
  - Right: "Intervention" with average score, entry count, score range
- Difference display: "+1.3 points (22% improvement)" or "-0.5 points (8% decline)"
- Correlation indicator: r value with strength label
- Line chart: daily scores with baseline period shaded blue, intervention shaded green
- Conclusion: plain-language summary
- "Share Results" and "Archive" buttons

#### 3.6 Data Requirements

##### Entity: Experiment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| hypothesis | string | Required, max 500 chars | None | What the user believes will happen |
| interventionDescription | string | Required, max 500 chars | None | What the user will do differently |
| periodDays | integer | One of [7, 14, 21, 30] | 14 | Duration of each period (baseline and intervention) |
| baselineStart | string | YYYY-MM-DD, required | None | First day of baseline |
| baselineEnd | string | YYYY-MM-DD, computed | None | Last day of baseline |
| interventionStart | string | YYYY-MM-DD, computed | None | First day of intervention |
| interventionEnd | string | YYYY-MM-DD, computed | None | Last day of intervention |
| status | enum | draft, baseline, intervention, analyzing, completed, abandoned | draft | Current lifecycle phase |
| templateId | string or null | Foreign key to ExperimentTemplate | null | Template used (if any) |
| baselineAvg | float or null | Computed | null | Mean mood during baseline |
| interventionAvg | float or null | Computed | null | Mean mood during intervention |
| pearsonR | float or null | Computed | null | Correlation between period and mood |
| conclusion | string or null | Max 500 chars | null | Auto-generated conclusion text |
| createdAt | datetime | ISO 8601 | Current timestamp | Record creation time |
| completedAt | datetime or null | ISO 8601 | null | When analysis was completed |

##### Entity: ExperimentTemplate (Static/Seed Data)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Assigned | Unique template identifier |
| name | string | Required | None | Template name |
| hypothesis | string | Required | None | Pre-written hypothesis |
| interventionDescription | string | Required | None | Pre-written intervention |
| suggestedDays | integer | One of [7, 14, 21, 30] | 14 | Suggested period length |
| category | enum | exercise, sleep, mindfulness, social, nutrition, digital | None | Template category |

**Indexes:**
- `mo_experiments(status)` - Find active experiments
- `mo_experiments(baselineStart)` - Chronological ordering

**Validation Rules:**
- Only 1 experiment with status "baseline" or "intervention" at a time (soft limit, overridable)
- `periodDays`: must be one of the valid values
- `baselineStart`: must not be in the past (can be today or future)
- `hypothesis` and `interventionDescription`: must not be empty

**Seed Templates (10 templates):**

| Name | Category | Hypothesis | Suggested Days |
|------|----------|-----------|----------------|
| Morning Exercise | exercise | Exercising in the morning improves my mood throughout the day | 14 |
| Daily Meditation | mindfulness | 10 minutes of daily meditation improves my baseline mood | 14 |
| 8 Hours Sleep | sleep | Getting 8+ hours of sleep consistently improves my mood | 21 |
| Social Lunch | social | Eating lunch with others instead of alone improves my afternoon mood | 14 |
| No Phone Before Bed | digital | Avoiding screens 1 hour before bed improves my morning mood | 14 |
| 3x Weekly Workout | exercise | Working out 3 times per week improves my weekly mood average | 21 |
| Daily Journaling | mindfulness | Writing in my journal daily improves my emotional awareness and mood | 14 |
| Caffeine Cutoff | nutrition | No caffeine after 2 PM improves my evening mood | 14 |
| Nature Walk | exercise | A 20-minute walk in nature daily improves my mood | 7 |
| Gratitude Practice | mindfulness | Listing 3 things I am grateful for each morning improves my mood | 14 |

#### 3.7 Business Logic Rules

##### Experiment Lifecycle State Machine

**Purpose:** Manage experiment transitions through its lifecycle phases.

**Logic:**

```
State transitions:
  draft -> baseline: User taps "Start Experiment" and baselineStart is today
  draft -> draft: User edits hypothesis or intervention (stays in draft)
  baseline -> intervention: Current date > baselineEnd
  intervention -> analyzing: Current date > interventionEnd
  analyzing -> completed: Analysis computation finishes
  [any active state] -> abandoned: User manually abandons

Automatic transitions:
  - On app open, check if current date has crossed a period boundary
  - If baseline period elapsed, transition to intervention (notify user)
  - If intervention period elapsed, transition to analyzing (run analysis, notify user)
```

##### Experiment Results Analysis

**Purpose:** Compare baseline and intervention periods and generate a conclusion.

**Inputs:**
- baselineEntries: list of MoodEntry records during baseline period
- interventionEntries: list of MoodEntry records during intervention period

**Logic:**

```
1. Compute baselineAvg = mean of baseline entry scores
2. Compute interventionAvg = mean of intervention entry scores
3. Compute scoreDiff = interventionAvg - baselineAvg
4. Compute percentChange = (scoreDiff / baselineAvg) * 100
5. Build paired data for Pearson r:
   - For each baseline entry: (x=0, y=score)
   - For each intervention entry: (x=1, y=score)
6. Compute Pearson r using the same formula as MM-010
7. Determine significance: |r| >= 0.3 AND total entries >= 20
8. Generate conclusion:
   a. IF significant AND r > 0: "Your experiment suggests that [intervention] is associated with improved mood. Average mood increased from [baselineAvg] to [interventionAvg] (+[scoreDiff] points, [percentChange]%)."
   b. IF significant AND r < 0: "Your experiment suggests that [intervention] may be associated with lower mood. Average mood decreased from [baselineAvg] to [interventionAvg] ([scoreDiff] points, [percentChange]%)."
   c. IF not significant: "Your experiment did not show a strong relationship between [intervention] and mood. The difference ([scoreDiff] points) was not statistically meaningful with the available data."
9. Store results and conclusion
```

**Edge Cases:**
- User logged no entries during baseline: "Experiment incomplete: no baseline data."
- User logged entries on only 2 days during intervention: "Insufficient data for analysis. Try a longer experiment."
- Perfect correlation (user logged only during intervention): r = 1.0 but meaningless, flag as "Insufficient comparison data"
- Negative percent change with positive intervention avg: correctly compute sign

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Analysis computation fails | Toast: "Could not analyze results. Please try again." | Retry button on results screen |
| Missing baseline data | Results show: "No baseline data logged. Experiment cannot be analyzed." | Offer to extend baseline period |
| Missing intervention data | Results show: "No intervention data logged. Experiment cannot be analyzed." | Offer to extend intervention period |
| User starts experiment while one is active | Warning: "Starting a new experiment will abandon your current one. Continue?" | User confirms or cancels |
| Date boundary transition missed (offline) | Catch up on next app open, compute correct phase | Transition to correct phase |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects the "Morning Exercise" template and starts an experiment,
   **When** the experiment begins,
   **Then** the baseline phase starts with a 14-day countdown and daily logging reminder.

2. **Given** the baseline period of 14 days has elapsed,
   **When** the user opens MyMood,
   **Then** the experiment transitions to the intervention phase with a notification: "Baseline complete! Start your intervention."

3. **Given** the intervention period is complete with 20+ entries total,
   **When** analysis runs,
   **Then** the results screen shows baseline vs intervention averages, Pearson r, and a plain-language conclusion.

**Edge Cases:**

4. **Given** the user has an active experiment,
   **When** they try to start a new one,
   **Then** a warning dialog explains the current experiment will be abandoned.

5. **Given** the user logged mood on only 5 days during a 14-day baseline,
   **When** analysis runs,
   **Then** the results note "Limited baseline data (5 of 14 days)" and flag results as preliminary.

6. **Given** the user abandons an experiment during the intervention phase,
   **When** they view past experiments,
   **Then** the abandoned experiment shows status "Abandoned" with whatever partial data was collected.

**Negative Tests:**

7. **Given** the user sets the baseline start date to yesterday,
   **When** they try to save,
   **Then** validation rejects with "Start date must be today or in the future."

8. **Given** the user had zero entries during both periods,
   **When** analysis is attempted,
   **Then** the results show "No data logged. Experiment cannot be analyzed."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| state transition draft to baseline | status=draft, date=baselineStart | status=baseline |
| state transition baseline to intervention | status=baseline, date>baselineEnd | status=intervention |
| results: positive improvement | baseline avg 5, intervention avg 7 | scoreDiff=+2, percentChange=40% |
| results: negative change | baseline avg 7, intervention avg 5 | scoreDiff=-2, percentChange=-28.6% |
| results: no significance | r=0.15, n=25 | significant=false |
| results: significant positive | r=0.45, n=25 | significant=true |
| conclusion generation positive | significant, r>0 | contains "improved mood" |
| conclusion generation neutral | not significant | contains "not statistically meaningful" |
| max one active experiment | 1 active, start new | warning returned |
| template population | templateId = "morning-exercise" | hypothesis pre-filled |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full experiment lifecycle | 1. Create, 2. Log baseline (7 days), 3. Log intervention (7 days), 4. View results | Complete results with comparison |
| Template creates experiment | 1. Select template, 2. Start | Experiment with pre-filled fields |
| Abandon experiment | 1. Start experiment, 2. Abandon on day 5 | Status set to abandoned, data preserved |
| Phase transition on app open | 1. Start baseline, 2. Skip ahead 14 days, 3. Open app | Automatically transitions to intervention |

---

### MM-017: Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-017 |
| **Feature Name** | Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a privacy-first user, I want to export all my mood data as a CSV or JSON file, so that I own a portable copy of my data that I can use in spreadsheets, other apps, or personal archives.

**Secondary:**
> As a therapy-supported user, I want to generate a formatted PDF report of my mood data for a specific date range, so that I can share it with my therapist during sessions.

**Tertiary:**
> As a user switching devices, I want to export my complete dataset including photos and settings, so that I can import it on my new device and retain my full history.

#### 3.3 Detailed Description

Data Export provides three export formats: CSV (for spreadsheets and data analysis), JSON (for app-to-app transfer and backup), and PDF (for human-readable reports). Each format supports date-range filtering and data-type selection (moods, emotions, activities, journal entries, breathing sessions, experiment results).

**CSV Export:** Generates one or more CSV files depending on selected data types. The primary mood CSV includes columns for date, time, score, descriptor, note, emotions (comma-separated), and activities (comma-separated). Additional CSV files are generated for detailed emotion tags, activity tags, and breathing sessions.

**JSON Export:** Generates a single JSON file containing a complete structured export of all selected data types. The JSON schema is versioned (starting at v1) for forward compatibility with the import feature (MM-018).

**PDF Report:** Generates a formatted report with mood trend charts, emotion distribution, activity correlations, and key statistics for the selected date range. The report is designed for sharing with healthcare providers and includes a privacy notice: "Generated locally by MyMood. This data has never been transmitted to any server."

**Full Backup:** A special export mode that includes all data types plus photos (as a ZIP archive) and user settings. This format is used for device migration.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood entry data
- MM-002 (Emotion Wheel): emotion tag data
- MM-003 (Activity Tagging): activity tag data
- MM-004 (Mood Notes & Micro-Journal): journal content
- MM-011 (Guided Breathing): breathing session data

**External Dependencies:**
- File system write access
- Share sheet API for sending exported files
- PDF generation library (for report format)
- ZIP library (for full backup with photos)

**Assumed Capabilities:**
- Sufficient free storage for temporary export files
- Share sheet available on platform

#### 3.5 User Interface Requirements

##### Screen: Export

**Layout:**
- Top: "Export Data" title
- Format selector: "CSV", "JSON", "PDF Report", "Full Backup"
- Date range picker: "All Time", "This Year", "This Month", "Custom Range"
- Data type checkboxes (not shown for Full Backup):
  - Mood Entries (always included)
  - Emotion Tags
  - Activity Tags
  - Journal Content
  - Breathing Sessions
  - Experiment Results
  - Photos (only for Full Backup)
- Preview summary: "127 entries, 342 emotion tags, 89 activities, 3 photos"
- "Export" button
- Below: "Recent Exports" list

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Options selected | Export button enabled with summary |
| No Data | Zero entries in selected range | "No data to export for this period" |
| Exporting | Export in progress | Progress bar with "Generating export..." |
| Complete | Export file generated | Share sheet appears with file |
| Error | Export failed | Error message with retry button |

**Interactions:**
- Select format: updates available options and preview
- Select date range: updates entry count preview
- Toggle data type: updates preview counts
- Tap "Export": generates file, shows progress, opens share sheet
- Tap recent export: re-shares the previously generated file (if still on disk)

#### 3.6 Data Requirements

##### Export Schema (JSON v1)

```json
{
  "exportVersion": 1,
  "exportedAt": "2026-03-06T10:00:00Z",
  "appVersion": "1.0.0",
  "dateRange": { "start": "2026-01-01", "end": "2026-03-06" },
  "data": {
    "entries": [
      {
        "id": "...",
        "score": 7,
        "note": "...",
        "journalContent": "...",
        "loggedAt": "...",
        "date": "...",
        "emotions": [{ "name": "joy", "family": "joy", "intensity": "moderate" }],
        "activities": [{ "name": "Exercise", "category": "Fitness" }],
        "photos": [{ "fileName": "photo-001.jpg", "capturedAt": "..." }]
      }
    ],
    "breathingSessions": [...],
    "experiments": [...],
    "settings": { "reminders": [...], "lockEnabled": false }
  }
}
```

##### CSV Column Definitions

**Mood Entries CSV:**

| Column | Description |
|--------|-------------|
| date | YYYY-MM-DD |
| time | HH:MM:SS |
| score | 1-10 |
| descriptor | Score label (Awful to Incredible) |
| note | Quick note text |
| journal | Journal content (Markdown stripped) |
| emotions | Semicolon-separated emotion names |
| activities | Semicolon-separated activity names |

No new database entities. Export reads from all existing tables.

#### 3.7 Business Logic Rules

##### Export Generation

**Purpose:** Generate export files in the requested format.

**Inputs:**
- format: enum (csv, json, pdf, backup)
- dateRange: {start, end} or "all"
- dataTypes: list of selected types

**Logic:**

```
1. Query all selected data types within the date range
2. SWITCH format:
   a. CSV:
      i. Generate primary mood entries CSV
      ii. IF emotion tags selected: generate emotion tags CSV
      iii. IF activity tags selected: generate activity tags CSV
      iv. IF breathing sessions selected: generate sessions CSV
      v. Package as single CSV (if one type) or ZIP (if multiple)
   b. JSON:
      i. Build JSON object per schema v1
      ii. Include all selected data types
      iii. Write to .json file
   c. PDF:
      i. Generate mood trend chart as embedded image
      ii. Generate emotion distribution chart
      iii. Format statistics, notable days, and summaries
      iv. Add privacy notice footer
      v. Render to PDF file
   d. BACKUP:
      i. Generate JSON export with all data types
      ii. Copy all photo files into backup directory
      iii. Include settings and preferences
      iv. Package as .zip file
3. RETURN file path for share sheet
```

**Edge Cases:**
- Very large export (10,000+ entries): show progress bar, generate in chunks
- PDF with no chart data (fewer than 7 entries): skip charts, show text summary only
- Export with photos (backup): warn user about file size before generating
- Markdown in journal content: strip for CSV, preserve for JSON
- Special characters in notes: properly escape for CSV (RFC 4180)

##### CSV Escaping

**Purpose:** Ensure CSV output is valid per RFC 4180.

**Logic:**

```
1. FOR each field value:
   a. IF value contains comma, double-quote, or newline:
      i. Wrap entire value in double quotes
      ii. Escape internal double quotes by doubling them ("" for each ")
   b. ELSE: output value as-is
2. Separate fields with commas
3. Separate rows with CRLF
4. First row: column headers
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient storage for export | Toast: "Not enough storage to generate export ([size needed])" | User frees storage |
| PDF generation fails | Toast: "Could not generate PDF report. Try CSV instead." | Offer CSV as fallback |
| Share sheet cancelled | Export file preserved in app cache | User can re-share from "Recent Exports" |
| Export interrupted (app crash) | Partial file deleted on next app open | Clean up temp files on launch |
| ZIP compression fails | Toast: "Could not create backup file" | Retry button |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects CSV format with all data types for "All Time",
   **When** they tap Export,
   **Then** a CSV file is generated and the share sheet opens with the file ready to send.

2. **Given** the user selects PDF Report for "This Month",
   **When** the report generates,
   **Then** a PDF with mood trend chart, emotion distribution, and statistics is created.

3. **Given** the user selects Full Backup,
   **When** the backup completes,
   **Then** a ZIP file containing JSON data + all photos is available for sharing.

**Edge Cases:**

4. **Given** the user exports JSON for a range with 5,000 entries,
   **When** the export generates,
   **Then** a progress bar shows percentage complete and the file is generated within 30 seconds.

5. **Given** the user has no data in the selected date range,
   **When** they try to export,
   **Then** the Export button is disabled with "No data to export for this period."

6. **Given** a CSV note field contains commas and quotes,
   **When** exported,
   **Then** the field is properly escaped per RFC 4180.

**Negative Tests:**

7. **Given** the device has only 10 MB free and the backup would be 50 MB,
   **When** the user taps Export,
   **Then** a warning shows "Not enough storage" with the required space.

8. **Given** the PDF generation library crashes,
   **When** the error is caught,
   **Then** the user sees "Could not generate PDF report. Try CSV instead."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| CSV escaping with comma | "hello, world" | "\"hello, world\"" |
| CSV escaping with quotes | 'he said "hi"' | '"he said ""hi"""' |
| CSV escaping with newline | "line1\nline2" | "\"line1\nline2\"" |
| JSON schema version | export output | exportVersion = 1 |
| date range filter | start=Jan 1, end=Jan 31 | only January entries |
| entry count preview | 50 entries, 120 tags | correct counts shown |
| markdown stripping for CSV | "**bold** text" | "bold text" |
| backup includes settings | full backup | settings key present in JSON |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| CSV export round-trip | 1. Log 10 entries, 2. Export CSV, 3. Verify file | Valid CSV with 10 data rows + header |
| JSON export completeness | 1. Log entries with emotions, activities, notes, 2. Export JSON | All data types present in output |
| PDF report generation | 1. Log 30 days of data, 2. Export PDF | PDF with charts and statistics |
| Full backup with photos | 1. Log entries with photos, 2. Export backup | ZIP contains JSON + photo files |

---

### MM-018: Data Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-018 |
| **Feature Name** | Data Import |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Daylio user switching to MyMood, I want to import my mood history from a Daylio CSV export, so that I retain years of mood data and do not have to start from scratch.

**Secondary:**
> As a user who exported MyMood data on a previous device, I want to import that backup on my new device, so that I can continue where I left off with my complete history.

**Tertiary:**
> As a Bearable user, I want to import my mood and symptom tracking data, so that I can migrate to MyMood without losing my health correlation insights.

#### 3.3 Detailed Description

Data Import supports importing mood data from three sources: MyMood's own JSON export (from MM-017), Daylio CSV export, and generic CSV with configurable column mapping. Future support for Bearable and other competitor formats can be added as additional parsers.

**MyMood JSON Import:** Restores a complete backup including mood entries, emotion tags, activity tags, journal content, breathing sessions, experiments, and optionally photos. The import detects duplicates by matching on (date, loggedAt) pairs and offers three conflict resolution strategies: skip duplicates, overwrite existing, or keep both.

**Daylio CSV Import:** Parses Daylio's export format which includes date, time, mood (text: "rad", "good", "meh", "bad", "awful"), activities (pipe-separated), and note. Daylio's 5-point mood scale is mapped to MyMood's 10-point scale:

| Daylio Mood | MyMood Score |
|-------------|-------------|
| awful | 2 |
| bad | 4 |
| meh | 5 |
| good | 7 |
| rad | 9 |

**Generic CSV Import:** Allows the user to map CSV columns to MyMood fields via a column-mapping interface. Required mapping: date column and score column. Optional: time, note, emotions, activities.

The import process runs in three stages: Parse (validate file format), Preview (show sample rows and mapping), and Commit (write to database in a transaction). The preview stage allows the user to adjust mappings, date formats, and score scaling before committing.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): MoodEntry table to import into
- MM-003 (Activity Tagging): ActivityTag and ActivityDefinition tables

**External Dependencies:**
- File picker for selecting import files
- CSV parser library
- JSON parser (standard library)

**Assumed Capabilities:**
- User has an export file from one of the supported sources
- File is accessible from the device (local file or shared via AirDrop/email)

#### 3.5 User Interface Requirements

##### Screen: Import

**Layout:**
- Top: "Import Data" title
- Source selector: "MyMood Backup", "Daylio Export", "Generic CSV"
- File picker button: "Choose File"
- Below file picker: import pipeline stages

**Import Pipeline Stages:**

1. **Parse:** Shows file validation result (valid/invalid, row count, date range detected)
2. **Preview:** Shows first 5 rows in a table with column headers
3. **Mapping (Generic CSV only):** Column mapping dropdowns
4. **Conflict Resolution:** "Skip duplicates", "Overwrite existing", "Keep both"
5. **Commit:** Progress bar and result summary

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Select Source | No file chosen | Source selector and file picker |
| Parsing | File selected, parsing in progress | "Validating file..." spinner |
| Parse Error | File is invalid | Error message with specific issue (e.g., "Missing date column") |
| Preview | File parsed successfully | 5-row preview table with mapping options |
| Importing | Commit in progress | Progress bar: "Importing entry 47 of 231..." |
| Complete | Import finished | Summary: "231 entries imported, 12 duplicates skipped" |
| Partial Failure | Some rows failed | Summary with failure count and option to view failed rows |

**Interactions:**
- Tap source: selects import format
- Tap "Choose File": opens file picker (filtered to .csv or .json)
- Tap column dropdown (Generic CSV): maps CSV column to MyMood field
- Select conflict resolution: sets duplicate handling strategy
- Tap "Import": starts commit process
- Tap "View Failed Rows": shows table of rows that could not be imported with error reasons

#### 3.6 Data Requirements

No new persistent entities. Import writes to existing MoodEntry, EmotionTag, ActivityTag, and BreathingSession tables.

##### Daylio CSV Expected Format

| Column | Example | Description |
|--------|---------|-------------|
| full_date | 2026-03-06 | Date in YYYY-MM-DD |
| date | March 6, 2026 | Human-readable date (backup) |
| weekday | Thursday | Day name |
| time | 8:15 AM | Time in 12h format |
| mood | good | One of: awful, bad, meh, good, rad |
| activities | Exercise \| Reading \| Cooking | Pipe-separated activity list |
| note | Had a great workout | Free text |

##### Import Validation Rules

- Date must be parseable to a valid date
- Score (or mapped mood) must resolve to 1-10 integer
- Duplicate detection: entries with same date AND loggedAt (within 60-second tolerance) are considered duplicates
- Maximum import size: 50,000 rows (to prevent memory issues)
- File size limit: 100 MB (for backups with photos)

#### 3.7 Business Logic Rules

##### Daylio Mood Mapping

**Purpose:** Convert Daylio's 5-point text mood to MyMood's 10-point numeric scale.

**Inputs:**
- daylioMood: string (awful, bad, meh, good, rad)

**Logic:**

```
1. MATCH daylioMood (case-insensitive):
   - "awful" -> 2
   - "bad" -> 4
   - "meh" -> 5
   - "good" -> 7
   - "rad" -> 9
2. IF no match THEN mark row as failed with "Unknown mood value: [value]"
3. RETURN mapped score
```

**Edge Cases:**
- Custom Daylio mood labels (user renamed "rad" to "amazing"): fallback to position-based mapping if text does not match
- Missing mood column: import fails at parse stage

##### Duplicate Detection

**Purpose:** Identify entries that already exist in the database to handle conflicts.

**Inputs:**
- importEntry: {date, loggedAt, score}
- existingEntries: list of MoodEntry records for the same date

**Logic:**

```
1. FOR each existingEntry on the same date:
   a. Compute timeDiff = ABS(importEntry.loggedAt - existingEntry.loggedAt)
   b. IF timeDiff <= 60 seconds THEN this is a duplicate
2. IF duplicate found:
   a. SWITCH conflictStrategy:
      - "skip": do not import this entry, increment skipCount
      - "overwrite": update existing entry with import data
      - "keepBoth": import as a new entry (new UUID)
3. IF no duplicate: import as new entry
```

##### Import Transaction

**Purpose:** Import all entries in a single database transaction for atomicity.

**Logic:**

```
1. BEGIN transaction
2. FOR each row in import data:
   a. Parse and validate row
   b. IF validation fails: add to failedRows list, continue
   c. Check for duplicates
   d. Apply conflict resolution strategy
   e. INSERT or UPDATE MoodEntry record
   f. IF activities present: create/link ActivityDefinition and ActivityTag records
   g. IF emotions present: create EmotionTag records
3. IF failedRows count > 50% of total rows:
   a. ROLLBACK transaction
   b. RETURN error: "Too many invalid rows ([count] of [total]). Import aborted."
4. ELSE:
   a. COMMIT transaction
   b. RETURN { importedCount, skippedCount, failedCount, failedRows }
```

**Edge Cases:**
- Empty CSV file: reject at parse stage
- CSV with only headers: reject with "File contains no data rows"
- Extremely large file: process in batches of 1,000 rows within the transaction
- Activities in import that do not exist locally: auto-create as custom activities
- Import interrupted (app crash): transaction rolls back, no partial data

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid file format | "This file is not a valid [format]. Please check the file and try again." | User selects correct file |
| Missing required columns | "Missing required column: [column name]" | User adjusts column mapping or file |
| Too many failed rows (>50%) | "Import aborted: [count] of [total] rows had errors." | User fixes source file |
| File too large (>100 MB) | "File exceeds maximum size of 100 MB" | User reduces file size |
| Database transaction fails | "Import failed. No data was changed." | Transaction rolled back, user can retry |
| Date format unrecognizable | "Could not parse date in row [N]: '[value]'" | Row added to failed list |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects a Daylio CSV export with 500 entries,
   **When** the import runs,
   **Then** 500 MoodEntry records are created with scores mapped from Daylio's 5-point scale.

2. **Given** the user imports a MyMood JSON backup from another device,
   **When** the import completes,
   **Then** all entries, emotions, activities, journal content, and settings are restored.

3. **Given** the user imports a Generic CSV with custom column mapping,
   **When** they map "feeling_score" to "score" and "diary_date" to "date",
   **Then** the import correctly reads those columns and creates valid entries.

**Edge Cases:**

4. **Given** the import file has 50 entries that duplicate existing data,
   **When** the user selects "Skip duplicates",
   **Then** 50 entries are skipped and the summary shows "50 duplicates skipped."

5. **Given** a Daylio export has custom mood label "awesome" instead of "rad",
   **When** the parser encounters this value,
   **Then** the row is marked as failed with "Unknown mood value: awesome" and other rows import normally.

6. **Given** the import file contains activities not in the local database,
   **When** the import runs,
   **Then** new custom activities are auto-created and tagged on the imported entries.

**Negative Tests:**

7. **Given** the user selects a PDF file instead of CSV,
   **When** parsing begins,
   **Then** the error "This file is not a valid CSV" is displayed.

8. **Given** 300 of 400 rows have invalid dates,
   **When** the threshold check runs,
   **Then** the import aborts with "Import aborted: 300 of 400 rows had errors."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Daylio mood: "awful" | "awful" | score = 2 |
| Daylio mood: "rad" | "rad" | score = 9 |
| Daylio mood: unknown | "awesome" | error: unknown mood |
| Daylio mood: case insensitive | "Good" | score = 7 |
| duplicate detection match | same date, 30s apart | duplicate = true |
| duplicate detection no match | same date, 5 min apart | duplicate = false |
| CSV parsing valid | 10-row valid CSV | 10 parsed entries |
| CSV parsing missing header | no header row | parse error |
| JSON schema v1 validation | valid v1 JSON | passes validation |
| row failure threshold | 51% failed | import aborted |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Daylio full import | 1. Select Daylio CSV (100 entries), 2. Import | 100 entries with mapped scores |
| MyMood backup restore | 1. Export JSON, 2. Clear data, 3. Import JSON | All data restored |
| Generic CSV with mapping | 1. Select CSV, 2. Map columns, 3. Import | Entries created per mapping |
| Duplicate skip strategy | 1. Import 50 entries, 2. Re-import same file with "Skip" | 0 new entries, 50 skipped |
| Auto-create activities | 1. Import CSV with unknown activities | New custom activities created |

---

### MM-019: Weekly & Monthly Reports

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-019 |
| **Feature Name** | Weekly & Monthly Reports |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a therapy-supported user, I want an automatically generated weekly mood report, so that I can bring a concise summary to my therapy sessions without manually compiling data.

**Secondary:**
> As a self-awareness seeker, I want a monthly mood report that highlights trends, patterns, and notable days, so that I can reflect on the past month in a structured way.

**Tertiary:**
> As a user who shares progress with a partner, I want to export or share a report as a PDF or image, so that I can discuss my emotional patterns with someone I trust.

#### 3.3 Detailed Description

Weekly & Monthly Reports generate structured summaries of mood data for defined time periods. Reports are generated automatically at the end of each week (Sunday night) and month (last day), or on-demand for any past period. Reports combine quantitative metrics with qualitative highlights to create a useful self-reflection document.

**Weekly Report Contents:**
- Date range (Monday through Sunday)
- Average mood score with week-over-week trend arrow
- Score distribution (histogram: how many entries at each score level)
- Best day and worst day with context (top emotion and note excerpt)
- Activity correlation highlights (top positive and top negative correlations from that week)
- Emotion frequency pie chart (top 5 emotions)
- Streak status
- Entry count and completion rate (entries per day average)

**Monthly Report Contents:**
- All weekly report contents, aggregated for the month
- Week-by-week trend line (4-5 data points)
- Month-over-month comparison (vs previous month)
- Year-to-date average and trend
- Top 3 most impactful activities (by correlation strength)
- Emotion evolution: how the emotion distribution shifted compared to the previous month
- Monthly journaling word count and themes (most common words in notes/journals, excluding stop words)
- Breathing exercise summary (sessions, total minutes, technique breakdown)

Reports are stored locally and accessible from a "Reports" section. They can be exported as PDF or shared as an image (screenshot of the report card). A notification can optionally alert the user when a new report is ready.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-006 (Mood Trends & Charts): trend computation and chart rendering
- MM-010 (Correlation Engine): activity correlation data

**External Dependencies:**
- PDF generation library
- Image rendering (screenshot API for share-as-image)
- Local notification for report-ready alerts

**Assumed Capabilities:**
- At least 1 week of mood data for weekly reports
- At least 1 month of mood data for monthly reports

#### 3.5 User Interface Requirements

##### Screen: Reports

**Layout:**
- Top: "Reports" title with "Generate" button (for on-demand reports)
- Report list: cards sorted by date (most recent first)
- Each report card shows:
  - Period: "Week of Mar 1-7" or "March 2026"
  - Average score with colored circle
  - Mini trend sparkline
  - Entry count
  - Tap to view full report

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Has Reports | 1+ reports generated | Scrollable list of report cards |
| No Reports | No reports yet | "Complete your first week to see a report" with progress ring |
| Generating | Report computation in progress | Spinner on the report card |

##### Screen: Report Detail

**Layout (scrollable card):**
- Header: period title + average score circle
- Section: Score Overview (average, min, max, entry count, entries-per-day)
- Section: Mood Trend (line chart with daily averages, week lines for monthly)
- Section: Score Distribution (horizontal histogram, 1-10 bars)
- Section: Notable Days (best day card, worst day card, each with note excerpt)
- Section: Emotions (pie chart of top 5 families + "Other")
- Section: Activities (top 3 positive correlations, top 3 negative)
- Section: Journaling (word count, top 10 frequent words as word cloud or list)
- Section: Breathing (session count, total minutes, technique split)
- Footer: "Share" and "Export PDF" buttons

**Interactions:**
- Scroll: navigate through report sections
- Tap "Share": generates image screenshot of report, opens share sheet
- Tap "Export PDF": generates PDF, opens share sheet
- Tap notable day: navigates to that day in the Daily Timeline

#### 3.6 Data Requirements

##### Entity: MoodReport

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| periodType | enum | weekly, monthly | None | Report type |
| periodStart | string | YYYY-MM-DD, required | None | First day of the period |
| periodEnd | string | YYYY-MM-DD, required | None | Last day of the period |
| avgScore | float | Computed | None | Average mood score for the period |
| entryCount | integer | Computed | None | Total entries in the period |
| reportData | string (JSON) | Required | None | Full report data as JSON blob |
| generatedAt | datetime | ISO 8601, auto-set | Current timestamp | When the report was generated |

**Indexes:**
- `periodType, periodStart` - Find reports by type and date
- `generatedAt` - Most recent first ordering

**Validation Rules:**
- One report per (periodType, periodStart) combination
- `reportData`: must be valid JSON conforming to the report schema
- Weekly: periodStart must be a Monday, periodEnd must be the following Sunday
- Monthly: periodStart must be the 1st of the month, periodEnd must be the last day

#### 3.7 Business Logic Rules

##### Weekly Report Generation

**Purpose:** Generate a comprehensive weekly mood summary.

**Inputs:**
- weekStart: string (YYYY-MM-DD, must be Monday)
- weekEnd: string (YYYY-MM-DD, must be Sunday)

**Logic:**

```
1. Query all MoodEntry records WHERE date BETWEEN weekStart AND weekEnd
2. IF entry count == 0 THEN skip report generation
3. Compute:
   a. avgScore = mean of all scores, rounded to 1 decimal
   b. scoreDistribution = count per score value (1-10)
   c. bestDay = date with highest daily average, include top emotion + note excerpt
   d. worstDay = date with lowest daily average, include top emotion + note excerpt
   e. entriesPerDay = entryCount / 7, rounded to 1 decimal
4. Compute week-over-week change:
   a. Fetch previous week's report (if exists)
   b. weekOverWeekDelta = currentAvg - previousAvg
   c. trendDirection = "up" if delta > 0.2, "down" if delta < -0.2, "stable" otherwise
5. Compute emotion distribution for the week (reuse MM-006 logic)
6. Compute top activity correlations for the week (reuse MM-010 logic, min 5 entries per factor)
7. Compute streak status from MM-007
8. Package into reportData JSON
9. Create MoodReport record
```

**Edge Cases:**
- Week with only 1 entry: generate report but flag "Limited data"
- Previous week report does not exist: skip week-over-week comparison
- No emotions tagged: skip emotion distribution section
- No activities tagged: skip correlation section

##### Monthly Report Generation

**Purpose:** Generate a comprehensive monthly mood summary.

**Inputs:**
- monthStart: string (YYYY-MM-DD, first of month)
- monthEnd: string (YYYY-MM-DD, last of month)

**Logic:**

```
1. Query all data for the month (same as weekly, broader range)
2. Compute all weekly report metrics aggregated for the month
3. Additionally compute:
   a. weekByWeekTrend: array of 4-5 weekly averages
   b. monthOverMonthDelta: compare to previous month's report
   c. yearToDateAvg: running average for the year
   d. topActivities: 3 strongest correlations from MM-010 for the month
   e. emotionEvolution: percent change per emotion family vs previous month
   f. journalWordCount: total words written in journals this month
   g. topWords: 10 most frequent non-stop-words from notes and journals
   h. breathingSummary: session count, total minutes, technique counts
4. Package into reportData JSON
5. Create MoodReport record
```

##### Automatic Report Scheduling

**Logic:**

```
1. On each app open:
   a. Check if last Sunday passed without a weekly report being generated
   b. IF so: generate the weekly report for the previous week
   c. Check if the last day of the previous month passed without a monthly report
   d. IF so: generate the monthly report for the previous month
2. Optionally send a local notification: "Your weekly mood report is ready!"
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Report generation fails | Toast: "Could not generate report." | Retry via "Generate" button |
| PDF export fails | Toast: "Could not create PDF." | Offer share-as-image as fallback |
| Image screenshot fails | Toast: "Could not capture report image." | Offer PDF as fallback |
| Insufficient data for correlations | Correlation section shows "Not enough data" | Rest of report generates normally |
| Chart rendering fails in report | Text-based fallback for that section | Other sections unaffected |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged moods every day for the past week,
   **When** Sunday night passes and they open MyMood on Monday,
   **Then** a new weekly report appears in the Reports list with all sections populated.

2. **Given** the user taps "Export PDF" on a monthly report,
   **When** the PDF generates,
   **Then** a formatted PDF with charts, statistics, and notable days opens in the share sheet.

3. **Given** the user taps a notable day in the report,
   **When** it reads "Best Day: Tuesday, avg 8.5",
   **Then** tapping it navigates to Tuesday's Daily Timeline.

**Edge Cases:**

4. **Given** the user logged moods on only 2 days of a 7-day week,
   **When** the weekly report generates,
   **Then** the report shows "Limited data (2 of 7 days)" and metrics are flagged as preliminary.

5. **Given** no previous month report exists,
   **When** the monthly report generates,
   **Then** the month-over-month section shows "No previous month to compare."

**Negative Tests:**

6. **Given** the user has zero entries for a week,
   **When** the auto-generation check runs,
   **Then** no weekly report is created for that week.

7. **Given** the chart rendering library fails,
   **When** the report generates,
   **Then** text-based statistics are shown in place of charts.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| weekly avg computation | 7 daily averages [5,6,7,6,5,8,7] | avg = 6.3 |
| week-over-week delta | current=6.5, previous=6.0 | delta=+0.5, direction="up" |
| best day identification | 7 daily averages | date with max average |
| score distribution | 10 entries with various scores | histogram counts |
| top words extraction | 3 journal entries | top 10 non-stop-words |
| automatic report check | last Sunday = Mar 1, no report | trigger generation |
| month-over-month comparison | current avg 7.0, prev avg 6.5 | delta=+0.5 |
| year-to-date average | 3 months of data | running average |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Auto-generate weekly | 1. Log 7 days, 2. Open app on Monday | Weekly report created |
| Auto-generate monthly | 1. Log full month, 2. Open app on 1st of next month | Monthly report created |
| PDF export | 1. Generate report, 2. Export PDF | Valid PDF file |
| Report with correlations | 1. Log 14 days with activities, 2. Generate report | Correlation section populated |

---

### MM-020: SOS / Panic Button

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-020 |
| **Feature Name** | SOS / Panic Button |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user experiencing acute anxiety or a panic attack, I want a single-tap SOS button that immediately starts a calming breathing exercise, so that I have instant access to a coping tool when I need it most.

**Secondary:**
> As a user in distress, I want to see grounding exercises (5-4-3-2-1 sensory technique) alongside breathing, so that I have multiple calming strategies available during a crisis moment.

**Tertiary:**
> As a user who has recovered from a panic episode, I want to log the event with details (trigger, duration, coping strategy used), so that I can track panic frequency and identify trigger patterns over time.

#### 3.3 Detailed Description

The SOS / Panic Button provides immediate access to calming tools during moments of acute distress. It is always accessible via a dedicated button on the mood module home screen and can be triggered from the lock screen notification (if reminders are enabled). The feature prioritizes speed and simplicity; every tap should reduce cognitive load, not add to it.

When activated, the SOS flow presents a full-screen calming environment with three tools available as swipeable pages:

**Page 1: Breathing Exercise (Default)**
Immediately starts a Box Breathing (4-4-4-4) session with simplified UI. No setup, no technique selection, no cycle configuration. Just the animated circle with phase labels. The user breathes along. Haptic feedback guides the rhythm.

**Page 2: Grounding Exercise (5-4-3-2-1)**
A step-by-step sensory grounding technique:
- "Name 5 things you can see"
- "Name 4 things you can touch"
- "Name 3 things you can hear"
- "Name 2 things you can smell"
- "Name 1 thing you can taste"

Each step has a counter. Tapping the counter advances to the next step. No typing required.

**Page 3: Emergency Contacts**
Shows user-configured emergency contacts (up to 3) with one-tap call buttons. Also displays a "Crisis Resources" section with the 988 Suicide & Crisis Lifeline number and Crisis Text Line (text HOME to 741741).

After completing or dismissing the SOS flow, the user is offered a brief log form: "Would you like to log this episode?" with optional fields for trigger, duration, coping strategy used, and a mood score.

SOS episodes are stored in a separate table and can be reviewed in a "Crisis History" view showing frequency, triggers, and duration trends. This data is strictly local and never transmitted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-011 (Guided Breathing Exercises): breathing exercise engine for Page 1

**External Dependencies:**
- Phone dialer API for emergency contact calls
- Haptic feedback API
- Wake lock to prevent screen sleep during SOS

**Assumed Capabilities:**
- Device can make phone calls (for emergency contacts)
- Screen remains awake during SOS flow

#### 3.5 User Interface Requirements

##### Component: SOS Button

**Layout:**
- Floating button on mood home screen, positioned above the FAB
- Red circular button (48x48px) with white SOS text or lifeline icon
- Subtle pulse animation (1 pulse per 2 seconds) to indicate it is always available

**Interactions:**
- Tap: immediately opens SOS flow (no confirmation dialog, speed is critical)
- Long press: shows tooltip "Emergency calming tools"

##### Screen: SOS Flow

**Layout:**
- Full-screen dark background (calming, reduces visual stimulation)
- Page indicator dots at top (3 dots for 3 pages)
- "X" close button in top-right corner (small, unobtrusive)
- Swipeable horizontal pages

**Page 1: Breathing (Default starting page)**
- Centered breathing circle (same as MM-011 but simplified)
- "Breathe with the circle" instruction text
- Phase label: "Breathe In", "Hold", "Breathe Out", "Hold"
- Countdown timer per phase
- No cycle counter, no session timer (reduce cognitive load)
- Runs indefinitely until user swipes or taps X

**Page 2: Grounding**
- Step indicator: "Step 1 of 5"
- Instruction: "Name 5 things you can SEE"
- 5 tap circles below instruction (tap each as you name something)
- When all tapped, auto-advances to next step with fade transition
- Completed steps show checkmarks
- Final step: "You are grounded. Take a deep breath." with calming graphic

**Page 3: Emergency Contacts**
- "Emergency Contacts" header
- Up to 3 user-configured contacts:
  - Name
  - "Call" button (green, prominent)
- "Crisis Resources" section:
  - "988 Suicide & Crisis Lifeline" with "Call" button
  - "Crisis Text Line" with "Text HOME to 741741" and "Text" button
- Small text: "You are not alone."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Breathing Active | SOS just opened | Page 1 with breathing animation running |
| Grounding In Progress | User on Page 2 | Current step with tap circles |
| Grounding Complete | All 5 steps done | Completion message |
| Contacts Shown | User on Page 3 | Contact list with call buttons |
| Dismissed | User tapped X | Episode log prompt |

#### 3.6 Data Requirements

##### Entity: SOSEpisode

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| startedAt | datetime | ISO 8601, required | Current timestamp | When the SOS button was tapped |
| endedAt | datetime or null | ISO 8601 | null | When the user dismissed the SOS flow |
| durationSeconds | integer or null | Computed | null | Total time in the SOS flow |
| toolsUsed | string[] | Subset of [breathing, grounding, contacts] | [] | Which pages the user visited |
| trigger | string or null | Max 200 chars | null | User-reported trigger (optional, logged after) |
| moodBefore | integer or null | 1-10 | null | Mood score at start (estimated by user) |
| moodAfter | integer or null | 1-10 | null | Mood score after completing SOS tools |
| notes | string or null | Max 500 chars | null | Additional context |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

##### Entity: EmergencyContact

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| name | string | Required, max 100 chars | None | Contact name |
| phoneNumber | string | Required, valid phone format | None | Phone number |
| sortOrder | integer | 0-2 | Auto-incremented | Display order |

**Indexes:**
- `mo_sos_episodes(startedAt)` - Chronological listing
- `mo_emergency_contacts(sortOrder)` - Ordered contact list

**Validation Rules:**
- Maximum 3 emergency contacts
- Phone number: must contain at least 7 digits
- `moodBefore` and `moodAfter`: 1-10 integers if provided

#### 3.7 Business Logic Rules

##### SOS Flow Timer

**Purpose:** Track how long the user spends in the SOS flow.

**Logic:**

```
1. On SOS button tap:
   a. Create SOSEpisode record with startedAt = now
   b. Start background timer
2. Track which pages the user visits:
   a. On page swipe: add page name to toolsUsed array
3. On dismiss (X button or swipe away):
   a. Set endedAt = now
   b. Compute durationSeconds = endedAt - startedAt
   c. Show episode log prompt
```

##### Grounding Exercise Progression

**Purpose:** Guide the user through the 5-4-3-2-1 sensory grounding technique.

**Logic:**

```
1. Define steps:
   - Step 1: "5 things you can SEE" (5 taps)
   - Step 2: "4 things you can TOUCH" (4 taps)
   - Step 3: "3 things you can HEAR" (3 taps)
   - Step 4: "2 things you can SMELL" (2 taps)
   - Step 5: "1 thing you can TASTE" (1 tap)
2. Display current step with the required number of tap circles
3. Each tap fills a circle and triggers a gentle haptic
4. When all circles filled:
   a. Pause 1 second
   b. Fade transition to next step
5. After Step 5:
   a. Show completion screen: "You are grounded. Take a deep breath."
   b. Mark "grounding" as used in toolsUsed
```

##### Episode Trend Analysis

**Purpose:** Analyze SOS episode frequency and trigger patterns over time.

**Inputs:**
- episodes: list of SOSEpisode records

**Logic:**

```
1. Frequency: count episodes per week for the last 12 weeks
2. Average duration: mean of durationSeconds across all episodes
3. Common triggers: group by trigger text (if provided), count frequency
4. Tool effectiveness: for episodes with both moodBefore and moodAfter, compute average improvement = moodAfter - moodBefore
5. Time-of-day pattern: bucket episodes by hour, identify peak distress hours
6. RETURN { weeklyFrequency, avgDuration, topTriggers, avgImprovement, peakHours }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Phone call fails | Toast: "Could not connect call" | User retries or uses alternative contact |
| Haptic feedback unavailable | SOS flow continues without haptics | Visual cues only |
| Episode save fails | SOS flow works normally, episode not recorded | Log warning; tool functionality is not affected |
| Contact not configured | Page 3 shows "Add emergency contacts in Settings" | User can still access crisis resource numbers |
| Wake lock fails | Screen may dim during SOS | Tap anywhere to re-engage |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps the SOS button,
   **When** the SOS flow opens,
   **Then** Box Breathing starts immediately on Page 1 with no additional taps required.

2. **Given** the user swipes to Page 2 (Grounding),
   **When** they tap 5 circles for "things you can see",
   **Then** the step advances to "4 things you can touch" with a fade transition.

3. **Given** the user dismisses the SOS flow after 3 minutes,
   **When** the episode log prompt appears,
   **Then** they can optionally log trigger, mood before/after, and notes.

**Edge Cases:**

4. **Given** the user has not configured emergency contacts,
   **When** they swipe to Page 3,
   **Then** crisis resource numbers (988, 741741) are still displayed with "Add contacts in Settings" prompt.

5. **Given** the user completes all 5 grounding steps,
   **When** the completion screen shows,
   **Then** "You are grounded. Take a deep breath." appears with a calming visual.

6. **Given** the user taps SOS and immediately taps X (1-second use),
   **When** the episode log prompt appears,
   **Then** they can skip logging or log the brief episode.

**Negative Tests:**

7. **Given** the phone dialer is unavailable (device has no phone capability),
   **When** the user taps "Call" on a contact,
   **Then** a message shows "Calling is not available on this device."

8. **Given** the SOS episode save fails,
   **When** the user dismisses the flow,
   **Then** the calming tools still worked and the failure is silent (not adding stress).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| SOS timer starts on open | button tap | startedAt recorded |
| SOS timer stops on dismiss | X button tap | endedAt recorded, duration computed |
| grounding step progression | 5 taps on step 1 | advances to step 2 |
| grounding completion | all 15 taps (5+4+3+2+1) | completion screen shown |
| tools used tracking | visit pages 1 and 2 | toolsUsed = [breathing, grounding] |
| episode trend: weekly count | 3 episodes this week | frequency = 3 |
| mood improvement calc | before=3, after=6 | improvement = +3 |
| max 3 emergency contacts | 3 existing, add 1 | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full SOS flow | 1. Tap SOS, 2. Breathe 2 min, 3. Swipe to grounding, 4. Complete, 5. Dismiss, 6. Log episode | Episode recorded with all data |
| Emergency contact call | 1. Configure contact, 2. Open SOS, 3. Swipe to Page 3, 4. Tap Call | Phone dialer opens with number |
| Episode history view | 1. Complete 5 SOS episodes, 2. View crisis history | 5 episodes with trend analysis |
| SOS from notification | 1. Set reminder, 2. Receive notification, 3. Quick action "SOS" | SOS flow opens directly |

---

### MM-021: Self-Care Suggestions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-021 |
| **Feature Name** | Self-Care Suggestions |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who just logged a low mood, I want to receive a personalized self-care suggestion based on what has helped me before, so that I have an actionable step I can take right now to feel better.

**Secondary:**
> As a new user with no historical data, I want to see evidence-based self-care suggestions from a curated library, so that I have helpful ideas even before the app learns my patterns.

**Tertiary:**
> As a long-term user, I want to rate how helpful each suggestion was, so that the system improves its recommendations over time.

#### 3.3 Detailed Description

Self-Care Suggestions provides personalized recommendations after the user logs a mood entry. Suggestions are contextual: low-mood entries (1-4) receive comforting and actionable suggestions, neutral entries (5-6) receive maintenance and mindfulness suggestions, and high-mood entries (7-10) receive savoring and gratitude suggestions.

The suggestion engine uses three data sources in priority order:
1. **Personal correlation data** (from MM-010): Activities that correlate with higher mood for this specific user
2. **Recency weighting**: Suggestions rotate to avoid repetition
3. **Curated library**: 100+ pre-written suggestions categorized by mood band and activity type

Each suggestion is a simple, actionable statement (e.g., "Take a 15-minute walk. Walking tends to improve your mood by 1.2 points."). When personal data supports it, the suggestion includes a personalized stat from the correlation engine.

Suggestions appear as a dismissible card below the "Mood Logged" confirmation. The user can tap "Helpful" (thumbs up) or "Not for me" (thumbs down) to provide feedback, or dismiss without rating. Feedback trains the suggestion engine over time.

The user can also browse all suggestions in a dedicated "Self-Care Ideas" screen, filtered by category (Physical, Social, Creative, Mindfulness, Nature, Rest).

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood score triggers suggestions
- MM-003 (Activity Tagging): activity data for personalization
- MM-010 (Correlation Engine): personal correlation stats (optional, enhances suggestions)

**External Dependencies:**
- None

**Assumed Capabilities:**
- Suggestion library loaded into memory

#### 3.5 User Interface Requirements

##### Component: Suggestion Card (Inline after Mood Log)

**Layout:**
- Card appears below "Mood Logged" confirmation toast
- Light bulb icon + "Try this:" header
- Suggestion text (1-2 sentences, max 200 characters)
- Personalized stat below (if available): "Walking improved your mood by 1.2 points on average"
- Two action buttons: thumbs up (Helpful) and thumbs down (Not for me)
- "See more ideas" link below buttons

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Suggestion Shown | Mood logged, suggestion selected | Card with suggestion text and buttons |
| Rated Helpful | User tapped thumbs up | "Glad to hear it!" brief feedback, card collapses |
| Rated Unhelpful | User tapped thumbs down | "Noted. We will adjust." brief feedback, card collapses |
| Dismissed | User scrolled past or tapped elsewhere | Card fades out after 10 seconds |
| No Suggestion | Suggestion engine cannot find a relevant one | Card not shown |

##### Screen: Self-Care Ideas

**Layout:**
- Top: "Self-Care Ideas" title
- Category filter pills: "All", "Physical", "Social", "Creative", "Mindfulness", "Nature", "Rest"
- Suggestion list: cards with:
  - Suggestion text
  - Category tag
  - Personal relevance indicator (star icon if correlation data supports it)
  - Thumbs up/down history (if previously rated)

**Interactions:**
- Tap category pill: filters suggestions
- Tap suggestion card: no action (informational)
- Tap thumbs up/down: rates the suggestion

#### 3.6 Data Requirements

##### Entity: SelfCareSuggestion (Static/Seed Data)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Assigned | Unique suggestion identifier |
| text | string | Required, max 200 chars | None | The suggestion text |
| moodBand | enum | low, neutral, high | None | Target mood range |
| category | enum | physical, social, creative, mindfulness, nature, rest | None | Activity category |
| relatedActivity | string or null | ActivityDefinition name | null | Activity this suggestion relates to (for personalization) |

##### Entity: SuggestionFeedback

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| suggestionId | string | Foreign key to SelfCareSuggestion.id | None | The suggestion rated |
| rating | enum | helpful, unhelpful | None | User's rating |
| moodAtTime | integer | 1-10 | None | Mood score when suggestion was shown |
| shownAt | datetime | ISO 8601 | Current timestamp | When the suggestion was displayed |

**Indexes:**
- `mo_suggestion_feedback(suggestionId)` - Aggregate ratings per suggestion
- `mo_suggestion_feedback(shownAt)` - Recency-based rotation

**Suggestion Count Targets:**

| Category | Low Mood | Neutral | High Mood | Total |
|----------|----------|---------|-----------|-------|
| Physical | 6 | 4 | 4 | 14 |
| Social | 5 | 5 | 5 | 15 |
| Creative | 4 | 6 | 5 | 15 |
| Mindfulness | 8 | 5 | 4 | 17 |
| Nature | 4 | 5 | 5 | 14 |
| Rest | 8 | 3 | 2 | 13 |
| **Total** | **35** | **28** | **25** | **88+** |

#### 3.7 Business Logic Rules

##### Suggestion Selection Algorithm

**Purpose:** Select the most relevant suggestion for the user's current mood and history.

**Inputs:**
- score: integer (1-10) - current mood score
- correlationResults: list of CorrelationResult from MM-010 (if available)
- feedbackHistory: list of SuggestionFeedback records
- showHistory: list of suggestions shown in the last 14 days

**Logic:**

```
1. Determine moodBand:
   - 1-4: "low"
   - 5-6: "neutral"
   - 7-10: "high"
2. Get all suggestions in this moodBand
3. Exclude suggestions shown in the last 3 days
4. Exclude suggestions rated "unhelpful" (permanently filtered out)
5. Score remaining suggestions:
   a. Base score: 1.0
   b. IF suggestion.relatedActivity has a positive correlation (r > 0.3) in correlationResults:
      - Add 3.0 (personalized relevance)
      - Store correlation stat for display
   c. IF suggestion rated "helpful" in past: add 1.5
   d. IF suggestion category not shown in last 7 days: add 1.0 (category diversity)
6. Sort by score DESC, break ties randomly
7. Select top suggestion
8. Record in show history
9. RETURN { suggestion, personalStat (if available) }
```

**Edge Cases:**
- No correlation data (new user): use base scoring only (curated library)
- All suggestions exhausted: reset 3-day window, re-include shown suggestions
- All suggestions rated unhelpful: show "No suggestions available. Browse Self-Care Ideas for more."
- Score exactly on boundary (e.g., 4): falls into "low" band

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Suggestion engine fails | No suggestion card shown (silent failure) | Mood logging unaffected |
| Feedback save fails | "Noted" text still shows, feedback not persisted | Retry on next save |
| Correlation data unavailable | Show suggestion without personalized stat | Generic suggestion still valuable |
| All suggestions rated unhelpful | "Browse Self-Care Ideas for more options" | Link to full library |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user logs a mood of 3,
   **When** the "Mood Logged" confirmation appears,
   **Then** a self-care suggestion card appears below with a low-mood suggestion.

2. **Given** the user has correlation data showing "Walking" improves mood by 1.5 points,
   **When** they log a low mood,
   **Then** a walking-related suggestion appears with "Walking improved your mood by 1.5 points on average."

3. **Given** the user taps "Helpful" on a suggestion,
   **When** the feedback is recorded,
   **Then** that suggestion is prioritized in future low-mood moments.

**Edge Cases:**

4. **Given** a new user with no correlation data,
   **When** they log their first mood,
   **Then** a generic suggestion from the curated library appears.

5. **Given** the user has rated all "Physical" suggestions as unhelpful,
   **When** a new suggestion is selected,
   **Then** suggestions from other categories are shown instead.

**Negative Tests:**

6. **Given** the suggestion engine encounters an error,
   **When** the mood is logged,
   **Then** the mood is saved normally and no suggestion card appears (no error shown).

7. **Given** the user logs a mood of 9,
   **When** the suggestion appears,
   **Then** it is a high-mood suggestion (savoring/gratitude), not a coping suggestion.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| mood band: score 2 | score = 2 | "low" |
| mood band: score 6 | score = 6 | "neutral" |
| mood band: score 9 | score = 9 | "high" |
| excludes recently shown | shown 2 days ago | excluded |
| includes after 3 days | shown 4 days ago | included |
| excludes permanently unhelpful | rated unhelpful | excluded |
| boosts correlated suggestion | r = 0.5 for walking | walking suggestion score += 3.0 |
| category diversity bonus | no "nature" in 7 days | nature suggestion score += 1.0 |
| selects top scored | 3 suggestions scored | highest score returned |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Suggestion after low mood | 1. Log mood 3, 2. View confirmation | Suggestion card with low-mood text |
| Personalized suggestion | 1. Build correlation data (14 days), 2. Log low mood | Suggestion includes personal stat |
| Feedback trains engine | 1. Rate 3 suggestions helpful, 2. Log mood | Helpful-rated suggestions prioritized |
| Browse self-care library | 1. Open Self-Care Ideas, 2. Filter by "Mindfulness" | Only mindfulness suggestions shown |

---

### MM-022: Ambient Sounds

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-022 |
| **Feature Name** | Ambient Sounds |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a stressed user, I want to play calming ambient sounds (rain, ocean, white noise) alongside or independently of breathing exercises, so that I can create a relaxing environment on demand.

**Secondary:**
> As a user who struggles to focus, I want to mix multiple ambient sound layers at independent volumes, so that I can build a personalized soundscape that helps me concentrate.

**Tertiary:**
> As a user winding down before bed, I want to set a sleep timer on ambient sounds so they stop automatically after a set duration, so that I can fall asleep without draining my battery.

#### 3.3 Detailed Description

Ambient Sounds provides a library of looping audio tracks organized by category that users can play for relaxation, focus, sleep, or as a complement to breathing exercises. Each sound is a seamless loop stored locally on the device (no streaming, no network required). Users can play a single sound or mix up to 4 sounds simultaneously, each with an independent volume slider.

The sound library ships with a fixed set of built-in sounds covering nature, urban, and abstract categories. Sounds are stored as compressed audio files bundled with the app (not downloaded on-demand). The total bundle size for all sounds does not exceed 25 MB.

A sleep timer allows the user to set an automatic stop time: 5, 10, 15, 20, 30, 45, or 60 minutes. When the timer expires, all sounds fade out over 5 seconds rather than stopping abruptly. The timer persists if the app goes to the background (sounds continue playing via background audio).

When a breathing exercise (MM-011) is active, ambient sounds continue playing underneath the breathing animation. The breathing exercise UI shows a small "Sound" indicator when sounds are active, and the user can adjust or mute sounds without leaving the breathing screen.

Each playback session is logged locally: start time, duration, and which sounds were used. This data feeds into the weekly/monthly reports (MM-019) and can be correlated with mood entries via the correlation engine (MM-010) to determine which soundscapes correspond to mood improvements.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-011 (Guided Breathing Exercises): ambient sounds integrate with breathing sessions as background audio

**External Dependencies:**
- Background audio playback capability (audio session must continue when app is in background or screen is locked)
- Bundled audio files (compressed, max 25 MB total)
- Audio mixing engine capable of layering up to 4 simultaneous tracks

**Assumed Capabilities:**
- Device has a speaker or connected audio output
- OS-level audio session management is available

#### 3.5 User Interface Requirements

##### Screen: Ambient Sounds

**Layout:**
- Top: "Ambient Sounds" title with a sleep timer button on the right (clock icon)
- Below title: playback status bar showing "Playing" or "Stopped" with a master play/pause button
- If a sleep timer is active, a countdown badge appears next to the timer button (e.g., "23:45")
- Main content: scrollable grid of sound cards, organized by category
- Each sound card (minimum 80x80px) shows:
  - Icon representing the sound (rain drops, waves, fire, etc.)
  - Name of the sound (max 20 characters)
  - Active indicator (glowing border when playing)
- When a sound is active, a volume slider appears below the card (0-100%)
- Bottom: "Now Playing" panel (sticky) showing up to 4 active sound names as pills, each with a small volume slider, and a master stop button

**Sound Library:**

| Category | Sounds |
|----------|--------|
| Nature | Rain, Thunderstorm, Ocean Waves, River Stream, Forest, Wind, Birdsong |
| Urban | Coffee Shop, Library, Train, City Night |
| Abstract | White Noise, Brown Noise, Pink Noise |
| Elements | Fireplace, Campfire |

Total: 16 bundled sounds.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | No sounds playing | All cards inactive, "Now Playing" panel hidden |
| Playing | 1-4 sounds active | Active cards glow, "Now Playing" panel visible with volume sliders |
| Timer Active | Sleep timer counting down | Timer badge on clock icon, countdown in "Now Playing" panel |
| Timer Expiring | Less than 10 seconds left | Countdown pulses, sounds begin 5-second fade out |
| Background | App backgrounded during playback | Sounds continue, lock screen shows playback controls |

**Interactions:**
- Tap sound card (inactive): starts playback at 70% volume, card glows active
- Tap sound card (active): stops that sound, card returns to inactive
- Slide volume slider: adjusts individual sound volume (0-100%)
- Tap master play/pause: pauses/resumes all active sounds
- Tap master stop: stops all sounds and clears the mix
- Tap timer button: opens timer picker
- Long press sound card: shows sound name and duration in a tooltip

##### Modal: Sleep Timer Picker

**Layout:**
- Title: "Sleep Timer"
- List of preset durations: 5, 10, 15, 20, 30, 45, 60 minutes
- Each row shows the duration and a checkmark for the selected option
- "Off" option at the top to cancel an active timer
- If a timer is active, the current remaining time is shown at the top

**Interactions:**
- Tap a duration: sets the timer, closes the modal, timer badge appears
- Tap "Off": cancels the active timer

**Transitions/Animations:**
- Sound card activation: 200ms border glow fade-in with the module accent color
- Sound card deactivation: 200ms border glow fade-out
- Volume slider: real-time audio feedback as the user drags
- Timer expiry fade: all sounds reduce volume linearly to 0 over 5 seconds

#### 3.6 Data Requirements

##### Entity: AmbientSound (Static/Bundled)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Assigned | Unique sound identifier (e.g., "rain", "ocean_waves") |
| name | string | Required, max 20 chars | None | Display name |
| category | enum | nature, urban, abstract, elements | None | Sound category |
| fileName | string | Required | None | Audio file name in the app bundle |
| iconName | string | Required | None | Icon identifier |
| durationSeconds | integer | Min: 10 | None | Length of the loop before seamless repeat |

##### Entity: AmbientSession

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| startedAt | datetime | ISO 8601, required | Current timestamp | When playback started |
| endedAt | datetime | ISO 8601 or null | null | When playback stopped (null if still playing) |
| durationSeconds | integer | Computed: endedAt - startedAt | null | Total playback duration in seconds |
| soundIds | string | Comma-separated list, max 4 | None | IDs of sounds played in this session |
| usedSleepTimer | boolean | - | false | Whether a sleep timer was set |
| sleepTimerMinutes | integer or null | 5, 10, 15, 20, 30, 45, 60 | null | Timer duration if used |
| breathingSessionId | string or null | Foreign key to BreathingSession.id | null | Linked breathing session if sounds played during one |

**Indexes:**
- `mo_ambient_sessions(startedAt)` - Session history ordered by date
- `mo_ambient_sessions(breathingSessionId)` - Find sessions linked to breathing exercises

**Validation Rules:**
- `soundIds` must contain 1 to 4 valid sound IDs
- `endedAt` must be after `startedAt` if both are set
- `durationSeconds` is computed, not user-supplied
- `sleepTimerMinutes` must be one of the valid preset values if not null

**Example Data:**

```
{
  "id": "a3b7c9d1-e2f4-5678-abcd-123456789012",
  "startedAt": "2026-03-07T22:15:00Z",
  "endedAt": "2026-03-07T22:45:00Z",
  "durationSeconds": 1800,
  "soundIds": "rain,fireplace",
  "usedSleepTimer": true,
  "sleepTimerMinutes": 30,
  "breathingSessionId": null
}
```

#### 3.7 Business Logic Rules

##### Sound Mixing Engine

**Purpose:** Layer up to 4 ambient sound loops with independent volume control.

**Inputs:**
- activeSounds: list of { soundId, volume (0.0-1.0) }, max length 4
- masterVolume: float (0.0-1.0), default 1.0

**Logic:**

```
1. FOR EACH sound in activeSounds:
   a. Load audio file from bundle if not already loaded
   b. Set loop mode to seamless (gapless playback)
   c. Set individual volume = sound.volume * masterVolume
   d. Start playback
2. IF activeSounds.length > 4:
   a. Reject addition
   b. Show toast: "Maximum 4 sounds at once. Stop one to add another."
3. When a sound is stopped:
   a. Fade volume to 0 over 200ms
   b. Stop playback
   c. Unload from memory if no other reference
4. Background audio session:
   a. Request background audio permission on first play
   b. Register for remote control events (lock screen play/pause)
   c. Set now-playing info (title: "MyMood Ambient", subtitle: sound names)
```

**Edge Cases:**
- Headphones disconnected during playback: pause all sounds (OS default behavior)
- Phone call interrupts: pause all sounds, resume when call ends (if still in foreground)
- All sounds at volume 0: continue playback (user may raise volume later)
- Battery saver mode: continue playback (audio is low-power)

##### Sleep Timer Logic

**Purpose:** Automatically stop all sounds after a user-defined duration.

**Inputs:**
- timerMinutes: integer (5, 10, 15, 20, 30, 45, 60)
- currentSounds: list of active sounds

**Logic:**

```
1. Start countdown from timerMinutes * 60 seconds
2. Update countdown display every 1 second
3. IF remaining <= 10 seconds:
   a. Begin visual pulse on countdown display
4. IF remaining <= 5 seconds:
   a. Begin fade: reduce all volumes linearly over 5 seconds
   b. Final volume at 0 seconds = 0.0
5. AT 0 seconds:
   a. Stop all playback
   b. Close audio session
   c. Record AmbientSession with endedAt = now
6. IF user manually stops sounds before timer:
   a. Cancel timer
   b. Record session normally
```

**Edge Cases:**
- App killed during timer: OS terminates audio, no session recorded (acceptable loss)
- Timer set while no sounds playing: timer starts but does nothing until sounds start
- Timer changed while active: replace remaining time with new selection

##### Session Logging

**Purpose:** Record ambient sound usage for reports and correlation analysis.

**Logic:**

```
1. ON first sound activated:
   a. Create AmbientSession record with startedAt = now, soundIds = [soundId]
2. ON additional sound added or removed during session:
   a. Update soundIds to reflect current active set
3. ON all sounds stopped (manual or timer):
   a. Set endedAt = now
   b. Compute durationSeconds = endedAt - startedAt (in seconds)
   c. Save session
4. Minimum session duration for logging: 30 seconds
   a. Sessions under 30 seconds are discarded (accidental plays)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Audio file missing from bundle | Sound card shows "Unavailable" badge, tap is no-op | Other sounds remain functional |
| Audio session initialization fails | Toast: "Could not start audio playback." | Retry on next tap |
| Background audio permission denied | Toast: "Sounds will stop when you leave the app. Enable background audio in Settings." | Sounds play in foreground only |
| 5th sound addition attempted | Toast: "Maximum 4 sounds at once. Stop one to add another." | User stops a sound first |
| Session log save fails | Silent failure, no user-facing impact | Next session attempts save again |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the Ambient Sounds screen,
   **When** they tap the "Rain" sound card,
   **Then** rain audio begins playing at 70% volume, the card shows a glowing border, and the "Now Playing" panel appears at the bottom.

2. **Given** "Rain" is playing,
   **When** the user also taps "Fireplace",
   **Then** both sounds play simultaneously with independent volume sliders in the "Now Playing" panel.

3. **Given** 2 sounds are playing,
   **When** the user sets a 15-minute sleep timer,
   **Then** a countdown badge "15:00" appears on the timer icon and counts down every second.

4. **Given** a sleep timer reaches 0,
   **When** the final 5 seconds begin,
   **Then** all sounds fade out smoothly over 5 seconds and playback stops completely.

**Edge Cases:**

5. **Given** 4 sounds are playing,
   **When** the user taps a 5th sound card,
   **Then** a toast appears: "Maximum 4 sounds at once. Stop one to add another."

6. **Given** sounds are playing and the user starts a breathing exercise,
   **When** the breathing screen opens,
   **Then** ambient sounds continue underneath the breathing animation with a small "Sound" indicator visible.

7. **Given** sounds are playing and the app goes to the background,
   **When** the user locks their phone,
   **Then** sounds continue playing and lock screen shows playback controls.

**Negative Tests:**

8. **Given** an audio file is corrupted or missing,
   **When** the user taps that sound card,
   **Then** the card shows "Unavailable" and no audio plays.
   **And** other sound cards remain functional.

9. **Given** the user plays sounds for only 10 seconds and stops,
   **When** the session ends,
   **Then** no AmbientSession record is created (under 30-second minimum).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| max 4 sounds enforced | 5th sound addition | rejected with error |
| effective volume calculation | individual: 0.8, master: 0.5 | effective: 0.4 |
| sleep timer countdown | 15 minutes start | 900 seconds countdown |
| fade calculation at t-3s | 5s fade, 3s remaining | volume = 3/5 = 0.6 of original |
| fade calculation at t-0s | 5s fade, 0s remaining | volume = 0.0 |
| session under 30s discarded | duration: 20 seconds | session not saved |
| session at 30s saved | duration: 30 seconds | session saved |
| soundIds parse | "rain,fireplace" | ["rain", "fireplace"] |
| soundIds max 4 validate | "a,b,c,d,e" | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Single sound playback | 1. Tap "Rain", 2. Verify audio output, 3. Tap "Rain" again | Sound starts, then stops |
| Mix 3 sounds | 1. Tap Rain, 2. Tap Fireplace, 3. Tap White Noise | All 3 audible simultaneously |
| Sleep timer full cycle | 1. Start sound, 2. Set 5-min timer, 3. Wait 5 min | Sounds fade and stop, session logged |
| Session logging | 1. Play sounds for 2 min, 2. Stop, 3. Query sessions | Session record with correct duration |
| Breathing + ambient | 1. Start ambient, 2. Start breathing exercise | Both play, breathing UI shows sound indicator |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Bedtime soundscape | 1. Open Ambient Sounds, 2. Tap Rain + Fireplace, 3. Set 30-min timer, 4. Lock phone | Sounds play for 30 min, fade, stop, session logged |
| Quick relaxation | 1. Open SOS, 2. Start breathing, 3. Add ocean sounds | Breathing + ocean sounds, session linked to breathing |

---

### MM-023: Widgets

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-023 |
| **Feature Name** | Widgets |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a frequent mood logger, I want a home screen widget showing my current streak and today's mood, so that I can see my progress at a glance and be reminded to log without opening the app.

**Secondary:**
> As a visual user, I want a "Today's Mood" widget that shows a colored circle reflecting my latest mood score, so that I can quickly assess my emotional state throughout the day.

**Tertiary:**
> As a data-driven user, I want a weekly trend widget showing a 7-day mini chart on my home screen, so that I can spot mood patterns without navigating into the full app.

#### 3.3 Detailed Description

Widgets bring MyMood data to the device home screen and lock screen, providing at-a-glance mood information and quick-log shortcuts. Three widget types are offered in multiple sizes, covering the most common use cases: checking today's mood, tracking logging streaks, and viewing recent trends.

Widgets read from the local database via a shared app group data container. They do not make network requests. Widget data refreshes on a timeline: every 30 minutes for time-sensitive widgets (Today's Mood), and every 60 minutes for less volatile widgets (Streak, Weekly Trend). Widgets also refresh immediately when the user logs a new mood entry.

The "Quick Log" widget includes a tap action that deep-links directly to the mood logging screen with the Quick Log interface pre-opened, reducing the friction to log from 3 taps (open app, navigate tab, select score) to 1 tap (tap widget, select score).

Widget appearance uses the MyMood accent color palette and respects the device's light/dark mode setting. Widgets do not display sensitive content (no journal text, no specific emotion names) to protect user privacy on shared devices or in screenshots.

#### 3.4 Prerequisites

**Feature Dependencies:**
- MM-001 (Mood Logging): mood score data for display
- MM-007 (Streak Tracking): streak count for the streak widget

**External Dependencies:**
- OS-level widget framework (home screen widgets, lock screen widgets where supported)
- Shared app group data container for reading database from widget extension
- Deep link handling for quick-log tap action

**Assumed Capabilities:**
- Device OS supports home screen widgets
- User has granted widget permissions (no special permissions required on most platforms)

#### 3.5 User Interface Requirements

##### Widget: Today's Mood (Small)

**Size:** 2x2 grid (small widget)

**Layout:**
- Background: dark card matching the MyMood theme
- Center: colored circle (48x48px) showing the latest mood score as a number
- Circle color matches the mood color scale (red 1-2, orange 3-4, yellow 5-6, green 7-8, blue 9-10)
- Below circle: mood descriptor text (e.g., "Good") in 12pt font
- Below descriptor: timestamp "2:30 PM" in 10pt muted text
- If no mood logged today: circle is gray with "?" and text reads "Tap to log"

**Tap Action:** Opens MyMood to the Quick Log screen.

##### Widget: Streak Counter (Small)

**Size:** 2x2 grid (small widget)

**Layout:**
- Background: dark card
- Top: flame icon (if streak active) or snowflake icon (if streak broken)
- Center: large streak number (e.g., "14") in 32pt bold font
- Below number: "day streak" label in 12pt font
- Bottom: "Best: 28" in 10pt muted text (personal best streak)
- If streak is 0: shows "Start logging!" as the label

**Tap Action:** Opens MyMood to the Quick Log screen.

##### Widget: Weekly Trend (Medium)

**Size:** 4x2 grid (medium widget)

**Layout:**
- Background: dark card
- Left section (1/3 width):
  - "This Week" label in 12pt font
  - Average score as large number (e.g., "7.2") in 24pt bold
  - Delta arrow and value vs last week (e.g., "+0.5" with green up arrow)
- Right section (2/3 width):
  - 7-bar mini chart showing daily average mood scores for Mon-Sun
  - Each bar colored by mood scale
  - Days without data show as thin gray line
  - Current day bar has a dot indicator on top
  - X-axis labels: M T W T F S S

**Tap Action:** Opens MyMood to the Mood Trends screen.

**States (all widgets):**

| State | Condition | Display |
|-------|-----------|---------|
| Data Available | At least 1 mood logged today (Today) or ever (Streak/Trend) | Normal display with latest data |
| No Data Today | No mood logged today | Today's Mood: gray circle with "?", "Tap to log" |
| No Data Ever | No mood entries at all | Onboarding state: "Log your first mood!" with tap action |
| Stale Data | Widget data older than 2 hours | Data shown with a small clock icon indicating refresh pending |
| Widget Loading | Initial load or refresh in progress | Placeholder skeleton with module accent color |

##### Widget Configuration (Medium and Large only)

**Options:**
- Time range: "This Week" or "Last 7 Days" (for Weekly Trend)
- Show delta: toggle on/off (for Weekly Trend)

#### 3.6 Data Requirements

##### Entity: WidgetConfiguration

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID | Auto-generated | Unique identifier |
| widgetType | enum | todayMood, streak, weeklyTrend | None | Which widget this configures |
| timeRange | enum | thisWeek, last7Days | thisWeek | Date range for trend widget |
| showDelta | boolean | - | true | Whether to show week-over-week change |
| updatedAt | datetime | ISO 8601, auto-set | Current timestamp | Last configuration change |

##### Entity: WidgetDataCache

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| widgetType | string | Primary key, enum values | None | Widget type this cache is for |
| cachedData | string (JSON) | Required, max 4096 chars | None | Pre-computed widget display data |
| computedAt | datetime | ISO 8601, auto-set | Current timestamp | When this cache was last computed |
| staleAfterMinutes | integer | Min: 5, Max: 120 | 30 | How long before this cache is considered stale |

**Indexes:**
- `mo_widget_data_cache(widgetType)` - Fast lookup by widget type

**Validation Rules:**
- `cachedData` must be valid JSON conforming to the widget data schema for that widgetType
- `computedAt` must be within the last 24 hours; older data triggers a forced recompute
- Widget types must be one of the defined enum values

**Widget Data Schemas:**

```
TodayMoodData:
{
  "latestScore": 7,              // 1-10 or null
  "latestDescriptor": "Good",    // score descriptor or null
  "latestColor": "#22C55E",      // mood color hex
  "latestTimestamp": "14:30",     // HH:MM format or null
  "entryCountToday": 3           // number of entries today
}

StreakData:
{
  "currentStreak": 14,           // 0+
  "bestStreak": 28,              // 0+
  "streakActive": true,          // has logged today
  "todayLogged": true            // at least 1 entry today
}

WeeklyTrendData:
{
  "weekAverage": 7.2,            // float, 1 decimal
  "previousWeekAverage": 6.7,    // float or null
  "delta": 0.5,                  // float or null
  "dailyScores": [6.0, 7.5, null, 8.0, 7.0, 7.5, null]  // Mon-Sun, null = no data
}
```

#### 3.7 Business Logic Rules

##### Widget Data Refresh Strategy

**Purpose:** Keep widget data fresh without excessive battery drain.

**Inputs:**
- triggerType: enum (scheduled, entryLogged, appOpened, manual)
- widgetType: enum (todayMood, streak, weeklyTrend)

**Logic:**

```
1. Determine refresh interval:
   a. todayMood: 30 minutes
   b. streak: 60 minutes
   c. weeklyTrend: 60 minutes
2. ON scheduled refresh (OS-triggered timeline):
   a. Read latest data from shared database
   b. Compute widget data schema
   c. Update WidgetDataCache
   d. Reload widget timeline
3. ON entryLogged:
   a. Immediately recompute all widget data
   b. Force widget timeline reload
4. ON appOpened:
   a. Check if any cache is stale (computedAt + staleAfterMinutes < now)
   b. IF stale: recompute and reload
5. Widget data computation:
   a. todayMood: query last MoodEntry WHERE date = today, ORDER BY loggedAt DESC LIMIT 1
   b. streak: read from StreakState (MM-007)
   c. weeklyTrend: query MoodEntry WHERE date >= weekStart, GROUP BY date, compute daily avg
```

**Edge Cases:**
- App never opened (widget only): scheduled refreshes still run via OS timeline
- Database locked during refresh: use cached data, retry next cycle
- Year boundary (Dec 31 to Jan 1): weeklyTrend handles year transitions via date arithmetic
- Time zone change: widget times reflect the device's current time zone

##### Deep Link Routing

**Purpose:** Route widget taps to the correct screen in the app.

**Logic:**

```
1. todayMood widget tap: navigate to mylife://mood/log
2. streak widget tap: navigate to mylife://mood/log
3. weeklyTrend widget tap: navigate to mylife://mood/trends
4. IF app is not running: launch app, then navigate after module initialization
5. IF app is running in background: bring to foreground, then navigate
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Shared database inaccessible | Widget shows "Open app to refresh" | User opens app, which triggers refresh |
| Widget data cache empty (first install) | Widget shows onboarding state: "Log your first mood!" | First mood log populates cache |
| Widget timeline refresh fails | Stale data continues to display with clock icon | Next scheduled refresh retries |
| Deep link target screen unavailable | App opens to the default tab (Quick Log) | User navigates manually |
| Widget removed and re-added | Widget loads with latest cached data | If no cache, shows onboarding state |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has logged a mood of 8 ("Great") at 2:30 PM,
   **When** they view the Today's Mood widget on their home screen,
   **Then** the widget shows a green circle with "8", "Great" below it, and "2:30 PM" timestamp.

2. **Given** the user has a 14-day logging streak,
   **When** they view the Streak Counter widget,
   **Then** the widget shows a flame icon, "14" in large text, "day streak" label, and their best streak below.

3. **Given** the user has mood data for 5 of the last 7 days,
   **When** they view the Weekly Trend widget,
   **Then** the chart shows 5 colored bars and 2 gray lines for missing days, with the weekly average and delta displayed.

4. **Given** the user taps the Today's Mood widget,
   **When** the app opens,
   **Then** it navigates directly to the Quick Log screen.

**Edge Cases:**

5. **Given** the user has not logged any mood today,
   **When** they view the Today's Mood widget,
   **Then** the widget shows a gray circle with "?" and "Tap to log" text.

6. **Given** the user has never logged any mood,
   **When** they add a widget to their home screen,
   **Then** the widget shows "Log your first mood!" as the onboarding state.

7. **Given** the user logs a mood entry,
   **When** the widget refreshes,
   **Then** the widget updates within 5 seconds to reflect the new entry.

**Negative Tests:**

8. **Given** the shared database is inaccessible,
   **When** the widget attempts to refresh,
   **Then** it shows the last cached data with a small clock icon.
   **And** no error message is shown on the home screen.

9. **Given** the widget data cache is older than 24 hours,
   **When** the widget is displayed,
   **Then** it forces a recompute rather than showing extremely stale data.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| todayMood data: has entry | latest score 7, time 14:30 | { latestScore: 7, latestDescriptor: "Good", latestColor: "#22C55E", latestTimestamp: "14:30" } |
| todayMood data: no entry | no entries today | { latestScore: null, latestDescriptor: null, latestTimestamp: null } |
| streak data: active | currentStreak: 14, bestStreak: 28 | { currentStreak: 14, bestStreak: 28, streakActive: true } |
| streak data: zero | no entries | { currentStreak: 0, bestStreak: 0, streakActive: false } |
| weeklyTrend data: full week | 7 daily averages | all 7 values in dailyScores array |
| weeklyTrend data: partial | 3 days with data | 3 values + 4 nulls |
| delta calculation | this: 7.2, prev: 6.7 | delta: 0.5 |
| delta calculation: no prev | this: 7.2, prev: null | delta: null |
| stale check: fresh | computedAt: 10 min ago, stale: 30 | stale = false |
| stale check: stale | computedAt: 45 min ago, stale: 30 | stale = true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Widget refresh on mood log | 1. Log mood, 2. Check widget cache | Cache updated with new score |
| Deep link from widget | 1. Tap todayMood widget, 2. App opens | Quick Log screen is displayed |
| Widget config change | 1. Change time range to "Last 7 Days", 2. Widget refreshes | Data reflects last 7 days instead of this week |
| Stale cache recompute | 1. Let cache age past staleAfterMinutes, 2. Widget refreshes | Fresh data computed from database |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Add widget and log mood | 1. Add Today's Mood widget, 2. Open app, 3. Log mood 8, 4. Return to home screen | Widget shows "8" with green circle |
| Widget-driven logging | 1. Tap streak widget (streak: 0), 2. Log mood on Quick Log, 3. Return to home | Streak widget shows "1" |

---

### MM-024: Settings & Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | MM-024 |
| **Feature Name** | Settings & Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user, I want a centralized settings screen where I can configure all MyMood preferences (reminders, theme, default scale, data management), so that I can customize the app to fit my personal workflow.

**Secondary:**
> As a privacy-conscious user, I want to view how much data MyMood stores, delete all my mood data with a single action (after confirmation), and export my data before deletion, so that I retain full control over my personal information.

**Tertiary:**
> As a user who has used Daylio before, I want to choose between a 5-point and 10-point mood scale, so that I can use the scale I am most comfortable with.

#### 3.3 Detailed Description

Settings & Preferences is the centralized configuration hub for MyMood. It groups all user-adjustable options into logical sections: General, Privacy & Security, Notifications, Data Management, and About. Each section contains related toggles, pickers, and action buttons.

The General section controls the core logging experience: mood scale (5-point or 10-point), default emotion wheel visibility (show/hide Plutchik wheel on Quick Log), start day of the week (for weekly reports and trends), and whether to show the daily streak counter on the Quick Log screen.

The Privacy & Security section provides access to the PIN/Biometric lock (MM-015) configuration and a "Privacy Mode" toggle. When Privacy Mode is enabled, the app's task switcher preview shows a blurred screen rather than mood data, and notification content is hidden ("MyMood" instead of "Time to log your mood!").

The Notifications section manages mood reminders (MM-013): adding, editing, and removing scheduled reminders, as well as toggling weekly report notifications.

The Data Management section shows storage statistics (total entries, date range, database size in KB/MB), provides access to export (MM-017) and import (MM-018) features, and offers a "Delete All Data" action with a 2-step confirmation flow. The deletion flow requires the user to type "DELETE" to confirm, preventing accidental data loss.

The About section shows the app version, build number, module version, and links to the privacy policy and open-source licenses.

Settings values are stored in a dedicated settings table in the local database. Default values are applied on first module initialization and can be reset to defaults from the settings screen.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (Settings is a foundational feature, though it references other features)

**Related Features (configured from Settings):**
- MM-013 (Mood Reminders): reminder scheduling managed here
- MM-015 (PIN/Biometric Lock): lock configuration accessed here
- MM-017 (Data Export): export initiated here
- MM-018 (Data Import): import initiated here

**External Dependencies:**
- Local notification scheduling API (for reminder management)
- Biometric authentication API (for lock configuration)
- File system access (for export)
- App metadata API (for version/build info)

**Assumed Capabilities:**
- User can navigate to Settings tab from the tab bar

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Top: "Settings" title
- Content: grouped sections in a scrollable list, each section with a header label

**Section: General**
- Mood Scale: segmented control, "5-point" or "10-point" (default: 10-point)
- Show Emotion Wheel: toggle (default: on)
- Start Day of Week: picker, Monday through Sunday (default: Monday)
- Show Streak on Quick Log: toggle (default: on)
- Default Quick Log View: segmented control, "Simple" (score only) or "Full" (score + emotion + activity) (default: Simple)

**Section: Privacy & Security**
- App Lock: row showing current status ("Off", "PIN", "PIN + Biometric"), tap navigates to Lock Settings (MM-015)
- Privacy Mode: toggle (default: off)
  - When on: task switcher preview is blurred, notification content is generic

**Section: Notifications**
- Mood Reminders: row showing "3 reminders set" or "None", tap navigates to Reminders management screen (MM-013)
- Weekly Report Notification: toggle (default: on)
- Monthly Report Notification: toggle (default: on)

**Section: Data Management**
- Storage Info: read-only rows showing:
  - Total mood entries: count (e.g., "1,247 entries")
  - Date range: "Jan 15, 2026 - Mar 7, 2026"
  - Database size: "2.4 MB"
  - Activities tracked: count
  - Breathing sessions: count
- Export Data: button, navigates to Export screen (MM-017)
- Import Data: button, navigates to Import screen (MM-018)
- Delete All Data: button (destructive, red text)

**Section: About**
- App Version: read-only (e.g., "1.0.0 (42)")
- Module Version: read-only (e.g., "mood@1.0.0")
- Privacy Policy: tap opens privacy policy text
- Open Source Licenses: tap opens licenses list
- Reset to Defaults: button (with confirmation dialog)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Normal | Settings loaded | All sections visible with current values |
| Loading | Computing storage stats | Storage info rows show loading spinner |
| Delete Confirmation Step 1 | User tapped "Delete All Data" | Dialog: "This will permanently delete all mood data. This cannot be undone. Continue?" with Cancel and Continue buttons |
| Delete Confirmation Step 2 | User tapped "Continue" | Dialog: "Type DELETE to confirm" with text field and a disabled Confirm button that enables when "DELETE" is typed |
| Delete In Progress | Deletion underway | Progress spinner, all other settings disabled |
| Reset Confirmation | User tapped "Reset to Defaults" | Dialog: "Reset all settings to defaults? Your mood data will not be affected." with Cancel and Reset buttons |

**Interactions:**
- Toggle switch: instantly saves the setting, no separate save button
- Segmented control: instantly saves the selection
- Picker: opens picker modal, selection saves on dismissal
- Tap row with arrow: navigates to detail screen
- Tap "Delete All Data": triggers 2-step confirmation flow
- Tap "Reset to Defaults": triggers single confirmation dialog

##### Modal: Delete Confirmation (Step 2)

**Layout:**
- Title: "Confirm Deletion"
- Body text: "This action is permanent. All mood entries, activities, emotions, breathing sessions, experiments, reports, and settings will be deleted."
- Bullet list of what will be deleted:
  - [count] mood entries
  - [count] activities
  - [count] breathing sessions
  - [count] experiment records
  - [count] reports
- Text input field with placeholder "Type DELETE to confirm"
- Two buttons: "Cancel" (default) and "Delete Everything" (red, disabled until "DELETE" is typed)

**Interactions:**
- Type in text field: "Delete Everything" button enables only when text exactly equals "DELETE" (case-sensitive)
- Tap "Delete Everything": triggers deletion, shows progress, then returns to Settings with empty state
- Tap "Cancel" or dismiss: no action taken

#### 3.6 Data Requirements

##### Entity: MoodSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, singleton ("mood_settings") | "mood_settings" | Fixed singleton key |
| moodScale | enum | fivePoint, tenPoint | tenPoint | Active mood scale |
| showEmotionWheel | boolean | - | true | Show Plutchik wheel on Quick Log |
| startDayOfWeek | integer | 0 (Sunday) through 6 (Saturday) | 1 (Monday) | First day of week for reports and trends |
| showStreakOnQuickLog | boolean | - | true | Display streak counter on Quick Log screen |
| defaultQuickLogView | enum | simple, full | simple | Quick Log initial view mode |
| privacyMode | boolean | - | false | Blur task switcher, hide notification content |
| weeklyReportNotification | boolean | - | true | Send notification when weekly report is ready |
| monthlyReportNotification | boolean | - | true | Send notification when monthly report is ready |
| createdAt | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |
| updatedAt | datetime | ISO 8601, auto-set | Current timestamp | Last modification time |

**Indexes:**
- Primary key on `id` (singleton, always "mood_settings")

**Validation Rules:**
- `moodScale` must be one of the two valid enum values
- `startDayOfWeek` must be 0-6 inclusive
- Exactly one MoodSettings record exists at all times
- Record is created on module initialization if it does not exist

**Example Data:**

```
{
  "id": "mood_settings",
  "moodScale": "tenPoint",
  "showEmotionWheel": true,
  "startDayOfWeek": 1,
  "showStreakOnQuickLog": true,
  "defaultQuickLogView": "simple",
  "privacyMode": false,
  "weeklyReportNotification": true,
  "monthlyReportNotification": true,
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-03-07T14:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Settings Initialization

**Purpose:** Ensure a valid settings record exists on module startup.

**Logic:**

```
1. ON module initialization:
   a. Query MoodSettings WHERE id = "mood_settings"
   b. IF no record exists:
      - Create one with all default values
   c. IF record exists but schema has new fields (migration):
      - Add new fields with default values
      - Increment updatedAt
2. Cache settings in memory for the session
3. ON any setting change:
   a. Update the database record
   b. Update the in-memory cache
   c. Trigger relevant side effects (see below)
```

##### Setting Change Side Effects

**Purpose:** Apply immediate behavioral changes when settings are modified.

**Logic:**

```
1. moodScale changed:
   a. IF switching from 10-point to 5-point:
      - Quick Log shows 5 buttons instead of 10
      - Existing 10-point data is NOT modified (display converts: ceil(oldScore / 2))
      - Charts and trends rescale Y-axis to 1-5
   b. IF switching from 5-point to 10-point:
      - Quick Log shows 10 buttons
      - Existing 5-point data is NOT modified (display converts: oldScore * 2)
      - Charts and trends rescale Y-axis to 1-10

2. showEmotionWheel changed:
   a. IF toggled off: Plutchik wheel is hidden from Quick Log (score + activity only)
   b. IF toggled on: Plutchik wheel appears below score on Quick Log

3. startDayOfWeek changed:
   a. Invalidate weekly trend cache
   b. Next weekly report uses new start day
   c. Year in Pixels week separators adjust

4. privacyMode changed:
   a. IF toggled on:
      - Register task switcher blur handler
      - Update notification content templates to generic text
   b. IF toggled off:
      - Remove blur handler
      - Restore descriptive notification content

5. weeklyReportNotification or monthlyReportNotification changed:
   a. Update local notification schedule accordingly
```

##### Scale Conversion Formula

**Purpose:** Display historical data correctly when the user changes mood scale.

**Formulas:**
- 10-point to 5-point display: `displayScore = ceil(rawScore / 2)` (e.g., 7 becomes 4, 8 becomes 4, 9 becomes 5, 10 becomes 5)
- 5-point to 10-point display: `displayScore = rawScore * 2` (e.g., 3 becomes 6, 5 becomes 10)
- Raw scores in the database are NEVER modified. Conversion is display-only.
- All analytics computations use raw scores. Only the UI layer applies conversion.

**Edge Cases:**
- Score 1 on 10-point converts to 1 on 5-point: ceil(1/2) = 1
- Score 2 on 10-point converts to 1 on 5-point: ceil(2/2) = 1
- Score 10 on 10-point converts to 5 on 5-point: ceil(10/2) = 5

##### Data Deletion Logic

**Purpose:** Permanently remove all module data when the user requests it.

**Inputs:**
- confirmationText: string (must equal "DELETE")

**Logic:**

```
1. Validate confirmationText === "DELETE" (case-sensitive)
2. IF not valid: reject, show error "Please type DELETE exactly"
3. Begin database transaction
4. Delete in order (respecting foreign keys):
   a. mo_suggestion_feedback
   b. mo_ambient_sessions
   c. mo_experiment_entries (if exists)
   d. mo_experiments
   e. mo_mood_reports
   f. mo_breathing_sessions
   g. mo_journal_entries
   h. mo_entry_photos
   i. mo_mood_entry_activities
   j. mo_mood_entry_emotions
   k. mo_mood_entries
   l. mo_activity_definitions (user-created only, preserve defaults)
   m. mo_widget_data_cache
5. Reset MoodSettings to defaults (do NOT delete the settings row)
6. Reset streak state
7. Commit transaction
8. Clear in-memory caches
9. Refresh widget data (all widgets show empty state)
10. Navigate to Quick Log (fresh start)
```

**Edge Cases:**
- Transaction fails mid-deletion: rollback all changes, no partial deletion
- Deletion during active breathing or ambient session: stop session first, then delete
- Export suggested before deletion: show "Would you like to export first?" prompt before Step 1

##### Storage Statistics Computation

**Purpose:** Show the user how much data the module stores.

**Logic:**

```
1. totalEntries = COUNT(*) FROM mo_mood_entries
2. dateRange = MIN(loggedAt), MAX(loggedAt) FROM mo_mood_entries
3. databaseSize = file size of SQLite database file (in KB or MB)
   - Note: this is the entire MyLife database, not just mood tables
   - Show as "MyMood data: ~X.X MB" (estimated by summing row counts * avg row size)
4. activitiesTracked = COUNT(*) FROM mo_activity_definitions WHERE isActive = true
5. breathingSessions = COUNT(*) FROM mo_breathing_sessions
6. Cache results for 5 minutes (avoid recomputing on every settings scroll)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Settings read fails on launch | Use hardcoded defaults, log error | Auto-retry on next app open |
| Setting save fails | Toast: "Could not save setting. Please try again." | Setting reverts to previous value |
| Delete transaction fails | Dialog: "Deletion failed. No data was removed." | User retries; full rollback ensures data integrity |
| Storage stats computation fails | Show "Unable to calculate" for affected rows | Retry on next Settings open |
| Scale conversion overflow | Display clamped to scale max | 5-point max: 5, 10-point max: 10 |
| Settings migration fails (new field) | Use hardcoded default for new field | Next app restart retries migration |

**Validation Timing:**
- Setting changes validate and save immediately on interaction (no form-level save)
- Delete confirmation validates on every keystroke in the text field
- Scale conversion validates on toggle (immediate, no save step)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens Settings,
   **When** the screen loads,
   **Then** all sections are visible with current values (General, Privacy & Security, Notifications, Data Management, About).

2. **Given** the user toggles "Mood Scale" from 10-point to 5-point,
   **When** they return to Quick Log,
   **Then** the score selector shows 5 buttons (1-5) instead of 10.
   **And** existing entries in the timeline display converted scores (ceil(raw/2)).

3. **Given** the user toggles "Privacy Mode" on,
   **When** they switch away from the app,
   **Then** the task switcher shows a blurred preview instead of mood data.
   **And** reminder notifications show "MyMood" instead of descriptive content.

4. **Given** the user has 500 mood entries,
   **When** they view the Data Management section,
   **Then** they see "500 entries", the date range, and the estimated storage size.

5. **Given** the user taps "Delete All Data", confirms with "Continue", then types "DELETE",
   **When** they tap "Delete Everything",
   **Then** all mood data is removed, settings reset to defaults, and the Quick Log shows the empty state.

**Edge Cases:**

6. **Given** the user types "delete" (lowercase) in the deletion confirmation,
   **When** they look at the "Delete Everything" button,
   **Then** it remains disabled (case-sensitive match required).

7. **Given** the user switches from 10-point to 5-point scale and back,
   **When** they view their historical data,
   **Then** all original scores display correctly (no data was modified during conversion).

8. **Given** the settings database record does not exist (fresh install),
   **When** the module initializes,
   **Then** a settings record is created with all default values.

**Negative Tests:**

9. **Given** a settings save fails due to a database error,
   **When** the user toggles a setting,
   **Then** the toggle reverts to its previous position and a toast appears: "Could not save setting. Please try again."

10. **Given** the deletion transaction fails mid-way,
    **When** the error is caught,
    **Then** all changes are rolled back and a dialog shows: "Deletion failed. No data was removed."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| scale convert 10->5: score 1 | rawScore: 1, target: 5pt | displayScore: 1 |
| scale convert 10->5: score 7 | rawScore: 7, target: 5pt | displayScore: 4 |
| scale convert 10->5: score 10 | rawScore: 10, target: 5pt | displayScore: 5 |
| scale convert 5->10: score 3 | rawScore: 3, target: 10pt | displayScore: 6 |
| scale convert 5->10: score 5 | rawScore: 5, target: 10pt | displayScore: 10 |
| settings defaults | no existing record | all defaults applied correctly |
| deletion validation: exact match | "DELETE" | valid = true |
| deletion validation: lowercase | "delete" | valid = false |
| deletion validation: with space | "DELETE " | valid = false |
| deletion validation: empty | "" | valid = false |
| storage stats: zero entries | 0 entries | totalEntries: 0, dateRange: null |
| storage stats: entries exist | 500 entries, Jan 1 - Mar 7 | totalEntries: 500, dateRange: "Jan 1, 2026 - Mar 7, 2026" |
| start day validation | 7 | validation error (must be 0-6) |
| start day validation | -1 | validation error (must be 0-6) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Change mood scale | 1. Set to 5-point, 2. Open Quick Log | 5 score buttons shown |
| Privacy mode toggle | 1. Enable privacy mode, 2. Background app | Task switcher shows blurred preview |
| Delete all data | 1. Have 100 entries, 2. Delete all, 3. Check tables | All mood tables empty, settings reset |
| Delete rollback on failure | 1. Simulate DB error mid-delete, 2. Check tables | All data intact, no partial deletion |
| Scale conversion display | 1. Log score 9 on 10pt, 2. Switch to 5pt, 3. View timeline | Entry shows "5" (converted), raw DB value remains 9 |
| Settings persistence | 1. Change 3 settings, 2. Force close app, 3. Reopen | All 3 settings retain changed values |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full settings customization | 1. Change scale to 5pt, 2. Hide emotion wheel, 3. Set start day to Sunday, 4. Enable privacy mode | Quick Log shows 5 buttons, no wheel, week starts Sunday, app blurs on switch |
| Data lifecycle | 1. Log 10 moods, 2. View storage stats, 3. Export, 4. Delete all | Stats show 10 entries, export file created, then all data removed |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on **MoodEntry**, the primary record for every mood log. Each MoodEntry can have multiple EmotionTags (Plutchik emotions), multiple ActivityTags (what the user was doing), multiple PhotoAttachments, and an optional extended journal entry stored as additional columns on the same row.

Supporting entities track breathing exercises (BreathingSession), ambient sound playback (AmbientSession), guided journaling prompts (PromptHistory), mood reminders (MoodReminder), SOS crisis episodes (SOSEpisode, EmergencyContact), and self-care suggestion feedback (SuggestionFeedback).

Analytical entities include StreakMilestone (logging streak achievements), Experiment (A/B lifestyle tests), and MoodReport (weekly/monthly generated reports). Configuration entities include MoodSettings (singleton preferences), ModuleLock (PIN/biometric lock state), and WidgetConfiguration/WidgetDataCache (home screen widget data).

Static seed data entities (not user-modifiable) include JournalingPrompt, SelfCareSuggestion, ExperimentTemplate, and AmbientSound. These ship pre-populated and are never synced or exported.

All user data is local-only. No entity has a cloud sync column, server ID, or network-dependent field.

### 4.2 Complete Entity Definitions

All tables use the `mo_` prefix in the MyLife hub database to avoid collisions with other modules.

#### Table: mo_entries

The central mood log table. Each row is one mood log event.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| score | INTEGER | NOT NULL, CHECK(score >= 1 AND score <= 10) | None | Mood score 1-10 |
| note | TEXT | CHECK(length(note) <= 500) | NULL | Quick context note |
| journalContent | TEXT | CHECK(length(journalContent) <= 5000) | NULL | Extended micro-journal (Markdown subset) |
| journalWordCount | INTEGER | CHECK(journalWordCount >= 0) | NULL | Computed word count of journalContent |
| hasDraft | INTEGER | NOT NULL, CHECK(hasDraft IN (0,1)) | 0 | Auto-saved draft exists |
| draftContent | TEXT | CHECK(length(draftContent) <= 5000) | NULL | Unsaved draft text |
| loggedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Exact time of mood log |
| date | TEXT | NOT NULL, YYYY-MM-DD | Derived from loggedAt | Date for daily aggregation |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |

#### Virtual Table: mo_entries_fts (FTS5)

Full-text search index over notes and journal content.

| Column | Source | Description |
|--------|--------|-------------|
| rowid | mo_entries.rowid | Links to main entry |
| note | mo_entries.note | Quick note text |
| journalContent | mo_entries.journalContent | Journal content |

Configuration: tokenizer=unicode61, content=mo_entries, content_rowid=rowid.

#### Table: mo_emotion_tags

Plutchik emotion tags linked to mood entries. Multiple emotions per entry.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| entryId | TEXT | NOT NULL, REFERENCES mo_entries(id) ON DELETE CASCADE | None | Parent mood entry |
| emotionFamily | TEXT | NOT NULL, CHECK(emotionFamily IN ('joy','trust','fear','surprise','sadness','disgust','anger','anticipation')) | None | Primary emotion category |
| emotionName | TEXT | NOT NULL | None | Specific Plutchik emotion name (32 valid values) |
| intensityLevel | TEXT | NOT NULL, CHECK(intensityLevel IN ('mild','moderate','intense','composite')) | None | Intensity band |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |

UNIQUE constraint on (entryId, emotionName).

#### Table: mo_activity_tags

Join table linking mood entries to activities. Multiple activities per entry.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| entryId | TEXT | NOT NULL, REFERENCES mo_entries(id) ON DELETE CASCADE | None | Parent mood entry |
| activityId | TEXT | NOT NULL, REFERENCES mo_activity_defs(id) | None | Activity definition reference |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |

UNIQUE constraint on (entryId, activityId).

#### Table: mo_activity_defs

Activity definitions (both default/seed and user-created).

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| name | TEXT | NOT NULL, CHECK(length(name) <= 50) | None | Display name |
| icon | TEXT | NOT NULL | None | Emoji or icon identifier |
| categoryId | TEXT | NOT NULL, REFERENCES mo_activity_categories(id) | None | Parent category |
| isDefault | INTEGER | NOT NULL, CHECK(isDefault IN (0,1)) | 0 | Bundled default activity |
| isCustom | INTEGER | NOT NULL, CHECK(isCustom IN (0,1)) | 0 | User-created activity |
| isArchived | INTEGER | NOT NULL, CHECK(isArchived IN (0,1)) | 0 | Hidden from picker |
| sortOrder | INTEGER | NOT NULL, CHECK(sortOrder >= 0) | 0 | Position within category |
| usageCount | INTEGER | NOT NULL, CHECK(usageCount >= 0) | 0 | Cached tag count |
| archivedAt | TEXT | ISO 8601 | NULL | When archived |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |
| updatedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Last modification time |

#### Table: mo_activity_categories

Activity category groupings (both default and user-created).

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| name | TEXT | NOT NULL, UNIQUE, CHECK(length(name) <= 50) | None | Category display name |
| icon | TEXT | NOT NULL | None | Category emoji |
| isDefault | INTEGER | NOT NULL, CHECK(isDefault IN (0,1)) | 0 | Bundled default category |
| isCustom | INTEGER | NOT NULL, CHECK(isCustom IN (0,1)) | 0 | User-created category |
| sortOrder | INTEGER | NOT NULL, CHECK(sortOrder >= 0) | 0 | Position in category list |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |

#### Table: mo_photos

Photo attachments for mood entries. Up to 3 per entry.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| entryId | TEXT | NOT NULL, REFERENCES mo_entries(id) ON DELETE CASCADE | None | Parent mood entry |
| filePath | TEXT | NOT NULL | None | Relative path to resized photo |
| thumbnailPath | TEXT | NOT NULL | None | Relative path to thumbnail |
| originalFileName | TEXT | NOT NULL | None | Original filename from camera/library |
| widthPx | INTEGER | NOT NULL, CHECK(widthPx > 0) | None | Image width in pixels |
| heightPx | INTEGER | NOT NULL, CHECK(heightPx > 0) | None | Image height in pixels |
| fileSizeBytes | INTEGER | NOT NULL, CHECK(fileSizeBytes > 0) | None | File size in bytes |
| sortOrder | INTEGER | NOT NULL, CHECK(sortOrder >= 0) | 0 | Display order within entry |
| capturedAt | TEXT | ISO 8601 | NULL | EXIF capture date |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |

#### Table: mo_breathing_sessions

Guided breathing exercise session records.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| technique | TEXT | NOT NULL, CHECK(technique IN ('box','fourSevenEight','coherent')) | None | Breathing technique used |
| startedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Session start |
| completedAt | TEXT | ISO 8601 | NULL | Session end (null if abandoned) |
| totalDurationSeconds | INTEGER | NOT NULL, CHECK(totalDurationSeconds >= 0) | 0 | Elapsed time in seconds |
| cyclesPlanned | INTEGER | NOT NULL, CHECK(cyclesPlanned >= 1) | 5 | Planned cycle count |
| cyclesCompleted | INTEGER | NOT NULL, CHECK(cyclesCompleted >= 0) | 0 | Actual cycles completed |
| wasCompleted | INTEGER | NOT NULL, CHECK(wasCompleted IN (0,1)) | 0 | All cycles finished |
| postMoodEntryId | TEXT | REFERENCES mo_entries(id) ON DELETE SET NULL | NULL | Mood logged after session |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |

#### Table: mo_ambient_sessions

Ambient sound playback session records.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| startedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Playback start |
| endedAt | TEXT | ISO 8601 | NULL | Playback end |
| durationSeconds | INTEGER | CHECK(durationSeconds >= 30) | NULL | Total duration (min 30s to be saved) |
| soundIds | TEXT | NOT NULL | None | Comma-separated sound IDs (1-4) |
| usedSleepTimer | INTEGER | NOT NULL, CHECK(usedSleepTimer IN (0,1)) | 0 | Whether sleep timer was set |
| sleepTimerMinutes | INTEGER | CHECK(sleepTimerMinutes IN (5,10,15,20,30,45,60)) | NULL | Timer duration if used |
| breathingSessionId | TEXT | REFERENCES mo_breathing_sessions(id) ON DELETE SET NULL | NULL | Linked breathing session |

#### Table: mo_journaling_prompts (Seed Data)

Static journaling prompt library. Pre-populated, not user-modifiable.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Assigned | Unique prompt identifier |
| text | TEXT | NOT NULL, CHECK(length(text) <= 200) | None | Prompt text |
| moodBand | TEXT | NOT NULL, CHECK(moodBand IN ('crisis','low','neutral','good','excellent')) | None | Target mood range |
| theme | TEXT | NOT NULL, CHECK(theme IN ('gratitude','reflection','relationships','work','health','growth','creativity','nature')) | None | Thematic category |
| emotionRelevance | TEXT | None | '[]' | JSON array of relevant emotion names |

#### Table: mo_prompt_history

Records which prompts were shown and selected.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| promptId | TEXT | NOT NULL, REFERENCES mo_journaling_prompts(id) | None | Prompt shown |
| shownAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | When shown |
| wasSelected | INTEGER | NOT NULL, CHECK(wasSelected IN (0,1)) | 0 | User selected this prompt |
| entryId | TEXT | REFERENCES mo_entries(id) ON DELETE SET NULL | NULL | Mood entry if prompt was used |

#### Table: mo_reminders

Scheduled mood logging reminders. Maximum 5 per user.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| timeHour | INTEGER | NOT NULL, CHECK(timeHour >= 0 AND timeHour <= 23) | None | Hour (24h) |
| timeMinute | INTEGER | NOT NULL, CHECK(timeMinute >= 0 AND timeMinute <= 59) | 0 | Minute |
| isRandomWindow | INTEGER | NOT NULL, CHECK(isRandomWindow IN (0,1)) | 0 | Randomize within window |
| windowEndHour | INTEGER | CHECK(windowEndHour >= 0 AND windowEndHour <= 23) | NULL | End hour for random window |
| windowEndMinute | INTEGER | CHECK(windowEndMinute >= 0 AND windowEndMinute <= 59) | NULL | End minute for random window |
| daysOfWeek | TEXT | NOT NULL | '[0,1,2,3,4,5,6]' | JSON array of active days (0=Monday) |
| isEnabled | INTEGER | NOT NULL, CHECK(isEnabled IN (0,1)) | 1 | Reminder active |
| message | TEXT | NOT NULL, CHECK(length(message) <= 100) | 'How are you feeling?' | Notification text |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |

#### Table: mo_streak_milestones

Achievement records for logging streak milestones.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| threshold | INTEGER | NOT NULL, CHECK(threshold IN (3,7,14,30,60,90,180,365)) | None | Streak day count achieved |
| achievedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | When milestone was first hit |
| shown | INTEGER | NOT NULL, CHECK(shown IN (0,1)) | 0 | Celebration displayed |

UNIQUE constraint on (threshold).

#### Table: mo_experiments

User-created A/B lifestyle experiments.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| hypothesis | TEXT | NOT NULL, CHECK(length(hypothesis) <= 500) | None | What user believes will happen |
| interventionDescription | TEXT | NOT NULL, CHECK(length(interventionDescription) <= 500) | None | Planned behavior change |
| periodDays | INTEGER | NOT NULL, CHECK(periodDays IN (7,14,21,30)) | 14 | Days per period |
| baselineStart | TEXT | NOT NULL, YYYY-MM-DD | None | Baseline period start |
| baselineEnd | TEXT | NOT NULL, YYYY-MM-DD | None | Baseline period end (computed) |
| interventionStart | TEXT | NOT NULL, YYYY-MM-DD | None | Intervention period start |
| interventionEnd | TEXT | NOT NULL, YYYY-MM-DD | None | Intervention period end (computed) |
| status | TEXT | NOT NULL, CHECK(status IN ('draft','baseline','intervention','analyzing','completed','abandoned')) | 'draft' | Lifecycle phase |
| templateId | TEXT | REFERENCES mo_experiment_templates(id) | NULL | Source template |
| baselineAvg | REAL | None | NULL | Mean mood during baseline |
| interventionAvg | REAL | None | NULL | Mean mood during intervention |
| pearsonR | REAL | None | NULL | Correlation coefficient |
| conclusion | TEXT | CHECK(length(conclusion) <= 500) | NULL | Auto-generated conclusion |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |
| completedAt | TEXT | ISO 8601 | NULL | Analysis completion time |

#### Table: mo_experiment_templates (Seed Data)

Pre-built experiment templates. 10 shipped.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Assigned | Unique template ID |
| name | TEXT | NOT NULL | None | Template name |
| hypothesis | TEXT | NOT NULL | None | Pre-written hypothesis |
| interventionDescription | TEXT | NOT NULL | None | Pre-written intervention |
| suggestedDays | INTEGER | NOT NULL, CHECK(suggestedDays IN (7,14,21,30)) | 14 | Suggested period length |
| category | TEXT | NOT NULL, CHECK(category IN ('exercise','sleep','mindfulness','social','nutrition','digital')) | None | Template category |

#### Table: mo_reports

Generated weekly and monthly mood reports.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| periodType | TEXT | NOT NULL, CHECK(periodType IN ('weekly','monthly')) | None | Report type |
| periodStart | TEXT | NOT NULL, YYYY-MM-DD | None | Period start date |
| periodEnd | TEXT | NOT NULL, YYYY-MM-DD | None | Period end date |
| avgScore | REAL | None | None | Average mood for period |
| entryCount | INTEGER | None | None | Entries in period |
| reportData | TEXT | NOT NULL | None | Full report JSON blob |
| generatedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Generation time |

UNIQUE constraint on (periodType, periodStart).

#### Table: mo_sos_episodes

SOS/panic button usage records.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| startedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | SOS activation time |
| endedAt | TEXT | ISO 8601 | NULL | SOS dismissal time |
| durationSeconds | INTEGER | None | NULL | Time in SOS flow |
| toolsUsed | TEXT | None | '[]' | JSON array: breathing, grounding, contacts |
| trigger | TEXT | CHECK(length(trigger) <= 200) | NULL | User-reported trigger |
| moodBefore | INTEGER | CHECK(moodBefore >= 1 AND moodBefore <= 10) | NULL | Pre-SOS mood estimate |
| moodAfter | INTEGER | CHECK(moodAfter >= 1 AND moodAfter <= 10) | NULL | Post-SOS mood |
| notes | TEXT | CHECK(length(notes) <= 500) | NULL | Additional context |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |

#### Table: mo_emergency_contacts

Personal emergency contacts for the SOS feature. Maximum 3.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| name | TEXT | NOT NULL, CHECK(length(name) <= 100) | None | Contact name |
| phoneNumber | TEXT | NOT NULL | None | Phone number (min 7 digits) |
| sortOrder | INTEGER | NOT NULL, CHECK(sortOrder >= 0 AND sortOrder <= 2) | Auto | Display order |

#### Table: mo_self_care_suggestions (Seed Data)

Static self-care suggestion library. 88+ suggestions shipped.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Assigned | Unique suggestion ID |
| text | TEXT | NOT NULL, CHECK(length(text) <= 200) | None | Suggestion text |
| moodBand | TEXT | NOT NULL, CHECK(moodBand IN ('low','neutral','high')) | None | Target mood range |
| category | TEXT | NOT NULL, CHECK(category IN ('physical','social','creative','mindfulness','nature','rest')) | None | Activity category |
| relatedActivity | TEXT | None | NULL | Activity name for correlation-based personalization |

#### Table: mo_suggestion_feedback

User ratings of self-care suggestions.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| suggestionId | TEXT | NOT NULL, REFERENCES mo_self_care_suggestions(id) | None | Rated suggestion |
| rating | TEXT | NOT NULL, CHECK(rating IN ('helpful','unhelpful')) | None | User rating |
| moodAtTime | INTEGER | NOT NULL, CHECK(moodAtTime >= 1 AND moodAtTime <= 10) | None | Mood when shown |
| shownAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | When suggestion was displayed |

#### Table: mo_widget_config

Widget configuration per widget type.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID | Unique identifier |
| widgetType | TEXT | NOT NULL, CHECK(widgetType IN ('todayMood','streak','weeklyTrend')) | None | Widget type |
| timeRange | TEXT | NOT NULL, CHECK(timeRange IN ('thisWeek','last7Days')) | 'thisWeek' | Date range for trend widget |
| showDelta | INTEGER | NOT NULL, CHECK(showDelta IN (0,1)) | 1 | Show week-over-week delta |
| updatedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Last config change |

#### Table: mo_widget_cache

Pre-computed widget display data for fast widget rendering.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| widgetType | TEXT | PRIMARY KEY | None | Widget type (acts as key) |
| cachedData | TEXT | NOT NULL, CHECK(length(cachedData) <= 4096) | None | JSON widget data |
| computedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Cache computation time |
| staleAfterMinutes | INTEGER | NOT NULL, CHECK(staleAfterMinutes >= 5 AND staleAfterMinutes <= 120) | 30 | Staleness threshold |

#### Table: mo_module_lock

Singleton PIN/biometric lock state. PIN hash and salt stored in platform secure storage, not in this table.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY, fixed 'mood_lock' | 'mood_lock' | Singleton key |
| isEnabled | INTEGER | NOT NULL, CHECK(isEnabled IN (0,1)) | 0 | Lock active |
| method | TEXT | CHECK(method IN ('pin','biometric','biometricWithPin')) | NULL | Auth method |
| timeoutMinutes | INTEGER | NOT NULL, CHECK(timeoutMinutes IN (0,1,5,15)) | 0 | Re-lock timeout |
| failedAttempts | INTEGER | NOT NULL, CHECK(failedAttempts >= 0) | 0 | Consecutive PIN failures |
| lockedUntil | TEXT | ISO 8601 | NULL | Lockout expiry |
| lastUnlockedAt | TEXT | ISO 8601 | NULL | Last successful unlock |

#### Table: mo_settings

Singleton user preferences for the module.

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY, fixed 'mood_settings' | 'mood_settings' | Singleton key |
| moodScale | TEXT | NOT NULL, CHECK(moodScale IN ('fivePoint','tenPoint')) | 'tenPoint' | Active scale |
| showEmotionWheel | INTEGER | NOT NULL, CHECK(showEmotionWheel IN (0,1)) | 1 | Wheel on Quick Log |
| startDayOfWeek | INTEGER | NOT NULL, CHECK(startDayOfWeek >= 0 AND startDayOfWeek <= 6) | 1 | Week start (0=Sun, 1=Mon) |
| showStreakOnQuickLog | INTEGER | NOT NULL, CHECK(showStreakOnQuickLog IN (0,1)) | 1 | Streak on Quick Log |
| defaultQuickLogView | TEXT | NOT NULL, CHECK(defaultQuickLogView IN ('simple','full')) | 'simple' | Quick Log mode |
| privacyMode | INTEGER | NOT NULL, CHECK(privacyMode IN (0,1)) | 0 | Task switcher blur |
| weeklyReportNotification | INTEGER | NOT NULL, CHECK(weeklyReportNotification IN (0,1)) | 1 | Weekly report alerts |
| monthlyReportNotification | INTEGER | NOT NULL, CHECK(monthlyReportNotification IN (0,1)) | 1 | Monthly report alerts |
| createdAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Record creation time |
| updatedAt | TEXT | NOT NULL, ISO 8601 | CURRENT_TIMESTAMP | Last update time |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| mo_entries -> mo_emotion_tags | one-to-many | A mood entry can have multiple Plutchik emotion tags |
| mo_entries -> mo_activity_tags | one-to-many | A mood entry can have multiple activity tags |
| mo_entries -> mo_photos | one-to-many | A mood entry can have up to 3 photo attachments |
| mo_activity_tags -> mo_activity_defs | many-to-one | Each activity tag references an activity definition |
| mo_activity_defs -> mo_activity_categories | many-to-one | Each activity belongs to a category |
| mo_breathing_sessions -> mo_entries | one-to-one (optional) | A breathing session can link to a post-session mood entry |
| mo_ambient_sessions -> mo_breathing_sessions | many-to-one (optional) | An ambient session can link to a concurrent breathing session |
| mo_prompt_history -> mo_journaling_prompts | many-to-one | Tracks which prompts were shown |
| mo_prompt_history -> mo_entries | many-to-one (optional) | Links prompt usage to the resulting entry |
| mo_suggestion_feedback -> mo_self_care_suggestions | many-to-one | Tracks suggestion ratings |
| mo_experiments -> mo_experiment_templates | many-to-one (optional) | Experiment may reference a template |

### 4.4 Indexes

| Table | Index Name | Columns | Reason |
|-------|-----------|---------|--------|
| mo_entries | idx_entries_date | date | Date-range queries for timeline, trends, Year in Pixels |
| mo_entries | idx_entries_logged_at | loggedAt | Chronological ordering within a day |
| mo_entries | idx_entries_date_logged | date, loggedAt | Sorted daily listing (composite) |
| mo_entries | idx_entries_score | score | Filtering by mood level |
| mo_emotion_tags | idx_emotion_entry | entryId | Emotions for a given entry |
| mo_emotion_tags | idx_emotion_family | emotionFamily | Aggregation by primary emotion |
| mo_emotion_tags | idx_emotion_name | emotionName | Frequency counting and correlation |
| mo_activity_tags | idx_activity_tag_entry | entryId | Activities for a given entry |
| mo_activity_tags | idx_activity_tag_activity | activityId | Frequency counting and correlation |
| mo_activity_defs | idx_activity_def_cat_sort | categoryId, sortOrder | Ordered listing within category |
| mo_activity_defs | idx_activity_def_archived | isArchived | Filter active vs archived |
| mo_activity_categories | idx_category_sort | sortOrder | Category ordering |
| mo_photos | idx_photos_entry | entryId | Photos for a given entry |
| mo_photos | idx_photos_entry_sort | entryId, sortOrder | Ordered photos per entry |
| mo_photos | idx_photos_created | createdAt | Chronological gallery listing |
| mo_breathing_sessions | idx_breathing_started | startedAt | Session history |
| mo_breathing_sessions | idx_breathing_technique | technique | Filter by technique |
| mo_ambient_sessions | idx_ambient_started | startedAt | Session history |
| mo_ambient_sessions | idx_ambient_breathing | breathingSessionId | Sessions linked to breathing |
| mo_prompt_history | idx_prompt_history_prompt | promptId, shownAt | Rotation lookups |
| mo_prompt_history | idx_prompt_history_shown | shownAt | Recent history |
| mo_reminders | idx_reminders_enabled | isEnabled | Active reminder scheduling |
| mo_streak_milestones | idx_streak_threshold | threshold | Milestone lookup |
| mo_experiments | idx_experiment_status | status | Find active experiments |
| mo_experiments | idx_experiment_baseline | baselineStart | Chronological ordering |
| mo_reports | idx_report_type_start | periodType, periodStart | Report lookup by type and date |
| mo_reports | idx_report_generated | generatedAt | Most recent first ordering |
| mo_sos_episodes | idx_sos_started | startedAt | Chronological listing |
| mo_suggestion_feedback | idx_feedback_suggestion | suggestionId | Aggregate ratings |
| mo_suggestion_feedback | idx_feedback_shown | shownAt | Recency rotation |
| mo_widget_cache | (primary key) | widgetType | Fast cache lookup |

### 4.5 Table Prefix

**MyLife hub table prefix:** `mo_`

All table names in the SQLite database are prefixed with `mo_` to avoid collisions with other modules in the MyLife hub. The mood module coexists in a single SQLite file alongside books (`bk_`), budget (`bg_`), fast (`ft_`), and other module tables.

### 4.6 Migration Strategy

**Initial Table Creation (v1.0.0):**
- All tables are created when the mood module is first enabled by the user
- Schema version is tracked in the MyLife hub's `hub_module_migrations` table
- Seed data (journaling prompts, experiment templates, self-care suggestions, ambient sounds) is inserted during the initial migration
- FTS5 virtual table and triggers are created as part of the initial migration

**Schema Versioning:**
- Each migration has a monotonically increasing version number (1, 2, 3, ...)
- Migrations run sequentially on module enable and on app update
- Migration state is stored per module: `hub_module_migrations` tracks `{ moduleId: 'mood', currentVersion: N }`

**Data Preservation on Disable:**
- When the user disables the mood module, all tables and data are preserved
- Re-enabling the module makes data available again immediately
- Only the "Delete All Data" action in Settings permanently removes data

**Additive-Only Migrations:**
- New columns are added with defaults (never remove or rename columns in minor versions)
- New tables can be added freely
- New seed data rows can be inserted (never modify existing seed data IDs)
- Column removal and table drops are reserved for major version migrations only

**Standalone App Import:**
- Data from a standalone MyMood app can be imported via the import feature (MM-018)
- Import creates new records in `mo_` tables, mapping foreign keys appropriately
- Duplicate detection uses (date, loggedAt, score) tuple to avoid reimporting existing entries

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Log | Pencil/pen icon | Quick Log | Primary mood logging interface with score selector, emotion wheel, and activity picker |
| Timeline | Clock icon | Daily Timeline | Chronological view of today's mood entries with details and history navigation |
| Insights | Chart/bar icon | Insights Dashboard | Trends, correlations, Year in Pixels, and experiments |
| Breathe | Wind/lungs icon | Breathing Home | Guided breathing exercises, ambient sounds, and SOS access |
| Settings | Gear icon | Settings | Preferences, data management, lock, reminders, import/export, about |

### 5.2 Navigation Flow

```
[Tab 1: Log]
  └── Quick Log Screen
        ├── Emotion Wheel Modal (MM-002)
        ├── Activity Picker Modal (MM-003)
        ├── Photo Capture/Select (MM-014)
        ├── Micro-Journal Expansion (MM-004)
        │     └── Journaling Prompt Carousel (MM-012)
        └── Post-Log Confirmation
              └── Self-Care Suggestion Card (MM-021)

[Tab 2: Timeline]
  └── Daily Timeline Screen (MM-005)
        ├── Date Picker (navigate to any day)
        ├── Entry Detail View
        │     ├── Photo Gallery (MM-014)
        │     └── Delete Confirmation
        └── Weekly Overview (horizontal scroll)

[Tab 3: Insights]
  └── Insights Dashboard
        ├── Mood Trends Tab (MM-006)
        │     ├── Time Period Selector (7d, 30d, 90d, 1yr)
        │     └── Score Distribution Detail
        ├── Correlations Tab (MM-010)
        │     ├── Factor Detail Screen
        │     └── Cross-Module Correlation Detail
        ├── Year in Pixels Tab (MM-009)
        │     ├── Year Selector
        │     └── Day Detail Popover
        ├── Experiments Tab (MM-016)
        │     ├── Experiment Designer (3-step wizard)
        │     ├── Active Experiment Detail
        │     ├── Experiment Results Screen
        │     └── Template Browser
        └── Reports Tab (MM-019)
              ├── Report Detail Screen
              └── PDF/Image Export Share Sheet

[Tab 4: Breathe]
  └── Breathing Home Screen (MM-011)
        ├── Technique Selector
        ├── Active Breathing Session
        │     └── Post-Breathing Mood Log Prompt
        ├── Ambient Sounds Screen (MM-022)
        │     └── Sleep Timer Picker Modal
        ├── SOS / Panic Button (MM-020)
        │     ├── Page 1: Emergency Breathing
        │     ├── Page 2: Grounding Exercise (5-4-3-2-1)
        │     └── Page 3: Emergency Contacts
        └── Session History

[Tab 5: Settings]
  └── Settings Screen (MM-024)
        ├── General Section (inline toggles and pickers)
        ├── Privacy & Security
        │     └── Lock Settings Screen (MM-015)
        │           ├── PIN Setup/Change Flow
        │           └── Biometric Configuration
        ├── Notifications
        │     └── Reminders Management Screen (MM-013)
        │           └── Reminder Editor Modal
        ├── Data Management
        │     ├── Export Screen (MM-017)
        │     ├── Import Screen (MM-018)
        │     └── Delete All Confirmation Flow (2-step)
        └── About Section (inline rows)
```

### 5.3 Screen Inventory

| Screen | Route | Purpose | Entry Points |
|--------|-------|---------|-------------|
| Quick Log | `/mood/log` | Log mood score, emotions, activities, notes, photos | Tab 1, widget tap, reminder notification tap, deep link |
| Daily Timeline | `/mood/timeline` | View and browse daily mood entries | Tab 2 |
| Timeline Date View | `/mood/timeline/:date` | View entries for a specific date | Date picker, Year in Pixels cell tap, report notable day tap |
| Insights Dashboard | `/mood/insights` | Central hub for analytics sub-tabs | Tab 3, widget trend tap |
| Mood Trends | `/mood/insights/trends` | Line charts, averages, score distribution | Insights sub-tab |
| Correlations | `/mood/insights/correlations` | Factor correlation rankings and details | Insights sub-tab |
| Factor Detail | `/mood/insights/correlations/:factorId` | Deep dive into a single correlation factor | Tap correlation row |
| Year in Pixels | `/mood/insights/pixels` | 365-cell annual grid | Insights sub-tab |
| Experiments Home | `/mood/insights/experiments` | List active and past experiments | Insights sub-tab |
| Experiment Designer | `/mood/insights/experiments/new` | 3-step experiment creation wizard | "Start New Experiment" button |
| Experiment Results | `/mood/insights/experiments/:id/results` | Baseline vs intervention comparison | Tap completed experiment |
| Reports | `/mood/insights/reports` | Weekly and monthly report list | Insights sub-tab |
| Report Detail | `/mood/insights/reports/:id` | Full report with charts and export | Tap report card |
| Breathing Home | `/mood/breathe` | Technique selection, session history, SOS access | Tab 4 |
| Active Breathing | `/mood/breathe/session` | Animated breathing exercise in progress | Tap "Begin" on technique |
| Ambient Sounds | `/mood/breathe/ambient` | Sound mixer with sleep timer | Tap "Ambient Sounds" on Breathing Home |
| SOS Flow | `/mood/breathe/sos` | 3-page crisis support flow | SOS button on Breathing Home, SOS shortcut |
| Settings | `/mood/settings` | Centralized preferences | Tab 5 |
| Lock Settings | `/mood/settings/lock` | PIN/biometric configuration | Tap "App Lock" row |
| Reminders | `/mood/settings/reminders` | Manage scheduled reminders | Tap "Mood Reminders" row |
| Export | `/mood/settings/export` | Data export format selection and download | Tap "Export Data" |
| Import | `/mood/settings/import` | File selection, preview, and import execution | Tap "Import Data" |

### 5.4 Deep Link Patterns

| Pattern | Target Screen | Parameters |
|---------|--------------|-----------|
| `mylife://mood/log` | Quick Log | None (opens fresh log) |
| `mylife://mood/log?score=7` | Quick Log | Pre-selects score 7 |
| `mylife://mood/timeline` | Daily Timeline | Shows today |
| `mylife://mood/timeline/:date` | Timeline Date View | date: YYYY-MM-DD |
| `mylife://mood/insights` | Insights Dashboard | Opens default sub-tab |
| `mylife://mood/insights/trends` | Mood Trends | None |
| `mylife://mood/insights/pixels` | Year in Pixels | None |
| `mylife://mood/insights/pixels/:year` | Year in Pixels | year: 4-digit year |
| `mylife://mood/insights/experiments/:id` | Experiment Detail/Results | id: experiment UUID |
| `mylife://mood/insights/reports/:id` | Report Detail | id: report UUID |
| `mylife://mood/breathe` | Breathing Home | None |
| `mylife://mood/breathe/sos` | SOS Flow | None (immediate launch) |
| `mylife://mood/breathe/ambient` | Ambient Sounds | None |
| `mylife://mood/settings` | Settings | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Exercise-mood correlation | Workouts (`workouts`) | Mood (`mood`) | MyMood reads workout dates and types from MyWorkouts tables to compute Pearson r between exercise and mood | User opens Correlations tab with MyWorkouts enabled |
| Fasting-mood correlation | Fast (`fast`) | Mood (`mood`) | MyMood reads fasting window start/end times from MyFast tables to correlate fasting state with mood scores | User opens Correlations tab with MyFast enabled |
| Medication-mood correlation | Meds (`meds`) | Mood (`mood`) | MyMood reads medication intake logs from MyMeds tables to correlate medication adherence with mood | User opens Correlations tab with MyMeds enabled |
| Habit-mood correlation | Habits (`habits`) | Mood (`mood`) | MyMood reads daily habit completion data from MyHabits tables to correlate habit streaks and completions with mood | User opens Correlations tab with MyHabits enabled |
| Reading-mood correlation | Books (`books`) | Mood (`mood`) | MyMood reads reading session dates from MyBooks tables to correlate reading activity with mood | User opens Correlations tab with MyBooks enabled |
| Mood data for health dashboard | Mood (`mood`) | Health (future) | MyHealth reads mood averages and trends from mo_entries for a holistic health overview | MyHealth dashboard render (read-only query) |
| Mood-based journal prompts | Mood (`mood`) | Journal (future) | MyMood can trigger a journal prompt in MyJournal when a low mood is logged ("You logged a low mood. Would you like to write about it?") | Mood entry saved with score <= 3 |
| Mood streak contribution | Mood (`mood`) | Habits (`habits`) | MyHabits can treat mood logging as a trackable habit, pulling streak data from MyMood | MyHabits queries mo_entries for daily completion |

### Cross-Module Correlation Protocol

All cross-module correlations follow the same protocol:

1. **Discovery:** When the user opens the Correlations tab, the correlation engine checks which other MyLife modules are enabled
2. **Data Access:** For each enabled module, the engine reads from that module's prefixed tables using standard SQLite queries (no API layer, direct table access within the same database file)
3. **Date Alignment:** Data from other modules is aligned to mood entry dates using the `date` (YYYY-MM-DD) column
4. **Computation:** Pearson r is computed between the binary factor (did the user do X on this date? 1/0) and the daily average mood score
5. **Minimum Data:** Cross-module correlations require at least 14 overlapping data points (days where both modules have data) to report
6. **Display:** Results appear in the Correlations tab alongside activity correlations, with a "Cross-Module" section header
7. **Privacy:** No data is copied or transferred between modules. Correlations are computed on-demand and cached in memory only

### Module Availability Check

```
FOR EACH module IN [workouts, fast, meds, habits, books]:
  IF moduleRegistry.isEnabled(module):
    tableName = modulePrefix[module] + "_" + dataTable[module]
    IF tableExists(tableName) AND rowCount(tableName) >= 14:
      - Add to available cross-module factors
    ELSE:
      - Skip (not enough data)
```

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Mood entries (scores, notes, journals) | Local SQLite (`mo_entries`) | At rest (OS-level full-disk encryption) | Never | Most sensitive: reveals emotional state patterns |
| Emotion tags | Local SQLite (`mo_emotion_tags`) | At rest (OS-level) | Never | Clinically sensitive: can indicate mental health conditions |
| Activity tags | Local SQLite (`mo_activity_tags`) | At rest (OS-level) | Never | Reveals behavioral patterns and lifestyle |
| Photo attachments | Local filesystem (`mood-photos/`) | At rest (OS-level) | Never | Photos taken in emotional moments are deeply personal |
| Breathing session history | Local SQLite (`mo_breathing_sessions`) | At rest (OS-level) | Never | Usage frequency could indicate anxiety/panic patterns |
| Ambient sound sessions | Local SQLite (`mo_ambient_sessions`) | At rest (OS-level) | Never | May indicate sleep difficulties or anxiety |
| SOS episode logs | Local SQLite (`mo_sos_episodes`) | At rest (OS-level) | Never | Crisis event records are extremely sensitive |
| Emergency contacts | Local SQLite (`mo_emergency_contacts`) | At rest (OS-level) | Never | Personal safety contacts |
| Experiment data | Local SQLite (`mo_experiments`) | At rest (OS-level) | Never | Reveals personal health experiments |
| Generated reports | Local SQLite (`mo_reports`) | At rest (OS-level) | Never | Aggregated mood summaries |
| PIN hash and salt | Platform secure storage (Keychain/Keystore) | AES-256 (platform-managed) | Never | Authentication credentials |
| Module settings | Local SQLite (`mo_settings`) | At rest (OS-level) | Never | Preference data only |
| Widget data cache | Shared app group container | At rest (OS-level) | Never | Pre-computed display data, no raw entries |
| Exported files (CSV, JSON, PDF) | User-chosen location via share sheet | Depends on destination | User-controlled | User explicitly initiates export |

### 7.2 Network Activity

This module operates entirely offline. No network requests are made under any circumstances.

- No analytics endpoints
- No crash reporting
- No telemetry
- No cloud sync
- No remote configuration
- No A/B testing servers
- No ad networks
- No push notification registration (local notifications only)

The only mechanism by which data can leave the device is user-initiated export (MM-017), which writes to a local file and opens the OS share sheet. The user controls the destination.

### 7.3 Data That Never Leaves the Device

- Mood scores, timestamps, and logging frequency
- Emotion selections and intensity levels
- Activity tagging history
- Free-text notes and micro-journal content
- Photo attachments and metadata
- Breathing exercise session history
- Ambient sound usage patterns
- SOS/panic episode records and triggers
- Correlation analysis results
- Experiment hypotheses, interventions, and outcomes
- Weekly and monthly report content
- Streak history and milestones
- Self-care suggestion feedback
- Emergency contact information
- PIN hash and authentication state
- Usage patterns (when and how often the user logs)

### 7.4 User Data Ownership

- **Export:** Users can export all their data in CSV (tabular) and JSON (structured) formats via MM-017
- **Therapist Reports:** Generated reports (MM-019) can be exported as PDF or image for sharing with healthcare providers
- **Delete:** Users can delete all module data from Settings via a 2-step confirmation requiring the user to type "DELETE" (MM-024)
- **Selective Delete:** Individual mood entries can be deleted from the Daily Timeline
- **Portability:** Export format is documented, human-readable, and uses standard formats (CSV, JSON) that can be opened in any spreadsheet or text editor
- **No Vendor Lock-in:** Because all data is local and exportable, users can switch to another mood tracking app at any time with their full history

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| PIN Lock | Optional 4-6 digit numeric PIN protecting entry to the mood module | Configured in Settings > Privacy & Security > App Lock |
| Biometric Lock | Optional Face ID / Touch ID / fingerprint authentication | Requires PIN as fallback; biometric data is never stored by the app (uses OS APIs) |
| Lockout Protection | 5 consecutive wrong PIN attempts triggers 5-minute lockout | Prevents brute-force attacks on 4-digit PINs |
| PIN Storage | PIN is salted and hashed (PBKDF2 with 100,000 iterations), stored in platform secure storage | Never stored in SQLite; never logged; never transmitted |
| Privacy Mode | Optional mode that blurs the task switcher preview and hides notification content | Prevents shoulder-surfing and notification-based exposure |
| Session Timeout | Configurable re-lock timeout (Immediately, 1 min, 5 min, 15 min) | Balances security and convenience |
| Photo Privacy | Photos stored in app-private directory, not in the device photo library | Camera roll scanning cannot find mood-attached photos |
| Export Protection | Exported files contain no encryption by default (user responsibility) | Users are warned: "This file is not encrypted. Store it securely." |
| Deletion Confirmation | 2-step process: confirmation dialog, then type "DELETE" | Prevents accidental data loss |
| Widget Data Privacy | Widgets show scores and streak counts only; never display journal text, emotion names, or activity details | Protects privacy on shared devices or in screenshots |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Plutchik's Wheel of Emotions | A psychological model created by Robert Plutchik that organizes emotions into 8 primary families (joy, trust, fear, surprise, sadness, disgust, anger, anticipation), each with 3 intensity levels (mild, moderate, intense) and 8 composite emotions formed by adjacent family combinations. Total: 32 named emotions. |
| Primary Emotion Family | One of the 8 basic emotion categories in Plutchik's model: joy, trust, fear, surprise, sadness, disgust, anger, anticipation. |
| Intensity Level | The strength of an emotion within a family. Mild (e.g., serenity), moderate (e.g., joy), or intense (e.g., ecstasy). Each level has a distinct name in the Plutchik model. |
| Composite Emotion | An emotion formed by combining two adjacent primary families. For example, "love" is joy + trust, "submission" is trust + fear, "awe" is fear + surprise. There are 8 composites in the model. |
| Mood Score | A numeric rating from 1 (worst) to 10 (best) representing the user's overall emotional state at a moment in time. The 5-point scale maps to the same concept with reduced granularity. |
| Mood Entry | A single logged record consisting of a mood score, timestamp, and optional enrichments (emotions, activities, notes, photos). Multiple entries per day are allowed. |
| Activity Tag | A label from a predefined or custom activity list attached to a mood entry to record what the user was doing at the time (e.g., "Exercise", "Work Meeting", "Reading"). |
| Pearson Correlation Coefficient (r) | A statistical measure of the linear relationship between two variables, ranging from -1.0 (perfect negative correlation) to +1.0 (perfect positive correlation). In MyMood, r measures the correlation between a factor's presence (1) or absence (0) and the mood score. Formula: r = SUM((xi - x_bar)(yi - y_bar)) / SQRT(SUM((xi - x_bar)^2) * SUM((yi - y_bar)^2)). |
| Statistically Meaningful Correlation | A correlation with absolute r value >= 0.3 and at least 10 data points. Correlations below this threshold are labeled "Weak or no correlation." |
| Year in Pixels | A visualization showing 365 (or 366) cells in a calendar grid, one per day, colored by the day's average mood score. Inspired by the "Year in Pixels" journaling technique popularized by the app Pixels. |
| Color Bucket | One of 5 color categories used to map continuous mood scores to discrete display colors in Year in Pixels: very-low (1.0-2.9, red), low (3.0-4.9, orange), moderate (5.0-6.0, yellow), good (6.1-8.0, green), excellent (8.1-10.0, blue). |
| Box Breathing | A breathing technique with equal-duration phases: inhale for N seconds, hold for N seconds, exhale for N seconds, hold for N seconds. Default: 4-4-4-4 (4 seconds per phase, 16 seconds per cycle). Used by Navy SEALs and recommended for acute stress. |
| 4-7-8 Breathing | A breathing technique: inhale for 4 seconds, hold for 7 seconds, exhale for 8 seconds. Total cycle: 19 seconds. Developed by Dr. Andrew Weil for anxiety and sleep. |
| Coherent Breathing | A breathing technique with slow, even breaths: inhale for 5.5 seconds, exhale for 5.5 seconds. 11-second cycle targeting ~5.5 breaths per minute, which research associates with heart rate variability optimization. |
| Breathing Cycle | One complete iteration of a breathing technique's phases (e.g., one box breathing cycle is inhale + hold + exhale + hold). Sessions consist of multiple cycles. |
| SOS / Panic Button | An emergency feature providing immediate access to a calming sequence: breathing exercise, grounding exercise (5-4-3-2-1), and emergency contacts. Designed for moments of acute anxiety or panic. |
| 5-4-3-2-1 Grounding | A sensory awareness technique for managing anxiety: identify 5 things you see, 4 you hear, 3 you can touch, 2 you smell, and 1 you taste. Redirects attention from anxious thoughts to present sensory input. |
| Streak | The number of consecutive calendar days on which the user logged at least one mood entry. Streaks break on any day without an entry (checked at midnight in the user's local timezone). |
| Streak Milestone | A predefined streak length (3, 7, 14, 30, 60, 90, 180, 365 days) that triggers a celebration overlay when first achieved. |
| Experiment | A structured A/B test of a lifestyle change, consisting of a baseline period (normal behavior) and an intervention period (changed behavior), each of equal length (7-30 days). Results are analyzed by comparing mean mood scores and computing Pearson r between the period variable and mood. |
| Baseline Period | The first phase of an experiment during which the user logs mood while maintaining their normal routine. Establishes the control data for comparison. |
| Intervention Period | The second phase of an experiment during which the user implements a deliberate lifestyle change while continuing to log mood. Data is compared against the baseline. |
| Self-Care Suggestion | A brief, actionable recommendation shown after mood logging, personalized by mood band (low/neutral/high) and optionally boosted by correlation data. Drawn from a curated library of 88+ suggestions. |
| Ambient Sound | A looping audio track from a bundled library (16 sounds across 4 categories) played for relaxation, focus, or sleep. Up to 4 sounds can be mixed simultaneously. |
| Sleep Timer | An automatic stop countdown for ambient sound playback. Preset durations: 5, 10, 15, 20, 30, 45, or 60 minutes. Sounds fade out over 5 seconds when the timer expires. |
| Privacy Mode | A setting that blurs the app's task switcher preview (preventing others from seeing mood data when switching apps) and replaces descriptive notification content with generic text. |
| Scale Conversion | Display-only transformation applied when the user switches between 5-point and 10-point mood scales. Raw database scores are never modified. 10-to-5: displayScore = ceil(rawScore / 2). 5-to-10: displayScore = rawScore * 2. |
| Module Lock | Optional authentication gate (PIN and/or biometric) that blocks access to all mood screens until the user authenticates. Controlled by a configurable timeout after which re-authentication is required. |
| Cross-Module Correlation | A Pearson r computation between data from another MyLife module (workouts, fasting, medication, habits, reading) and daily average mood scores. Requires at least 14 overlapping data points and both modules to be enabled. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification: Sections 1-2 and MM-001 through MM-021 |
| 1.1 | 2026-03-07 | Claude (Spec Writer Agent) | Completed MM-022 through MM-024, added Sections 4-8 (Data Architecture, Screen Map, Cross-Module Integration, Privacy and Security, Glossary) |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should ambient sounds be bundled or downloaded on demand? | Bundling adds ~25 MB to app size but ensures offline availability. Download-on-demand reduces initial size but requires network. | Bundled (offline-first matches privacy philosophy) | 2026-03-07 |
| 2 | Should the 5-point scale use different descriptors than the 10-point scale? | 10-point scale has 10 descriptors (Awful through Incredible). 5-point needs a separate set. | Deferred to implementation | - |
| 3 | Should cross-module correlations be opt-in per module or all-or-nothing? | Privacy-conscious users may want mood-exercise correlation but not mood-medication. | Deferred to implementation | - |
| 4 | Should the correlation engine use Spearman's rho instead of Pearson r for non-normal mood score distributions? | Mood scores are ordinal and may not be normally distributed. Spearman is more robust for ordinal data. | Deferred to implementation (Pearson specified for MVP, Spearman as future enhancement) | - |
| 5 | What happens to widget data when the module is disabled? | Widgets cannot function without the module. Should they show "Module disabled" or be automatically removed? | Deferred to implementation | - |
