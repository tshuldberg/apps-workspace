# MyWorkouts - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (Spec Writer Agent)
> **Reviewer:** Team Lead

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyWorkouts
- **Tagline:** "Body-map guided workouts, builder, and coaching flows"
- **Module ID:** `workouts`
- **Feature ID Prefix:** WO
- **Table Prefix:** `wk_`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Strength Lifter (Alex) | 22-35, trains 4-6x/week, tracks weight/reps meticulously, uses progressive overload | Log sets with precise weight, see previous performance, track PRs, get plate loading help |
| Fitness Beginner (Sam) | 18-30, new to gym, unsure which exercises target which muscles, needs guidance | Discover exercises via body map, follow pre-built workouts, learn proper form from demos |
| Home Gym User (Jordan) | 25-45, exercises at home with limited equipment, values privacy and offline access | Build custom workouts from available equipment, record form for self-review, no cloud dependency |
| Runner/Endurance (Casey) | 20-40, mixes strength with running/cycling/hiking, wants GPS tracking | Record outdoor routes with pace/elevation, combine cardio and strength in one app |
| Coach/Trainer (Morgan) | 28-50, manages multiple clients, creates programs, reviews form videos | Build multi-week plans, review client form recordings, provide timestamped feedback |

### 1.3 Core Value Proposition

MyWorkouts is a privacy-first workout companion that replaces Strong, Hevy, and Fitbod with zero subscription lock-in on core features. It combines an interactive body map for exercise discovery, voice-controlled workout execution, form video recording for coach review, and intelligent progressive overload suggestions. Unlike competitors that store complete workout histories on their servers with no local-only option, MyWorkouts keeps all data on-device by default with optional Supabase sync for cross-device access.

### 1.4 Competitive Landscape

| Competitor | Price | Strengths | Weaknesses | Our Differentiator |
|-----------|-------|-----------|------------|-------------------|
| Strong | $30/yr | Clean UI, rest timer, plate calculator | Limited free tier (3 workouts), no AI, no body map | Unlimited free workouts, interactive body map, voice commands |
| Hevy | $50/yr | Social feed, workout sharing, exercise videos | Data stored on their servers, no offline mode | Privacy-first, local storage, coach portal |
| Fitbod | $96/yr | AI workout generation, recovery tracking | Expensive, opaque algorithm, no coach portal | Transparent rule-based AI, coach review, 1/6th the price |
| Strava | $80/yr | GPS tracking, segments, massive community | Exposed military base locations via heatmap, no strength | Privacy zones on GPS, combined strength + cardio |
| Nike Training Club | Free | Free guided workouts | Collects 20 data types, shares with advertisers | Zero analytics, zero telemetry |
| Peloton | $192/yr | Live classes, leaderboards | Always-on camera concerns, AI chat data lawsuit | No camera surveillance, no data monetization |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All workout data is stored locally on the device by default
- Optional Supabase sync for cross-device access uses encrypted connections with no third-party data sharing
- Zero analytics, zero telemetry, zero behavioral profiling
- Progress photos are stored locally in the app's documents directory and never uploaded
- GPS routes support configurable privacy zones to exclude home/work areas from any shared data
- Form recordings are stored in Supabase Storage only when Premium is active, accessible only to the user and their assigned coach
- No advertising, no data monetization
- Users own their data with full export (CSV, JSON) and complete delete capabilities

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| WO-001 | Exercise Library | P0 | Core | None | Implemented |
| WO-002 | Body Map Visualization | P0 | Core | WO-001 | Implemented |
| WO-003 | Workout Builder | P0 | Core | WO-001 | Implemented |
| WO-004 | Set/Rep/Weight Logging | P0 | Core | WO-003 | Implemented |
| WO-005 | Workout Player Engine | P0 | Core | WO-003, WO-004 | Implemented |
| WO-006 | Voice Commands | P0 | Core | WO-005 | Implemented |
| WO-007 | Form Video Recording | P1 | Core | WO-005 | Implemented |
| WO-008 | Progress Tracking | P0 | Analytics | WO-004 | Implemented |
| WO-009 | Coach Portal | P1 | Social | WO-007 | Implemented |
| WO-010 | Workout Templates | P0 | Core | WO-003 | Implemented |
| WO-011 | Exercise Search and Filtering | P0 | Data Management | WO-001 | Implemented |
| WO-012 | Rest Timer | P0 | Core | WO-005 | Not Started |
| WO-013 | Previous Performance Display | P0 | Core | WO-004, WO-005 | Not Started |
| WO-014 | Video Exercise Demos | P1 | Core | WO-001 | Not Started |
| WO-015 | AI Workout Generation | P1 | Core | WO-001, WO-002, WO-020 | Not Started |
| WO-016 | Progressive Overload Automation | P1 | Analytics | WO-004, WO-013 | Not Started |
| WO-017 | Muscle Recovery Heatmap | P1 | Analytics | WO-002, WO-004 | Not Started |
| WO-018 | GPS Route Recording | P1 | Core | None | Not Started |
| WO-019 | Plate Calculator | P2 | Core | None | Implemented (engine) |
| WO-020 | Progress Photos | P2 | Data Management | None | Not Started |
| WO-021 | Workout Sharing | P2 | Social | WO-004 | Not Started |
| WO-022 | Apple Watch App | P1 | Core | WO-005, WO-012 | Not Started |
| WO-023 | Social Feed | P2 | Social | WO-021 | Not Started |
| WO-024 | Superset/Circuit Support | P0 | Core | WO-003, WO-005 | Implemented |
| WO-025 | Workout Calendar | P1 | Analytics | WO-004 | Not Started |
| WO-026 | Body Measurements Tracking | P2 | Data Management | None | Not Started |
| WO-027 | One-Rep Max Calculator | P0 | Core | WO-004 | Implemented (engine) |
| WO-028 | Warmup Set Calculator | P1 | Core | WO-019 | Implemented (engine) |
| WO-029 | Workout Plans (Multi-Week Programs) | P1 | Core | WO-003 | Implemented |
| WO-030 | Data Export | P1 | Import/Export | WO-004 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

---

## 3. Feature Specifications

### WO-001: Exercise Library

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-001 |
| **Feature Name** | Exercise Library |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a gym-goer, I want to browse a curated library of 100+ exercises with descriptions, muscle group tags, and difficulty levels, so that I can discover new exercises and build effective workouts.

**Secondary:**
> As a beginner, I want to see which muscles each exercise targets, so that I can learn proper exercise selection for my goals.

#### 3.3 Detailed Description

The Exercise Library is the foundational data layer of MyWorkouts. It provides a catalog of over 100 exercises spanning seven categories (strength, cardio, mobility, fascia, recovery, flexibility, balance) with detailed metadata for each entry. Every exercise includes a human-readable description of proper form, the muscle groups it targets, a difficulty rating, default set/rep recommendations, and audio cue text for voice-guided workouts.

The library ships with a curated seed dataset bundled as JSON within the app. On first module enable, the seed data is inserted into the `wk_exercises` SQLite table. Users cannot currently add custom exercises (planned for a future release), but the exercise entries are query-able, filterable, and form the basis for the Workout Builder (WO-003) and Body Map (WO-002) features.

Each exercise record supports optional video and thumbnail URLs for exercise demos (WO-014), and an array of audio cues used during workout playback (WO-005).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local storage for SQLite database
- Bundled JSON seed data file (`exercise-seed.json`)

**Assumed Capabilities:**
- MyLife hub module system is initialized and database adapter is available
- Module migrations have run successfully

#### 3.5 User Interface Requirements

##### Screen: Exercise Library Browser

**Layout:**
- Top navigation bar with screen title "Exercises" and a search icon on the right
- Below the nav bar, a horizontal scrollable row of category filter chips (All, Strength, Cardio, Mobility, Fascia, Recovery, Flexibility, Balance)
- Below the filter chips, a secondary row of difficulty filter chips (All, Beginner, Intermediate, Advanced)
- The main content area is a scrollable vertical list of exercise cards
- Each exercise card displays: exercise name (bold), category badge, difficulty badge, and a row of muscle group tags (colored pills)
- Tapping an exercise card navigates to the Exercise Detail screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No exercises in database (seed failed) | Message: "Exercise library is empty. Please reinstall the module." with a retry button |
| Loading | Seed data is being inserted | Skeleton cards with shimmer animation |
| Populated | Exercises exist | Scrollable list of exercise cards sorted alphabetically by name |
| Search Active | User has entered search text | Filtered list showing matches; if no results: "No exercises match your search" |
| Filtered | Category or difficulty filter is active | Filtered list; active filters are visually highlighted |

**Interactions:**
- Tap category chip: toggle that category filter on/off
- Tap difficulty chip: toggle that difficulty filter on/off
- Tap search icon: expand search bar with text input and keyboard
- Tap exercise card: navigate to Exercise Detail screen
- Pull-to-refresh: re-query the exercise list

##### Screen: Exercise Detail

**Layout:**
- Full-screen view with back navigation
- Exercise name as the screen title
- Description text (2-5 sentences of form instructions)
- Muscle group section with mini body map highlighting targeted muscles
- Metadata row: category, difficulty, default sets x reps
- "Add to Workout" button at the bottom (navigates to Workout Builder)
- Placeholder area for exercise demo video/animation (WO-014)

#### 3.6 Data Requirements

##### Entity: Exercise

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated slug | Auto | Unique identifier (e.g., "seed-push-up-1") |
| name | string | Required, max 100 chars | None | Exercise name |
| description | string | Required | '' | Form instructions and description |
| category | enum | One of: cardio, strength, mobility, fascia, recovery, flexibility, balance | None | Exercise category |
| muscle_groups_json | string (JSON) | Valid JSON array of MuscleGroup values | '[]' | Targeted muscle groups |
| difficulty | enum | One of: beginner, intermediate, advanced | 'beginner' | Difficulty level |
| video_url | string | Nullable, valid URL | null | URL to exercise demo video |
| thumbnail_url | string | Nullable, valid URL | null | URL to exercise thumbnail image |
| audio_cues_json | string (JSON) | Valid JSON array of AudioCue objects | '[]' | Voice cues for guided playback |
| default_sets | integer | Min: 1, Max: 20 | 3 | Recommended number of sets |
| default_reps | integer | Nullable, Min: 1, Max: 100 | null | Recommended reps (null for duration-based) |
| default_duration | integer | Nullable, Min: 1 (seconds) | null | Recommended duration in seconds (null for rep-based) |
| is_premium | integer | 0 or 1 | 0 | Whether this exercise requires Premium |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `wk_exercises_category_idx` on `category` - frequently filtered
- `wk_exercises_difficulty_idx` on `difficulty` - frequently filtered

**Validation Rules:**
- `name`: must not be empty after trimming whitespace
- `category`: must be one of the seven valid enum values
- `difficulty`: must be one of the three valid enum values
- `muscle_groups_json`: must be parseable as a JSON array; each element must be a valid MuscleGroup enum value
- Either `default_reps` or `default_duration` should be non-null (rep-based or duration-based exercise)

**Example Data:**
```json
{
  "id": "seed-push-up-1",
  "name": "Push-up",
  "description": "Start in a high plank with hands shoulder-width apart. Lower your chest to the ground, keeping elbows at 45 degrees, then push back up to start.",
  "category": "strength",
  "muscle_groups_json": "[\"chest\",\"triceps\",\"shoulders\",\"core\"]",
  "difficulty": "beginner",
  "video_url": null,
  "thumbnail_url": null,
  "audio_cues_json": "[{\"timestamp\":0,\"text\":\"Push-ups. Lower your chest to the ground and press back up.\",\"type\":\"instruction\"}]",
  "default_sets": 3,
  "default_reps": 12,
  "default_duration": null,
  "is_premium": 0,
  "created_at": "2026-02-20T00:00:00.000Z"
}
```

#### 3.7 Business Logic Rules

##### Exercise Library Seeding

**Purpose:** Populate the exercise library with the bundled seed dataset on first module enable.

**Inputs:**
- db: DatabaseAdapter - the SQLite database connection
- seedExercises: WorkoutSeedItem[] - the bundled JSON seed data

**Logic:**
```
1. Query COUNT(*) from wk_exercises
2. IF count > 0 THEN RETURN 0 (already seeded)
3. BEGIN TRANSACTION
4. FOR EACH item in seedExercises:
   a. Generate id = "seed-{slugify(name)}-{index + 1}"
   b. Build audioCues array from item.audioCueText
   c. INSERT INTO wk_exercises with all fields
5. COMMIT TRANSACTION
6. RETURN count of inserted exercises
```

**Edge Cases:**
- If seed data JSON is malformed: transaction rolls back, zero exercises inserted
- If database is read-only: seeding fails silently, exercise count returns 0
- Duplicate seeding attempts: skipped because count > 0 check

##### Exercise Filtering

**Purpose:** Filter exercises by search text, category, difficulty, and muscle groups.

**Inputs:**
- search: string (optional) - partial match against name or description
- category: WorkoutCategory (optional) - exact match
- difficulty: WorkoutDifficulty (optional) - exact match
- muscleGroups: MuscleGroup[] (optional) - exercises containing any of the specified groups
- limit: number (optional) - max results to return

**Logic:**
```
1. Build WHERE clause from non-null filters:
   - search: LOWER(name) LIKE '%{search}%' OR LOWER(description) LIKE '%{search}%'
   - category: category = {category}
   - difficulty: difficulty = {difficulty}
2. Execute SQL query with WHERE clause, ORDER BY name ASC
3. IF muscleGroups filter is set:
   a. Parse muscle_groups_json for each result
   b. Keep only exercises where at least one muscle group matches
4. IF limit is set: slice results to limit
5. RETURN filtered exercise list
```

**Edge Cases:**
- Empty search string: ignored, returns all
- No filters set: returns entire library
- Muscle group filter with empty array: ignored

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Seed data insertion fails | Empty library with retry prompt | User taps "Retry" to re-run seeding |
| Malformed exercise JSON in database | Exercise is skipped in list rendering | Log error, exclude malformed records |
| Search query returns no results | "No exercises match your search" message | User clears search or changes filters |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the module is freshly enabled and the exercise library is empty,
   **When** the library screen loads,
   **Then** 100+ exercises are seeded from the bundled JSON and displayed alphabetically.

2. **Given** exercises exist in the library,
   **When** the user taps the "Strength" category filter,
   **Then** only exercises with category "strength" are displayed.

3. **Given** exercises exist in the library,
   **When** the user searches for "squat",
   **Then** exercises with "squat" in their name or description are displayed.

**Edge Cases:**

4. **Given** exercises exist in the library,
   **When** the user applies both a category filter and a difficulty filter,
   **Then** only exercises matching both filters are displayed.

5. **Given** the exercise library is already seeded,
   **When** the module is disabled and re-enabled,
   **Then** the existing exercises are preserved (no duplicate seeding).

**Negative Tests:**

6. **Given** exercises exist in the library,
   **When** the user searches for "xyznonexistent",
   **Then** the system shows "No exercises match your search" and no data is modified.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| seeds exercises on empty database | empty wk_exercises table | 100+ rows inserted, returns count |
| skips seeding when exercises exist | wk_exercises has rows | returns 0, no new rows |
| filters by category | category: 'strength' | only strength exercises returned |
| filters by difficulty | difficulty: 'beginner' | only beginner exercises returned |
| filters by search text | search: 'push' | exercises with "push" in name/description |
| filters by muscle groups | muscleGroups: ['chest'] | exercises targeting chest |
| combines multiple filters | category: 'strength', difficulty: 'intermediate' | intersection of both filters |
| returns empty for no matches | search: 'xyznonexistent' | empty array |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full seed and query cycle | 1. Enable module 2. Seed exercises 3. Query all | All seed exercises present with correct fields |
| Exercise detail lookup | 1. Seed exercises 2. Get exercise by ID | Returns complete exercise with parsed JSON fields |

---

### WO-002: Body Map Visualization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-002 |
| **Feature Name** | Body Map Visualization |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a gym-goer, I want to tap muscle groups on an interactive human body diagram, so that I can discover exercises that target those muscles.

**Secondary:**
> As a beginner, I want to see front and back views of the body with labeled muscle groups, so that I can learn muscle anatomy while planning workouts.

#### 3.3 Detailed Description

The Body Map is an interactive SVG-based visualization of the human body showing 14 muscle groups across front and back views. Users tap muscle groups on the diagram to select them, and the app filters the exercise library to show exercises targeting those muscles. Selected muscle groups are highlighted with a colored overlay (default indigo, #6366F1).

The body map uses react-native-body-highlighter (mobile) and react-body-highlighter (web) libraries, with a mapping layer that translates library-specific SVG slug names to the internal MuscleGroup enum. The mapping supports 15 SVG slugs mapped to 14 muscle groups (upper-back and lower-back both map to the Back muscle group).

The body map also powers the Muscle Recovery Heatmap (WO-017) by supporting intensity-based coloring (green/yellow/red gradient instead of a single highlight color).

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-001: Exercise Library - muscle group data comes from exercises

**External Dependencies:**
- react-native-svg (mobile) or SVG rendering (web)
- react-native-body-highlighter / react-body-highlighter library

**Assumed Capabilities:**
- Exercise library is seeded with muscle group data

#### 3.5 User Interface Requirements

##### Screen: Body Map (Explore Tab)

**Layout:**
- Top section: toggle between "Front" and "Back" body views
- Center: full-width SVG body diagram with tappable muscle group regions
- Below the body diagram: horizontal scrollable row of selected muscle group chips with "x" to deselect
- Below the chips: filtered exercise list showing exercises that target any selected muscle group
- Each muscle group region shows its label on hover/long-press

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Selection | No muscle groups tapped | Full body shown without highlights; exercise list shows all exercises |
| Selection Active | One or more muscle groups tapped | Selected muscles highlighted in indigo (#6366F1); exercise list filtered |
| Recovery View | Recovery heatmap mode (WO-017) | Muscles colored by recovery state: green (fresh), yellow (moderate), red (fatigued) |

**Interactions:**
- Tap muscle group region: toggle selection on/off for that group
- Tap "x" on muscle group chip: deselect that group
- Tap "Clear All" button: deselect all muscle groups
- Toggle "Front"/"Back": switch body view orientation
- Tap exercise in filtered list: navigate to Exercise Detail

#### 3.6 Data Requirements

##### Muscle Group Definitions

| Muscle Group ID | Label | Region | Side | SVG Slugs |
|----------------|-------|--------|------|-----------|
| chest | Chest | upper | front | chest |
| back | Back | upper | back | upper-back, lower-back |
| shoulders | Shoulders | upper | both | deltoids |
| biceps | Biceps | upper | front | biceps |
| triceps | Triceps | upper | back | triceps |
| forearms | Forearms | upper | both | forearm |
| core | Core | core | front | abs, obliques |
| quads | Quadriceps | lower | front | quadriceps |
| hamstrings | Hamstrings | lower | back | hamstring |
| glutes | Glutes | lower | back | gluteal |
| calves | Calves | lower | back | calves |
| hip_flexors | Hip Flexors | lower | front | adductors |
| neck | Neck | upper | both | neck |
| full_body | Full Body | core | both | (all slugs) |

#### 3.7 Business Logic Rules

##### Slug-to-MuscleGroup Mapping

**Purpose:** Translate body-highlighter library SVG slugs to internal MuscleGroup enum values.

**Logic:**
```
1. When user taps an SVG region, receive the slug string
2. Look up slug in SLUG_TO_MUSCLE_GROUP map
3. IF found: toggle that MuscleGroup in the selection set
4. IF not found: ignore the tap (unmapped region)
```

##### Highlight Data Builder

**Purpose:** Convert selected MuscleGroup[] into the data array expected by the body-highlighter library.

**Inputs:**
- selectedGroups: MuscleGroup[] - currently selected muscle groups
- color: string - hex color for highlighting (default '#6366F1')

**Logic:**
```
1. FOR EACH group in selectedGroups:
   a. Look up MUSCLE_GROUP_TO_SLUGS[group]
   b. FOR EACH slug: create { slug, intensity: 2, color }
2. RETURN array of highlight data objects
```

**Edge Cases:**
- Full Body selection: highlights all 15 slugs
- Overlapping selections (e.g., Core + Full Body): duplicate slugs are acceptable (library handles dedup)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| SVG fails to render | Fallback to text list of muscle groups as tappable buttons | User can still select muscle groups via text buttons |
| Unknown SVG slug tapped | Nothing happens | Tap is silently ignored |

#### 3.9 Acceptance Criteria

1. **Given** the body map screen is displayed,
   **When** the user taps the chest region on the front view,
   **Then** the chest region highlights in indigo and the exercise list filters to chest exercises.

2. **Given** chest is selected,
   **When** the user also taps the back region on the back view,
   **Then** both chest and back are highlighted and the exercise list shows exercises targeting either chest or back.

3. **Given** multiple muscle groups are selected,
   **When** the user taps "Clear All",
   **Then** all highlights are removed and the full exercise list is restored.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| slugToMuscleGroup maps chest correctly | slug: 'chest' | MuscleGroup.Chest |
| slugToMuscleGroup maps upper-back to Back | slug: 'upper-back' | MuscleGroup.Back |
| slugToMuscleGroup returns undefined for unknown | slug: 'unknown' | undefined |
| buildHighlightData creates correct slugs | selectedGroups: [Chest, Core] | 3 entries: chest, abs, obliques |
| muscleGroupToSlugs returns all slugs for FullBody | group: FullBody | 15 slugs |

---

### WO-003: Workout Builder

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-003 |
| **Feature Name** | Workout Builder |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a gym-goer, I want to create custom workouts by selecting exercises from the library and configuring sets, reps, weight, and rest periods, so that I have a structured plan for each training session.

**Secondary:**
> As an advanced lifter, I want to group exercises into supersets, dropsets, giant sets, or pyramid sets, so that I can program complex training methodologies.

#### 3.3 Detailed Description

The Workout Builder is a drag-and-drop interface for composing workouts from the exercise library. Users add exercises, configure parameters (sets, reps, duration, weight, rest time), reorder exercises, and save the result as a named workout definition.

The builder supports exercise grouping for supersets and circuits. Users select two or more exercises and group them with a set type (superset, dropset, giant, pyramid). Grouped exercises execute back-to-back without inter-exercise rest, then rest before the next round of the group.

The builder maintains its state via a Zustand store (`WorkoutBuilderStore`) that supports both create and edit flows. The `loadWorkout` action hydrates the builder from an existing workout definition for editing.

Default parameters: 3 sets, 10 reps, 60 seconds rest. The estimated duration is automatically calculated from exercises, sets, reps (at ~3 seconds per rep), and rest periods.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-001: Exercise Library - exercises must exist to build workouts from

**External Dependencies:**
- Drag-and-drop gesture handling for exercise reordering

#### 3.5 User Interface Requirements

##### Screen: Workout Builder

**Layout:**
- Top bar: "New Workout" or "Edit Workout" title, Cancel (left), Save (right)
- Title input field (required)
- Description input field (optional, multiline)
- Difficulty selector: three tappable chips (Beginner, Intermediate, Advanced)
- Estimated duration display (auto-calculated, read-only)
- "Add Exercise" button that navigates to the exercise library picker
- Exercise list (reorderable via drag handles):
  - Each exercise row shows: drag handle, exercise name, sets x reps (or duration), weight, rest time
  - Tapping a row expands inline editing for sets, reps, weight, weight unit, rest time
  - Swipe left to delete an exercise
  - Checkbox on left for multi-select (grouping)
- "Group Selected" button (appears when 2+ exercises are checked) with set type picker
- Grouped exercises display with a vertical bracket and set type label

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No exercises added | Prompt: "Add exercises to build your workout" with "Add Exercise" button |
| Building | Exercises added, unsaved | Exercise list with configuration controls |
| Editing | Loaded from existing workout | Same as Building, with pre-filled data |
| Saving | Save in progress | Save button shows spinner |
| Validation Error | Title is empty | Inline error below title field: "Workout title is required" |

**Interactions:**
- Tap "Add Exercise": navigate to exercise picker, return with selected exercise
- Drag exercise row: reorder within the list
- Tap exercise row: expand inline editing panel
- Swipe left on exercise: reveal delete button
- Check 2+ exercises, tap "Group Selected": open set type picker (superset, dropset, giant, pyramid)
- Tap "Ungroup" on a grouped exercise: remove the exercise from its group
- Tap "Save": validate and persist the workout

#### 3.6 Data Requirements

##### Entity: Workout

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| title | string | Required, max 200 chars | None | Workout name |
| description | string | Optional | '' | Workout description |
| difficulty | enum | One of: beginner, intermediate, advanced | 'beginner' | Difficulty level |
| exercises_json | string (JSON) | Valid JSON array of WorkoutExerciseEntry | '[]' | Ordered exercise list |
| estimated_duration | integer | Min: 0 (seconds) | 0 | Auto-calculated estimated duration |
| is_premium | integer | 0 or 1 | 0 | Whether this workout requires Premium |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

##### Embedded Type: WorkoutExerciseEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| exerciseId | string | Required, references exercise | None | Exercise library ID |
| name | string | Required | None | Exercise name (denormalized) |
| category | string | Required | None | Exercise category (denormalized) |
| sets | integer | Min: 1, Max: 20 | 3 | Number of sets |
| reps | integer | Nullable, Min: 1, Max: 200 | 10 | Reps per set (null for duration-based) |
| duration | integer | Nullable, Min: 1 (seconds) | null | Duration per set in seconds |
| restAfter | integer | Min: 0 (seconds) | 60 | Rest after exercise completion |
| order | integer | Min: 0 | Auto | Position in the exercise list |
| weight | number | Optional, Min: 0 | undefined | Weight in the specified unit |
| weightUnit | enum | 'lbs' or 'kg' | undefined | Weight unit |
| setType | enum | 'normal', 'superset', 'dropset', 'giant', 'pyramid' | undefined | Set grouping type |
| setGroupId | string | Optional | undefined | Group ID linking exercises in a superset/circuit |

**Indexes:**
- `wk_workouts_created_idx` on `created_at DESC` - for listing workouts by recency

#### 3.7 Business Logic Rules

##### Duration Estimation

**Purpose:** Auto-calculate the estimated workout duration from exercise parameters.

**Inputs:**
- exercises: WorkoutExerciseEntry[] - the workout's exercise list

**Logic:**
```
1. total = 0
2. FOR EACH exercise in exercises:
   a. IF exercise has duration:
      exerciseTime = duration * sets
   b. ELSE:
      reps = exercise.reps OR 10
      exerciseTime = reps * 3 * sets  (3 seconds per rep)
   c. total += exerciseTime
   d. IF sets > 1:
      total += restAfter * (sets - 1)
3. RETURN max(0, round(total))
```

**Formula:**
- `estimated_duration = SUM(exercise_time + inter_set_rest) for each exercise`
- `exercise_time = (reps * 3s * sets)` for rep-based, or `(duration * sets)` for duration-based
- `inter_set_rest = rest_after * (sets - 1)`

##### Exercise Grouping (Superset/Circuit)

**Purpose:** Group 2+ exercises for back-to-back execution.

**Inputs:**
- selectedIndices: number[] - indices of exercises to group
- setType: SetType - the grouping type

**Logic:**
```
1. IF selectedIndices.length < 2: do nothing
2. Generate groupId = "group-{timestamp}"
3. FOR EACH index in selectedIndices:
   a. Set exercise.setGroupId = groupId
   b. Set exercise.setType = setType
4. Clear selectedIndices
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Title is empty on save | Inline error: "Workout title is required" | User fills in the title |
| No exercises added on save | Inline error: "Add at least one exercise" | User adds exercises |
| Database write fails | Toast: "Could not save workout. Please try again." | User taps Save again |
| Exercise deleted from library that is in a workout | Exercise shows as "Unknown Exercise" in workout | User removes or replaces the exercise |

#### 3.9 Acceptance Criteria

1. **Given** the Workout Builder is open,
   **When** the user adds 3 exercises, sets titles and saves,
   **Then** the workout appears in the workout list with correct exercise count and estimated duration.

2. **Given** 2 exercises are selected via checkbox,
   **When** the user taps "Group Selected" and chooses "Superset",
   **Then** both exercises show a superset bracket and share a setGroupId.

3. **Given** an existing workout is loaded for editing,
   **When** the user changes the title and saves,
   **Then** the workout is updated (not duplicated) and the new title is reflected in the list.

4. **Given** exercises are in the builder,
   **When** the user drags an exercise from position 3 to position 1,
   **Then** the exercise order updates and the estimated duration recalculates.

**Negative Tests:**

5. **Given** the builder is open with no title entered,
   **When** the user taps Save,
   **Then** the system shows "Workout title is required" and does not save.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| estimates duration for rep-based exercises | 3 exercises, 3 sets, 10 reps, 60s rest | ~630 seconds |
| estimates duration for duration-based exercises | 1 exercise, 3 sets, 30s duration, 60s rest | 210 seconds |
| groups selected exercises into superset | indices [0, 1], type 'superset' | both exercises share setGroupId |
| ungroups exercise removes entire group | ungroup any exercise in group | all exercises in that group lose setGroupId |
| toWorkoutPayload produces correct structure | builder state with 2 exercises | Workout object with exercises ordered 0, 1 |

---

### WO-004: Set/Rep/Weight Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-004 |
| **Feature Name** | Set/Rep/Weight Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a lifter, I want to log the exact weight, reps, and sets I complete for each exercise during a workout, so that I can track my strength progression over time.

**Secondary:**
> As a data-driven athlete, I want my estimated one-rep max (1RM) automatically calculated from my logged sets, so that I can measure strength gains without testing maximal lifts.

#### 3.3 Detailed Description

Set/Rep/Weight Logging captures granular per-set performance data during an active workout session. For each exercise in a workout, the user logs: the number of sets completed, reps per set, weight used, and weight unit (lbs or kg). The system automatically calculates an estimated one-rep max (1RM) using the Epley or Brzycki formula based on user preference.

This data feeds into Progress Tracking (WO-008), Progressive Overload Automation (WO-016), and Previous Performance Display (WO-013). The completed exercise data is stored as a JSON array within the workout session record (`exercises_completed_json`), with optional per-set weight data stored in a dedicated `wk_set_weights` table for detailed analysis.

Duration-based exercises (planks, stretches) log actual time held instead of reps. Skipped exercises are recorded with `skipped: true` to preserve the workout structure in history.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-003: Workout Builder - workouts must exist to log against

**External Dependencies:**
- None (all local)

#### 3.5 User Interface Requirements

##### Component: Set Logger (within Active Workout screen)

**Layout:**
- Current exercise name and description at the top
- Table of sets with columns: Set #, Previous (WO-013 data), Weight, Reps, Check
- Each row has: set number label, previous performance hint (gray text), weight input (numeric), reps input (numeric), checkbox to mark complete
- Weight unit toggle (lbs/kg) in the header
- "Add Set" button below the table to add extra sets beyond the default
- For duration-based exercises: replace reps input with a timer display
- Below the table: estimated 1RM display (auto-calculated from best set)

**Interactions:**
- Tap weight input: open numeric keyboard, pre-fill with previous value if available
- Tap reps input: open numeric keyboard
- Tap set checkbox: mark set as complete, advance rest timer (WO-012)
- Tap "Add Set": append a new row to the table
- Swipe left on a set row: delete that set
- Tap 1RM display: toggle between Epley and Brzycki formulas

#### 3.6 Data Requirements

##### Embedded Type: CompletedExercise

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| exercise_id | string | Required | None | Exercise library ID |
| sets_completed | integer | Min: 0 | 0 | Number of sets completed |
| reps_completed | integer | Nullable, Min: 0 | null | Total reps (null for duration-based) |
| duration_actual | number | Nullable, Min: 0.0 (seconds) | null | Actual duration in seconds |
| skipped | boolean | Required | false | Whether the exercise was skipped |
| weight | number | Optional, Min: 0 | undefined | Weight used |
| weightUnit | enum | 'lbs' or 'kg' | undefined | Weight unit |
| estimated1RM | number | Optional, Min: 0 | undefined | Calculated 1RM from best set |

##### Entity: SetWeight (detailed per-set tracking)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| sessionId | string | Required, references session | None | Workout session ID |
| exerciseId | string | Required, references exercise | None | Exercise ID |
| setNumber | integer | Min: 1 | None | Set number within the exercise |
| weight | number | Min: 0 | None | Weight lifted |
| weightUnit | enum | 'lbs' or 'kg' | None | Weight unit |
| reps | integer | Min: 0 | None | Reps completed in this set |
| estimated1RM | number | Min: 0 | None | 1RM calculated from this set |
| createdAt | datetime | ISO 8601 | Current timestamp | When this set was logged |

#### 3.7 Business Logic Rules

##### One-Rep Max Calculation

**Purpose:** Estimate the maximum weight a user could lift for one rep based on a multi-rep set.

**Inputs:**
- weight: number - weight lifted
- reps: number - reps completed
- formula: 'epley' | 'brzycki' - calculation method (default: 'epley')

**Logic (Epley):**
```
1. IF reps <= 0 OR weight <= 0: RETURN 0
2. IF reps == 1: RETURN weight (actual 1RM)
3. RETURN round(weight * (1 + reps / 30))
```

**Logic (Brzycki):**
```
1. IF reps <= 0 OR weight <= 0: RETURN 0
2. IF reps == 1: RETURN weight
3. IF reps >= 37: RETURN 0 (formula breaks down)
4. RETURN round(weight * 36 / (37 - reps))
```

**Formulas:**
- Epley: `1RM = weight * (1 + reps / 30)`
- Brzycki: `1RM = weight * 36 / (37 - reps)`

**Edge Cases:**
- 0 weight or 0 reps: returns 0
- 1 rep: returns the weight itself (actual max)
- 37+ reps (Brzycki only): returns 0 (division by zero/negative)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Non-numeric input in weight/reps | Input rejected, field shows last valid value | User enters valid number |
| Weight exceeds 2000 lbs/1000 kg | Warning: "Are you sure? This weight seems unusually high." | User confirms or corrects |
| Session save fails | Toast: "Could not save workout data." | Data retained in memory for retry |

#### 3.9 Acceptance Criteria

1. **Given** an active workout session with a bench press exercise (3 sets, 8 reps),
   **When** the user logs 185 lbs x 8 reps for set 1 and marks it complete,
   **Then** the set shows as completed with a checkmark, and the estimated 1RM updates (Epley: 185 * (1 + 8/30) = 234 lbs).

2. **Given** a duration-based exercise (plank, 3 sets x 60 seconds),
   **When** the user completes a 65-second hold,
   **Then** the actual duration (65s) is recorded and displayed.

3. **Given** a user skips an exercise,
   **When** the session is completed,
   **Then** the skipped exercise is recorded with skipped: true and sets_completed: 0.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| Epley 1RM with 185 lbs x 8 reps | weight: 185, reps: 8 | 234 |
| Epley 1RM with 1 rep (actual max) | weight: 315, reps: 1 | 315 |
| Epley 1RM with 0 weight | weight: 0, reps: 10 | 0 |
| Brzycki 1RM with 185 lbs x 8 reps | weight: 185, reps: 8 | 230 |
| Brzycki 1RM with 37 reps (breakdown) | weight: 100, reps: 37 | 0 |

---

### WO-005: Workout Player Engine

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-005 |
| **Feature Name** | Workout Player Engine |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a gym-goer, I want to start a workout and be guided through each exercise with automatic progression, rest periods, and real-time tracking, so that I can focus on lifting instead of managing my phone.

**Secondary:**
> As a user, I want to pause, resume, skip exercises, go back to previous exercises, and adjust playback speed during a workout, so that I have full control over my session.

#### 3.3 Detailed Description

The Workout Player Engine is a state machine that drives the active workout experience. It manages the lifecycle of a workout session from start to completion, tracking the current exercise, set, rep, elapsed time, rest countdowns, and playback speed.

The engine is implemented as a pure reducer function (`reducePlayer`) that takes a `PlayerStatus` state object and a `PlayerAction` and returns a new state. This functional architecture enables deterministic behavior, easy testing, and compatibility with both mobile and web platforms.

The player supports five states: idle (not started), playing (active exercise), paused, rest (countdown between sets/exercises), and completed. It handles both rep-based exercises (counting reps toward a target) and duration-based exercises (auto-completing when the timer reaches the exercise duration).

Superset/circuit support is built into the engine. When exercises share a `setGroupId`, the player skips inter-exercise rest between grouped exercises and cycles through the group before resting. After the last exercise in a group completes a set, the player returns to the first exercise in the group for the next set, with inter-set rest capped at half the rest_after value or 30 seconds, whichever is less.

Playback speed can be adjusted from 0.5x to 2.0x in 0.25x increments, affecting the exercise elapsed timer (but not rest timers or real-world elapsed time).

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-003: Workout Builder - workouts must exist to play
- WO-004: Set/Rep/Weight Logging - player records completion data

**External Dependencies:**
- Timer/interval mechanism for TICK actions (platform-provided)

#### 3.5 User Interface Requirements

##### Screen: Active Workout Player

**Layout:**
- Top bar: workout title, elapsed time (MM:SS), pause/resume button
- Progress bar showing overall workout completion percentage
- Current exercise card:
  - Exercise name (large text)
  - Set indicator: "Set 2 of 4"
  - Rep counter (for rep-based) or countdown timer (for duration-based)
  - Weight display (if configured)
- Rest overlay (when in rest state):
  - Large countdown timer (MM:SS)
  - "Skip Rest" button
  - Next exercise preview
- Bottom controls: Previous Exercise, Skip Exercise, Speed adjustment
- Superset/circuit indicator: shows group label and progress within the group

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | Workout loaded but not started | Exercise preview with "Start Workout" button |
| Playing | Active exercise | Exercise card with rep counter or timer, controls enabled |
| Paused | User paused | Dimmed overlay with "Resume" button, timer frozen |
| Rest | Between sets or exercises | Rest countdown overlay, next exercise preview |
| Completed | All exercises done | Summary screen with total time, exercises completed, PRs achieved |

#### 3.6 Data Requirements

##### State Object: PlayerStatus

| Field | Type | Description |
|-------|------|-------------|
| state | enum | 'idle', 'playing', 'paused', 'rest', 'completed' |
| currentExerciseIndex | integer | Index of current exercise in the exercises array |
| currentSet | integer | Current set number (1-indexed) |
| currentRep | integer | Current rep count within the set |
| elapsedTime | number | Total elapsed time in milliseconds (real-time) |
| exerciseElapsed | number | Current exercise elapsed time in ms (speed-adjusted) |
| restRemaining | number | Rest countdown in milliseconds |
| speed | number | Playback speed multiplier (0.5 to 2.0) |
| exercises | WorkoutExercise[] | Full exercise list for the workout |
| completed | CompletedExercise[] | Completed exercise records |
| groupNavigation | object | Precomputed indexes for superset navigation |

##### Action Types

| Action | Fields | Description |
|--------|--------|-------------|
| START | none | Begin the workout from idle state |
| PAUSE | none | Pause during playing state |
| RESUME | none | Resume from paused state |
| TICK | deltaMs: number | Advance timers by delta milliseconds |
| COMPLETE_REP | none | Increment rep counter; auto-complete set if target reached |
| COMPLETE_SET | none | Finish current set; advance to next set or exercise |
| SKIP_EXERCISE | none | Skip current exercise (marks as skipped) |
| PREVIOUS_EXERCISE | none | Go back to previous exercise |
| ADJUST_SPEED | direction: 'faster', 'slower', 'normal' | Change playback speed |
| REST_COMPLETE | none | End rest period and resume playing |

#### 3.7 Business Logic Rules

##### State Machine Transitions

| Current State | Action | Next State | Side Effects |
|--------------|--------|------------|-------------|
| idle | START | playing | exerciseElapsed resets to 0 |
| playing | PAUSE | paused | timers frozen |
| paused | RESUME | playing | timers resume |
| playing | TICK | playing | elapsedTime += deltaMs, exerciseElapsed += deltaMs * speed |
| playing | TICK (duration met) | rest or completed | auto-completes current set via COMPLETE_SET |
| playing | COMPLETE_REP (target reached) | rest or playing | auto-completes set via COMPLETE_SET |
| playing | COMPLETE_SET (more sets remain, no group) | rest | inter-set rest = min(rest_after / 2, 30s) |
| playing | COMPLETE_SET (more sets, in group, next in group exists) | playing | advance to next exercise in group, same set number |
| playing | COMPLETE_SET (more sets, in group, last in group) | rest | back to first in group, next set, rest = min(rest_after / 2, 30s) |
| playing | COMPLETE_SET (last set) | rest or completed | inter-exercise rest = rest_after; advance to next exercise |
| playing | COMPLETE_SET (last set, same group as next) | playing | skip rest, advance immediately |
| playing | COMPLETE_SET (last set, last exercise) | completed | workout done |
| playing | SKIP_EXERCISE | playing or completed | record as skipped, advance |
| any | PREVIOUS_EXERCISE | playing | go back one exercise, remove last completed entry |
| rest | TICK (rest <= 0) | playing | rest complete, auto-dispatches REST_COMPLETE |
| rest | REST_COMPLETE | playing | restRemaining = 0 |
| any | ADJUST_SPEED(faster) | same | speed = min(speed + 0.25, 2.0) |
| any | ADJUST_SPEED(slower) | same | speed = max(speed - 0.25, 0.5) |
| any | ADJUST_SPEED(normal) | same | speed = 1.0 |

##### Progress Calculation

**Purpose:** Calculate overall workout progress as a percentage.

**Formula:**
```
totalSets = SUM(exercise.sets for each exercise)
doneSets = SUM(completed.sets_completed for each completed exercise)
progress = min((doneSets + (currentSet - 1)) / totalSets, 1.0)
```

**Edge Cases:**
- Zero exercises: progress = 0
- Zero total sets: progress = 0

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Exercise index out of bounds | Player transitions to completed state | Workout summary displayed |
| Timer drift (device sleep) | Elapsed time may be inaccurate | Timer corrects on next TICK using real delta |

#### 3.9 Acceptance Criteria

1. **Given** a workout with 3 exercises (3 sets each) is loaded,
   **When** the user taps "Start Workout",
   **Then** the player transitions from idle to playing, showing the first exercise, set 1.

2. **Given** the player is in playing state on exercise 1, set 2,
   **When** the user completes set 2 (not the last set),
   **Then** the player transitions to rest state with countdown = min(rest_after/2, 30000)ms.

3. **Given** two exercises are in a superset group,
   **When** the user completes set 1 of exercise A,
   **Then** the player immediately advances to exercise B set 1 (no rest), not exercise A set 2.

4. **Given** the player is in rest state with 5 seconds remaining,
   **When** the user taps "Skip Rest",
   **Then** the rest timer clears and the player transitions to playing the next exercise/set.

5. **Given** the user is on the last set of the last exercise,
   **When** the set is completed,
   **Then** the player transitions to completed state and shows the workout summary.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| START transitions idle to playing | state: idle, action: START | state: playing |
| PAUSE only works during playing | state: rest, action: PAUSE | state: rest (unchanged) |
| TICK advances elapsed time | deltaMs: 1000, speed: 1.0 | elapsedTime += 1000, exerciseElapsed += 1000 |
| TICK with 2x speed | deltaMs: 1000, speed: 2.0 | exerciseElapsed += 2000 |
| TICK auto-completes duration exercise | exerciseElapsed >= duration * 1000 | COMPLETE_SET dispatched |
| COMPLETE_SET inter-set rest capped at 30s | rest_after: 120 | restRemaining = 30000 |
| superset skips rest between group members | exercises A,B in group, complete A set 1 | advance to B set 1, state: playing |
| SKIP marks exercise as skipped | playing, action: SKIP | completed entry has skipped: true |
| playerProgress returns correct % | 3 exercises, 3 sets each, 4 sets done | progress = 4/9 = 0.44 |

---

### WO-006: Voice Commands

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-006 |
| **Feature Name** | Voice Commands |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a lifter with sweaty hands, I want to control my workout session with voice commands like "next set", "pause", and "start recording", so that I do not need to touch my phone mid-exercise.

**Secondary:**
> As a user following along with a workout, I want to ask "what exercise" or "how many reps" and hear the answer, so that I can stay focused on my form.

#### 3.3 Detailed Description

Voice Commands provide hands-free control of the Workout Player Engine (WO-005) using the Web Speech API (web) and platform speech recognition (mobile). The system continuously listens for commands during an active workout session, parses recognized speech against a defined command grammar, and dispatches the appropriate player action.

The voice parser supports 16 commands across 5 categories: playback control, pacing, navigation, information queries, and recording control. Each command maps to a specific player action or UI response. The parser uses substring matching with confidence scoring: exact matches receive 1.0 confidence, partial matches (command phrase found within a longer utterance) receive 0.8 confidence. Commands below a minimum confidence threshold (0.5) are ignored.

All voice commands used during a session are logged with their timestamp and recognition status for analytics and debugging. The voice command log is stored in the session's `voice_commands_used_json` field.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-005: Workout Player Engine - voice commands dispatch player actions

**External Dependencies:**
- Web Speech API (web) or platform speech recognition SDK (mobile)
- Microphone permission

**Assumed Capabilities:**
- User has granted microphone permission
- Device has a working microphone

#### 3.5 User Interface Requirements

##### Component: Voice Command Indicator (within Active Workout screen)

**Layout:**
- Microphone icon in the top-right of the active workout screen
- Icon states: idle (gray), listening (pulsing green), command recognized (brief blue flash), error (red flash)
- When a command is recognized: brief toast showing the command text and action taken
- Long-press on microphone icon: show list of supported commands

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Off | Voice commands disabled in settings | Gray microphone icon with line-through |
| Idle | Listening but no speech detected | Gray microphone icon |
| Listening | Speech detected, processing | Pulsing green microphone icon |
| Recognized | Command matched | Blue flash + toast with command text |
| Unrecognized | Speech detected but no command match | Brief red flash, no action taken |
| Error | Microphone unavailable or permission denied | Red icon with "!" badge, tap to see error |

#### 3.6 Data Requirements

##### Voice Command Grammar

| Command Phrase | Synonyms | Category | Action | Player Action |
|---------------|----------|----------|--------|---------------|
| "pause" | "stop" | playback | Pause the workout | PAUSE |
| "resume" | "play", "start" | playback | Resume the workout | RESUME |
| "slower" | "slow down" | pacing | Decrease playback speed by 0.25x | ADJUST_SPEED(slower) |
| "faster" | "speed up" | pacing | Increase playback speed by 0.25x | ADJUST_SPEED(faster) |
| "normal speed" | - | pacing | Reset playback speed to 1.0x | ADJUST_SPEED(normal) |
| "next" | "skip" | navigation | Skip to next exercise | SKIP_EXERCISE |
| "previous" | "back" | navigation | Go to previous exercise | PREVIOUS_EXERCISE |
| "repeat" | - | navigation | Restart current exercise | PREVIOUS_EXERCISE + START |
| "what exercise" | - | info | Announce current exercise name | TTS: exercise name |
| "how many reps" | - | info | Announce remaining reps | TTS: rep count |
| "how much time" | - | info | Announce time remaining | TTS: time remaining |
| "start recording" | - | recording | Begin form video recording | Start camera capture |
| "stop recording" | - | recording | End form video recording | Stop camera capture |
| "next set" | "done", "complete" | navigation | Mark current set complete | COMPLETE_SET |
| "add weight" | "more weight" | logging | Increment weight by 5 lbs / 2.5 kg | Update weight field |
| "rest" | "take a break" | playback | Skip to rest period | COMPLETE_SET (force rest) |

##### Voice Command Log Entry

| Field | Type | Description |
|-------|------|-------------|
| command | string | The raw transcript text |
| timestamp | number | Milliseconds since session start |
| recognized | boolean | Whether the command was successfully matched |

#### 3.7 Business Logic Rules

##### Voice Command Parsing

**Purpose:** Match a speech transcript to a known command.

**Inputs:**
- transcript: string - the recognized speech text

**Logic:**
```
1. normalized = transcript.toLowerCase().trim()
2. FOR EACH (phrase, command) in COMMAND_MAP:
   a. IF normalized.includes(phrase):
      - confidence = 1.0 if normalized === phrase, else 0.8
      - RETURN { category, action, confidence, raw: transcript }
3. RETURN null (no match)
```

**Edge Cases:**
- Empty transcript: returns null
- Multiple commands in one utterance (e.g., "pause and skip"): first match wins (iteration order)
- Background noise transcribed as text: no match, returns null

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Microphone permission denied | Red mic icon with message: "Mic access required for voice commands" | Tap icon to open device settings |
| Speech recognition unavailable | Voice controls hidden, manual controls only | User controls workout via touch |
| Command not recognized | Brief red flash on mic icon, no action | User repeats command or uses touch |
| Speech recognition timeout | Mic icon returns to idle state | Auto-restarts listening after 1 second |

#### 3.9 Acceptance Criteria

1. **Given** the workout player is in playing state with voice commands enabled,
   **When** the user says "pause",
   **Then** the player pauses and the mic icon flashes blue with toast "Paused".

2. **Given** the workout player is paused,
   **When** the user says "resume",
   **Then** the player resumes and timers continue.

3. **Given** the user says "speed up" twice,
   **When** the speed was 1.0x,
   **Then** the speed is now 1.5x.

4. **Given** the user says "what exercise",
   **Then** the app announces the current exercise name via text-to-speech.

5. **Given** the user says something unintelligible,
   **Then** the mic icon flashes red briefly and no action is taken.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses "pause" command | transcript: "pause" | { category: 'playback', action: 'pause', confidence: 1.0 } |
| parses "stop" as pause synonym | transcript: "stop" | { category: 'playback', action: 'pause', confidence: 1.0 } |
| parses "speed up" command | transcript: "speed up" | { category: 'pacing', action: 'faster', confidence: 1.0 } |
| partial match has 0.8 confidence | transcript: "hey pause the workout" | { action: 'pause', confidence: 0.8 } |
| returns null for unknown speech | transcript: "hello world" | null |
| returns null for empty string | transcript: "" | null |
| getSupportedCommands returns all keys | none | array of 16 command phrases |

---

### WO-007: Form Video Recording

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-007 |
| **Feature Name** | Form Video Recording |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a lifter focused on proper technique, I want to record short video clips of my form during a workout session, so that I can review my technique later or share it with my coach.

**Secondary:**
> As a coach, I want to view my client's form recordings with the ability to leave timestamped feedback, so that I can help them improve their technique remotely.

#### 3.3 Detailed Description

Form Video Recording allows users to capture short video clips during an active workout session. Each recording is associated with a specific exercise within a session, with start and end timestamps marking the portion of the workout being filmed.

Recording can be triggered via voice command ("start recording" / "stop recording") or touch controls. The recorded video is stored as a .webm file. For Premium users, recordings are uploaded to Supabase Storage in the `recordings` bucket with the path pattern `{userId}/{sessionId}/{exerciseId}-{timestamp}.webm`, making them accessible from the Coach Portal (WO-009). For non-Premium users, recordings are stored locally only.

Each recording can receive timestamped coach feedback through the Coach Portal. Feedback entries include the timestamp within the video, the coach's comment, and the coach's user ID.

Form recording is a Premium feature gated by the subscription system. Free users see the recording controls but receive a prompt to upgrade when they attempt to start recording.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-005: Workout Player Engine - recordings are captured during active sessions

**External Dependencies:**
- Camera permission
- getUserMedia + MediaRecorder (web) or Expo Camera (mobile)
- Supabase Storage (for cloud upload, Premium only)

#### 3.5 User Interface Requirements

##### Component: Recording Controls (within Active Workout screen)

**Layout:**
- Red circle "Record" button in the bottom-right of the active workout screen
- During recording: pulsing red border around the screen, recording duration counter
- Camera preview as a small picture-in-picture overlay (movable, resizable)
- "Stop" button replaces "Record" during active recording

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Available | Premium user, camera permission granted | Red Record button visible |
| Recording | Actively capturing video | Pulsing red border, duration counter, PiP camera preview |
| Processing | Recording stopped, saving/uploading | Spinner on the Record button |
| Locked | Free user | Record button with lock icon; tap shows upgrade prompt |
| Unavailable | No camera or permission denied | Record button hidden |

##### Screen: Recordings List

**Layout:**
- Scrollable list of recordings grouped by session date
- Each recording card: exercise name, duration, thumbnail, date
- Tap to open recording viewer
- Swipe left to delete

##### Screen: Recording Viewer

**Layout:**
- Full-screen video player
- Timeline scrubber with coach feedback markers (colored dots)
- Below video: list of coach feedback entries (timestamp, comment, coach name)
- "Share" button for exporting the video

#### 3.6 Data Requirements

##### Entity: FormRecording

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| session_id | string | Required, references session | None | Associated workout session |
| exercise_id | string | Required, references exercise | None | Exercise being recorded |
| video_url | string | Required, valid URL or file path | None | Video file location |
| timestamp_start | number | Min: 0.0 | None | Start time within session (seconds) |
| timestamp_end | number | Min: 0.0, > timestamp_start | None | End time within session (seconds) |
| coach_feedback_json | string (JSON) | Valid JSON array | '[]' | Timestamped coach comments |
| created_at | datetime | ISO 8601 | Current timestamp | Record creation time |

**Indexes:**
- `wk_form_recordings_session_idx` on `session_id` - query recordings by session

#### 3.7 Business Logic Rules

##### Premium Gating

**Logic:**
```
1. Check subscription status via canAccessFeature('form_recording')
2. IF user is Premium (active or trialing): allow recording
3. ELSE: show upgrade prompt with pricing information
```

##### Video Storage Path

**Formula:**
- Supabase Storage path: `{userId}/{sessionId}/{exerciseId}-{Date.now()}.webm`
- Local storage path: `{appDocumentsDir}/recordings/{sessionId}/{exerciseId}-{Date.now()}.webm`

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | Recording controls hidden; message in settings | User grants permission in device settings |
| Recording fails to save | Toast: "Recording could not be saved" | Recording data is preserved for retry |
| Supabase upload fails | Recording saved locally; retry icon on recording card | Auto-retry on next app open with connectivity |
| Storage full | Toast: "Not enough storage for recording" | User frees storage or deletes old recordings |

#### 3.9 Acceptance Criteria

1. **Given** a Premium user is in an active workout,
   **When** they tap the Record button,
   **Then** recording starts with camera preview and pulsing red border.

2. **Given** a recording is in progress,
   **When** the user says "stop recording",
   **Then** the recording stops, saves, and a thumbnail appears in the recordings list.

3. **Given** a Free user taps the Record button,
   **Then** an upgrade prompt is shown with pricing for Premium.

4. **Given** a recording has coach feedback,
   **When** the user opens the Recording Viewer,
   **Then** feedback markers appear on the video timeline at the correct timestamps.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates recording with correct fields | sessionId, exerciseId, videoUrl | recording record with timestamps |
| queries recordings by session | sessionId filter | only recordings for that session |
| deletes recording by ID | recording ID | recording removed from database |
| coach feedback JSON parses correctly | valid JSON with 2 entries | array of 2 CoachFeedback objects |

---

### WO-008: Progress Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-008 |
| **Feature Name** | Progress Tracking |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a consistent gym-goer, I want to see my workout streaks, total volume, personal records, and weekly summaries, so that I can track my fitness progress over time.

**Secondary:**
> As a data-driven user, I want to see charts of my workout frequency and volume by week, so that I can identify trends and stay motivated.

#### 3.3 Detailed Description

Progress Tracking aggregates workout session data into meaningful metrics and visualizations. It provides five key analytics: workout streaks (consecutive days with completed sessions), volume statistics (total sessions, exercises, sets, reps, duration by muscle group), personal records (best performance per exercise), weekly/monthly summaries (sessions and volume per period), and workout history (enriched session list with titles and stats).

The progress engine operates on arrays of completed workout sessions and an exercise map, producing computed statistics without maintaining separate aggregation tables. All calculations are pure functions that can run on both mobile and web platforms.

Weight-based personal records track the heaviest weight lifted and highest estimated 1RM for each exercise, using the WorkoutSetWeight data from detailed per-set logging.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-004: Set/Rep/Weight Logging - session data to aggregate

**External Dependencies:**
- None (pure computation)

#### 3.5 User Interface Requirements

##### Screen: Progress Tab

**Layout:**
- Top section: streak card showing current streak (days), longest streak, and last workout date
- Below streak: summary cards row (total sessions, total minutes, total reps - last 30 days)
- Weekly bar chart: 8 weeks of workout frequency (sessions per week)
- Personal Records section: scrollable list of exercises with best weight, reps, and 1RM
- "View History" link to full workout history list

##### Screen: Workout History

**Layout:**
- Scrollable list of completed workouts ordered by date (most recent first)
- Each entry: workout title, date, duration, exercises completed/total, total reps
- Tap to view session detail with full exercise-by-exercise breakdown

#### 3.6 Data Requirements

##### Computed Type: StreakInfo

| Field | Type | Description |
|-------|------|-------------|
| current | integer | Current consecutive workout days (0 if streak broken) |
| longest | integer | All-time longest streak |
| lastWorkoutDate | string (nullable) | ISO date of most recent workout |

##### Computed Type: VolumeStats

| Field | Type | Description |
|-------|------|-------------|
| totalSessions | integer | Number of completed sessions |
| totalExercises | integer | Total non-skipped exercises |
| totalSets | integer | Total sets completed |
| totalReps | integer | Total reps completed |
| totalDurationMinutes | integer | Total workout time (rounded) |
| byMuscleGroup | Record<string, number> | Workout count per muscle group |

##### Computed Type: PersonalRecord

| Field | Type | Description |
|-------|------|-------------|
| exerciseId | string | Exercise ID |
| exerciseName | string | Exercise display name |
| maxReps | integer | Best reps in a session |
| maxSets | integer | Most sets in a session |
| maxDuration | number (nullable) | Longest duration hold |
| maxWeight | number (optional) | Heaviest weight lifted |
| max1RM | number (optional) | Highest estimated 1RM |
| achievedAt | string | Date of the record |

#### 3.7 Business Logic Rules

##### Streak Calculation

**Purpose:** Calculate current and longest consecutive workout day streaks.

**Inputs:**
- sessions: WorkoutSession[] - all completed sessions

**Logic:**
```
1. Extract unique completion dates (YYYY-MM-DD) from sessions
2. Convert to epoch-day numbers, sort descending
3. IF no dates: RETURN { current: 0, longest: 0, lastWorkoutDate: null }
4. Check if streak is active: most recent date is today or yesterday
5. Walk through sorted dates counting consecutive days (diff of exactly 1)
6. Track the first streak segment as the current streak (if active)
7. Track the maximum streak segment as the longest streak
8. RETURN { current, longest, lastWorkoutDate }
```

**Edge Cases:**
- Only one workout ever: current = 1 (if today/yesterday), longest = 1
- Multiple workouts on the same day: counted as one day
- Gap of 2+ days: streak resets to 0

##### Volume Calculation

**Purpose:** Aggregate volume metrics from completed sessions.

**Logic:**
```
1. FOR EACH completed session:
   a. Increment totalSessions
   b. Calculate duration = (completedAt - startedAt) in minutes
   c. FOR EACH completed exercise (not skipped):
      - Increment totalExercises
      - Add sets_completed to totalSets
      - Add reps_completed to totalReps
      - Look up exercise in exerciseMap for muscle groups
      - Increment byMuscleGroup counters
2. RETURN aggregated stats
```

##### Weekly Summary Buckets

**Purpose:** Group sessions into weekly buckets for charting.

**Inputs:**
- sessions: WorkoutSession[]
- weekCount: number (default 8)

**Logic:**
```
1. Create weekCount empty buckets
2. FOR EACH completed session:
   a. Calculate ageMs = now - completedAt
   b. weekIndex = floor(ageMs / weekMs)
   c. IF weekIndex < weekCount: add to bucket
3. RETURN array of PeriodSummary with labels
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No completed sessions | Empty state: "Complete your first workout to see progress!" | Call-to-action to start a workout |
| Invalid session dates | Session excluded from calculations | Logged as data quality issue |

#### 3.9 Acceptance Criteria

1. **Given** a user has worked out for 5 consecutive days,
   **When** they view the Progress tab,
   **Then** the current streak shows 5 and the streak card is highlighted.

2. **Given** a user completed 3 sessions this week (8 total sets of bench press, best set: 185 lbs x 8),
   **When** they view Personal Records,
   **Then** Bench Press shows maxWeight: 185, estimated1RM: 234 (Epley).

3. **Given** a user has 8 weeks of workout history,
   **When** they view the weekly chart,
   **Then** 8 bars are displayed showing session counts per week, labeled correctly.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| streak of 5 consecutive days | 5 sessions on consecutive days ending today | current: 5, longest: 5 |
| streak broken by gap | sessions with 2-day gap | current: 0 (or shorter segment) |
| streak counts yesterday as active | last session yesterday | current streak includes yesterday |
| volume with 3 sessions | 3 completed sessions with exercise data | correct sums for sets, reps, duration |
| volume excludes skipped exercises | 1 session with 1 skipped exercise | skipped exercise not counted |
| weekly summaries for 4 weeks | sessions across 4 weeks | 4 PeriodSummary entries with correct counts |
| personal records finds max reps | 3 sessions with same exercise, different reps | maxReps is the highest value |

---

### WO-009: Coach Portal

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-009 |
| **Feature Name** | Coach Portal |
| **Priority** | P1 |
| **Category** | Social |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a coach, I want to review my clients' form recordings and leave timestamped feedback on their technique, so that I can provide remote coaching.

**Secondary:**
> As a coach, I want to create and assign multi-week workout plans to my clients, so that they follow a structured training program.

#### 3.3 Detailed Description

The Coach Portal is a separate Next.js application (running on port 3001) designed for personal trainers and coaches who manage multiple clients. It provides a dashboard showing all assigned clients, their recent workout activity, form recordings pending review, and plan assignments.

Coaches can view client form recordings with a video player and leave timestamped feedback comments. When a coach leaves feedback, it appears in the client's Recording Viewer (WO-007) as markers on the video timeline.

Coaches can also create workout plans (WO-029) and assign them to clients. The portal shows plan adherence metrics (workouts completed vs. scheduled).

The coach-client relationship is managed via the `coach_id` field on the User entity. A user assigns themselves to a coach by entering the coach's unique code or accepting an invitation link.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-007: Form Video Recording - recordings to review

**External Dependencies:**
- Supabase Auth for coach authentication
- Supabase Storage for accessing client recordings
- Next.js 15 (separate app on port 3001)

#### 3.5 User Interface Requirements

##### Screen: Coach Dashboard

**Layout:**
- Client list sidebar with client names, last activity date, and unreviewed recording count
- Main content area: selected client's profile, recent sessions, pending recordings
- Top bar: coach profile, notifications bell, settings gear

##### Screen: Recording Review

**Layout:**
- Full-screen video player with timeline scrubber
- Feedback panel on the right (desktop) or bottom sheet (mobile):
  - Existing feedback entries with timestamps, editable
  - "Add Feedback" button: click a point on the timeline, type comment, save
- Client exercise details alongside the video

#### 3.6 Data Requirements

##### Embedded Type: CoachFeedback

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| timestamp | number | Min: 0, Max: video duration | None | Timestamp within the video (seconds) |
| comment | string | Required, max 500 chars | None | Coach's feedback text |
| coach_id | string | Required, valid user ID | None | Coach who left the feedback |
| created_at | datetime | ISO 8601 | Current timestamp | When the feedback was created |

#### 3.7 Business Logic Rules

##### Coach-Client Assignment

**Logic:**
```
1. Coach generates a unique invite code or share link
2. Client enters code or opens link in their app
3. System sets client.coach_id = coach.user_id
4. Coach's dashboard now shows the client
5. Client can remove their coach at any time (sets coach_id = null)
```

##### Recording Access Control

**Logic:**
```
1. A recording is accessible to:
   a. The user who created it (always)
   b. The user's assigned coach (if coach_id is set)
2. No other users can access the recording
3. If coach_id is removed, coach immediately loses access
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Client has no recordings | Empty state: "No recordings to review" | Coach waits for client to record |
| Video fails to load | Error message with retry button | Coach taps retry |
| Feedback save fails | Toast: "Could not save feedback" | Coach retries |

#### 3.9 Acceptance Criteria

1. **Given** a coach has 3 assigned clients,
   **When** the coach opens the dashboard,
   **Then** all 3 clients are listed with their last activity dates.

2. **Given** a client has uploaded a form recording,
   **When** the coach opens the recording,
   **Then** they can play the video and add timestamped feedback.

3. **Given** a coach adds feedback at timestamp 5.2s with comment "Keep elbows tighter",
   **When** the client views the recording,
   **Then** a feedback marker appears at 5.2s on the timeline with the coach's comment.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| coach feedback parses from JSON | valid JSON string | array of CoachFeedback objects |
| empty feedback returns empty array | '[]' | [] |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Coach adds feedback to recording | 1. Open recording 2. Click timeline 3. Type comment 4. Save | Feedback appears in recording's coach_feedback_json |

---

### WO-010: Workout Templates

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-010 |
| **Feature Name** | Workout Templates |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a gym-goer who follows the same routines weekly, I want to save my workouts as reusable templates, so that I can quickly start a workout without rebuilding it each time.

**Secondary:**
> As a user exploring new routines, I want to clone public templates from other users or coaches, so that I can try proven workout programs.

#### 3.3 Detailed Description

Workout Templates extend the Workout entity (WO-003) with sharing and reuse capabilities. Every saved workout already functions as a template (it persists and can be started multiple times). This feature adds the ability to mark workouts as public (shareable via the coach portal or social feed), track how many times a template has been cloned, and provide a "Use Template" flow that creates a new session from the template.

Templates include the full exercise configuration (sets, reps, weight, rest, grouping) and metadata (title, description, difficulty). When a user clones a template, they get an independent copy that they can customize without affecting the original.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-003: Workout Builder - templates are saved workouts

#### 3.5 User Interface Requirements

##### Screen: Workouts List (existing, enhanced)

**Layout:**
- Existing workout list with added "Template" badge on shared workouts
- "My Workouts" and "Community" tab toggle (Community shows public templates)
- Each workout card: title, exercise count, estimated duration, difficulty badge, clone count (for public)
- Tap to start workout or view details
- Long press: Edit, Duplicate, Share, Delete options

#### 3.6 Data Requirements

##### Entity: RoutineTemplate (extends Workout)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| title | string | Required | None | Template name |
| description | string | Optional | '' | Template description |
| creatorId | string | Required | None | User who created the template |
| exercises | WorkoutExercise[] | Required | [] | Exercise configuration |
| difficulty | string | Required | None | Difficulty level |
| isPublic | boolean | Required | false | Whether the template is shared |
| cloneCount | integer | Min: 0 | 0 | Number of times cloned |
| createdAt | datetime | ISO 8601 | Current timestamp | Creation time |

#### 3.7 Business Logic Rules

##### Template Cloning

**Logic:**
```
1. User taps "Use Template" on a community template
2. Create a new Workout with:
   - title = original.title + " (Copy)"
   - exercises = deep copy of original.exercises
   - creatorId = current user
   - isPublic = false
3. Increment original template's cloneCount
4. Navigate to the new workout's detail screen
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Clone fails | Toast: "Could not copy template" | User retries |
| Template references deleted exercises | Exercises show as "Unknown" | User can edit and replace |

#### 3.9 Acceptance Criteria

1. **Given** a user has saved a workout,
   **When** they mark it as public,
   **Then** it appears in the Community templates list.

2. **Given** a community template exists,
   **When** a user taps "Use Template",
   **Then** a copy is created in their workout list and the clone count increments.

3. **Given** a user clones a template and modifies it,
   **Then** the original template is not affected.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| clone creates independent copy | template with 3 exercises | new workout with same exercises, different ID |
| clone increments clone count | template with cloneCount 5 | cloneCount becomes 6 |

---

### WO-011: Exercise Search and Filtering

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-011 |
| **Feature Name** | Exercise Search and Filtering |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a gym-goer looking for a specific exercise, I want to search by name and filter by category, difficulty, and muscle group, so that I can quickly find exercises for my workout.

#### 3.3 Detailed Description

Exercise Search and Filtering provides the query interface for the Exercise Library (WO-001). It supports text search (case-insensitive substring match on name and description), category filtering (exact match on one of seven categories), difficulty filtering (exact match on beginner/intermediate/advanced), and muscle group filtering (exercises targeting any of the specified groups).

Filters can be combined: text search AND category AND difficulty are applied as SQL WHERE clauses, while muscle group filtering is applied in-memory after the SQL query (since muscle groups are stored as JSON). An optional `limit` parameter caps the number of results.

This feature is implemented in the `getWorkoutExercises` function in `db/crud.ts` and is the primary query interface used by the Body Map (WO-002), Workout Builder (WO-003), and AI Workout Generation (WO-015).

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-001: Exercise Library - exercises must exist to search

#### 3.5 User Interface Requirements

Covered in WO-001 (Exercise Library Browser screen). This feature specifies the underlying query behavior.

#### 3.6 Data Requirements

##### Filter Interface

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| search | string | No | Substring match against name and description |
| category | WorkoutCategory | No | Exact match on exercise category |
| difficulty | WorkoutDifficulty | No | Exact match on difficulty level |
| muscleGroups | MuscleGroup[] | No | Exercises targeting any of these groups |
| limit | integer | No | Maximum results to return |

#### 3.7 Business Logic Rules

##### Combined Filter Logic

**Logic:**
```
1. Start with all exercises
2. IF search is set: apply LOWER(name) LIKE '%search%' OR LOWER(description) LIKE '%search%'
3. IF category is set: apply category = category
4. IF difficulty is set: apply difficulty = difficulty
5. Execute SQL query with combined WHERE clause, ORDER BY name ASC
6. IF muscleGroups is set and non-empty:
   a. Parse muscle_groups_json for each result
   b. Keep only exercises where at least one muscle group is in the filter set
7. IF limit is set and > 0: slice results to limit
8. RETURN filtered results
```

**Sort/Filter/Ranking Logic:**
- Default sort: alphabetical by name (ASC)
- No ranking or relevance scoring; all matches are equal
- Filters are AND-combined (search AND category AND difficulty)
- Muscle group filter uses OR logic (exercise matches ANY specified group)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| SQL query fails | Empty list with error message | Retry on next screen focus |
| Malformed muscle_groups_json | Exercise excluded from muscle group filter results | Data quality issue logged |

#### 3.9 Acceptance Criteria

1. **Given** exercises exist with various categories,
   **When** the user filters by "cardio",
   **Then** only cardio exercises are returned.

2. **Given** exercises exist,
   **When** the user searches "press" and filters by "intermediate",
   **Then** only intermediate exercises with "press" in name or description are returned.

3. **Given** exercises exist targeting chest and back,
   **When** the user filters by muscleGroups: ['chest', 'back'],
   **Then** exercises targeting chest OR back are returned.

#### 3.10 Test Specifications

Covered in WO-001 Test Specifications (combined filter tests).

---

### WO-012: Rest Timer

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-012 |
| **Feature Name** | Rest Timer |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a lifter tracking my rest periods, I want a configurable rest timer that auto-starts after I log a set and alerts me with vibration and sound when rest is over, so that I maintain consistent rest intervals.

**Secondary:**
> As a strength athlete doing heavy compound lifts, I want per-exercise rest time defaults (3 minutes for compounds, 90 seconds for isolation), so that the timer adjusts automatically to the exercise type.

#### 3.3 Detailed Description

The Rest Timer is a prominent countdown overlay that activates automatically after a set is marked complete. It counts down from a configurable rest duration and alerts the user when the rest period ends via haptic vibration and an optional sound. The timer is integrated into the Workout Player Engine (WO-005), which already supports the `rest` state and `restRemaining` countdown.

This feature adds user-visible timer UI, configurable per-exercise default rest times, manual override controls, and audio/haptic alerts. The engine already handles the state transitions; this feature focuses on presentation and configuration.

Per-exercise default rest times follow these recommendations:
- Compound lifts (squat, deadlift, bench press, overhead press): 180 seconds (3 min)
- Accessory/isolation exercises (curls, extensions, raises): 90 seconds
- Core/ab exercises: 60 seconds
- Cardio/conditioning: 30 seconds

Users can override the default rest time for any exercise in the Workout Builder or during the active workout.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-005: Workout Player Engine - rest state management

**External Dependencies:**
- Haptic feedback API (Expo Haptics / navigator.vibrate)
- Audio playback for alert sound

#### 3.5 User Interface Requirements

##### Component: Rest Timer Overlay (within Active Workout screen)

**Layout:**
- Full-screen semi-transparent overlay when rest state is active
- Large circular countdown timer in the center (MM:SS format)
- Circular progress ring depleting as time passes
- "+30s" and "-30s" adjustment buttons flanking the timer
- "Skip Rest" button below the timer
- Next exercise preview card below the skip button (exercise name, sets x reps)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Counting | Timer > 0 | Countdown with depleting ring |
| Warning | Timer <= 10 seconds | Ring turns yellow, countdown pulses |
| Complete | Timer reaches 0 | Vibration + sound alert, auto-dismiss after 2 seconds |
| Extended | User tapped "+30s" | Timer increases, ring adjusts |
| Skipped | User tapped "Skip Rest" | Overlay dismissed, player resumes |

**Interactions:**
- Tap "+30s": add 30 seconds to rest timer
- Tap "-30s": subtract 30 seconds (minimum 0)
- Tap "Skip Rest": immediately end rest period
- Timer reaches 0: device vibrates (3 short bursts), plays alert sound, auto-advances to next set

#### 3.6 Data Requirements

##### Rest Timer Configuration

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| defaultRestSeconds | integer | Min: 0, Max: 600 | 90 | Global default rest time |
| perExerciseRest | Record<string, integer> | exercise_id to seconds | {} | Per-exercise overrides |
| soundEnabled | boolean | - | true | Play alert sound on timer complete |
| vibrationEnabled | boolean | - | true | Vibrate on timer complete |
| autoStartTimer | boolean | - | true | Auto-start rest timer after completing a set |

##### Default Rest Times by Exercise Type

| Exercise Type | Default Rest (seconds) | Examples |
|--------------|----------------------|----------|
| Compound barbell | 180 | Squat, Deadlift, Bench Press, Overhead Press |
| Compound dumbbell | 120 | Dumbbell Press, Dumbbell Row |
| Isolation | 90 | Bicep Curl, Tricep Extension, Lateral Raise |
| Core | 60 | Plank, Crunches, Russian Twist |
| Cardio/conditioning | 30 | Jumping Jacks, Burpees, Mountain Climbers |

#### 3.7 Business Logic Rules

##### Rest Timer Auto-Start

**Purpose:** Automatically start the rest countdown after a set is logged.

**Logic:**
```
1. User marks a set as complete (COMPLETE_SET action)
2. Engine determines rest duration:
   a. Check perExerciseRest for current exercise ID
   b. IF override exists: use override value
   c. ELSE: use exercise's rest_after field from workout definition
3. IF autoStartTimer is true AND restDuration > 0:
   a. Transition to 'rest' state with restRemaining = restDuration * 1000 ms
4. ELSE: stay in 'playing' state (no rest)
```

##### Timer Adjustment

**Logic:**
```
1. "+30s" tapped: restRemaining += 30000
2. "-30s" tapped: restRemaining = max(0, restRemaining - 30000)
   IF restRemaining reaches 0: dispatch REST_COMPLETE
```

##### Alert on Completion

**Logic:**
```
1. restRemaining reaches 0 (via TICK action)
2. IF vibrationEnabled: trigger 3 short haptic bursts (100ms each, 100ms gap)
3. IF soundEnabled: play alert tone (bundled audio file, 500ms duration)
4. Wait 2 seconds, then dispatch REST_COMPLETE to resume playing
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Haptic API unavailable | No vibration, sound still plays | Graceful degradation |
| Sound playback fails | No sound, vibration still triggers | Timer still completes normally |
| Timer drift from device sleep | Timer catches up on next TICK | Difference handled in engine delta |

#### 3.9 Acceptance Criteria

1. **Given** a user completes set 1 of bench press (rest_after = 180s),
   **When** they mark the set complete,
   **Then** the rest timer overlay appears with a 3:00 countdown.

2. **Given** the rest timer shows 1:30 remaining,
   **When** the user taps "+30s",
   **Then** the timer updates to 2:00.

3. **Given** the rest timer reaches 0,
   **Then** the device vibrates 3 times, plays an alert sound, and the player resumes to the next set after 2 seconds.

4. **Given** the rest timer is active,
   **When** the user taps "Skip Rest",
   **Then** the timer dismisses immediately and the next set begins.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| auto-starts rest after COMPLETE_SET | rest_after: 120 | state: 'rest', restRemaining: 120000 |
| +30s extends rest timer | restRemaining: 60000, add 30s | restRemaining: 90000 |
| -30s reduces rest timer | restRemaining: 60000, subtract 30s | restRemaining: 30000 |
| -30s at 20s remaining | restRemaining: 20000, subtract 30s | restRemaining: 0, REST_COMPLETE |
| per-exercise override used | perExerciseRest[exerciseId] = 180 | restRemaining: 180000 |

---

### WO-013: Previous Performance Display

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-013 |
| **Feature Name** | Previous Performance Display |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a lifter who wants to progressively overload, I want to see my previous session's weight and reps for each exercise inline during my current workout, so that I know what to beat today.

#### 3.3 Detailed Description

Previous Performance Display shows the user's most recent logged performance for each exercise directly within the set logging interface during an active workout. For each exercise, the system queries the most recent completed session containing that exercise and displays the weight, reps, and sets from that session as gray "ghost" text next to the current input fields.

The display format is: "Last: 185 lbs x 8, 185 x 7, 185 x 6" showing each set's weight and reps from the previous session. This data is pre-fetched when the workout starts and cached for the session duration.

This feature is table-stakes for strength training apps and is the foundation for Progressive Overload Automation (WO-016).

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-004: Set/Rep/Weight Logging - historical data to display
- WO-005: Workout Player Engine - active workout context

**External Dependencies:**
- None (queries local database)

#### 3.5 User Interface Requirements

##### Component: Previous Performance Hint (within Set Logger)

**Layout:**
- Each set row in the Set Logger shows a "Previous" column between Set # and Weight
- Previous column displays the weight and reps from the matching set in the last session
- Text is gray and smaller than the active input fields
- If no previous data exists: "First time!" in the Previous column
- Tap previous data to auto-fill current set inputs with those values

**Example Display:**
```
Set#  Previous        Weight   Reps   Done
1     185 lbs x 8    [185]    [8]    [ ]
2     185 lbs x 7    [   ]    [  ]   [ ]
3     185 lbs x 6    [   ]    [  ]   [ ]
```

#### 3.6 Data Requirements

##### Query: Last Session Performance

**Inputs:**
- exerciseId: string
- userId: string (optional, for multi-user)

**Returns:** Array of { setNumber, weight, weightUnit, reps } for the most recent session containing this exercise

**Query Logic:**
```sql
SELECT sw.set_number, sw.weight, sw.weight_unit, sw.reps
FROM wk_set_weights sw
JOIN wk_workout_sessions ws ON sw.session_id = ws.id
WHERE sw.exercise_id = ?
  AND ws.completed_at IS NOT NULL
ORDER BY ws.completed_at DESC
LIMIT 1  -- most recent session
-- then get all sets from that session for this exercise
```

#### 3.7 Business Logic Rules

##### Previous Data Lookup

**Purpose:** Find the most recent performance for each exercise in the current workout.

**Logic:**
```
1. When workout starts, get list of all exercise IDs in the workout
2. FOR EACH exerciseId:
   a. Query the most recent completed session containing this exercise
   b. Extract per-set weight and reps data
   c. Cache the result in a Map<exerciseId, SetData[]>
3. Display cached data alongside current set inputs
4. IF no previous session contains this exercise: display "First time!"
```

**Edge Cases:**
- Exercise never performed before: show "First time!" encouragement
- Exercise performed but with no weight (bodyweight exercise): show reps only
- Multiple sessions on the same day: use the most recent by completed_at timestamp

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Previous data query fails | "Previous" column shows "-" | Workout continues normally without hints |
| Previous session has different set count | Show data for available sets, blank for extra sets | User enters data manually |

#### 3.9 Acceptance Criteria

1. **Given** a user performed bench press last session (3 sets: 185x8, 185x7, 185x6),
   **When** they start a new workout with bench press,
   **Then** the Previous column shows "185 lbs x 8", "185 lbs x 7", "185 lbs x 6" for sets 1-3.

2. **Given** a user has never performed overhead press,
   **When** they start a workout with overhead press,
   **Then** the Previous column shows "First time!" for all sets.

3. **Given** previous data is displayed,
   **When** the user taps the previous data for set 1,
   **Then** the weight and reps inputs auto-fill with the previous values.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| returns previous data for known exercise | exerciseId with history | array of { setNumber, weight, reps } |
| returns empty for unknown exercise | exerciseId with no history | empty array |
| uses most recent session | 2 sessions, different dates | data from the later session |

---

### WO-014: Video Exercise Demos

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-014 |
| **Feature Name** | Video Exercise Demos |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a beginner unfamiliar with exercise form, I want to see short video clips or animated illustrations demonstrating proper technique for each exercise, so that I can perform exercises safely and effectively.

#### 3.3 Detailed Description

Video Exercise Demos provide visual form guidance for exercises in the library. Each exercise can have an associated short clip (5-10 seconds) or animated illustration showing proper execution. Demos are displayed as a tappable overlay on the exercise card during active workouts and as a prominent video player on the Exercise Detail screen.

The initial implementation uses animated illustrations (Lottie animations or looping GIF sequences) for the top 50 most-used exercises, bundled with the app for offline access. Future iterations can add full video clips lazy-loaded from a CDN.

Demos are referenced via the `video_url` and `thumbnail_url` fields on the Exercise entity (WO-001). For bundled assets, these are local file paths; for remote assets, they are HTTPS URLs.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-001: Exercise Library - demo assets are linked to exercises

**External Dependencies:**
- Lottie animation player (lottie-react-native / @lottiefiles/react-lottie-player)
- Bundled animation assets (~50 exercises initially)

#### 3.5 User Interface Requirements

##### Component: Demo Overlay (within Active Workout screen)

**Layout:**
- Small "Demo" button with play icon on the exercise card
- Tap opens a modal with the animation/video playing in a loop
- Close button (X) in the top-right
- "Slow motion" toggle for half-speed playback

##### Component: Demo Player (on Exercise Detail screen)

**Layout:**
- Full-width video/animation player at the top of the Exercise Detail screen
- Auto-plays in a loop on screen entry
- Tap to pause/resume
- Slow motion toggle below the player

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Available | Demo asset exists for this exercise | Demo button/player visible |
| Loading | Asset is being loaded | Skeleton placeholder with shimmer |
| Playing | Animation/video playing | Looping playback |
| Unavailable | No demo asset for this exercise | No demo button; text: "Demo coming soon" |

#### 3.6 Data Requirements

Uses existing Exercise entity fields:
- `video_url`: path to demo animation/video (null if unavailable)
- `thumbnail_url`: path to static preview frame (null if unavailable)

#### 3.7 Business Logic Rules

##### Asset Resolution

**Logic:**
```
1. Check exercise.video_url
2. IF starts with "asset://": resolve as bundled local asset
3. IF starts with "https://": load from remote URL with caching
4. IF null: show "Demo coming soon" placeholder
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Bundled asset missing | "Demo coming soon" placeholder | No action needed |
| Remote asset fails to load | "Demo unavailable" with retry | User taps retry |
| Animation player crashes | Demo button hidden for that exercise | App continues normally |

#### 3.9 Acceptance Criteria

1. **Given** a Push-up exercise with a bundled demo animation,
   **When** the user taps the Demo button during a workout,
   **Then** a modal opens with the push-up animation playing in a loop.

2. **Given** an exercise with no demo asset,
   **When** the user views the Exercise Detail screen,
   **Then** the demo area shows "Demo coming soon" instead of a player.

3. **Given** the demo modal is open,
   **When** the user toggles "Slow motion",
   **Then** the animation plays at 0.5x speed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| resolves bundled asset path | video_url: "asset://pushup.lottie" | local file path |
| resolves remote URL | video_url: "https://cdn.example.com/demo.mp4" | HTTPS URL |
| returns null for no demo | video_url: null | null (show placeholder) |

---

### WO-015: AI Workout Generation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-015 |
| **Feature Name** | AI Workout Generation |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a gym-goer who does not know what to do today, I want the app to generate a workout based on my target muscles, available equipment, time, and recovery state, so that I get an effective session without planning.

**Secondary:**
> As an intermediate lifter, I want AI-generated workouts that follow strength training principles (compound movements first, progressive volume, proper muscle pairing), so that I train smarter.

#### 3.3 Detailed Description

AI Workout Generation creates personalized workouts using a rule-based engine. The generator takes four inputs: target muscle groups (selected via body map), available equipment (home gym, full gym, bodyweight only), time available (15/30/45/60 minutes), and recovery state (from the Muscle Recovery Heatmap, WO-017, if available).

The initial implementation is deterministic (rule-based), not ML-based. It selects exercises from the library that match the target muscles and equipment constraints, assigns sets and reps based on the user's training goal (strength: 5x5, hypertrophy: 4x8-12, endurance: 3x15-20), and orders them with compound movements first followed by isolation work. A future iteration can introduce ML-based personalization.

The generator avoids exercises targeting muscles in the "fatigued" (red) recovery state (WO-017). If recovery data is unavailable, all muscles are treated as available.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-001: Exercise Library - exercises to select from
- WO-002: Body Map Visualization - target muscle selection UI
- WO-020: Muscle Recovery Heatmap (optional) - recovery state for smart selection

**External Dependencies:**
- None (rule-based engine runs locally)

#### 3.5 User Interface Requirements

##### Screen: Generate Workout

**Layout:**
- Step 1: "What muscles?" - Body map with multi-select (or "Full Body" button)
- Step 2: "What equipment?" - Toggle buttons (Full Gym, Home Gym, Bodyweight Only)
- Step 3: "How much time?" - Segmented control (15 min, 30 min, 45 min, 60 min)
- Step 4: "Training goal?" - Segmented control (Strength, Hypertrophy, Endurance)
- Recovery warning: if selected muscles are fatigued, show orange warning "Chest is fatigued (worked yesterday). Include anyway?"
- "Generate" button
- Result: preview of generated workout with exercises, sets, reps
- "Start Workout" and "Save as Template" buttons on the preview

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Input | User selecting parameters | Step-by-step input form |
| Generating | Engine processing | Brief spinner (< 500ms for rule-based) |
| Preview | Workout generated | Exercise list with edit capability |
| No Match | No exercises match constraints | "No exercises match your criteria. Try different filters." |

#### 3.6 Data Requirements

##### Generator Input

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| targetMuscles | MuscleGroup[] | At least 1 | Muscles to target |
| equipment | enum | 'full_gym', 'home_gym', 'bodyweight' | Available equipment |
| durationMinutes | integer | 15, 30, 45, or 60 | Time budget |
| goal | enum | 'strength', 'hypertrophy', 'endurance' | Training goal |
| recoveryState | Record<MuscleGroup, 'fresh' | 'moderate' | 'fatigued'> | Optional | Muscle recovery data |

##### Goal-Based Set/Rep Schemes

| Goal | Sets | Reps | Rest (seconds) |
|------|------|------|----------------|
| Strength | 5 | 5 | 180 |
| Hypertrophy | 4 | 8-12 | 90 |
| Endurance | 3 | 15-20 | 60 |

#### 3.7 Business Logic Rules

##### Workout Generation Algorithm

**Purpose:** Generate a structured workout from user inputs and the exercise library.

**Inputs:**
- targetMuscles, equipment, durationMinutes, goal, recoveryState (optional)

**Logic:**
```
1. QUERY exercises from library matching:
   - muscle_groups includes any of targetMuscles
   - category is appropriate for equipment type
   - (optional) exclude exercises for 'fatigued' muscles unless user overrides
2. SEPARATE into compound exercises (targets 3+ muscle groups) and isolation exercises (targets 1-2)
3. SORT compounds by muscle coverage (more target muscles = higher priority)
4. SORT isolations by target muscle specificity

5. DETERMINE exercise count based on duration:
   - 15 min: 3-4 exercises
   - 30 min: 5-6 exercises
   - 45 min: 7-8 exercises
   - 60 min: 9-10 exercises

6. SELECT exercises:
   a. Fill compound slots first (40% of total exercises, minimum 1)
   b. Fill remaining slots with isolation exercises
   c. Ensure each target muscle has at least 1 exercise
   d. Avoid duplicate exercises

7. ASSIGN sets/reps based on goal:
   - Strength: 5 sets x 5 reps, 180s rest
   - Hypertrophy: 4 sets x 10 reps (random 8-12), 90s rest
   - Endurance: 3 sets x 17 reps (random 15-20), 60s rest

8. ORDER: compounds first, then isolation exercises

9. CALCULATE estimated duration using estimateDuration()
10. IF estimated duration exceeds durationMinutes * 60:
    - Remove last isolation exercise, recalculate
    - Repeat until within budget

11. RETURN WorkoutDefinition with generated exercises
```

**Edge Cases:**
- No exercises match constraints: return empty result with error message
- Only 1-2 exercises match: generate a short workout with available exercises
- All target muscles are fatigued: warn user, generate anyway if they confirm
- Duration budget too short for even 3 exercises: suggest increasing time

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No matching exercises | "No exercises match your criteria. Try different filters." | User adjusts inputs |
| Generated workout exceeds time | Exercises are trimmed to fit within budget | Automatic, user sees final result |
| Recovery data unavailable | All muscles treated as fresh | Generator works without recovery data |

#### 3.9 Acceptance Criteria

1. **Given** the user selects chest + triceps, full gym, 30 min, hypertrophy,
   **When** they tap "Generate",
   **Then** a workout with 5-6 exercises is generated, starting with compounds (bench press), followed by isolation (tricep extension), with 4 sets x 8-12 reps each.

2. **Given** chest is marked as "fatigued" in recovery data,
   **When** the user selects chest as a target,
   **Then** a warning appears: "Chest is fatigued (worked yesterday). Include anyway?"

3. **Given** the user selects bodyweight only, 15 minutes, strength,
   **When** they tap "Generate",
   **Then** a workout with 3-4 bodyweight exercises is generated with 5x5 scheme.

4. **Given** no exercises match the constraints (impossible combination),
   **Then** the system shows "No exercises match your criteria" instead of an empty workout.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates 5-6 exercises for 30 min | duration: 30, goal: hypertrophy | 5-6 exercises |
| compounds come first | any valid input | first exercises have 3+ muscle groups |
| strength goal uses 5x5 | goal: strength | all exercises have 5 sets, 5 reps |
| hypertrophy goal uses 4x8-12 | goal: hypertrophy | 4 sets, reps between 8-12 |
| excludes fatigued muscles | recoveryState: { chest: 'fatigued' } | no chest exercises |
| trims to fit time budget | 60 min budget, exercises total 70 min | exercises removed until <= 60 min |
| returns empty for no matches | equipment: 'bodyweight', category: 'fascia' | empty result |

---

### WO-016: Progressive Overload Automation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-016 |
| **Feature Name** | Progressive Overload Automation |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a lifter practicing progressive overload, I want the app to auto-suggest weight or rep increases based on my recent performance history, so that I progressively get stronger without manual tracking.

#### 3.3 Detailed Description

Progressive Overload Automation analyzes a user's recent performance history for each exercise and generates suggestions for the current session. If the user has consistently hit their target reps for a specified number of consecutive sessions, the system suggests increasing the weight by the minimum increment. If the user has not reached target reps, the system suggests maintaining the current weight or decreasing if performance has declined.

The suggestion is displayed as a subtle hint in the Set Logger (WO-004), below the Previous Performance Display (WO-013). Suggestions are never forced; the user can always override.

Progression rules are configurable per exercise:
- Minimum weight increment: 5 lbs (barbell), 2.5 lbs (dumbbell), 2.5 kg / 1.25 kg for metric
- Sessions before suggesting increase: 2-3 consecutive sessions hitting target
- Target rep range: from the workout definition (e.g., 8-12 for hypertrophy)

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-004: Set/Rep/Weight Logging - historical weight/rep data
- WO-013: Previous Performance Display - data infrastructure

#### 3.5 User Interface Requirements

##### Component: Overload Suggestion (within Set Logger)

**Layout:**
- Below the "Previous" data in the Set Logger, a small suggestion badge appears
- Green up-arrow with text: "Try 190 lbs (+5)" when weight increase is suggested
- Neutral text: "Stay at 185 lbs" when no change is suggested
- Orange down-arrow: "Consider 180 lbs (-5)" when deload is suggested
- Tap the suggestion to auto-fill the weight input

#### 3.6 Data Requirements

##### Progression Configuration (per exercise)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| exerciseId | string | Required | None | Exercise to configure |
| minWeightIncrement | number | Min: 0 | 5 (lbs) / 2.5 (kg) | Minimum weight step |
| sessionsBeforeIncrease | integer | Min: 1, Max: 10 | 3 | Consecutive sessions hitting target before suggesting increase |
| targetRepMin | integer | Min: 1 | 8 | Lower bound of target rep range |
| targetRepMax | integer | Min: targetRepMin | 12 | Upper bound of target rep range |
| autoDeload | boolean | - | true | Suggest weight decrease on consistent underperformance |

#### 3.7 Business Logic Rules

##### Progressive Overload Algorithm

**Purpose:** Determine whether to suggest a weight increase, decrease, or maintenance for an exercise.

**Inputs:**
- exerciseId: string
- recentSessions: last N sessions containing this exercise (N = sessionsBeforeIncrease)
- config: Progression Configuration

**Logic:**
```
1. GATHER last N sessions for this exercise where N = config.sessionsBeforeIncrease
2. IF fewer than N sessions exist: RETURN "no suggestion" (insufficient data)

3. FOR EACH of the last N sessions:
   a. Get the weight used (from set weights)
   b. Get the reps achieved per set
   c. Check: did ALL sets achieve >= config.targetRepMin reps?
   d. Check: was the same weight used across sessions?

4. IF all N sessions used the same weight AND all sets hit >= targetRepMin:
   RETURN "increase" suggestion:
   - newWeight = currentWeight + config.minWeightIncrement
   - message = "Try {newWeight} {unit} (+{increment})"

5. IF the last 2 sessions had declining reps (each session worse than previous) AND autoDeload is true:
   RETURN "decrease" suggestion:
   - newWeight = currentWeight - config.minWeightIncrement
   - message = "Consider {newWeight} {unit} (-{increment})"

6. ELSE:
   RETURN "maintain" suggestion:
   - message = "Stay at {currentWeight} {unit}"
```

**Edge Cases:**
- First time performing exercise: no suggestion displayed
- Only 1 session of history: insufficient data, no suggestion
- User already increased weight manually: system adjusts baseline
- Weight was different across sessions: use most recent session's weight as baseline

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Insufficient history | No suggestion shown | User trains normally |
| Data inconsistency (missing sets) | Suggestion skipped for that exercise | No action needed |

#### 3.9 Acceptance Criteria

1. **Given** a user hit 185 lbs x 8 reps on all 3 sets for 3 consecutive sessions on bench press,
   **When** they start a new bench press session,
   **Then** the suggestion shows "Try 190 lbs (+5)" with a green up-arrow.

2. **Given** a user's bench press reps declined from 8,7,6 to 7,6,5 over 2 sessions,
   **When** they start a new session,
   **Then** the suggestion shows "Consider 180 lbs (-5)" with an orange down-arrow.

3. **Given** insufficient history (only 1 previous session),
   **Then** no progressive overload suggestion is displayed.

4. **Given** a suggestion is displayed,
   **When** the user taps it,
   **Then** the weight input auto-fills with the suggested weight.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| suggests increase after 3 consistent sessions | 3 sessions, all 185x8+ | "increase", 190 lbs |
| suggests maintain with mixed results | 3 sessions, varying reps | "maintain", 185 lbs |
| suggests decrease on declining trend | 2 sessions declining reps | "decrease", 180 lbs |
| no suggestion with 1 session | 1 session only | null (no suggestion) |
| respects custom increment | minWeightIncrement: 2.5 | increment by 2.5 |

---

### WO-017: Muscle Recovery Heatmap

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-017 |
| **Feature Name** | Muscle Recovery Heatmap |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a lifter who trains 5-6 days per week, I want to see a color-coded body map showing which muscles are fresh, moderate, or fatigued based on my recent training, so that I can plan my next workout to avoid overtraining.

#### 3.3 Detailed Description

The Muscle Recovery Heatmap extends the Body Map (WO-002) with a color gradient overlay based on training history. Each muscle group is colored based on its estimated recovery state: green (fully recovered, safe to train), yellow/amber (moderately recovered, can train but not optimal), or red (fatigued, needs rest).

Recovery state is calculated from three factors:
1. **Training volume:** Total sets targeting each muscle group in recent sessions
2. **Time since last trained:** Hours since the muscle group was last worked
3. **Exercise intensity:** Difficulty level and category of exercises performed

The heatmap updates daily (recalculated when the app is opened or the progress tab is visited). It feeds into the AI Workout Generation (WO-015) to avoid suggesting exercises for fatigued muscles.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-002: Body Map Visualization - the body map UI to color
- WO-004: Set/Rep/Weight Logging - training history data

**External Dependencies:**
- None (pure computation applied to body map)

#### 3.5 User Interface Requirements

##### Component: Recovery Heatmap (within Body Map, toggle mode)

**Layout:**
- Toggle switch on the Body Map screen: "Exercise Finder" vs "Recovery Status"
- In Recovery Status mode, muscle groups are colored by recovery state:
  - Green (#22C55E): 0-30% fatigue (fully recovered)
  - Yellow (#EAB308): 31-60% fatigue (moderately recovered)
  - Orange (#F97316): 61-80% fatigue (should rest)
  - Red (#EF4444): 81-100% fatigue (needs rest)
- Each muscle group shows its label and hours since last trained on tap
- Legend bar at the bottom: "Fresh" (green) to "Fatigued" (red)
- "Last Updated" timestamp

#### 3.6 Data Requirements

##### Computed Type: MuscleRecoveryState

| Field | Type | Description |
|-------|------|-------------|
| muscleGroup | MuscleGroup | The muscle group |
| fatiguePercent | number (0-100) | Calculated fatigue level |
| status | enum | 'fresh', 'moderate', 'fatigued' |
| hoursSinceLastTrained | number | Hours since last session targeting this muscle |
| recentVolume | integer | Total sets in the last 7 days |
| color | string | Hex color for the heatmap overlay |

#### 3.7 Business Logic Rules

##### Recovery Calculation Algorithm

**Purpose:** Calculate per-muscle-group recovery state from training history.

**Inputs:**
- sessions: completed sessions from the last 7 days
- exerciseMap: exercise ID to Exercise mapping (for muscle group lookup)
- now: current timestamp

**Logic:**
```
1. Initialize fatigueMap: Record<MuscleGroup, { volume: number, lastTrainedAt: Date }>

2. FOR EACH completed session in the last 7 days:
   a. FOR EACH completed exercise (not skipped):
      - Look up exercise in exerciseMap
      - FOR EACH muscle group in exercise.muscle_groups:
        - fatigueMap[group].volume += sets_completed
        - IF session.completed_at > fatigueMap[group].lastTrainedAt:
          fatigueMap[group].lastTrainedAt = session.completed_at

3. FOR EACH muscle group in fatigueMap:
   a. hoursSince = (now - lastTrainedAt) / 3600000
   b. volumeFactor = min(volume / 20, 1.0)   // 20 sets = maximum volume factor
   c. timeFactor = max(1.0 - (hoursSince / 72), 0)  // 72 hours (3 days) = full recovery
   d. fatiguePercent = round(volumeFactor * timeFactor * 100)

4. Assign status:
   - fatiguePercent 0-30: 'fresh' (green #22C55E)
   - fatiguePercent 31-60: 'moderate' (yellow #EAB308)
   - fatiguePercent 61-80: 'fatigued' (orange #F97316)
   - fatiguePercent 81-100: 'fatigued' (red #EF4444)

5. RETURN array of MuscleRecoveryState for all 14 muscle groups
   (muscle groups not trained in last 7 days get fatiguePercent: 0, status: 'fresh')
```

**Formulas:**
- `volumeFactor = min(totalSets / 20, 1.0)` - caps at 20 sets per muscle group per week
- `timeFactor = max(1.0 - (hoursSinceLastTrained / 72), 0)` - linear decay over 72 hours
- `fatiguePercent = volumeFactor * timeFactor * 100`

**Edge Cases:**
- Muscle group not trained in 7 days: fatigue = 0, status = 'fresh'
- Muscle trained heavily today (20+ sets): fatigue approaches 100%
- Muscle trained 48 hours ago with light volume (5 sets): fatigue ~11% (fresh)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No recent workout data | All muscles shown as green (fresh) | Accurate default state |
| Exercise missing from exerciseMap | Exercise's sets excluded from calculation | Conservative (slightly lower fatigue) |

#### 3.9 Acceptance Criteria

1. **Given** a user did 15 sets of chest exercises yesterday,
   **When** they open the Recovery Heatmap today,
   **Then** the chest region is orange/red (fatigued).

2. **Given** a user did 5 sets of back exercises 3 days ago,
   **When** they open the Recovery Heatmap,
   **Then** the back region is green (fresh, time factor near 0).

3. **Given** a user has no workout history,
   **When** they open the Recovery Heatmap,
   **Then** all muscle groups are green (fresh).

4. **Given** chest is red (fatigued),
   **When** the user taps the chest region,
   **Then** a tooltip shows "Chest - Fatigued (85%) - Last trained: 8 hours ago - 15 sets this week".

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| fresh after 72+ hours | 10 sets, 72 hours ago | fatiguePercent: 0, status: 'fresh' |
| fatigued after heavy training today | 20 sets, 2 hours ago | fatiguePercent: ~97, status: 'fatigued' |
| moderate after medium training yesterday | 10 sets, 24 hours ago | fatiguePercent: ~33, status: 'moderate' |
| volume caps at 20 sets | 30 sets, 1 hour ago | volumeFactor: 1.0, not 1.5 |
| untrained muscles are fresh | no sessions | all muscles: fatiguePercent: 0 |

---

### WO-018: GPS Route Recording

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-018 |
| **Feature Name** | GPS Route Recording |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a runner who also lifts, I want to record my outdoor runs, rides, and hikes with a GPS map trace, pace splits, and elevation profile in the same app as my strength workouts, so that I have one unified fitness tracker.

**Secondary:**
> As a privacy-conscious athlete, I want configurable privacy zones that exclude my home and work areas from any shared route data, so that my daily patterns are not exposed.

#### 3.3 Detailed Description

GPS Route Recording adds outdoor activity tracking to MyWorkouts, enabling users to record runs, cycling rides, and hikes with real-time GPS tracking. The feature captures location data points at regular intervals (every 3-5 seconds) and renders them as a polyline on a map. Post-activity, the user sees a summary with total distance, moving time, average/max pace, elevation gain, and per-mile/km splits.

Privacy is a first-class concern. Users can define circular privacy zones around sensitive locations (home, work). When a route passes through a privacy zone, the GPS points within the zone are excluded from any shared or exported data (but retained locally for personal viewing).

Routes are stored as arrays of coordinate/timestamp/altitude tuples in local SQLite. Map rendering uses Mapbox (mobile via @rnmapbox/maps) or MapLibre (web). This is a large feature that may alternatively live in a separate MyTrails module; the architecture is designed to be modular.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone feature within workouts)

**External Dependencies:**
- Background location permission (always-on during recording)
- GPS hardware
- Mapbox GL (mobile) / MapLibre GL (web) for map rendering
- Battery optimization handling (prevent OS from killing background location)

#### 3.5 User Interface Requirements

##### Screen: Start Activity

**Layout:**
- Activity type selector: Run, Ride, Hike, Walk
- Map preview showing current location
- Large "Start" button
- Current GPS signal strength indicator (weak/moderate/strong)
- Recent activities list below the start button

##### Screen: Active Recording

**Layout:**
- Full-screen map with route polyline drawing in real-time
- Top stats bar: distance, moving time, current pace
- Bottom control bar: pause/resume, stop (with "are you sure?" confirmation)
- Auto-pause indicator (when movement stops for > 10 seconds)
- Heart rate display (if Apple Watch connected, WO-022)

##### Screen: Activity Summary

**Layout:**
- Map with completed route polyline, start/end markers
- Stats grid: distance, moving time, average pace, max pace, elevation gain, calories estimate
- Splits table: per-mile or per-km with pace and elevation for each split
- Elevation profile chart (line graph of altitude over distance)
- "Save" and "Discard" buttons
- Share button (generates summary image, WO-021)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Pre-Start | GPS acquiring | Signal strength indicator, "Waiting for GPS..." |
| Recording | Active tracking | Live map with route, stats updating |
| Auto-Paused | No movement > 10s | "Auto-paused" indicator, stats frozen |
| Paused | User paused | "Paused" overlay, resume/stop buttons |
| Completed | User stopped | Activity summary screen |
| GPS Lost | Signal lost during recording | Orange warning: "GPS signal lost", last known position shown |

#### 3.6 Data Requirements

##### Entity: GPSActivity

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| activityType | enum | 'run', 'ride', 'hike', 'walk' | None | Activity type |
| startedAt | datetime | Required | None | Activity start time |
| completedAt | datetime | Nullable | null | Activity end time |
| distanceMeters | number | Min: 0 | 0 | Total distance in meters |
| movingTimeSeconds | integer | Min: 0 | 0 | Moving time (excludes pauses) |
| elevationGainMeters | number | Min: 0 | 0 | Total elevation gained |
| routeJson | string (JSON) | Valid JSON array of RoutePoint | '[]' | GPS coordinate sequence |
| splitsJson | string (JSON) | Valid JSON array of Split | '[]' | Per-distance splits |
| privacyZonesJson | string (JSON) | Valid JSON array of PrivacyZone | '[]' | User's privacy exclusion zones |
| caloriesEstimate | integer | Min: 0 | 0 | Estimated calories burned |
| averagePaceSecondsPerKm | number | Min: 0 | 0 | Average pace |
| maxPaceSecondsPerKm | number | Min: 0 | 0 | Fastest pace |
| createdAt | datetime | ISO 8601 | Current timestamp | Record creation time |

##### Embedded Type: RoutePoint

| Field | Type | Description |
|-------|------|-------------|
| lat | number | Latitude (-90 to 90) |
| lng | number | Longitude (-180 to 180) |
| alt | number | Altitude in meters |
| timestamp | number | Unix timestamp in milliseconds |
| accuracy | number | GPS accuracy in meters |

##### Embedded Type: Split

| Field | Type | Description |
|-------|------|-------------|
| splitNumber | integer | Split index (1-indexed) |
| distanceMeters | number | Distance for this split (typically 1609.34m for mile or 1000m for km) |
| timeSeconds | integer | Time for this split |
| paceSecondsPerUnit | number | Pace for this split |
| elevationChange | number | Net elevation change in this split |

##### Entity: PrivacyZone

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Zone label (e.g., "Home", "Work") |
| centerLat | number | Center latitude |
| centerLng | number | Center longitude |
| radiusMeters | number | Zone radius (default: 200m) |

#### 3.7 Business Logic Rules

##### GPS Point Collection

**Logic:**
```
1. Start location tracking with high accuracy, 3-5 second intervals
2. FOR EACH new GPS point:
   a. IF accuracy > 30 meters: discard point (too inaccurate)
   b. Calculate distance from last accepted point
   c. IF distance < 2 meters AND elapsed < 10 seconds: discard (stationary)
   d. Append to route array
   e. Update cumulative distance
   f. Update current pace (distance / elapsed for last 30 seconds)
```

##### Auto-Pause Detection

**Logic:**
```
1. Track rolling 10-second window of GPS points
2. IF total movement in 10 seconds < 5 meters:
   a. Transition to auto-paused state
   b. Stop incrementing moving time
   c. Continue recording GPS points (but mark as paused)
3. WHEN movement > 5 meters in 3-second window:
   a. Resume from auto-pause
   b. Resume incrementing moving time
```

##### Split Calculation

**Logic:**
```
1. User configures split distance: 1 mile (1609.34m) or 1 km (1000m)
2. Track cumulative distance
3. WHEN cumulative distance crosses a split boundary:
   a. Calculate split time = current time - last split time
   b. Calculate split pace = split time / split distance
   c. Calculate elevation change = current altitude - altitude at last split
   d. Append Split to splits array
```

##### Privacy Zone Filtering

**Purpose:** Remove GPS points within privacy zones from shared/exported data.

**Logic:**
```
1. FOR EACH route point:
   a. FOR EACH privacy zone:
      - Calculate distance from point to zone center (Haversine formula)
      - IF distance <= zone.radiusMeters: mark point as private
2. When exporting or sharing:
   a. Remove all private-marked points
   b. Connect remaining route segments with dashed lines on the map
```

##### Calorie Estimation

**Formula:**
```
caloriesPerMinute = {
  run: 11.0,
  ride: 8.0,
  hike: 7.0,
  walk: 4.5
}
calories = movingTimeMinutes * caloriesPerMinute[activityType]
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| GPS permission denied | Cannot start activity; prompt to enable in settings | User enables location permission |
| GPS signal lost | Orange warning banner; last position shown | Resumes tracking when signal returns |
| Battery critically low (< 5%) | Warning: "Battery low. Save activity to prevent data loss." | User saves activity |
| Background location killed by OS | Activity continues with gaps in route | Reconnects on next GPS update |

#### 3.9 Acceptance Criteria

1. **Given** the user starts a run,
   **When** they run 1 mile,
   **Then** the map shows a route polyline, distance reads ~1609m, and a split is recorded.

2. **Given** the user stops moving for 15 seconds,
   **When** auto-pause activates,
   **Then** the moving time freezes and an "Auto-paused" indicator appears.

3. **Given** the user has a privacy zone around their home,
   **When** they share the activity,
   **Then** the shared route omits GPS points within 200m of their home.

4. **Given** a completed 5K run,
   **When** the user views the summary,
   **Then** they see 5 splits with per-mile pace and elevation, plus total stats.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| discards low-accuracy points | accuracy: 50m | point discarded |
| accepts high-accuracy points | accuracy: 10m | point appended |
| auto-pause after 10s stationary | < 5m movement in 10s | state: auto-paused |
| split calculation at 1 mile | cumulative distance crosses 1609.34m | new split entry |
| privacy zone filters points | point within 200m of zone center | point marked private |
| calorie estimation for 30 min run | run, 30 minutes | ~330 calories |

---

### WO-019: Plate Calculator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-019 |
| **Feature Name** | Plate Calculator |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a lifter loading a barbell, I want to input my target weight and see which plates to load on each side, so that I do not have to do mental math between sets.

#### 3.3 Detailed Description

The Plate Calculator is a utility that takes a target barbell weight and shows the plate breakdown per side. It uses a greedy algorithm: subtract the bar weight, divide by two, then fit the largest available plates first. The calculator supports both lbs (standard plates: 45, 35, 25, 10, 5, 2.5) and kg (standard plates: 25, 20, 15, 10, 5, 2.5, 1.25).

The calculator accounts for different bar weights: 45 lbs (standard barbell), 35 lbs (women's barbell), 15 lbs (EZ curl bar). It shows the total achievable weight and any remainder that cannot be loaded with standard plates.

The engine is already implemented in `packages/shared/src/workout/plateCalculator.ts`. This feature specifies the UI and integration into the active workout screen.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (standalone utility)

**External Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Component: Plate Calculator (bottom sheet from Active Workout screen)

**Layout:**
- Accessible via a barbell icon in the Set Logger
- Bar weight selector: 45 lbs / 35 lbs / 15 lbs (or kg equivalents)
- Target weight input (numeric, pre-filled from current exercise weight if available)
- Unit toggle: lbs / kg
- Visual plate diagram: barbell with color-coded plates stacked on each side
- Plate breakdown list: "Each side: 45 + 25 + 10 = 80 lbs"
- Total weight display: "Total: 205 lbs"
- Remainder warning if target is not achievable: "Closest: 205 lbs (remainder: 0.5 lbs)"

**Plate Colors:**
| Plate (lbs) | Plate (kg) | Color |
|-------------|-----------|-------|
| 45 | 25 | Blue |
| 35 | 20 | Yellow |
| 25 | 15 | Green |
| 10 | 10 | White |
| 5 | 5 | Red |
| 2.5 | 2.5 | Gray |
| - | 1.25 | Silver |

#### 3.6 Data Requirements

##### Calculation Result: PlateResult

| Field | Type | Description |
|-------|------|-------------|
| perSide | Array<{ weight: number, count: number }> | Plates needed per side |
| totalWeight | number | Actual total weight achievable |
| remainder | number | Weight that cannot be loaded with available plates |

#### 3.7 Business Logic Rules

##### Greedy Plate Algorithm

**Purpose:** Calculate which plates to load on each side of the barbell.

**Inputs:**
- targetWeight: number - desired total weight
- barWeight: number - weight of the empty bar
- unit: 'lbs' | 'kg' - weight system

**Logic:**
```
1. IF targetWeight <= barWeight: RETURN empty (just the bar)
2. remaining = (targetWeight - barWeight) / 2
3. plates = unit === 'lbs' ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25]
4. FOR EACH plate in plates (descending):
   a. IF remaining <= 0: BREAK
   b. count = floor(remaining / plate)
   c. IF count > 0:
      - Add { weight: plate, count } to perSide
      - remaining -= count * plate
5. remainder = round(remaining * 100) / 100  (avoid floating point issues)
6. totalWeight = barWeight + sum(perSide weights) * 2
7. RETURN { perSide, totalWeight, remainder }
```

**Edge Cases:**
- Target equals bar weight: return empty plate list
- Target less than bar weight: return empty plate list with totalWeight = barWeight
- Non-standard target (e.g., 137.5 lbs): show remainder

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Target weight < bar weight | "Just use the empty bar" message | No action needed |
| Non-achievable exact weight | Show closest achievable weight with remainder | User adjusts target |

#### 3.9 Acceptance Criteria

1. **Given** target weight 225 lbs, bar weight 45 lbs,
   **When** the plate calculator runs,
   **Then** it shows: each side = 1x45 + 1x25 + 1x10 + 1x5 + 1x2.5 = 87.5 lbs (wait, let me recalculate: (225-45)/2 = 90 per side = 2x45). Each side: 2x45. Total: 225 lbs. Remainder: 0.

2. **Given** target weight 135 lbs, bar weight 45 lbs,
   **Then** each side: 1x45. Total: 135 lbs.

3. **Given** target weight 42.5 lbs, bar weight 45 lbs,
   **Then** "Just use the empty bar" message displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| 225 lbs with 45 lb bar | target: 225, bar: 45, unit: lbs | perSide: [{45, 2}], total: 225, remainder: 0 |
| 135 lbs with 45 lb bar | target: 135, bar: 45, unit: lbs | perSide: [{45, 1}], total: 135, remainder: 0 |
| target <= bar weight | target: 40, bar: 45 | perSide: [], total: 45, remainder: 0 |
| kg plates | target: 100, bar: 20, unit: kg | perSide: [{25, 1}, {15, 1}], total: 100, remainder: 0 |
| remainder case | target: 137.5, bar: 45, unit: lbs | remainder: 0, perSide: [{45, 1}, {2.5, 1}] |

---

### WO-020: Progress Photos

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-020 |
| **Feature Name** | Progress Photos |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user tracking my body transformation, I want to take dated photos and compare them side-by-side over time, so that I can visually see my progress.

#### 3.3 Detailed Description

Progress Photos allows users to capture or import body photos with date stamps and view type tags (front, side, back). Photos are stored locally in the app's documents directory, never uploaded to Supabase or any cloud service. Users can compare two photos side-by-side with a slider overlay.

Each photo entry includes the date taken, view type, and optional notes. Photos are organized in a timeline view grouped by month and can be filtered by view type for consistent comparison.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

**External Dependencies:**
- Camera permission (for capture)
- Photo library permission (for import)
- Local file system storage

#### 3.5 User Interface Requirements

##### Screen: Progress Photos

**Layout:**
- Grid view of photos grouped by month (most recent first)
- Filter chips: All, Front, Side, Back
- "Add Photo" floating action button (opens camera or photo picker)
- Tap photo to view full-screen with date and notes overlay
- "Compare" button (select 2 photos for side-by-side)

##### Screen: Photo Comparison

**Layout:**
- Two photos side-by-side (or overlaid with slider)
- Date labels on each photo
- Swipe slider to reveal before/after
- Pinch to zoom

#### 3.6 Data Requirements

##### Entity: ProgressPhoto

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| userId | string | Required | None | Owner user ID |
| photoUri | string | Required, local file path | None | Local path to photo file |
| viewType | enum | 'front', 'side', 'back' | 'front' | Photo view angle |
| notes | string | Optional, max 500 chars | '' | User notes |
| takenAt | datetime | Required | Current timestamp | When the photo was taken |

#### 3.7 Business Logic Rules

##### Photo Storage

**Logic:**
```
1. Photo is captured or selected from library
2. Copy photo to app documents directory: {appDocumentsDir}/progress-photos/{id}.jpg
3. Save ProgressPhoto record with local file path
4. Photos NEVER leave the device
5. On module data delete: all photos in the directory are deleted
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | Prompt with "Camera access needed for progress photos" | User grants permission |
| Storage full | Toast: "Not enough storage for photo" | User frees space |
| Photo file missing (deleted externally) | Placeholder with "Photo unavailable" | User can delete the entry |

#### 3.9 Acceptance Criteria

1. **Given** the user takes a front-view progress photo,
   **When** they save it,
   **Then** it appears in the photos grid with today's date and "Front" tag.

2. **Given** the user selects two photos from different months,
   **When** they tap "Compare",
   **Then** both photos appear side-by-side with a slider overlay.

3. **Given** photos exist,
   **When** the user filters by "Back",
   **Then** only back-view photos are displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates photo record | viewType: 'front', takenAt: now | record saved with correct fields |
| filters by view type | viewType: 'back' | only back photos returned |
| deletes photo and file | photo ID | record and file both removed |

---

### WO-021: Workout Sharing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-021 |
| **Feature Name** | Workout Sharing |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a gym-goer proud of my session, I want to generate a visual workout summary card and share it via the system share sheet, so that I can post it to Instagram Stories or send to friends.

#### 3.3 Detailed Description

Workout Sharing generates a post-workout summary card as a shareable image. The card includes: workout title, total duration, exercises performed, total volume (sets x reps x weight), personal records achieved, and muscle groups worked (as a mini body map).

The image is generated client-side using canvas rendering (web) or react-native-view-shot (mobile). No account or social network is required; sharing uses the platform's native share sheet.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-004: Set/Rep/Weight Logging - session data for the summary

**External Dependencies:**
- Canvas API or react-native-view-shot for image generation
- Platform share sheet API

#### 3.5 User Interface Requirements

##### Component: Share Card (post-workout summary)

**Layout:**
- Card dimensions: 1080x1920 pixels (Instagram Story format)
- MyWorkouts branding at the top (logo, app name)
- Workout title and date
- Stats grid: Duration, Exercises, Total Sets, Total Reps, Total Volume
- PR badges (if any personal records were hit)
- Mini body map showing worked muscle groups
- "MyWorkouts" watermark at the bottom

**Interactions:**
- "Share" button on workout completion summary screen
- Opens system share sheet with the generated image
- "Save to Photos" option alongside sharing

#### 3.6 Data Requirements

##### Computed Type: WorkoutSummary

| Field | Type | Description |
|-------|------|-------------|
| title | string | Workout title |
| duration | number | Total duration in minutes |
| exerciseCount | integer | Number of exercises completed |
| totalSets | integer | Total sets completed |
| totalReps | integer | Total reps completed |
| totalVolume | number | Sum of (weight x reps) across all sets |
| prsHit | string[] | List of exercise names where PRs were achieved |
| muscleGroups | MuscleGroup[] | All muscle groups worked |

#### 3.7 Business Logic Rules

##### Summary Generation

**Logic:**
```
1. After workout completion, aggregate session data into WorkoutSummary
2. Calculate totalVolume = SUM(weight * reps) for each set across all exercises
3. Detect PRs by comparing current session performance against historical PersonalRecords
4. Collect unique muscle groups from all completed exercises
5. Render summary card as an image
6. Present share sheet with the generated image
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Image generation fails | "Could not create share card" | User can manually screenshot the summary screen |
| Share sheet cancelled | Nothing happens, user returns to summary | No action needed |

#### 3.9 Acceptance Criteria

1. **Given** a completed workout with 5 exercises, 20 total sets, 2 PRs,
   **When** the user taps "Share",
   **Then** a visual card is generated showing all stats and 2 PR badges.

2. **Given** the share card is generated,
   **When** the user selects Instagram from the share sheet,
   **Then** the image is shared to Instagram Stories at 1080x1920 resolution.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| summary calculates total volume | 3 exercises with weights | correct totalVolume sum |
| summary detects PRs | current session exceeds historical records | prsHit contains exercise names |
| summary collects muscle groups | exercises targeting chest, back, core | muscleGroups: [chest, back, core] |

---

### WO-022: Apple Watch App

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-022 |
| **Feature Name** | Apple Watch App |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a lifter who does not want to carry my phone to the squat rack, I want to log sets from my Apple Watch, so that I can track my workout from my wrist.

**Secondary:**
> As a runner, I want to see my heart rate in real-time during my workout on my Watch, so that I can train in the right heart rate zone.

#### 3.3 Detailed Description

The Apple Watch app is a watchOS companion that mirrors the core active workout experience on the wrist. It shows the current exercise name, set counter, rest timer countdown, and heart rate from the Watch's optical sensor. Users can complete sets with pre-filled weight/reps from their previous performance (WO-013) using quick-tap buttons.

The Watch app communicates with the iPhone app via WatchConnectivity framework, syncing the workout state bidirectionally. Starting a workout on either device mirrors to the other. The Watch can also operate independently for quick workouts when the phone is not nearby, syncing data when reconnected.

Heart rate data from HealthKit is recorded and can be displayed alongside workout data in the Progress tab.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-005: Workout Player Engine - workout state management
- WO-012: Rest Timer - rest countdown on Watch

**External Dependencies:**
- watchOS 10+ SDK
- WatchConnectivity framework
- HealthKit (heart rate access)
- Apple Watch hardware

#### 3.5 User Interface Requirements

##### Watch Screen: Active Workout

**Layout:**
- Exercise name (truncated to fit, scrollable on tap)
- Set counter: "Set 2/4"
- Weight and reps display with +/- buttons
- "Done" button (marks set complete, starts rest timer)
- Heart rate display in top-right corner (BPM)
- Swipe left: skip exercise
- Swipe right: previous exercise

##### Watch Screen: Rest Timer

**Layout:**
- Large countdown number (seconds)
- Circular progress ring
- "Skip" button
- Next exercise preview (name only)
- Haptic tap when rest completes

##### Watch Screen: Workout Selection

**Layout:**
- Scrollable list of recent/saved workouts
- "Quick Start" button (empty workout, log as you go)
- Each workout shows: title, exercise count, estimated duration

#### 3.6 Data Requirements

Shares the same data model as the phone app. Watch data syncs via WatchConnectivity:

| Sync Direction | Data | Trigger |
|----------------|------|---------|
| Phone to Watch | Workout definitions, previous performance | Workout start |
| Watch to Phone | Completed sets, heart rate samples | Real-time during workout |
| Watch to Phone | Full session data | Workout completion |
| Phone to Watch | Rest timer settings, preferences | Settings change |

#### 3.7 Business Logic Rules

##### WatchConnectivity Sync

**Logic:**
```
1. Phone app sends workout definition + previous performance data to Watch on workout start
2. Watch receives and displays exercise list
3. User logs sets on Watch; each completion sends { exerciseId, setNumber, weight, reps } to Phone
4. Phone updates session record in real-time
5. Rest timer runs independently on Watch (synced start time, independent countdown)
6. On workout completion, Watch sends full session summary to Phone
7. If Phone is unreachable: Watch stores data locally, syncs on next connection
```

##### Heart Rate Sampling

**Logic:**
```
1. Request HealthKit authorization for heart rate data
2. Start HKWorkoutSession on Watch
3. Sample heart rate every 5 seconds during workout
4. Display current BPM on Watch face
5. Record heart rate samples in session data
6. Stop HKWorkoutSession on workout completion
7. Calculate average and max heart rate for the session
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Phone unreachable | Watch operates independently, shows "Offline" badge | Data syncs when reconnected |
| HealthKit permission denied | Heart rate display hidden | User grants permission in Watch Settings |
| Watch battery low (< 10%) | Warning on Watch: "Battery low" | User finishes workout or saves progress |

#### 3.9 Acceptance Criteria

1. **Given** a user starts a workout on their phone,
   **When** their Apple Watch is connected,
   **Then** the workout appears on the Watch with the first exercise ready.

2. **Given** the user completes a set on their Watch,
   **Then** the phone app updates in real-time, showing the set as complete.

3. **Given** the Watch shows the rest timer at 0,
   **Then** the Watch vibrates with a haptic tap and auto-advances to the next set.

4. **Given** the phone is not nearby,
   **When** the user starts a workout on Watch only,
   **Then** the workout data syncs to the phone when they reconnect.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| sync message formats correctly | workout definition | valid WatchConnectivity payload |
| heart rate averaging | [72, 85, 90, 88, 75] samples | average: 82, max: 90 |

---

### WO-023: Social Feed

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-023 |
| **Feature Name** | Social Feed |
| **Priority** | P2 |
| **Category** | Social |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a social gym-goer, I want to see my friends' workout completions, PRs, and milestones in an activity feed, so that I stay motivated and accountable.

#### 3.3 Detailed Description

The Social Feed is an opt-in activity feed showing workout completions from followed users. Each post displays the workout summary (WO-021 data), and users can like and comment on posts. The feed is strictly opt-in with granular privacy controls: users choose what to share (workout titles, stats, PRs) and what to keep private.

Social data is stored in Supabase (requires auth). Users follow other users by username or invite link. The feed is chronological (no algorithmic ranking).

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-021: Workout Sharing - summary data for posts

**External Dependencies:**
- Supabase Auth (user accounts required)
- Supabase Realtime (live feed updates)

#### 3.5 User Interface Requirements

##### Screen: Social Feed

**Layout:**
- Scrollable vertical feed of workout posts
- Each post: user avatar, username, time ago, workout summary card, like/comment counts
- Like button (tap to toggle)
- Comment button (opens comment thread)
- Pull-to-refresh for new posts

##### Screen: User Profile (social)

**Layout:**
- User avatar, display name, member since
- Stats: total workouts, current streak, followers/following counts
- Follow/Unfollow button
- Grid of recent workout posts

#### 3.6 Data Requirements

##### Entity: SocialPost

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| userId | string | Required | None | Post author |
| sessionId | string | Required | None | Associated workout session |
| content | WorkoutSummary (JSON) | Required | None | Workout summary data |
| createdAt | datetime | ISO 8601 | Current timestamp | Post creation time |

##### Entity: SocialLike

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| userId | string | Required | None | User who liked |
| postId | string | Required, references SocialPost | None | Post liked |
| createdAt | datetime | ISO 8601 | Current timestamp | Like time |

##### Entity: SocialComment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| userId | string | Required | None | Comment author |
| postId | string | Required, references SocialPost | None | Post commented on |
| body | string | Required, max 500 chars | None | Comment text |
| createdAt | datetime | ISO 8601 | Current timestamp | Comment time |

##### Entity: SocialFollow

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| followerId | string | Required | None | User who follows |
| followingId | string | Required | None | User being followed |
| createdAt | datetime | ISO 8601 | Current timestamp | Follow time |

#### 3.7 Business Logic Rules

##### Feed Query

**Logic:**
```
1. Get list of user IDs the current user follows
2. Query SocialPost WHERE userId IN followedIds ORDER BY createdAt DESC LIMIT 50
3. For each post, query like count and comment count
4. Check if current user has liked each post
5. RETURN enriched post list
```

##### Privacy Controls

Users configure which data is shared in posts:
- Workout title: on/off (default: on)
- Exercise names: on/off (default: on)
- Weight/reps details: on/off (default: off)
- Personal records: on/off (default: on)
- Duration: on/off (default: on)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Feed load fails | "Could not load feed. Pull to refresh." | User pulls to refresh |
| User not authenticated | "Sign in to see your feed" with sign-in button | User signs in |

#### 3.9 Acceptance Criteria

1. **Given** a user follows 3 people who have posted workouts,
   **When** they open the Social Feed,
   **Then** posts from all 3 appear in reverse chronological order.

2. **Given** a user taps the like button on a post,
   **Then** the like count increments and the button shows as liked.

3. **Given** a user has weight sharing disabled in privacy settings,
   **When** they complete a workout and it posts to the feed,
   **Then** the post shows exercise names and duration but not weight/reps.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| feed returns posts from followed users | 3 followed users with posts | 3 posts returned |
| privacy filter removes weight data | privacy: { weightDetails: false } | post.content has no weight fields |

---

### WO-024: Superset/Circuit Support

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-024 |
| **Feature Name** | Superset/Circuit Support |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an experienced lifter, I want to group 2-3 exercises into a superset so they execute back-to-back without rest, then rest before the next round, so that I can save time and increase training intensity.

#### 3.3 Detailed Description

Superset/Circuit Support allows users to group exercises in the Workout Builder and have the Workout Player Engine handle them as linked sets. This is fully specified in WO-003 (builder grouping) and WO-005 (player engine group navigation). This feature entry consolidates the superset behavior specification.

Four set types are supported:
- **Superset:** 2 exercises, alternating (e.g., bench press + bent-over row)
- **Dropset:** Same exercise, decreasing weight each set
- **Giant set:** 3+ exercises, back-to-back
- **Pyramid:** Same exercise, increasing then decreasing reps

Grouped exercises share a `setGroupId`. The engine precomputes navigation indexes for efficient group traversal. Within a group, exercises execute sequentially without inter-exercise rest. After the last exercise in the group completes a round, the engine rests (inter-set rest = min(rest_after/2, 30 seconds)), then cycles back to the first exercise in the group for the next set.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-003: Workout Builder - grouping UI
- WO-005: Workout Player Engine - group navigation logic

#### 3.5-3.10

Fully covered in WO-003 and WO-005 specifications.

---

### WO-025: Workout Calendar

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-025 |
| **Feature Name** | Workout Calendar |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a gym-goer tracking consistency, I want to see a calendar view with dots on days I worked out, so that I can visualize my training frequency at a glance.

#### 3.3 Detailed Description

The Workout Calendar is a monthly calendar view with visual indicators on days that have completed workout sessions. Each dot's color represents the workout focus (strength = red, cardio = blue, mobility = green). Tapping a day shows the workouts completed on that day.

The calendar integrates with Workout Plans (WO-029) to show scheduled vs. completed workouts, helping users track plan adherence.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-004: Set/Rep/Weight Logging - session completion dates

#### 3.5 User Interface Requirements

##### Screen: Workout Calendar

**Layout:**
- Standard monthly calendar grid
- Month/year header with left/right navigation arrows
- Days with completed workouts show colored dots (up to 3 dots for multiple workouts)
- Today is highlighted with a ring
- Tapping a day shows a bottom sheet with that day's workout summaries
- Monthly stats at the bottom: "12 workouts this month, 4 rest days"

#### 3.6 Data Requirements

Queries `wk_workout_sessions` grouped by completion date. No additional tables needed.

#### 3.7 Business Logic Rules

##### Calendar Data

**Logic:**
```
1. Query all sessions completed in the current month
2. Group by date (YYYY-MM-DD)
3. For each date, determine workout focus/category for dot color
4. Build calendar data structure with date -> { sessions, dotColors }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No workouts this month | Calendar shows with no dots; message "No workouts yet this month" | User starts a workout |

#### 3.9 Acceptance Criteria

1. **Given** a user worked out on March 1, 3, 5, 7,
   **When** they view the March calendar,
   **Then** those 4 dates have colored dots.

2. **Given** a user taps March 3,
   **Then** a bottom sheet shows the workout(s) completed on that day with summaries.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| groups sessions by date | 5 sessions across 3 dates | 3 date entries |
| assigns correct dot colors | strength session | red dot |

---

### WO-026: Body Measurements Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-026 |
| **Feature Name** | Body Measurements Tracking |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a lifter tracking body composition changes, I want to log body measurements (chest, waist, arms, legs) and see them charted over time, so that I can correlate physique changes with my training.

#### 3.3 Detailed Description

Body Measurements Tracking allows users to log periodic body measurements at specific body points. Supported measurement types: chest, waist, hips, left bicep, right bicep, left thigh, right thigh, left calf, right calf, neck, shoulders, forearms. Measurements are logged with a date and unit (inches or centimeters).

A line chart shows each measurement type over time, allowing users to see trends. All data is stored locally.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None

#### 3.5 User Interface Requirements

##### Screen: Body Measurements

**Layout:**
- List of measurement types with most recent value and date
- "Log Measurement" button opens a form with measurement type picker, value input, date picker
- Tap a measurement type to see a line chart of that measurement over time
- Unit toggle: inches / cm

#### 3.6 Data Requirements

##### Entity: BodyMeasurement

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| userId | string | Required | None | User ID |
| measurementType | string | Required, one of defined types | None | Body part measured |
| value | number | Required, Min: 0 | None | Measurement value |
| unit | enum | 'inches' or 'cm' | 'inches' | Measurement unit |
| measuredAt | datetime | Required | Current timestamp | When measurement was taken |

#### 3.7 Business Logic Rules

##### Measurement Types

Supported types: chest, waist, hips, left_bicep, right_bicep, left_thigh, right_thigh, left_calf, right_calf, neck, shoulders, left_forearm, right_forearm, body_weight.

Body weight uses lbs/kg unit instead of inches/cm.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid measurement value (negative) | Inline error: "Value must be positive" | User enters valid value |

#### 3.9 Acceptance Criteria

1. **Given** the user logs chest = 42 inches,
   **When** they view the measurements list,
   **Then** "Chest: 42 in" appears with today's date.

2. **Given** 3 chest measurements logged over 3 months,
   **When** the user taps "Chest",
   **Then** a line chart shows the trend over 3 months.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates measurement record | type: 'chest', value: 42, unit: 'inches' | record saved |
| queries measurements by type | type: 'waist' | only waist measurements returned |

---

### WO-027: One-Rep Max Calculator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-027 |
| **Feature Name** | One-Rep Max Calculator |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a strength trainee, I want my estimated one-rep max calculated automatically from my logged sets, so that I can track my strength without testing true maxes.

#### 3.3 Detailed Description

Fully specified in WO-004 (Set/Rep/Weight Logging). The 1RM engine supports Epley and Brzycki formulas and is implemented in `packages/shared/src/workout/oneRM.ts`. The 1RM is calculated for each logged set and the best (highest) 1RM for each exercise is stored in the session data and displayed in the Progress Tracking (WO-008) personal records section.

#### 3.4-3.10

See WO-004 for complete specification.

---

### WO-028: Warmup Set Calculator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-028 |
| **Feature Name** | Warmup Set Calculator |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a lifter who warms up before heavy sets, I want the app to suggest progressive warmup sets leading to my working weight, so that I warm up properly without guessing.

#### 3.3 Detailed Description

The Warmup Set Calculator generates a sequence of warmup sets with progressive loading leading to the user's working weight. The standard progression is: bar only x 10 reps, 50% x 8 reps, 70% x 5 reps, 85% x 3 reps, then working weight. Weights are rounded to the nearest 5 lbs for practical loading.

The engine is implemented in `packages/shared/src/workout/warmupCalculator.ts`.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-019: Plate Calculator - plate loading for warmup weights

#### 3.5 User Interface Requirements

##### Component: Warmup Suggestion (within Set Logger)

**Layout:**
- "Warmup" button above the set table for barbell exercises
- Tapping opens a list of warmup sets with weight and reps
- Each warmup set shows the plate loading (via plate calculator)
- "Start Warmup" button to add warmup sets before working sets

#### 3.6 Data Requirements

##### Computed Type: WarmupSet

| Field | Type | Description |
|-------|------|-------------|
| weight | number | Weight for this warmup set |
| reps | integer | Recommended reps |
| percentage | integer | Percentage of working weight (0 for bar-only) |

#### 3.7 Business Logic Rules

##### Warmup Progression

**Inputs:**
- workingWeight: number - the target working weight
- barWeight: number - the empty bar weight

**Logic:**
```
1. IF workingWeight <= barWeight: RETURN [{ weight: barWeight, reps: 10, percentage: 0 }]
2. Start with bar only: { weight: barWeight, reps: 10, percentage: 0 }
3. Add percentage-based sets:
   - 50% x 8: round(workingWeight * 0.5 / 5) * 5
   - 70% x 5: round(workingWeight * 0.7 / 5) * 5
   - 85% x 3: round(workingWeight * 0.85 / 5) * 5
4. Skip sets where rounded weight equals bar weight or working weight
5. RETURN warmup set array
```

**Edge Cases:**
- Working weight is light (e.g., 95 lbs): fewer warmup sets (50% rounds to bar weight, skip)
- Working weight equals bar weight: just the bar x 10

#### 3.9 Acceptance Criteria

1. **Given** working weight 225 lbs, bar weight 45 lbs,
   **Then** warmup sets: bar x 10, 115 x 8 (50%), 160 x 5 (70%), 190 x 3 (85%).

2. **Given** working weight 65 lbs, bar weight 45 lbs,
   **Then** warmup sets: bar x 10 (50% and 70% round to bar, skipped), 55 x 3 (85%).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| warmup for 225 lbs | working: 225, bar: 45 | [bar x10, 115x8, 160x5, 190x3] |
| warmup for light weight | working: 65, bar: 45 | [bar x10, 55x3] |
| warmup when working = bar | working: 45, bar: 45 | [bar x10] |

---

### WO-029: Workout Plans (Multi-Week Programs)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-029 |
| **Feature Name** | Workout Plans (Multi-Week Programs) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user following a structured training program, I want to follow a multi-week workout plan that tells me which workout to do each day, so that I progress systematically.

**Secondary:**
> As a coach, I want to create multi-week plans and assign them to clients, so that they follow a progressive training program.

#### 3.3 Detailed Description

Workout Plans are structured multi-week programs that assign specific workouts to specific days. Each plan consists of weeks, and each week consists of 7 days. Each day is either a workout day (with a linked workout ID) or a rest day, with optional notes.

Users can follow one active plan at a time. The app tracks the user's position in the plan based on their start date and shows today's scheduled workout. Plan progress is visualized on the Workout Calendar (WO-025).

Plans are created by coaches via the Coach Portal (WO-009) or by users in the Plan Builder. The plan engine is implemented in `packages/shared/src/workout/plans.ts`.

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-003: Workout Builder - plans reference saved workouts

#### 3.5 User Interface Requirements

##### Screen: Plans List

**Layout:**
- Active plan card at the top (if one is active) showing current week/day, today's workout
- "Browse Plans" section with available plans
- Each plan card: title, duration (weeks), sessions per week, difficulty

##### Screen: Plan Detail

**Layout:**
- Week-by-week accordion view
- Each week shows 7 days with workout name or "Rest" for each day
- Current day highlighted
- Progress indicator (weeks completed / total weeks)
- "Start Plan" or "Quit Plan" button

#### 3.6 Data Requirements

##### Entity: WorkoutPlan

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | Auto | Unique identifier |
| title | string | Required | None | Plan name |
| coach_id | string | Required | None | Creator (coach or user) |
| weeks | WorkoutPlanWeek[] (JSON) | Required | [] | Weekly schedule |
| is_premium | boolean | Required | false | Premium-only plan |
| created_at | datetime | ISO 8601 | Current timestamp | Creation time |

##### Embedded Type: WorkoutPlanWeek

| Field | Type | Description |
|-------|------|-------------|
| week_number | integer | Week number (1-indexed) |
| days | WorkoutPlanDay[] | 7-day schedule |

##### Embedded Type: WorkoutPlanDay

| Field | Type | Description |
|-------|------|-------------|
| day_number | integer | Day number (1-7) |
| workout_id | string (nullable) | Linked workout (null for rest days) |
| rest_day | boolean | Whether this is a rest day |
| notes | string (nullable) | Day-specific notes |

#### 3.7 Business Logic Rules

##### Current Plan Position

**Purpose:** Determine which week and day the user is on in their active plan.

**Inputs:**
- plan: WorkoutPlan
- startDate: string (ISO date when user started the plan)

**Logic:**
```
1. diffDays = floor((now - startDate) / millisecondsPerDay)
2. IF diffDays < 0: RETURN week 1, day 0 (plan not started)
3. weekIndex = floor(diffDays / 7)
4. dayIndex = diffDays % 7
5. IF weekIndex >= plan.weeks.length: RETURN last week, day 6, isComplete: true
6. RETURN { weekNumber: weekIndex + 1, dayIndex, isComplete: false }
```

##### Today's Workout

**Logic:**
```
1. Get current plan position
2. Find the week matching weekNumber
3. Find the day at dayIndex
4. RETURN { workoutId, restDay, notes }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Plan references deleted workout | Day shows "Workout unavailable" | User can edit plan or skip day |
| Plan completed | "Plan Complete!" celebration screen | User can restart or choose new plan |

#### 3.9 Acceptance Criteria

1. **Given** a user starts a 4-week plan on Monday,
   **When** it is Wednesday of week 1,
   **Then** the plan shows "Week 1, Day 3" with the scheduled workout.

2. **Given** the plan is complete (past the last week),
   **Then** the plan shows as complete with a celebration message.

3. **Given** today is a rest day in the plan,
   **Then** the plan shows "Rest Day" with any notes from the coach.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| getCurrentPlanPosition day 0 | startDate: today | week: 1, day: 0 |
| getCurrentPlanPosition day 10 | startDate: 10 days ago | week: 2, day: 3 |
| getCurrentPlanPosition past end | startDate: 50 days ago, 4-week plan | isComplete: true |
| getTodaysWorkout on workout day | day with workout_id set | { workoutId: 'xyz', restDay: false } |
| getTodaysWorkout on rest day | day with rest_day: true | { workoutId: null, restDay: true } |

---

### WO-030: Data Export

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | WO-030 |
| **Feature Name** | Data Export |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user who owns my data, I want to export all my workout history, exercises, and body measurements as CSV or JSON, so that I can back up my data or migrate to another app.

#### 3.3 Detailed Description

Data Export generates downloadable files containing all user workout data. The export includes: workout definitions, session history with per-set details, exercise library (custom exercises), body measurements, progress photos metadata (file paths), and GPS activities.

Supported formats: CSV (one file per entity type, zipped) and JSON (single file with all entities).

#### 3.4 Prerequisites

**Feature Dependencies:**
- WO-004: Set/Rep/Weight Logging - session data to export

#### 3.5 User Interface Requirements

##### Screen: Export Data (within Settings)

**Layout:**
- Format selector: CSV (Zip) or JSON
- Checkboxes for data types to include: Workouts, Sessions, Exercises, Measurements, GPS Activities
- "Export" button
- Progress indicator during export generation
- Share sheet with the generated file

#### 3.6 Data Requirements

##### Export Format: JSON

```json
{
  "exportDate": "2026-03-06T12:00:00Z",
  "version": "1.0",
  "workouts": [...],
  "sessions": [...],
  "exercises": [...],
  "measurements": [...],
  "gpsActivities": [...]
}
```

##### Export Format: CSV (Zip)

- `workouts.csv`: id, title, description, difficulty, exercise_count, estimated_duration, created_at
- `sessions.csv`: id, workout_id, started_at, completed_at, exercises_completed, total_reps, total_sets
- `exercises.csv`: id, name, category, muscle_groups, difficulty, default_sets, default_reps
- `measurements.csv`: id, type, value, unit, measured_at
- `gps_activities.csv`: id, type, distance_m, moving_time_s, elevation_gain_m, started_at, completed_at

#### 3.7 Business Logic Rules

##### Export Generation

**Logic:**
```
1. Query all selected data types from SQLite
2. FOR CSV: generate one CSV file per entity type, add to zip archive
3. FOR JSON: build single JSON object with all entity arrays
4. Generate file in temp directory
5. Present via share sheet for saving/sharing
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Export generation fails | Toast: "Could not generate export" | User retries |
| No data to export | "No workout data to export yet" | User completes some workouts first |

#### 3.9 Acceptance Criteria

1. **Given** a user has 10 sessions, 5 workouts, and 3 measurements,
   **When** they export as JSON,
   **Then** the JSON file contains all 10 sessions, 5 workouts, and 3 measurements.

2. **Given** a user exports as CSV,
   **Then** they receive a zip file with separate CSV files for each data type.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| JSON export includes all entities | 5 workouts, 10 sessions | JSON with workouts.length = 5, sessions.length = 10 |
| CSV export generates correct headers | any data | first row of each CSV contains correct column headers |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on **Exercises** (the building blocks) and **Workouts** (compositions of exercises). Users build Workouts from the Exercise Library, then execute them as **Workout Sessions**. Each session records per-exercise completion data and optional per-set weight data (**SetWeights**). Sessions can have **Form Recordings** with **Coach Feedback**.

**Workout Plans** organize Workouts into multi-week schedules. **GPS Activities** record outdoor route data independently. **Progress Photos** and **Body Measurements** track physical changes over time. **Social Posts** share workout summaries with followers.

The relationships are:
- Exercise (1) -> WorkoutExerciseEntry (*) -> Workout (1): many-to-many through embedded JSON
- Workout (1) -> WorkoutSession (*): one-to-many
- WorkoutSession (1) -> FormRecording (*): one-to-many
- WorkoutSession (1) -> SetWeight (*): one-to-many
- WorkoutSession (1) -> SocialPost (0..1): one-to-one (optional)
- User (1) -> BodyMeasurement (*): one-to-many
- User (1) -> ProgressPhoto (*): one-to-many
- User (1) -> GPSActivity (*): one-to-many
- WorkoutPlan (1) -> Workout (*): many-to-many through day schedule

### 4.2 Complete Entity Definitions

#### Entity: wk_exercises

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto | Unique identifier |
| name | TEXT | NOT NULL | None | Exercise name |
| description | TEXT | NOT NULL | '' | Form instructions |
| category | TEXT | NOT NULL | None | Exercise category |
| muscle_groups_json | TEXT | NOT NULL | '[]' | JSON array of MuscleGroup values |
| difficulty | TEXT | NOT NULL | 'beginner' | Difficulty level |
| video_url | TEXT | Nullable | NULL | Demo video URL |
| thumbnail_url | TEXT | Nullable | NULL | Thumbnail URL |
| audio_cues_json | TEXT | NOT NULL | '[]' | JSON array of AudioCue objects |
| default_sets | INTEGER | NOT NULL | 3 | Recommended sets |
| default_reps | INTEGER | Nullable | NULL | Recommended reps |
| default_duration | INTEGER | Nullable | NULL | Recommended duration (seconds) |
| is_premium | INTEGER | NOT NULL | 0 | Premium exercise flag |
| created_at | TEXT | NOT NULL | datetime('now') | Creation timestamp |

#### Entity: wk_workouts

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto | Unique identifier |
| title | TEXT | NOT NULL | None | Workout name |
| description | TEXT | NOT NULL | '' | Workout description |
| difficulty | TEXT | NOT NULL | 'beginner' | Difficulty level |
| exercises_json | TEXT | NOT NULL | '[]' | JSON array of exercise entries |
| estimated_duration | INTEGER | NOT NULL | 0 | Estimated duration (seconds) |
| is_premium | INTEGER | NOT NULL | 0 | Premium workout flag |
| created_at | TEXT | NOT NULL | datetime('now') | Creation timestamp |

#### Entity: wk_workout_sessions

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto | Unique identifier |
| workout_id | TEXT | NOT NULL, FK wk_workouts | None | Associated workout |
| started_at | TEXT | NOT NULL | None | Session start time |
| completed_at | TEXT | Nullable | NULL | Session completion time |
| exercises_completed_json | TEXT | NOT NULL | '[]' | JSON array of CompletedExercise |
| voice_commands_used_json | TEXT | NOT NULL | '[]' | JSON array of VoiceCommandLog |
| pace_adjustments_json | TEXT | NOT NULL | '[]' | JSON array of PaceAdjustment |
| created_at | TEXT | NOT NULL | datetime('now') | Creation timestamp |

#### Entity: wk_form_recordings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto | Unique identifier |
| session_id | TEXT | NOT NULL, FK wk_workout_sessions | None | Associated session |
| exercise_id | TEXT | NOT NULL | None | Exercise recorded |
| video_url | TEXT | NOT NULL | None | Video file path/URL |
| timestamp_start | REAL | NOT NULL | None | Start time in session |
| timestamp_end | REAL | NOT NULL | None | End time in session |
| coach_feedback_json | TEXT | NOT NULL | '[]' | JSON array of CoachFeedback |
| created_at | TEXT | NOT NULL | datetime('now') | Creation timestamp |

#### Entity: wk_workout_logs (Legacy)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto | Unique identifier |
| name | TEXT | NOT NULL | None | Workout name |
| focus | TEXT | NOT NULL | 'full_body' | Workout focus area |
| duration_min | INTEGER | NOT NULL | None | Duration in minutes |
| calories | INTEGER | NOT NULL | 0 | Calories burned |
| rpe | INTEGER | NOT NULL | 7 | Rate of perceived exertion (1-10) |
| completed_at | TEXT | NOT NULL | None | Completion timestamp |
| notes | TEXT | Nullable | NULL | User notes |
| created_at | TEXT | NOT NULL | datetime('now') | Creation timestamp |

#### Entity: wk_programs (Legacy)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | PRIMARY KEY | Auto | Unique identifier |
| name | TEXT | NOT NULL | None | Program name |
| goal | TEXT | NOT NULL | None | Program goal |
| weeks | INTEGER | NOT NULL | None | Duration in weeks |
| sessions_per_week | INTEGER | NOT NULL | None | Sessions per week |
| is_active | INTEGER | NOT NULL | 0 | Active program flag |
| created_at | TEXT | NOT NULL | datetime('now') | Creation timestamp |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| wk_workouts -> wk_workout_sessions | one-to-many | A workout can have many sessions |
| wk_workout_sessions -> wk_form_recordings | one-to-many | A session can have many recordings (CASCADE delete) |
| wk_exercises -> wk_workouts | many-to-many | Exercises compose workouts (via exercises_json) |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| wk_exercises | wk_exercises_category_idx | category | Filter by category |
| wk_exercises | wk_exercises_difficulty_idx | difficulty | Filter by difficulty |
| wk_workouts | wk_workouts_created_idx | created_at DESC | List workouts by recency |
| wk_workout_sessions | wk_workout_sessions_workout_idx | workout_id | Query sessions by workout |
| wk_workout_sessions | wk_workout_sessions_completed_idx | completed_at DESC | List completed sessions by recency |
| wk_form_recordings | wk_form_recordings_session_idx | session_id | Query recordings by session |
| wk_workout_logs | wk_workout_logs_focus_idx | focus | Filter legacy logs by focus |
| wk_workout_logs | wk_workout_logs_completed_idx | completed_at DESC | List legacy logs by recency |
| wk_programs | wk_programs_active_idx | is_active | Find active program |

### 4.5 Table Prefix

**MyLife hub table prefix:** `wk_`

All table names in the SQLite database are prefixed with `wk_` to avoid collisions with other modules in the MyLife hub. Example: the `exercises` table becomes `wk_exercises`.

### 4.6 Migration Strategy

- **Version 1:** Creates legacy tables (`wk_workout_logs`, `wk_programs`) with basic indexes.
- **Version 2:** Creates the full feature schema (`wk_exercises`, `wk_workouts`, `wk_workout_sessions`, `wk_form_recordings`) with comprehensive indexes.
- Tables are created on module enable. Schema version is tracked in the module registry.
- Data from the standalone MyWorkouts app (Supabase-backed) can be imported via a future data importer.
- Legacy tables (v1) are retained for backward compatibility with prior hub releases.
- Destructive migrations (column removal) are deferred to major versions only.
- New tables for future features (GPS activities, body measurements, progress photos, social, set weights) will be added in Version 3.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Home | home | Dashboard | Quick stats, current streak, today's workout, recent activity |
| Explore | search | Body Map / Exercise Library | Interactive body map for exercise discovery |
| Workouts | layers | Workouts List | Saved workouts and templates |
| Progress | trending-up | Progress Dashboard | Streaks, volume stats, PRs, weekly charts |
| Profile | user | User Profile | Settings, coach info, export, subscription |

### 5.2 Navigation Flow

```
[Tab 1: Home]
  ├── Today's Workout Card -> Active Workout Player
  │     ├── Set Logger (per exercise)
  │     │     ├── Plate Calculator (bottom sheet)
  │     │     └── Warmup Calculator (bottom sheet)
  │     ├── Rest Timer Overlay
  │     ├── Voice Command Indicator
  │     └── Form Recording Controls
  │           └── Recording Viewer
  ├── Workout Calendar
  │     └── Day Detail (bottom sheet)
  └── Recovery Heatmap

[Tab 2: Explore]
  ├── Body Map (front/back toggle)
  │     └── Filtered Exercise List
  │           └── Exercise Detail
  │                 ├── Exercise Demo Player
  │                 └── "Add to Workout" -> Workout Builder
  └── Generate Workout
        └── Generated Workout Preview
              ├── Start Workout -> Active Workout Player
              └── Save as Template -> Workouts List

[Tab 3: Workouts]
  ├── My Workouts List
  │     ├── Workout Detail
  │     │     ├── Start Workout -> Active Workout Player
  │     │     └── Edit Workout -> Workout Builder
  │     └── New Workout -> Workout Builder
  ├── Plans List
  │     ├── Plan Detail
  │     └── Plan Builder
  └── Community Templates

[Tab 4: Progress]
  ├── Streak Card
  ├── Volume Stats
  ├── Weekly Chart
  ├── Personal Records List
  ├── Workout History
  │     └── Session Detail
  ├── Body Measurements
  │     └── Measurement Chart
  └── Progress Photos
        └── Photo Comparison

[Tab 5: Profile]
  ├── Coach Settings (assign/remove coach)
  ├── Subscription / Pricing
  ├── Privacy Settings (social sharing controls)
  ├── GPS Privacy Zones
  ├── Rest Timer Settings
  ├── Unit Preferences (lbs/kg, miles/km)
  ├── Data Export
  └── Delete All Data
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Dashboard | `/home` | Quick stats and today's workout | Tab 1 |
| Body Map | `/explore` | Interactive muscle group selector | Tab 2 |
| Exercise Detail | `/exercise/:id` | Full exercise info with demo | Body map, exercise list, search |
| Workout Builder | `/workouts/builder` | Create/edit workout | "New Workout", "Edit Workout" |
| Workouts List | `/workouts` | Browse saved workouts | Tab 3 |
| Active Workout Player | `/workout/:id/play` | Execute a workout session | "Start Workout" on any workout |
| Recording Viewer | `/recordings/:id` | View form recording with feedback | Recordings list, session detail |
| Progress Dashboard | `/progress` | Stats, streaks, PRs | Tab 4 |
| Workout History | `/progress/history` | Session history list | Progress tab |
| Session Detail | `/progress/session/:id` | Per-exercise session breakdown | Workout history |
| Plans List | `/plans` | Browse workout plans | Tab 3 |
| Plan Detail | `/plans/:id` | Plan schedule with progress | Plans list |
| Generate Workout | `/generate` | AI workout generation | Explore tab |
| Workout Calendar | `/calendar` | Monthly training calendar | Home tab |
| Body Measurements | `/measurements` | Log and chart measurements | Progress tab |
| Progress Photos | `/photos` | Photo timeline and comparison | Progress tab |
| GPS Activity Start | `/activity/start` | Start outdoor activity | Home tab |
| GPS Activity Summary | `/activity/:id` | Post-activity stats and map | Activity completion |
| Social Feed | `/social` | Friends' workout feed | Profile tab |
| Profile/Settings | `/profile` | User settings and preferences | Tab 5 |
| Data Export | `/profile/export` | Export workout data | Profile tab |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://workouts/workout/:id` | Workout Detail | id: workout UUID |
| `mylife://workouts/workout/:id/play` | Active Workout Player | id: workout UUID |
| `mylife://workouts/exercise/:id` | Exercise Detail | id: exercise UUID |
| `mylife://workouts/plan/:id` | Plan Detail | id: plan UUID |
| `mylife://workouts/session/:id` | Session Detail | id: session UUID |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Workout as habit | Workouts | Habits | Workout frequency → habit tracking | On session completion |
| Fasting zone context | Fast | Workouts | Fasting state → display on workout entry | On workout start |
| Heart rate data | Health | Workouts | HealthKit HR → workout session data | During active workout |
| Recovery metrics | Health | Workouts | HRV, resting HR → recovery heatmap inputs | On heatmap calculation |
| Sleep and recovery | Health | Workouts | Sleep data → recovery calculation weighting | On heatmap calculation |
| Nutrition suggestions | Nutrition | Workouts | Training volume → protein intake suggestions | On session completion |
| Mood correlation | Mood | Workouts | Workout completion → mood correlation stats | On mood entry |
| Medication timing | Meds | Workouts | Medication schedule → exercise timing warnings | On workout start |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Workout definitions | Local SQLite | At rest (OS-level) | Optional (Supabase) | Core workout data |
| Session history | Local SQLite | At rest (OS-level) | Optional (Supabase) | Training logs |
| Exercise library | Local SQLite | No | No | Bundled seed data |
| Form recordings | Local file system or Supabase Storage | At rest (OS-level) | Premium only | Video files |
| Progress photos | Local file system only | At rest (OS-level) | Never | Never leaves device |
| GPS routes | Local SQLite | At rest (OS-level) | Never (by default) | Privacy zones enforced |
| Body measurements | Local SQLite | At rest (OS-level) | No | Local only |
| Social posts | Supabase (if opted in) | In transit (TLS) | Yes | Requires auth |
| Voice command logs | Local SQLite (session) | No | No | Session metadata only |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Supabase sync | Cross-device workout data | Workout/session data | Workout/session data | Explicit opt-in |
| Form recording upload | Coach review | Video file | Coach feedback | Implicit (Premium feature) |
| Social feed | Friends' workouts | Post content | Feed posts | Explicit opt-in |
| Exercise demo download | Lazy-loaded demos | Exercise ID request | Animation/video file | Implicit (user opens demo) |

### 7.3 Data That Never Leaves the Device

- Progress photos (body transformation images)
- GPS routes (unless explicitly shared, and then with privacy zone filtering)
- Voice command audio (only transcripts are stored, not audio)
- Body measurements
- Exercise library seed data
- User preferences and settings

### 7.4 User Data Ownership

- **Export:** Users can export all their data in CSV (zipped) or JSON format
- **Delete:** Users can delete all module data from Settings (irreversible, with confirmation dialog)
- **Portability:** Export format is documented and human-readable
- **Granular control:** Users can delete individual sessions, recordings, or photos

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Premium gating | Form recording requires active Premium subscription | Enforced via subscription status check |
| Coach access | Recordings accessible only to user and assigned coach | coach_id field controls access |
| Privacy zones | GPS routes exclude points within user-defined zones from sharing | Zones stored locally |
| Social privacy | Users control which workout data is shared in social posts | Per-field toggle in settings |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| 1RM (One-Rep Max) | The maximum weight a person can lift for one repetition of a given exercise, either tested or estimated from multi-rep sets |
| Active Workout | A workout session in progress, managed by the Workout Player Engine |
| Audio Cue | A text string spoken by the app during workout playback to guide the user through an exercise |
| Body Map | An interactive SVG diagram of the human body showing 14 muscle groups, used for exercise discovery and recovery visualization |
| Coach Portal | A separate web application for personal trainers to review client recordings and manage plans |
| Compound Exercise | An exercise that targets 3 or more muscle groups simultaneously (e.g., squat, deadlift) |
| Dropset | A set type where the weight decreases on each successive set without rest |
| Exercise Library | The curated catalog of 100+ exercises with metadata, seeded from bundled JSON |
| Fatigue Percent | A 0-100 score representing how fatigued a muscle group is, based on recent training volume and time since last worked |
| Form Recording | A short video clip of the user performing an exercise, captured during a workout for technique review |
| Giant Set | Three or more exercises performed back-to-back without rest between them |
| GPS Privacy Zone | A circular area around a sensitive location (home, work) where GPS points are excluded from shared data |
| Hypertrophy | Training goal focused on muscle size growth, typically using 4 sets of 8-12 reps |
| Isolation Exercise | An exercise that primarily targets 1-2 muscle groups (e.g., bicep curl, lateral raise) |
| Module | A self-contained feature set within the MyLife hub, registered via ModuleDefinition |
| Plate Calculator | A utility that shows which weight plates to load on each side of a barbell for a target weight |
| Player State | One of five states in the Workout Player Engine: idle, playing, paused, rest, completed |
| Progressive Overload | The gradual increase of training stimulus (weight, reps, volume) over time to drive adaptation |
| Pyramid Set | A set structure where reps increase then decrease (or vice versa) across sets |
| RPE (Rate of Perceived Exertion) | A 1-10 subjective scale of how hard a workout felt |
| Rest Timer | A configurable countdown between sets that alerts the user when rest is complete |
| Session | A single instance of performing a workout, with start/end times and per-exercise completion data |
| Set | One continuous round of an exercise (e.g., 10 reps of bench press = 1 set) |
| Split | A per-distance segment of a GPS activity with its own pace and elevation data |
| Superset | Two exercises performed back-to-back without rest between them |
| Table Prefix | The string prepended to all SQLite table names for this module (wk_) to avoid naming collisions |
| Voice Command | A spoken instruction recognized during a workout to control playback, pacing, or recording |
| Volume | The total training load, typically calculated as sets x reps x weight |
| Warmup Set | A lighter set performed before working sets to prepare muscles and joints |
| Working Weight | The target weight for the main (non-warmup) sets of an exercise |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (Spec Writer Agent) | Initial specification covering 30 features |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should GPS Route Recording live in MyWorkouts or a separate MyTrails module? | GPS tracking is a large feature that competes with Strava; may warrant its own module | Pending | - |
| 2 | Should the AI workout generator use Claude API for more sophisticated generation? | Rule-based engine is simpler but less personalized; Claude API adds cost and network dependency | Pending | - |
| 3 | What is the pricing for MyWorkouts standalone vs. as a MyLife module? | Standalone has Premium at $15/mo or $120/yr; MyLife Pro bundles all modules at $4.99/mo | Pending | - |
| 4 | Should custom user-created exercises be supported in v1? | Currently only seed exercises exist; users may want to add their own | Pending | - |
| 5 | Should social features require Supabase Auth or support anonymous sharing? | Social feed requires user identity; anonymous sharing via share sheet does not | Pending | - |
| 6 | What is the maximum number of privacy zones a user can create? | Need to balance flexibility with UI complexity | Pending | - |
| 7 | Should the warmup calculator account for the user's training history? | Currently uses fixed percentages; could personalize based on historical warmup preferences | Pending | - |

