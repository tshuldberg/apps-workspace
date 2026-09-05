# MyFilms - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-myfilms agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyFilms
- **Tagline:** Your private film diary
- **Module ID:** `films`
- **Feature ID Prefix:** `FM`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Casual Viewer | Ages 18-35, watches 2-5 films/week across streaming and theaters, uses phone primarily | Keep a record of what they watched, rate favorites, maintain a "to watch" list |
| Film Enthusiast | Ages 25-55, watches 5+ films/week, curates personal rankings and collections | Deep viewing analytics, detailed reviews, year-in-review, director/actor filmographies, decade browsing |
| Letterboxd Migrant | Ages 20-40, currently uses Letterboxd, concerned about data ownership | Import existing Letterboxd data, replicate core tracking features locally, full data export |
| Privacy-Conscious Viewer | Any age, does not want streaming services or third parties aggregating viewing history | Full data ownership, no tracking, no cross-platform viewing profile assembled by third parties |
| Film Student/Critic | Ages 18-35, watches films analytically, writes detailed reviews | Structured reviews, tags for thematic analysis, filmmaker browsing, genre/decade statistics |

### 1.3 Core Value Proposition

MyFilms is a privacy-first film diary and tracker that keeps all viewing data on-device in local storage. Users log films they watch, assign half-star ratings (0.5-5.0), write personal reviews, build watchlists with priority ordering, create themed collections, and analyze viewing habits through rich statistics and year-in-review. Unlike Letterboxd (which requires a cloud account and stores all data on their servers), MyFilms never transmits viewing history, ratings, or reviews to any third party. Film metadata is fetched from TMDb (The Movie Database, a free community-driven API) but no personal viewing data is ever sent. Your film diary is yours alone.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Letterboxd | Large community (15M+ users), social discovery, excellent UI, curated lists | Requires cloud account, all data on Letterboxd servers, premium features behind $19-49/yr paywall, social is core (not optional) | Full privacy, offline-first, no account required, no subscription needed for stats/lists |
| IMDb | Massive database, industry standard, user reviews | Owned by Amazon, heavy advertising, limited personal tracking, no diary feature | No ads, no Amazon data collection, dedicated diary/tracking focus |
| Trakt | Multi-platform tracking (films + TV), scrobbling, detailed stats | Cloud-only, complex UI, requires integrations for full value | Simpler UX, offline-first, no integrations required |
| JustWatch | Excellent streaming availability data, cross-platform | Not a tracking app, limited personal library features | Full tracking and diary, streaming data as supplemental feature |
| Serializd | Clean UI, modern design | Small community, limited features, cloud-only | Feature-complete offline tracking, no dependency on service survival |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export (CSV, JSON) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export
- Film metadata is fetched from TMDb API but no user viewing data is transmitted
- Search queries sent to TMDb contain only the search term (title), never user identity or viewing history
- No streaming service or third party can reconstruct a user's complete viewing history
- Ratings, reviews, diary entries, and watchlist content never leave the device

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| FM-001 | Film Logging | P0 | Core | None | Not Started |
| FM-002 | TMDb Search and Metadata | P0 | Core | FM-001 | Not Started |
| FM-003 | Watchlist | P0 | Core | FM-001 | Not Started |
| FM-004 | Ratings and Reviews | P0 | Core | FM-001 | Not Started |
| FM-005 | Collections and Lists | P0 | Data Management | FM-001 | Not Started |
| FM-006 | Search and Filtering | P0 | Data Management | FM-001 | Not Started |
| FM-007 | Film Diary Calendar | P1 | Core | FM-001 | Not Started |
| FM-008 | Viewing Statistics | P1 | Analytics | FM-001, FM-004 | Not Started |
| FM-009 | Year-in-Review | P1 | Analytics | FM-008 | Not Started |
| FM-010 | Ratings Histogram | P1 | Analytics | FM-004 | Not Started |
| FM-011 | Actor and Director Browsing | P1 | Data Management | FM-001, FM-002 | Not Started |
| FM-012 | Tags and Categorization | P1 | Data Management | FM-001 | Not Started |
| FM-013 | Letterboxd CSV Import | P1 | Import/Export | FM-001 | Not Started |
| FM-014 | Data Export (CSV/JSON) | P1 | Import/Export | FM-001 | Not Started |
| FM-015 | Rewatch Tracking | P1 | Core | FM-001 | Not Started |
| FM-016 | Decade Browsing | P1 | Data Management | FM-001 | Not Started |
| FM-017 | Settings and Preferences | P0 | Settings | None | Not Started |
| FM-018 | Onboarding and First-Run | P1 | Onboarding | FM-001 | Not Started |
| FM-019 | IMDb CSV Import | P2 | Import/Export | FM-001 | Not Started |
| FM-020 | Film Goals and Challenges | P2 | Analytics | FM-001, FM-008 | Not Started |
| FM-021 | Streaming Availability | P2 | Core | FM-001, FM-002 | Not Started |

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

### FM-001: Film Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-001 |
| **Feature Name** | Film Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a casual viewer, I want to log films I have watched with the date I saw them, so that I can keep a complete record of my viewing history.

**Secondary:**
> As a film enthusiast, I want to add films to my library with detailed metadata (director, cast, runtime, genres), so that I can browse and analyze my collection by any dimension.

**Tertiary:**
> As a privacy-conscious viewer, I want all my film data stored entirely on my device, so that no streaming service or third party can reconstruct my viewing profile.

#### 3.3 Detailed Description

Film Logging is the foundational feature of MyFilms. It provides the ability to create, read, update, and delete film records in local persistent storage. Every film record stores comprehensive metadata including title, original title (for foreign films), director(s), cast (top-billed actors), release year, runtime in minutes, genres, language, country of origin, poster image URL (with optional local cache path), synopsis, TMDb identifier, and the source of how the film was added (manual entry, TMDb search, import, or barcode scan).

Users can add films in three ways: searching the TMDb API (FM-002), manual entry (typing in details directly), or importing from a CSV file (FM-013). Each method sets the `added_source` field accordingly so the user can see how each film entered their library.

When a user logs a film as "watched," they set the watched date (defaulting to today), and optionally assign a half-star rating (0.5-5.0) and write a review at the same time. If a user has not yet watched a film but wants to record it, they add it with a status of "want_to_watch" (which also appears on the watchlist). This dual-status approach means the film library is the single source of truth for all films the user interacts with, whether watched or not.

The library view displays all films in a scrollable list or grid, sortable by title, watched date, release year, runtime, rating, or date added. Users can filter by genre, decade, watch status, and rating range. The library supports both a compact list view (poster thumbnail, title, year, rating) and a poster grid view (poster image fills card, title overlaid at bottom).

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local persistent storage for the database
- File system access for cached poster images

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable
- Device has sufficient storage for film records and cached poster images

#### 3.5 User Interface Requirements

##### Screen: Film Library

**Layout:**
- Top navigation bar displays "Films" title and a count badge showing total films (e.g., "Films (142)")
- Right side of nav bar has an "Add" button (plus icon) that opens an action sheet with options: "Search TMDb", "Add Manually"
- Below the nav bar is a filter/sort toolbar with: a search text input (filters library by title substring when 2+ characters are entered), a sort dropdown (Title A-Z, Title Z-A, Date Watched, Date Added, Release Year, Runtime, Rating), a view toggle (list/grid), and filter chips for genre, decade, and watch status
- Main content area displays films in the selected view mode (list or grid)
- In list view: each row shows poster thumbnail (40x60px), title (bold, single line, truncated), release year in parentheses, director name (secondary text, single line), and half-star rating display (if rated)
- In grid view: poster image fills card (3 columns on phone, 4 on tablet, 5 on desktop), title overlaid at bottom of poster with semi-transparent background, rating shown as stars overlaid at top-right corner
- Pull-to-refresh recalculates any computed data and reloads the list

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No films in library | Centered illustration of a film reel, heading "Your film library is empty", subtext "Log your first film to get started", primary button "Search for a Film", secondary button "Add Manually" |
| Loading | Database query in progress | Skeleton placeholders matching list/grid layout |
| Populated | 1+ films exist | Scrollable list/grid of film items |
| Error | Database read fails | Inline error banner: "Could not load your film library. Pull down to retry." |
| Search Active | User types in search bar | Filtered results by title substring; if no matches: "No films matching '[query]'" |

**Interactions:**
- Tap film item: navigates to Film Detail screen
- Long press film item: opens context menu with "Edit", "Add to Collection", "Delete"
- Swipe left on list item: reveals "Delete" action (red)
- Pull-to-refresh: reloads film list from database

**Transitions/Animations:**
- Items animate out when deleted with a fade + slide-left, 200ms duration
- View mode toggle (list/grid) cross-fades, 150ms duration
- New items animate in from the top of the list when added

##### Screen: Film Detail

**Layout:**
- Full-width poster image at top (if available), otherwise a colored placeholder with the film's first letter and a film strip pattern
- Below poster: title (large, bold), original title (if different, medium, italic, secondary color), director(s) (tappable, secondary text)
- Metadata row: release year, runtime formatted as "Xh Ym" (e.g., "2h 28m"), genre chips (horizontal scrollable), language, country
- Horizontal divider
- Watch status badge (color-coded: gray for want_to_watch, green for watched)
- Watched date display (if watched): "Watched on [date]" formatted as "March 5, 2026"
- Rewatch count (if rewatched): "Watched 3 times" with a small rewatch icon
- Cast section: horizontal scrollable list of top 10 cast members, each showing name and character name
- Rating display: half-star rating (if rated), tap to rate/edit. Stars rendered at 32px, filled/half/empty states
- Review section: review text (if exists), "Write Review" button if no review exists
- Collections section: horizontal scrollable chips showing assigned collections, plus "+" chip to add to collection
- Tags section: horizontal scrollable chips showing assigned tags, plus "+" chip to add tag
- Action buttons row: "Edit", "Share", "Delete"
- Synopsis section (collapsible): full film synopsis, collapsed to 3 lines by default with "Read more" toggle

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Complete | All metadata present | Full detail view as described |
| Minimal | Only title and year | Detail view with empty sections collapsed |
| With Poster | Poster URL exists | Poster image rendered from URL or cache |
| Without Poster | No poster URL | Colored placeholder with initial letter and film strip pattern |
| Watched | Status is watched | Green status badge, watched date shown, rating section enabled |
| Unwatched | Status is want_to_watch | Gray status badge, "Mark as Watched" button shown, rating section hidden |

**Interactions:**
- Tap "Edit": opens Edit Film modal
- Tap director name: navigates to Director filmography view (FM-011)
- Tap cast member: navigates to Actor filmography view (FM-011)
- Tap genre chip: filters library to films in that genre
- Tap "Mark as Watched": opens watched date picker (defaults to today), then changes status
- Tap rating stars: opens half-star rating picker
- Tap "Delete": confirmation dialog ("Delete '[film title]'? This will remove the film and all associated ratings, reviews, tags, and collection assignments. This cannot be undone."), then removes film and all related data
- Tap "Share": generates a share card with poster, title, year, director, and rating

##### Modal: Add Film Manually

**Layout:**
- Modal sheet sliding up from bottom
- Title: "Add Film"
- Form fields in scrollable view:
  - Title (required, text input, max 500 characters)
  - Original Title (optional, text input, max 500 characters, for foreign-language films)
  - Director(s) (optional, text input, comma-separated, max 1000 characters)
  - Release Year (optional, numeric input, min 1888, max current year + 2)
  - Runtime (optional, numeric input in minutes, min 1, max 1440)
  - Genres (optional, multi-select from predefined list of 20 genres)
  - Language (optional, text input, defaults to "en")
  - Country (optional, text input, max 255 characters)
  - Synopsis (optional, multiline text, max 5000 characters)
  - Poster URL (optional, text input for URL, or "Choose Image" button for local file)
  - Watch Status (segmented control: "Watched" / "Want to Watch", default "Watched")
  - Watched Date (date picker, shown only when status is "Watched", defaults to today)
  - Rating (half-star picker, 0.5-5.0, shown only when status is "Watched", optional)
- Footer: "Cancel" button (left) and "Save" button (right, disabled until title is filled)

**Interactions:**
- Tap "Save": validates fields, generates UUID, inserts film record, closes modal, navigates to new Film Detail screen
- Tap "Cancel": dismisses modal with confirmation if form has unsaved data ("Discard unsaved changes?")
- Inline validation: title field shows "Title is required" if blurred while empty
- Toggling watch status to "Want to Watch" hides the watched date and rating fields
- Toggling watch status to "Watched" shows the watched date (defaults to today) and rating fields

##### Modal: Edit Film

**Layout:**
- Same form fields as Add Film Manually, pre-populated with existing values
- Title: "Edit Film"
- Footer: "Cancel" and "Save Changes"

**Interactions:**
- Tap "Save Changes": validates, updates film record, closes modal, refreshes Film Detail screen
- Fields that changed are highlighted with a subtle indicator

#### 3.6 Data Requirements

##### Entity: Film

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| title | TEXT | Required, min 1 char after trim | None | Film title |
| original_title | TEXT | Optional | null | Original title for foreign-language films |
| directors | TEXT | Optional, JSON array as string | null | Director names as JSON array, e.g., '["Christopher Nolan"]' |
| cast | TEXT | Optional, JSON array of objects as string | null | Top-billed cast as JSON array, e.g., '[{"name":"Leonardo DiCaprio","character":"Cobb"}]' |
| release_year | INTEGER | Optional, 1888-2100 | null | Year of theatrical release |
| runtime_minutes | INTEGER | Optional, 1-1440 | null | Runtime in minutes |
| genres | TEXT | Optional, JSON array as string | null | Genre tags, e.g., '["Drama","Thriller"]' |
| language | TEXT | Optional | 'en' | ISO 639-1 language code |
| country | TEXT | Optional | null | Country of origin |
| synopsis | TEXT | Optional | null | Film synopsis or plot summary |
| poster_url | TEXT | Optional, valid URL | null | URL to poster image (from TMDb: image.tmdb.org/t/p/w500/{path}) |
| poster_cached_path | TEXT | Optional | null | Local file path to cached poster image |
| tmdb_id | INTEGER | Optional, unique if present | null | TMDb movie identifier |
| imdb_id | TEXT | Optional | null | IMDb identifier (e.g., "tt1375666") |
| watch_status | TEXT | One of: 'watched', 'want_to_watch' | 'want_to_watch' | Current watch status |
| watched_date | TEXT | Optional, ISO date (YYYY-MM-DD) | null | Date the film was watched (null if want_to_watch) |
| added_source | TEXT | One of: 'search', 'manual', 'import_letterboxd', 'import_imdb' | 'manual' | How the film was added to the library |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Film has many Rating records (one per watch/rewatch, via FM-004)
- Film has many Review records (one per watch/rewatch, via FM-004)
- Film has many CollectionFilm join records (many-to-many with Collection, via FM-005)
- Film has many FilmTag join records (many-to-many with Tag, via FM-012)
- Film has many DiaryEntry records (one per watch event, via FM-007)
- Film has many Rewatch records (via FM-015)

**Indexes:**
- `tmdb_id` (unique where not null) - Deduplication on TMDb search/import
- `imdb_id` - Deduplication on IMDb import
- `title COLLATE NOCASE` - Sorted listing by title (case-insensitive)
- `watched_date` - Diary calendar queries and date-range filtering
- `release_year` - Decade browsing and year-based sorting
- `watch_status` - Filtering watched vs. want_to_watch

**Validation Rules:**
- `title`: Must not be empty string after trimming whitespace
- `release_year`: If provided, must be between 1888 (first known film) and current year + 2
- `runtime_minutes`: If provided, must be between 1 and 1440 (24 hours)
- `watch_status`: Must be one of the allowed enum values
- `watched_date`: If `watch_status` is 'watched', should not be null; if 'want_to_watch', should be null
- `added_source`: Must be one of the allowed enum values
- `genres`: If provided, must be a valid JSON array of strings

**Example Data:**

```json
{
  "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "title": "Inception",
  "original_title": null,
  "directors": "[\"Christopher Nolan\"]",
  "cast": "[{\"name\":\"Leonardo DiCaprio\",\"character\":\"Cobb\"},{\"name\":\"Joseph Gordon-Levitt\",\"character\":\"Arthur\"},{\"name\":\"Elliot Page\",\"character\":\"Ariadne\"}]",
  "release_year": 2010,
  "runtime_minutes": 148,
  "genres": "[\"Science Fiction\",\"Action\",\"Thriller\"]",
  "language": "en",
  "country": "United States",
  "synopsis": "A thief who enters the dreams of others to steal secrets from their subconscious is offered a chance to have his criminal history erased.",
  "poster_url": "https://image.tmdb.org/t/p/w500/ljsZTbVsrQSqNgWeRnEMb3XTiqq.jpg",
  "poster_cached_path": "/data/posters/f1a2b3c4.jpg",
  "tmdb_id": 27205,
  "imdb_id": "tt1375666",
  "watch_status": "watched",
  "watched_date": "2026-01-15",
  "added_source": "search",
  "created_at": "2026-01-15T20:30:00Z",
  "updated_at": "2026-01-15T20:35:00Z"
}
```

#### 3.7 Business Logic Rules

##### Film Deduplication

**Purpose:** Prevent the same film from being added twice to the library.

**Inputs:**
- new_tmdb_id: integer (optional)
- new_imdb_id: string (optional)
- new_title: string
- new_release_year: integer (optional)

**Logic:**

```
1. IF new_tmdb_id is provided THEN
     Query: SELECT id FROM films WHERE tmdb_id = new_tmdb_id
     IF result exists THEN RETURN "duplicate" with existing film ID
2. IF new_imdb_id is provided THEN
     Query: SELECT id FROM films WHERE imdb_id = new_imdb_id
     IF result exists THEN RETURN "duplicate" with existing film ID
3. Query: SELECT id FROM films WHERE title = new_title COLLATE NOCASE
   IF result exists AND release_year matches (or both null) THEN
     RETURN "possible_duplicate" with existing film ID (let user decide)
4. RETURN "unique" (no duplicate found)
```

**Edge Cases:**
- Different cuts of the same film (theatrical vs. director's cut): treated as separate films if they have different TMDb IDs
- Same title, different release years (remakes): not flagged as duplicates
- Whitespace-only differences in title: trimmed before comparison
- Films with no TMDb ID (manually added): rely on title + year matching only

##### Poster Image Caching

**Purpose:** Cache poster images locally so they display without network access.

**Logic:**

```
1. When a film with poster_url is displayed and poster_cached_path is null:
2. Download image from poster_url to local file system
3. Store local path in poster_cached_path
4. Display from local cache on subsequent views
5. IF download fails, display poster_url directly (requires network)
6. IF both fail, show placeholder with film initial letter
```

**Edge Cases:**
- Extremely large poster files (>5 MB): skip caching, display from URL only
- Disk space insufficient: skip caching, display from URL only
- Cached file deleted by OS (storage pressure): re-download on next view

##### Runtime Formatting

**Purpose:** Convert runtime in minutes to a human-readable "Xh Ym" string.

**Inputs:**
- runtime_minutes: integer

**Logic:**

```
1. IF runtime_minutes is null or 0 THEN RETURN empty string
2. hours = floor(runtime_minutes / 60)
3. minutes = runtime_minutes mod 60
4. IF hours > 0 AND minutes > 0 THEN RETURN "{hours}h {minutes}m"
5. IF hours > 0 AND minutes == 0 THEN RETURN "{hours}h"
6. IF hours == 0 THEN RETURN "{minutes}m"
```

**Edge Cases:**
- Runtime of 0: display nothing (do not show "0m")
- Runtime of 60: display "1h" (not "1h 0m")
- Runtime > 600 (10+ hours, e.g., some experimental films): display normally (e.g., "10h 30m")

**Sort/Filter/Ranking Logic:**
- **Default sort:** Date added (most recent first)
- **Available sort options:** Title A-Z, Title Z-A, Date Watched (newest), Date Watched (oldest), Date Added (newest), Date Added (oldest), Release Year (newest), Release Year (oldest), Runtime (longest), Runtime (shortest), Rating (highest), Rating (lowest)
- **Filter options:** Watch status (watched/want_to_watch), Genre (multi-select), Decade (1920s-2020s), Rating range (0.5-5.0 slider). Filters are combinable (AND logic).
- **Search:** Substring matching on title and original_title fields. Case-insensitive. Minimum 2 characters to activate.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on add | Toast: "Could not save film. Please try again." | User taps retry or re-submits form |
| Database write fails on edit | Toast: "Could not update film. Please try again." | User taps retry |
| Required field left blank | Inline validation below field: "Title is required" | User fills field, error clears on input |
| Duplicate TMDb ID detected | Dialog: "This film may already be in your library. View existing?" with "View" and "Add Anyway" buttons | User chooses to view existing or force add |
| Poster image download fails | Placeholder image shown with film initial, no error toast | System retries on next view |
| Invalid runtime value | Inline validation: "Runtime must be between 1 and 1440 minutes" | User corrects value |
| Invalid release year | Inline validation: "Year must be between 1888 and [current year + 2]" | User corrects value |

**Validation Timing:**
- Field-level validation runs on blur (when the user leaves the field)
- Form-level validation runs on save button tap
- Deduplication check runs on save, before insert

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the film library is empty,
   **When** the user taps "Add" then "Add Manually", fills in title "Inception" and taps Save,
   **Then** a new film record is created with status "want_to_watch", the library shows 1 film, and the user is navigated to the Film Detail screen.

2. **Given** a film exists with status "want_to_watch",
   **When** the user opens the Film Detail screen and taps "Mark as Watched", selects today's date, and confirms,
   **Then** the film's watch_status changes to "watched", watched_date is set to today, and the status badge turns green.

3. **Given** a film exists in the library,
   **When** the user taps the film, then taps "Edit", changes the title, and saves,
   **Then** the film title is updated in the database and reflected everywhere in the UI.

4. **Given** a film exists in the library,
   **When** the user taps the film, then taps "Delete" and confirms,
   **Then** the film and all its related records (ratings, reviews, tags, collection assignments, diary entries) are deleted.

**Edge Cases:**

5. **Given** a film with TMDb ID 27205 already exists,
   **When** the user attempts to add another film with TMDb ID 27205,
   **Then** the system shows a duplicate detection dialog before allowing the add.

6. **Given** the user is adding a film manually,
   **When** the user enters a release year of 1800,
   **Then** inline validation shows "Year must be between 1888 and [current year + 2]" and the save button remains disabled.

7. **Given** the library contains 1000+ films,
   **When** the user opens the library,
   **Then** the initial page of films loads within 500ms with smooth scrolling through the full list.

**Negative Tests:**

8. **Given** the add film form is open,
   **When** the user leaves the title field blank and taps Save,
   **Then** the system shows "Title is required" below the title field and does not create a record.

9. **Given** the add film form has unsaved changes,
   **When** the user taps "Cancel",
   **Then** a confirmation dialog appears ("Discard unsaved changes?") and no data is saved unless the user confirms.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| formats runtime hours and minutes | runtime_minutes: 148 | "2h 28m" |
| formats runtime hours only | runtime_minutes: 120 | "2h" |
| formats runtime minutes only | runtime_minutes: 45 | "45m" |
| returns empty for null runtime | runtime_minutes: null | "" |
| returns empty for zero runtime | runtime_minutes: 0 | "" |
| detects duplicate by TMDb ID | tmdb_id: 27205 (exists) | { status: "duplicate", existingId: "..." } |
| detects possible duplicate by title+year | title: "Inception", year: 2010 (exists) | { status: "possible_duplicate", existingId: "..." } |
| allows same title different year | title: "Dune", year: 2021 (exists: "Dune" 1984) | { status: "unique" } |
| validates title not empty | title: "   " | validation error: "Title is required" |
| validates release year minimum | release_year: 1800 | validation error: "Year must be between 1888 and ..." |
| validates runtime range | runtime_minutes: 1500 | validation error: "Runtime must be between 1 and 1440 minutes" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add film and verify in library | 1. Open add form, 2. Fill title "Parasite" and year 2019, 3. Save, 4. Return to library | Film "Parasite" appears in the library list with year 2019 |
| Delete film and verify removal | 1. Add a film, 2. Open detail, 3. Delete with confirmation, 4. Return to library | Film no longer appears in library; count decremented by 1 |
| Edit film and verify update | 1. Add a film, 2. Open detail, 3. Edit title from "Inception" to "INCEPTION", 4. Save | Title updates to "INCEPTION" on detail screen and in library list |
| Mark as watched | 1. Add film with want_to_watch status, 2. Open detail, 3. Tap "Mark as Watched", 4. Select date | Status changes to watched, watched_date set, badge turns green |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user logs their first film | 1. Open app (empty state), 2. Tap "Add Manually", 3. Enter title "The Shawshank Redemption", year 1994, status "Watched", watched date "2026-01-01", 4. Save | Library shows 1 film, detail screen shows all entered data, empty state is gone |
| User builds a small library | 1. Add 5 films via manual entry, 2. Sort by release year, 3. Filter by genre | Films sort correctly by year; filter shows only matching films; count badge reflects filter |

---

### FM-002: TMDb Search and Metadata

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-002 |
| **Feature Name** | TMDb Search and Metadata |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a casual viewer, I want to search for films by title and have all metadata filled in automatically, so that I do not have to type in director, cast, runtime, and genres manually.

**Secondary:**
> As a film enthusiast, I want to see TMDb metadata including poster images, full cast lists, and synopses, so that my film library is rich and visually appealing without manual data entry.

#### 3.3 Detailed Description

TMDb Search and Metadata provides the primary method for adding films to the library. Instead of typing in all film details manually, users type a film title into a search bar, the app queries the TMDb (The Movie Database) API, and displays matching results. The user taps a result to view full details, then confirms to add it to their library with all metadata pre-filled.

TMDb is a free, community-driven film database API (similar to IMDb but open and free for non-commercial use). It provides comprehensive metadata including title, original title, release date, runtime, genres, cast, crew, synopsis, poster images, and external IDs (IMDb). The API requires an API key but does not require user authentication, and the only data sent to TMDb is the search query (a film title or keywords). No personal viewing data, ratings, or user identity is ever transmitted.

The search flow works as follows: the user types a query, the app sends a request to TMDb's search endpoint (`/search/movie?query=X`), results are displayed as a scrollable list with poster thumbnails and basic info, the user taps a result, the app fetches full details from TMDb's detail endpoint (`/movie/{id}` with `append_to_response=credits`), and a confirmation screen shows the complete metadata before the user saves it to their library.

Metadata fetched from TMDb is cached locally so that subsequent views of the same film do not require network access. Poster images are downloaded and cached to local storage for offline viewing.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - The film record structure must exist to store fetched metadata

**External Dependencies:**
- Network access for TMDb API queries
- TMDb API key (embedded in the app, free tier supports up to 40 requests per 10 seconds)

**Assumed Capabilities:**
- Device has network connectivity (feature degrades gracefully without it)
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: TMDb Search

**Layout:**
- Top section: large search text input with placeholder "Search films..." and a clear button (X) on the right
- Below search input: "Powered by TMDb" attribution text (required by TMDb API terms of use, small, secondary color)
- Results area: scrollable vertical list of search results
- Each result row shows: poster thumbnail (40x60px, or placeholder if no poster), title (bold, single line), release year in parentheses, and a brief synopsis (2 lines max, truncated)
- Results are ordered by TMDb relevance score (default API ordering)
- Below the last result: "Showing X of Y results" text if more results are available, with a "Load More" button to fetch the next page

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Initial | Screen just opened, no query entered | Centered placeholder text: "Type a film title to search TMDb" with a film search icon |
| Searching | Query submitted, waiting for API response | Skeleton placeholders in list area (3-5 placeholder rows), subtle loading indicator |
| Results | API returned 1+ results | Scrollable list of film results |
| No Results | API returned 0 results | Centered text: "No films found for '[query]'. Try a different title or check the spelling." with a "Search again" link |
| Error | Network request failed | Centered error icon, text: "Could not connect to TMDb. Check your internet connection.", "Retry" button, and "Add Manually" fallback link |
| Offline | Device has no network | Banner at top: "You are offline. Search requires an internet connection.", with "Add Manually" fallback button |

**Interactions:**
- Typing in search input: triggers search after a 500ms debounce (no search on every keystroke)
- Tap search result: navigates to TMDb Film Preview screen
- Tap "Load More": fetches next page of results (TMDb paginates at 20 results per page)
- Tap "Add Manually": navigates to the manual add form (FM-001)
- Tap clear button (X): clears search input and returns to initial state

**Transitions/Animations:**
- Search results fade in as they load, 150ms stagger per row
- Transition from initial state to results is a cross-fade, 200ms

##### Screen: TMDb Film Preview

**Layout:**
- Full-width poster image at top (fetched from TMDb: `image.tmdb.org/t/p/w500/{poster_path}`)
- Below poster: title (large, bold), original title (if different, medium, italic), release year
- Metadata row: runtime as "Xh Ym", genre chips, language, country
- Director(s) listed below metadata row
- Cast section: horizontal scrollable list of top 10 cast members with name and character
- Synopsis section: full text, scrollable if long
- Horizontal divider
- Bottom action area:
  - Watch Status toggle: "Watched" / "Want to Watch" (segmented control, default "Watched")
  - Watched Date picker (shown only when "Watched" selected, defaults to today)
  - Rating picker (half-star, 0.5-5.0, shown only when "Watched" selected, optional)
  - "Add to Library" primary button (full width)
  - "Cancel" secondary link

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Fetching full details from TMDb | Poster area shows loading shimmer, metadata area shows skeleton text |
| Loaded | Full details received | Complete preview as described |
| Partial | Some metadata missing (e.g., no poster) | Layout adapts: missing sections are hidden, placeholder used for poster |
| Duplicate Detected | Film with same TMDb ID already in library | Banner at top: "This film is already in your library." with "View Existing" and "Add Anyway" buttons |
| API Error | Detail fetch failed | Error message: "Could not load film details. Please try again." with "Retry" button |

**Interactions:**
- Tap "Add to Library": runs deduplication check, then saves film record with all TMDb metadata populated, closes preview, navigates to Film Detail screen
- Tap "Cancel": returns to search results (search state preserved)
- Tap "View Existing": navigates to the existing film's detail screen (when duplicate detected)
- Toggle watch status: shows/hides watched date and rating fields

#### 3.6 Data Requirements

This feature uses the Film entity defined in FM-001. No additional entities are introduced.

**TMDb API Response Mapping:**

| TMDb Field | Film Entity Field | Notes |
|-----------|------------------|-------|
| title | title | Direct mapping |
| original_title | original_title | Only stored if different from title |
| release_date | release_year | Extract year from "YYYY-MM-DD" |
| runtime | runtime_minutes | Direct mapping (integer minutes) |
| genres[].name | genres | Mapped to JSON array of genre name strings |
| overview | synopsis | Direct mapping |
| poster_path | poster_url | Prefixed with "https://image.tmdb.org/t/p/w500/" |
| id | tmdb_id | TMDb integer identifier |
| imdb_id | imdb_id | From /movie/{id}/external_ids or detail response |
| credits.crew[job=Director].name | directors | Filtered to directors only, mapped to JSON array |
| credits.cast[0..9] | cast | Top 10 cast members with name and character |
| original_language | language | ISO 639-1 code |
| production_countries[0].name | country | First production country |

#### 3.7 Business Logic Rules

##### Search Debouncing

**Purpose:** Prevent excessive API calls while the user is still typing.

**Inputs:**
- query: string (current search input value)
- debounce_interval: 500ms

**Logic:**

```
1. User types a character in the search input
2. Cancel any pending search timer
3. Start a new timer for 500ms
4. WHEN timer fires:
   a. IF query length < 2 THEN do nothing (too short)
   b. IF query equals the last-searched query THEN do nothing (no change)
   c. ELSE send API request: GET /search/movie?query={encoded_query}&page=1
5. Store query as last-searched query
```

**Edge Cases:**
- User types and deletes quickly: no API call made
- User pastes a long string: single API call after 500ms debounce
- Empty query after clearing: reset to initial state, no API call

##### TMDb API Rate Limiting

**Purpose:** Respect TMDb's rate limit of 40 requests per 10 seconds.

**Logic:**

```
1. Maintain a sliding window of request timestamps (last 10 seconds)
2. Before each API request:
   a. Count requests in the last 10 seconds
   b. IF count >= 35 (conservative buffer) THEN
      Queue the request and retry after 1 second
   c. ELSE send request immediately
3. Log timestamp of sent request
```

**Edge Cases:**
- Rapid pagination (user scrolling through results fast): requests are queued
- Multiple concurrent searches (should not happen in normal UI, but guard against it)

##### Metadata Enrichment on Add

**Purpose:** Fetch full details (including credits) before saving to library.

**Inputs:**
- tmdb_id: integer (from search result)

**Logic:**

```
1. Send API request: GET /movie/{tmdb_id}?append_to_response=credits
2. Parse response into Film entity fields using the mapping table
3. For directors: filter credits.crew where job = "Director"
4. For cast: take first 10 entries from credits.cast
5. Construct poster_url as "https://image.tmdb.org/t/p/w500/" + poster_path
6. Run deduplication check (FM-001 logic)
7. IF unique: save film record
8. IF duplicate: show duplicate dialog
```

**Edge Cases:**
- Film has no director listed in credits: set directors to null
- Film has fewer than 10 cast members: store all available
- Film has no poster: set poster_url to null
- Film has no runtime (unreleased): set runtime_minutes to null

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Network unavailable | Banner: "You are offline. Search requires an internet connection." | "Add Manually" fallback button |
| TMDb API returns 401 (invalid key) | Error: "Search service is temporarily unavailable." | No user recovery; this is an app configuration issue |
| TMDb API returns 429 (rate limited) | Transparent retry with 1-second delay; if persistent: "Search is busy. Please wait a moment." | Auto-retry up to 3 times, then show error |
| TMDb API returns 500+ (server error) | Error: "TMDb is experiencing issues. Please try again later." with "Retry" button | User taps retry |
| Search query returns 0 results | "No films found for '[query]'. Try a different title or check the spelling." | User modifies query or adds manually |
| Detail fetch fails after search success | "Could not load film details. Please try again." with "Retry" button | User taps retry or goes back to results |
| Poster image URL is invalid/broken | Placeholder image shown | No retry for broken URLs; film still saves without poster |
| Timeout (>10 seconds) | "Request timed out. Check your connection." with "Retry" button | User taps retry |

**Validation Timing:**
- Search input: debounced validation (500ms delay)
- No form validation needed (all metadata comes from TMDb)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the TMDb Search screen,
   **When** the user types "Inception" and waits 500ms,
   **Then** the app sends a search request to TMDb and displays a list of results including "Inception (2010)".

2. **Given** search results are displayed,
   **When** the user taps "Inception (2010)",
   **Then** the app fetches full details from TMDb and displays the preview screen with title, poster, runtime "2h 28m", genres, director "Christopher Nolan", and top cast members.

3. **Given** the preview screen shows "Inception" with status set to "Watched" and date set to today,
   **When** the user taps "Add to Library",
   **Then** the film is saved with all TMDb metadata, the user is navigated to the Film Detail screen, and the film appears in the library list.

4. **Given** the user has no network connection,
   **When** the user opens the TMDb Search screen,
   **Then** a banner shows "You are offline. Search requires an internet connection." with an "Add Manually" fallback button.

**Edge Cases:**

5. **Given** the user searches for a very common title like "Love",
   **When** results are displayed,
   **Then** the first page shows 20 results with a "Load More" button to fetch additional pages.

6. **Given** a film has no poster in TMDb,
   **When** the user adds that film,
   **Then** the film is saved with poster_url as null, and a placeholder image is shown in the library.

**Negative Tests:**

7. **Given** the TMDb API is down,
   **When** the user searches for a film,
   **Then** an error message is displayed with a "Retry" button, and no partial data is saved.

8. **Given** a film with the same TMDb ID already exists in the library,
   **When** the user attempts to add it again from search results,
   **Then** a "This film is already in your library" banner appears with "View Existing" and "Add Anyway" options.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| maps TMDb response to film entity | TMDb API response for movie 27205 | Film entity with title "Inception", year 2010, runtime 148, etc. |
| extracts directors from credits crew | credits.crew array with job fields | JSON array of director names only |
| extracts top 10 cast from credits | credits.cast array with 50 entries | Array of first 10 entries with name and character |
| constructs poster URL from path | poster_path: "/ljsZTbVsrQSqNgWeRnEMb3XTiqq.jpg" | "https://image.tmdb.org/t/p/w500/ljsZTbVsrQSqNgWeRnEMb3XTiqq.jpg" |
| handles null poster path | poster_path: null | poster_url: null |
| extracts year from release date | release_date: "2010-07-16" | release_year: 2010 |
| handles missing release date | release_date: null | release_year: null |
| debounce prevents rapid API calls | 5 keystrokes in 200ms | Only 1 API call made (after final debounce) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Search and add film | 1. Type "Parasite", 2. Wait for results, 3. Tap result, 4. Tap "Add to Library" | Film saved with TMDb metadata, appears in library |
| Search with no results | 1. Type "xyznonexistentfilm123" | "No films found" message displayed |
| Add as want_to_watch | 1. Search "Dune", 2. Tap result, 3. Toggle to "Want to Watch", 4. Add | Film saved with watch_status "want_to_watch", no watched_date |
| Duplicate detection | 1. Add "Inception" via search, 2. Search "Inception" again, 3. Tap result | Duplicate banner shown on preview screen |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user adds first film via search | 1. Open app (empty), 2. Tap "Search for a Film", 3. Type "The Dark Knight", 4. Tap result, 5. Set as watched with today's date and 4.5 rating, 6. Add | Library has 1 film with poster, full metadata, rating 4.5, watched today |
| User adds a foreign film | 1. Search "Parasite", 2. Tap the 2019 Korean film result, 3. Add | Film saved with original_title in Korean, language "ko", country "South Korea" |

---

### FM-003: Watchlist

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-003 |
| **Feature Name** | Watchlist |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a casual viewer, I want to maintain a list of films I plan to watch, so that I never forget a recommendation or a film that caught my eye.

**Secondary:**
> As a film enthusiast, I want to prioritize films on my watchlist with ordering and notes, so that I can plan my viewing in a deliberate way.

#### 3.3 Detailed Description

The Watchlist is a dedicated view of all films in the library with a watch_status of "want_to_watch". It functions as a curated queue of films the user intends to watch. Rather than being a separate data structure, the watchlist is a filtered view of the film library, meaning any film marked as "want_to_watch" automatically appears here, and marking a watchlist film as "watched" removes it from this view.

Users can add films to the watchlist in several ways: searching TMDb and choosing "Want to Watch" (FM-002), manually adding a film with that status (FM-001), or changing an existing watched film back to "want_to_watch" (rare, but allowed). The watchlist supports custom ordering via a priority field (integer) so users can drag-and-drop to reorder their queue. Users can also add a personal note to each watchlist entry explaining why they want to watch it (e.g., "Recommended by Sarah" or "Sequel to Dune").

The watchlist displays films in a clean, prioritized list with poster thumbnails, titles, release years, and any attached notes. Users can sort by priority (custom order), date added, release year, or title. A "Pick for me" feature randomly selects a film from the watchlist when the user cannot decide what to watch next.

When a user marks a watchlist film as "watched," the app prompts them to optionally set a rating and write a review immediately, creating a smooth logging flow from intent to completion.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - The film record and watch_status field must exist

**External Dependencies:**
- Local persistent storage for the database

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Films can be added with watch_status "want_to_watch"

#### 3.5 User Interface Requirements

##### Screen: Watchlist

**Layout:**
- Top navigation bar displays "Watchlist" title and a count badge showing total watchlist films (e.g., "Watchlist (23)")
- Right side of nav bar has a "Pick for me" button (dice icon) that randomly selects a film
- Below the nav bar is a sort dropdown: Priority (custom), Date Added, Release Year, Title A-Z
- Main content area is a scrollable vertical list of watchlist films
- Each row shows: drag handle (three horizontal lines, left edge), poster thumbnail (40x60px), title (bold, single line), release year in parentheses, and personal note preview (if exists, secondary text, single line, truncated)
- Below each film row, if a note exists: note text in secondary color, italic, truncated to 1 line with ellipsis
- At the bottom of the list: "Add Films" button linking to TMDb Search

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No films with want_to_watch status | Centered illustration of an empty movie ticket, heading "Your watchlist is empty", subtext "Add films you want to watch", primary button "Search for Films" |
| Populated | 1+ watchlist films | Sortable, reorderable list of films |
| Single Item | Exactly 1 film | Same as populated; "Pick for me" button is hidden (only 1 choice) |
| Reorder Mode | User initiated drag | Film row lifts with shadow, other rows shift to accommodate, haptic feedback on pickup and drop |

**Interactions:**
- Tap film row: navigates to Film Detail screen (FM-001)
- Long press film row: enters reorder mode (drag to reposition)
- Swipe right on film row: reveals "Watched" action (green) that marks the film as watched with today's date and opens a quick-rate sheet
- Swipe left on film row: reveals "Remove" action (red) that sets watch_status back to neutral or deletes the film (user preference in FM-017)
- Tap "Pick for me": animation spins through film titles for 1.5 seconds, then lands on a random selection, highlighting it with a pulse animation. Tapping the highlighted film navigates to its detail screen.
- Drag and drop: reorders films by updating their priority field. Priority values are re-normalized (1, 2, 3...) after each reorder.

**Transitions/Animations:**
- Swipe-to-watched: film row slides out to the right with a green checkmark animation, 300ms
- Pick for me: slot-machine style scroll through film titles, 1.5 seconds, easing out to the selected film
- Reorder drag: lifted item has 4px shadow, 1.05x scale; drop animation eases into final position, 200ms

##### Sheet: Quick Rate (after marking as watched)

**Layout:**
- Bottom sheet that appears after swiping to mark a film as watched
- Title: "You watched [Film Title]!"
- Half-star rating picker (0.5-5.0, initially unset)
- "Write a review" text link (opens full review editor from FM-004)
- "Done" button (saves whatever rating is set, or no rating if skipped)
- "Skip" link (marks as watched with no rating)

**Interactions:**
- Tap a star value: sets rating and enables "Done" button
- Tap "Done": saves the watched_date (today) and rating, removes film from watchlist view
- Tap "Skip": saves the watched_date (today) with no rating, removes film from watchlist view
- Tap "Write a review": opens the review editor; on review save, returns here and auto-taps "Done"

#### 3.6 Data Requirements

This feature uses the Film entity from FM-001 with two additional fields:

##### Extended Film Entity Fields (Watchlist)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| watchlist_priority | INTEGER | Optional, positive integer | null | Custom sort order within watchlist (1 = highest priority) |
| watchlist_note | TEXT | Optional, max 500 characters | null | Personal note about why this film is on the watchlist |

**Indexes:**
- `watchlist_priority` (where watch_status = 'want_to_watch') - Fast ordered retrieval of watchlist
- Compound index on `(watch_status, watchlist_priority)` - Filtered sorted query

**Validation Rules:**
- `watchlist_priority`: If provided, must be a positive integer (1 or greater)
- `watchlist_note`: If provided, must not exceed 500 characters
- When watch_status changes from 'want_to_watch' to 'watched': watchlist_priority is cleared (set to null)

**Example Data (watchlist film):**

```json
{
  "id": "w1x2y3z4-a5b6-7890-cdef-012345678901",
  "title": "Oppenheimer",
  "release_year": 2023,
  "watch_status": "want_to_watch",
  "watched_date": null,
  "watchlist_priority": 3,
  "watchlist_note": "Sarah said this was incredible. 3 hour runtime - save for a weekend.",
  "tmdb_id": 872585
}
```

#### 3.7 Business Logic Rules

##### Priority Reordering

**Purpose:** Maintain consistent priority ordering when films are reordered via drag-and-drop.

**Inputs:**
- film_id: string (the film being moved)
- new_position: integer (1-based target position)

**Logic:**

```
1. Get all watchlist films sorted by current priority
2. Remove the moved film from the list
3. Insert the moved film at new_position (1-based index)
4. Re-assign priority values sequentially: 1, 2, 3, ..., N
5. UPDATE each film's watchlist_priority in a single transaction
6. RETURN the updated list
```

**Edge Cases:**
- Moving to same position: no-op
- Moving to position 1 (top): all other films shift down by 1
- Moving to last position: all films between old and new position shift up by 1
- Film with null priority (newly added): assigned priority = max(current priorities) + 1

##### Random Film Selection ("Pick for Me")

**Purpose:** Randomly select a film from the watchlist to help indecisive users.

**Inputs:**
- watchlist_films: array of film records

**Logic:**

```
1. IF watchlist is empty THEN show empty state (should not reach here, button hidden)
2. IF watchlist has 1 film THEN select it immediately (button hidden in this state)
3. Generate a random index from 0 to length - 1 (uniform distribution)
4. The previously picked film (if any) is excluded from selection to avoid consecutive repeats
5. IF all films have been recently picked, reset the exclusion
6. RETURN the selected film
```

**Edge Cases:**
- Watchlist with exactly 2 films: alternates between them (no consecutive repeats)
- Watchlist changes between picks (film removed): re-index before picking
- All films picked recently: reset exclusion list

##### Mark as Watched Transition

**Purpose:** Transition a watchlist film to watched status with optional rating.

**Inputs:**
- film_id: string
- watched_date: date (defaults to today)
- rating: float (optional, 0.5-5.0 in 0.5 increments)

**Logic:**

```
1. UPDATE film SET watch_status = 'watched', watched_date = watched_date
2. SET watchlist_priority = null
3. SET watchlist_note = null (or preserve, based on user preference in FM-017)
4. IF rating is provided THEN create a Rating record (FM-004)
5. Re-normalize remaining watchlist priorities (close gaps)
6. RETURN updated film
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on reorder | Toast: "Could not save order. Your changes may not persist." | Revert to previous order in UI; retry on next interaction |
| Database write fails on mark watched | Toast: "Could not update film. Please try again." | Film remains in watchlist; user retries |
| Watchlist note exceeds 500 characters | Character counter turns red at 500, save button disabled | User shortens note |
| Pick-for-me with empty watchlist | Button is hidden (should never occur) | N/A |
| Concurrent modification (rare) | Last write wins; UI refreshes from database | Pull-to-refresh |

**Validation Timing:**
- Note character count validated on every keystroke (live counter)
- Priority reorder validated on drop (transaction-level)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user adds a film via TMDb Search with status "Want to Watch",
   **When** they navigate to the Watchlist tab,
   **Then** the film appears in the watchlist with the correct title, year, and poster.

2. **Given** the watchlist contains 5 films,
   **When** the user drags the 5th film to position 1,
   **Then** the film moves to the top, all other films shift down by 1, and priority values are updated to 1-5.

3. **Given** the watchlist contains 3 films,
   **When** the user swipes right on a film and the Quick Rate sheet appears, and the user taps a 4-star rating and "Done",
   **Then** the film's status changes to "watched", watched_date is today, rating is 4.0, and the film disappears from the watchlist (count decrements from 3 to 2).

4. **Given** the watchlist contains 10 films,
   **When** the user taps "Pick for me",
   **Then** a random film is highlighted after the selection animation, and tapping it navigates to the Film Detail screen.

**Edge Cases:**

5. **Given** the watchlist contains exactly 1 film,
   **When** the user views the watchlist,
   **Then** the "Pick for me" button is hidden since there is only one option.

6. **Given** a film on the watchlist has a personal note,
   **When** the user marks that film as watched,
   **Then** the watchlist_note is cleared (or preserved, based on settings) and watchlist_priority is set to null.

**Negative Tests:**

7. **Given** the user is editing a watchlist note,
   **When** the note exceeds 500 characters,
   **Then** the character counter turns red and the save button is disabled.

8. **Given** the user has an empty watchlist,
   **When** they navigate to the Watchlist tab,
   **Then** the empty state is shown with an "Add Films" call-to-action and no "Pick for me" button.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| re-normalizes priorities after reorder | films with priorities [1,2,3], move 3 to position 1 | priorities become [1,2,3] with moved film at position 1 |
| random pick excludes previous selection | watchlist [A,B,C], previous pick A | picked film is B or C (not A) |
| random pick with 2 films alternates | watchlist [A,B], previous pick A | picked film is B |
| clears watchlist fields on mark watched | film with priority 3 and note | priority null, note null, status "watched" |
| validates note length | note with 501 characters | validation error |
| validates note length at limit | note with 500 characters | validation passes |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add to watchlist via search | 1. Search TMDb, 2. Select "Want to Watch", 3. Add, 4. Go to Watchlist | Film appears in watchlist with correct priority |
| Reorder watchlist | 1. Add 3 films, 2. Drag film 3 to position 1, 3. Reload watchlist | Order persists after reload, priorities are 1, 2, 3 |
| Mark as watched from watchlist | 1. Swipe right on film, 2. Rate 4.0, 3. Tap Done | Film removed from watchlist, appears in library as watched |
| Add watchlist note | 1. Open film detail, 2. Add note "Recommended by friend", 3. Save, 4. View watchlist | Note preview shown in watchlist row |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Build and use watchlist | 1. Add 5 films as "Want to Watch", 2. Reorder them, 3. Mark top film as watched with 5-star rating | Watchlist has 4 films in correct order, library shows 5 films total with 1 watched and rated |
| Pick for me flow | 1. Add 3 films to watchlist, 2. Tap "Pick for me", 3. Film is selected, 4. Tap to view detail, 5. Mark as watched | Selected film is logged as watched, watchlist has 2 remaining |

---

### FM-004: Ratings and Reviews

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-004 |
| **Feature Name** | Ratings and Reviews |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a casual viewer, I want to rate films on a half-star scale (0.5 to 5.0), so that I can record how much I enjoyed each film and compare my opinions over time.

**Secondary:**
> As a film student/critic, I want to write detailed reviews with timestamps, so that I can capture my analysis and thoughts on each film and revisit them later.

**Tertiary:**
> As a film enthusiast, I want to rate a film differently on rewatches, so that I can track how my opinion of a film changes over time.

#### 3.3 Detailed Description

Ratings and Reviews gives users two complementary tools for recording their opinions on films: a half-star rating system and a free-form text review.

The rating system uses a half-star scale from 0.5 to 5.0 (10 possible values). This matches the granularity offered by Letterboxd and provides more nuance than a simple 5-star integer scale. Ratings are optional - users can log a film as watched without rating it. Users can also rate a film without writing a review. The rating is visually displayed as filled, half-filled, and empty star icons.

Reviews are free-form text entries up to 10,000 characters. Each review is timestamped and associated with a specific viewing (important for rewatches - see FM-015). Reviews can contain spoilers, which the user can flag via a "Contains Spoilers" toggle. Spoiler-flagged reviews are collapsed by default when viewing the film detail screen, requiring a deliberate tap to reveal.

When a film is rewatched, a new rating and/or review can be recorded for that specific viewing. The film detail screen shows all ratings and reviews chronologically, with the most recent at the top. The "primary" rating displayed on film cards and in statistics is the most recent rating, but users can view their complete rating history.

The rating picker is a horizontal row of 5 star icons. Tapping the left half of a star selects the half-star value; tapping the right half selects the full value. A "Clear" button below the stars removes the rating entirely. The current rating value is displayed as a number (e.g., "4.5") next to the stars for clarity.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records must exist to attach ratings and reviews to

**External Dependencies:**
- None (ratings and reviews are entirely local data)

**Assumed Capabilities:**
- User can navigate to a Film Detail screen
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Rating Picker (inline on Film Detail)

**Layout:**
- Section header: "Rating"
- Row of 5 star icons (each icon is 32x32 points, 4 points spacing between icons, total row width ~180 points)
- Below stars: numeric display of current rating value (e.g., "4.5 / 5.0") or "Not rated" if null
- "Clear" text button to the right of the numeric display (only visible when a rating exists)
- Below the rating row: "Write a Review" button if no review exists, or review preview (first 3 lines) if a review exists

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Not Rated | No rating exists for this film | 5 empty star outlines, text "Not rated" |
| Rated | Rating value between 0.5-5.0 | Stars filled to corresponding level (half-fill for .5 values), numeric value shown |
| Rating in Progress | User is interacting with stars | Stars update in real-time as finger/pointer moves across them |

**Interactions:**
- Tap left half of star N: sets rating to (N - 0.5), e.g., tapping left half of star 3 = 2.5
- Tap right half of star N: sets rating to N, e.g., tapping right half of star 3 = 3.0
- Tap "Clear": removes rating (sets to null), shows confirmation if a review also exists ("Remove rating? Your review will be kept.")
- Rating changes save immediately to the database (no separate save button)

**Transitions/Animations:**
- Stars fill/unfill with a 100ms scale pulse animation
- Clearing rating fades stars to empty outlines over 150ms

##### Modal: Review Editor

**Layout:**
- Modal sheet sliding up from bottom, full height (95% of screen)
- Title bar: "Review" on the left, "Done" button on the right
- Below title: film title and year as subtitle text (e.g., "Inception (2010)")
- Main area: multiline text input for the review body, placeholder "Write your thoughts..."
- Character counter in bottom-right: "0 / 10,000" (turns red at 9,500+)
- "Contains Spoilers" toggle switch at the bottom of the form
- If this is a rewatch review, a label at top: "Review for viewing on [date]"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New Review | No existing review for this viewing | Empty text input with placeholder |
| Editing | Existing review being modified | Pre-populated text, original preserved until save |
| At Limit | Character count >= 9,500 | Character counter turns red |
| Over Limit | Character count > 10,000 | Counter shows "10,050 / 10,000" in red, Done button disabled |

**Interactions:**
- Tap "Done": saves review to database, closes modal, returns to Film Detail
- Tap outside modal or swipe down: if text changed, shows "Discard changes?" confirmation; otherwise dismisses
- Toggle "Contains Spoilers": sets the spoiler flag on the review record
- Typing: character counter updates in real-time

**Transitions/Animations:**
- Modal slides up from bottom, 250ms spring animation
- On save, modal slides down with a brief success haptic

##### Screen: Rating History (on Film Detail, expandable)

**Layout:**
- Section header: "Rating History" (only shown if 2+ ratings exist for this film)
- Each entry row shows: date (e.g., "Jan 15, 2026"), star rating (compact, 16px stars), review preview (1 line, or "No review" in secondary text)
- Entries sorted by date, most recent first
- Tap entry row: expands to show full review text inline

#### 3.6 Data Requirements

##### Entity: Rating

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film this rating belongs to |
| rating_value | REAL | Optional, 0.5-5.0, step 0.5 | null | Half-star rating (null means logged without rating) |
| review_text | TEXT | Optional, max 10,000 characters | null | Free-form review text |
| contains_spoilers | INTEGER | 0 or 1 | 0 | Whether the review contains spoilers |
| viewing_date | TEXT | ISO date (YYYY-MM-DD), required | Current date | Date of the viewing this rating corresponds to |
| is_rewatch | INTEGER | 0 or 1 | 0 | Whether this is a rewatch rating (see FM-015) |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Rating belongs to Film (many-to-one via film_id)
- A film can have many Ratings (one per viewing)

**Indexes:**
- `film_id` - Look up all ratings for a film
- `film_id, viewing_date DESC` - Most recent rating first (for "primary" rating display)
- `rating_value` - Statistics queries (average, distribution)

**Validation Rules:**
- `film_id`: Must reference an existing Film record
- `rating_value`: If provided, must be one of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
- `review_text`: If provided, length must be <= 10,000 characters after trimming
- `viewing_date`: Must be a valid ISO date, must not be in the future (max = today)

**Example Data:**

```json
{
  "id": "r1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "film_id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "rating_value": 4.5,
  "review_text": "Nolan's masterwork. The layered dream heist concept is executed with precision, and the emotional core with Cobb and Mal gives it weight beyond spectacle.",
  "contains_spoilers": 0,
  "viewing_date": "2026-01-15",
  "is_rewatch": 0,
  "created_at": "2026-01-15T21:00:00Z",
  "updated_at": "2026-01-15T21:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Primary Rating Selection

**Purpose:** Determine which rating to display as the "primary" rating for a film on cards, in lists, and for statistics.

**Inputs:**
- film_id: UUID
- ratings: array of Rating records for this film

**Logic:**

```
1. Query: SELECT rating_value FROM ratings
   WHERE film_id = {film_id} AND rating_value IS NOT NULL
   ORDER BY viewing_date DESC, created_at DESC
   LIMIT 1
2. IF result exists THEN RETURN result.rating_value
3. ELSE RETURN null (film is unrated)
```

**Edge Cases:**
- Film with multiple viewings but only one rated: the one rated viewing is the primary rating
- Film rated 3.0, then rewatched and rated 4.5: primary rating is 4.5 (most recent)
- Film rated 4.0 on first watch, rewatched but not re-rated: primary rating remains 4.0

##### Rating Value Validation

**Purpose:** Ensure rating values are valid half-star increments.

**Inputs:**
- value: number

**Logic:**

```
1. IF value is null THEN RETURN valid (rating is optional)
2. IF value < 0.5 OR value > 5.0 THEN RETURN invalid
3. IF (value * 2) is not an integer THEN RETURN invalid
4. RETURN valid
```

**Formulas:**
- `is_valid_rating = value >= 0.5 AND value <= 5.0 AND (value * 2) % 1 === 0`

**Edge Cases:**
- 0.0 is not valid (minimum is 0.5; use null for "no rating")
- 5.5 and above are not valid
- 2.3 is not valid (not a half-star increment)

##### Spoiler Collapse Logic

**Purpose:** Determine whether a review should be collapsed behind a spoiler warning.

**Logic:**

```
1. IF review.contains_spoilers == 1 THEN
     Display collapsed view: "[Spoiler] Tap to reveal review"
     On tap: expand to show full review text
2. ELSE
     Display review text directly (first 3 lines in preview, full text in expanded view)
```

**Sort/Filter/Ranking Logic:**
- **Default sort for rating history:** Viewing date descending (most recent first)
- **Tiebreaker:** created_at descending
- **No filter/search within rating history:** All ratings for a film are shown

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on rating save | Toast: "Could not save rating. Please try again." | Rating reverts to previous value; user can re-tap |
| Database write fails on review save | Toast: "Could not save review. Please try again." | Review text is preserved in editor; user can tap Done again |
| Review exceeds 10,000 characters | Character counter turns red, Done button disabled | User deletes text until under limit |
| Invalid rating value (programmatic) | Should not occur in UI; logged as error | Rating is not saved; previous value retained |
| Film record deleted while review editor is open | Toast: "This film has been deleted." Modal closes | User is returned to library screen |

**Validation Timing:**
- Rating validation: immediate on tap (only valid half-star increments are selectable via the UI)
- Review character count: real-time as user types
- Review save validation: on Done button tap
- Spoiler flag: toggleable at any time, saves with review

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a watched film with no rating,
   **When** the user taps the right half of the 4th star,
   **Then** the rating is set to 4.0, stars fill to 4 of 5, and the numeric display shows "4.0 / 5.0".

2. **Given** a watched film with no review,
   **When** the user taps "Write a Review", types 500 characters, and taps Done,
   **Then** the review is saved, the Film Detail shows a 3-line preview, and the full review is visible on expand.

3. **Given** a film with a rating of 3.0,
   **When** the user taps the left half of the 5th star,
   **Then** the rating changes to 4.5 and the stars update immediately.

4. **Given** a film with 2 viewings (rated 3.0 on first, 4.5 on second),
   **When** the user views the Film Detail screen,
   **Then** the primary rating shows 4.5 and the "Rating History" section shows both entries.

**Edge Cases:**

5. **Given** a film rated 4.5,
   **When** the user taps "Clear" to remove the rating,
   **Then** the rating is set to null, stars show empty outlines, and the text shows "Not rated".

6. **Given** a review with "Contains Spoilers" toggled on,
   **When** another user views the Film Detail (or the user views it later),
   **Then** the review text is hidden behind a "[Spoiler] Tap to reveal review" label.

**Negative Tests:**

7. **Given** the review editor is open with unsaved changes,
   **When** the user swipes down to dismiss,
   **Then** a confirmation dialog appears ("Discard changes?") and the review is not saved unless confirmed.

8. **Given** the review editor is open,
   **When** the user types past 10,000 characters,
   **Then** the character counter turns red and the Done button is disabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates half-star increment 4.5 | value: 4.5 | valid |
| validates half-star increment 3.0 | value: 3.0 | valid |
| rejects non-half-star value 2.3 | value: 2.3 | invalid |
| rejects zero rating | value: 0.0 | invalid |
| rejects rating above max | value: 5.5 | invalid |
| allows null rating (unrated) | value: null | valid |
| selects most recent rating as primary | ratings: [3.0 on Jan 1, 4.5 on Feb 1] | primary: 4.5 |
| returns null for unrated film | ratings: [] | primary: null |
| truncates review to 10,000 chars | review: 10,001 chars | validation error |
| allows review at exactly 10,000 chars | review: 10,000 chars | valid |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Rate a film | 1. Open film detail, 2. Tap 4th star right half, 3. Check database | Rating record created with value 4.0, film_id correct |
| Write a review | 1. Open film detail, 2. Tap Write Review, 3. Type text, 4. Tap Done | Review record created, preview shows on detail screen |
| Clear a rating | 1. Rate film 3.5, 2. Tap Clear | Rating value set to null, stars empty |
| Edit existing review | 1. Write review, 2. Tap review preview, 3. Modify text, 4. Save | Review updated, timestamp updated |
| Spoiler toggle | 1. Write review, 2. Toggle "Contains Spoilers" on, 3. Save, 4. Reopen detail | Review collapsed behind spoiler warning |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Rate and review a film | 1. Search for "Parasite", 2. Add as watched, 3. Rate 5.0, 4. Write review "Masterpiece of class commentary" | Film in library with 5.0 rating, review visible on detail, stats include rating |
| Multiple ratings over time | 1. Watch and rate film 3.0, 2. Rewatch (FM-015) and rate 4.5, 3. View detail | Primary rating shows 4.5, rating history shows both entries |

---

### FM-005: Collections and Lists

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-005 |
| **Feature Name** | Collections and Lists |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to create custom collections of films (e.g., "Best Horror Films", "2024 Favorites", "Comfort Rewatches"), so that I can organize my library beyond the default watched/want-to-watch categories.

**Secondary:**
> As a casual viewer, I want to add and remove films from collections easily, so that I can build themed lists without friction.

#### 3.3 Detailed Description

Collections and Lists allows users to create named, ordered groups of films. Each collection has a title, an optional description, and an ordered list of films. A film can belong to multiple collections simultaneously.

Collections serve many purposes: themed lists ("Best Sci-Fi of the 2000s"), annual favorites ("2025 Top 10"), viewing projects ("Hitchcock Marathon"), recommendation lists ("Films to Show Mom"), or personal rankings ("All-Time Top 50"). The flexibility comes from the fact that users define the collection purpose through naming and description - the system imposes no categories or structure beyond title, description, and ordered film list.

The collections screen displays all collections as a grid of cards, each showing the collection title, film count, and a 2x2 poster mosaic of the first 4 films. Users can create new collections, edit titles/descriptions, reorder films within a collection via drag-and-drop, and delete collections. Deleting a collection removes the grouping only - the films themselves remain in the library.

Films can be added to collections from the Film Detail screen (via an "Add to Collection" button) or from within a collection screen (via an "Add Films" button that opens a picker showing the user's library).

Collections have a maximum of 500 films each, and users can create up to 100 collections. These limits are generous enough for any practical use case while preventing performance issues with extremely large lists.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Films must exist in the library to be added to collections

**External Dependencies:**
- None (collections are entirely local data)

**Assumed Capabilities:**
- User can navigate between screens
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Collections List

**Layout:**
- Top navigation bar: title "Collections" on the left, "+" button on the right to create new collection
- Main area: scrollable grid of collection cards (2 columns on phone, 3 on tablet, 4 on desktop)
- Each card shows:
  - 2x2 poster mosaic (first 4 film posters; if fewer than 4, remaining cells show themed color blocks)
  - Collection title (bold, single line, truncated with ellipsis)
  - Film count (secondary text, e.g., "12 films")
- Cards are sorted by most recently modified first (moving a collection's films updates its modified timestamp)
- Below last card: footer text "X collections, Y total films"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No collections exist | Centered illustration (film reel with list icon), text "No collections yet", subtext "Create your first collection to organize your films", "Create Collection" button |
| Populated | 1+ collections exist | Grid of collection cards |
| Single | Exactly 1 collection | Single card centered, no grid layout |

**Interactions:**
- Tap collection card: navigates to Collection Detail screen
- Tap "+": opens Create Collection modal
- Long press collection card: shows context menu with "Edit", "Delete"
- Tap "Delete" in context menu: confirmation dialog ("Delete '[name]'? The films in this collection will not be deleted from your library.")

**Transitions/Animations:**
- Cards appear with staggered fade-in, 100ms per card
- Deleted card animates out with fade + scale down, 200ms

##### Screen: Collection Detail

**Layout:**
- Top navigation bar: collection title, "Edit" button (pencil icon), "..." menu (share, delete)
- Below nav: collection description (if present, up to 3 lines with expand)
- Stats row: "X films" and total runtime (e.g., "48h 30m total")
- Main area: scrollable vertical list of films in collection order
- Each film row: poster thumbnail (40x60), title, year, rating stars (compact), runtime
- Row number badge on the left (1, 2, 3...) for ranked/ordered lists
- Bottom floating button: "Add Films" to add more films

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Collection | Collection exists but has no films | Centered text "This collection is empty", "Add Films" button |
| Populated | 1+ films in collection | Numbered list of films |
| Reorder Mode | User activated drag-and-drop | Drag handles appear on right side of each row, row numbers update live |

**Interactions:**
- Tap film row: navigates to Film Detail screen
- Long press and drag: reorders films within the collection
- Tap "Edit": opens Edit Collection modal (title, description)
- Tap "Add Films": opens Film Picker modal
- Swipe left on film row: "Remove" action (removes from collection only, not from library)
- Tap "...": menu with "Share List" and "Delete Collection"

##### Modal: Create/Edit Collection

**Layout:**
- Modal sheet, half-height
- Title: "New Collection" or "Edit Collection"
- Form fields:
  - Title (required, text input, max 100 characters)
  - Description (optional, multiline text input, max 500 characters)
- Footer: "Cancel" and "Save" buttons

**Interactions:**
- Tap "Save": creates/updates collection, closes modal
- Tap "Cancel": dismisses modal, with confirmation if unsaved changes exist

##### Modal: Film Picker

**Layout:**
- Modal sheet, full height
- Title: "Add Films to [Collection Name]"
- Search bar at top to filter library
- Scrollable list of all films in library
- Each row: poster thumbnail, title, year, checkbox on right
- Films already in the collection have a filled checkbox and subtle background highlight
- Footer: "Done" button with count badge (e.g., "Add 3 films")

**Interactions:**
- Tap row: toggles checkbox (add/remove film from selection)
- Tap "Done": adds selected films to collection, assigns positions after existing films
- Search: filters list by title substring (case-insensitive)

#### 3.6 Data Requirements

##### Entity: Collection

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| title | TEXT | Required, min 1 char after trim, max 100 chars | None | Collection name |
| description | TEXT | Optional, max 500 characters | null | Collection description |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

##### Entity: CollectionFilm (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| collection_id | TEXT (UUID) | Foreign key to Collection.id, required | None | Collection this join belongs to |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film in the collection |
| position | INTEGER | Required, min 1 | Auto (next position) | Order position within collection |
| added_at | TEXT | ISO datetime, auto-set | Current timestamp | When the film was added to this collection |

**Relationships:**
- Collection has many Films through CollectionFilm (many-to-many)
- Film has many Collections through CollectionFilm (many-to-many)
- CollectionFilm belongs to both Collection and Film

**Indexes:**
- `Collection`: `title COLLATE NOCASE` - Sorted listing and dedup check
- `CollectionFilm`: `collection_id, position` - Ordered retrieval of films in a collection
- `CollectionFilm`: `film_id` - Finding all collections a film belongs to
- `CollectionFilm`: `collection_id, film_id` (unique) - Prevent duplicate film in same collection

**Validation Rules:**
- `Collection.title`: Must not be empty after trimming; max 100 characters
- `Collection`: Maximum 100 collections per user (checked before creation)
- `CollectionFilm`: Maximum 500 films per collection (checked before adding)
- `CollectionFilm`: Same film cannot appear twice in the same collection (unique constraint on collection_id + film_id)
- `CollectionFilm.position`: Must be >= 1; re-normalized after reorder or removal

**Example Data:**

```json
{
  "collection": {
    "id": "c1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "title": "All-Time Top 10",
    "description": "My personal ranking of the greatest films ever made.",
    "created_at": "2026-02-01T10:00:00Z",
    "updated_at": "2026-02-15T18:30:00Z"
  },
  "collection_films": [
    { "id": "cf-001", "collection_id": "c1a2...", "film_id": "f-inception", "position": 1, "added_at": "2026-02-01T10:05:00Z" },
    { "id": "cf-002", "collection_id": "c1a2...", "film_id": "f-parasite", "position": 2, "added_at": "2026-02-01T10:06:00Z" }
  ]
}
```

#### 3.7 Business Logic Rules

##### Position Re-normalization

**Purpose:** Keep collection positions as a contiguous sequence (1, 2, 3, ...) after reorder or removal.

**Inputs:**
- collection_id: UUID
- action: "reorder" | "remove"
- (for reorder) from_position: integer, to_position: integer
- (for remove) removed_position: integer

**Logic:**

```
FOR "reorder":
1. Remove film from from_position
2. Shift films between from_position and to_position by +1 or -1
3. Insert film at to_position
4. Re-assign positions as 1, 2, 3, ... based on new order

FOR "remove":
1. Delete CollectionFilm record at removed_position
2. UPDATE CollectionFilm SET position = position - 1
   WHERE collection_id = {collection_id} AND position > removed_position
3. Update Collection.updated_at to now
```

**Edge Cases:**
- Moving film to same position: no-op
- Removing last film in collection: collection remains with 0 films (not auto-deleted)
- Removing film that appears in multiple collections: only the CollectionFilm record for this collection is removed

##### Collection Total Runtime

**Purpose:** Calculate the total runtime of all films in a collection for the stats display.

**Formulas:**
- `total_runtime_minutes = SUM(film.runtime_minutes) for all films in collection WHERE runtime_minutes IS NOT NULL`
- `total_runtime_display = format_runtime(total_runtime_minutes)` (reuses FM-001 runtime formatting)

**Edge Cases:**
- Films with null runtime: excluded from sum, not treated as 0
- Empty collection: display "0h"

##### Poster Mosaic Generation

**Purpose:** Generate the 2x2 poster mosaic shown on collection cards.

**Logic:**

```
1. Take first 4 films in collection (by position order)
2. IF 4 films with posters: show 2x2 grid of poster images
3. IF 3 films with posters: 2x2 grid, 4th cell is accent-colored placeholder
4. IF 2 films with posters: 2x2 grid, cells 3 and 4 are placeholders
5. IF 1 film with poster: single poster centered, remaining cells are placeholders
6. IF 0 films with posters: solid accent color block with collection initial letter
```

**Sort/Filter/Ranking Logic:**
- **Default sort for Collections List:** Most recently modified first (updated_at DESC)
- **Sort options for films within a collection:** Manual order (position), Title A-Z, Rating (highest), Year (newest)
- **No global filter on collections:** User scrolls to find collection by name

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Collection limit reached (100) | Toast: "Maximum 100 collections reached. Delete a collection to create a new one." | User deletes an existing collection |
| Film limit in collection reached (500) | Toast: "This collection has reached the 500-film limit." | User removes films before adding more |
| Database write fails on collection create | Toast: "Could not create collection. Please try again." | User retries |
| Duplicate film in collection | Film already checked in picker, cannot be added again | Checkbox shows filled state, no action on tap |
| Film deleted while in collection | CollectionFilm record cascade-deleted, collection count updates | Collection adjusts automatically |
| Title left blank | Inline validation: "Title is required" | User types title, error clears |

**Validation Timing:**
- Title validation: on blur and on save
- Collection limit check: on save (before insert)
- Film limit check: on "Done" in film picker (before insert)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no collections exist,
   **When** the user taps "+", enters title "Horror Classics", and saves,
   **Then** a new empty collection appears in the Collections grid with the title "Horror Classics" and "0 films".

2. **Given** a collection "Horror Classics" exists with 0 films,
   **When** the user taps the collection, taps "Add Films", selects 3 films, and taps Done,
   **Then** the collection shows 3 films in the order selected, with position numbers 1, 2, 3.

3. **Given** a collection has films at positions 1, 2, 3,
   **When** the user drags film 3 to position 1,
   **Then** positions re-normalize to 1, 2, 3 with the dragged film now at 1.

4. **Given** a film is in 2 collections,
   **When** the user views the Film Detail screen,
   **Then** both collections are listed under a "Collections" section.

**Edge Cases:**

5. **Given** a user has 100 collections,
   **When** the user taps "+" to create a 101st,
   **Then** a toast message appears: "Maximum 100 collections reached."

6. **Given** a collection has 500 films,
   **When** the user tries to add another film,
   **Then** a toast message appears: "This collection has reached the 500-film limit."

**Negative Tests:**

7. **Given** the create collection modal is open,
   **When** the user leaves the title blank and taps Save,
   **Then** inline validation shows "Title is required" and the collection is not created.

8. **Given** a collection with 3 films,
   **When** the user deletes the collection,
   **Then** the collection is removed but all 3 films remain in the library.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| re-normalizes positions after removal | positions [1,2,3], remove 2 | positions become [1,2] |
| re-normalizes positions after reorder | positions [1,2,3], move 3 to 1 | positions [1,2,3] with moved film at 1 |
| calculates collection runtime | films with runtimes [120, 148, null, 95] | total: 363 minutes, display: "6h 3m" |
| generates mosaic for 4 films | 4 films with posters | 2x2 grid, all poster images |
| generates mosaic for 0 films | empty collection | solid accent block with initial letter |
| validates collection title not blank | title: "  " | validation error |
| validates title max length | title: 101 chars | validation error |
| prevents duplicate film in collection | film already in collection | rejected |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and populate collection | 1. Create "Best of 2025", 2. Add 5 films, 3. View collection | 5 films listed with positions 1-5, total runtime shown |
| Reorder within collection | 1. Collection has [A,B,C], 2. Drag C to position 1 | Order becomes [C,A,B], positions 1,2,3 |
| Remove film from collection | 1. Collection has [A,B,C], 2. Swipe left on B, tap Remove | Collection shows [A,C], positions 1,2 |
| Delete collection preserves films | 1. Collection has 3 films, 2. Delete collection | Collection gone, all 3 films in library |
| Film in multiple collections | 1. Add film to Collection A, 2. Add same film to Collection B | Film appears in both, Film Detail shows both collections |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Build a top 10 list | 1. Create "Top 10" collection, 2. Add 10 films, 3. Reorder to preference, 4. View collection | 10 films in chosen order, numbered 1-10, total runtime shown |
| Organize library into genres | 1. Create "Sci-Fi" collection, 2. Create "Drama" collection, 3. Add films to each, 4. Add one film to both | Two collections with correct counts, shared film appears in both |

---

### FM-006: Search and Filtering

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-006 |
| **Feature Name** | Search and Filtering |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast with 500+ films in my library, I want to search, filter, and sort my collection by multiple criteria, so that I can quickly find specific films or browse subsets of my library.

**Secondary:**
> As a casual viewer, I want to filter my library to see only films from a specific decade or genre, so that I can choose what to rewatch tonight.

#### 3.3 Detailed Description

Search and Filtering provides comprehensive tools for navigating a film library of any size. It combines three mechanisms: text search (substring matching on title and director fields), multi-faceted filters (genre, decade, rating range, watch status, runtime range), and sort controls (12 sort options). These mechanisms work together - a user can search for "horror" in titles, filter to the 1980s, filter to rated 4.0+, and sort by rating descending, all simultaneously.

Text search uses case-insensitive substring matching across the film title, original_title, and director fields. The search activates after the user types at least 2 characters and updates results in real-time with a 300ms debounce. Search highlighting marks the matched text in bold within results.

Filters are presented as a collapsible filter panel below the search bar. Each filter is a discrete control: genre is a horizontal scrollable set of chips (multi-select), decade is a horizontal scrollable set of chips (multi-select), rating range is a dual-handle slider (0.5 to 5.0), watch status is a segmented control (All / Watched / Want to Watch), and runtime range is a dual-handle slider (0 to 300+ minutes). Filters combine with AND logic - enabling "Horror" genre AND "1980s" decade shows only films that match both criteria.

An active filter count badge appears on the filter toggle button to indicate how many filters are currently active. A "Clear All" button resets all filters and search to their defaults.

Sort is controlled via a dropdown/picker accessible from the top bar. The default sort is "Date Added (newest first)". Sort applies after search and filter, so the user sees their filtered subset in the chosen order.

Results display a count header (e.g., "23 of 150 films") when any filter or search is active, so the user knows how many films match.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records must exist with metadata fields (genres, release_year, runtime, watch_status)
- FM-004: Ratings and Reviews - Rating data must be queryable for rating range filter

**External Dependencies:**
- None (all search and filtering operates on local data)

**Assumed Capabilities:**
- Local database supports indexed queries on multiple fields
- Film library has been populated with at least some metadata

#### 3.5 User Interface Requirements

##### Screen: Library with Search and Filters

**Layout:**
- Top navigation bar: "Library" title, sort picker button (right, shows current sort name)
- Below nav: search text input with magnifying glass icon, placeholder "Search films..."
- Below search: filter toggle button ("Filters" with active filter count badge, e.g., "Filters (3)")
- Filter panel (collapsible, hidden by default):
  - Genre row: horizontal scrollable chips for 20 genres, multi-select (selected chips have filled background)
  - Decade row: horizontal scrollable chips ["1920s", "1930s", ..., "2020s"], multi-select
  - Rating range: dual-handle slider labeled "Rating: 0.5 - 5.0" with current range values displayed
  - Watch status: segmented control ["All", "Watched", "Want to Watch"]
  - Runtime range: dual-handle slider labeled "Runtime: 0 - 300+ min" with current range values
  - "Clear All Filters" text button at bottom of panel
- Results count header: "Showing X of Y films" (only visible when search or filters are active)
- Main area: scrollable vertical list of film rows (reuses library list from FM-001)
- Each row: poster thumbnail, title, year, director, rating stars (if rated), runtime badge

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | No search or filters active | Full library list with current sort, no count header |
| Search Active | Search text entered (2+ chars) | Filtered list with matched text highlighted, count header |
| Filters Active | 1+ filter applied | Filtered list, filter badge count, count header |
| Combined | Search + filters both active | Results matching both search and all filters, count header |
| No Results | Search/filter combination yields 0 results | Centered text: "No films match your search and filters.", "Clear Filters" button |
| Loading | Library has 1000+ films and filter query is running | Brief skeleton placeholder (max 200ms for SQLite queries) |

**Interactions:**
- Typing in search: results update after 300ms debounce
- Tap filter toggle: expands/collapses filter panel with 200ms slide animation
- Tap genre chip: toggles that genre filter on/off; results update immediately
- Tap decade chip: toggles that decade filter on/off; results update immediately
- Drag rating slider handles: updates range in real-time
- Drag runtime slider handles: updates range in real-time
- Tap segmented control: switches watch status filter immediately
- Tap "Clear All Filters": resets all filters to defaults, closes filter panel
- Tap sort picker: opens dropdown with 12 sort options
- Tap sort option: list re-sorts immediately

**Transitions/Animations:**
- Filter panel: slide down/up with 200ms ease-in-out
- List items: cross-fade on filter change, 150ms
- Search highlight: bold text matching appears immediately

#### 3.6 Data Requirements

No new entities are introduced. This feature operates on existing Film and Rating entities from FM-001 and FM-004.

**Query Patterns:**

| Query | Fields Used | Index Required |
|-------|-----------|---------------|
| Text search | title, original_title, directors | title COLLATE NOCASE, directors |
| Genre filter | genres (JSON array contains) | Full scan of genres field (JSON) |
| Decade filter | release_year | release_year |
| Rating filter | ratings.rating_value (via join) | ratings.film_id, ratings.rating_value |
| Watch status filter | watch_status | watch_status |
| Runtime filter | runtime_minutes | runtime_minutes |
| Sort by date added | created_at | created_at |
| Sort by watched date | watched_date | watched_date |
| Sort by rating | ratings.rating_value (via join) | ratings.rating_value |

#### 3.7 Business Logic Rules

##### Search Matching Algorithm

**Purpose:** Find films matching a user's text query across multiple fields.

**Inputs:**
- query: string (min 2 characters)

**Logic:**

```
1. Normalize query: trim whitespace, convert to lowercase
2. IF query length < 2 THEN RETURN all films (no search filter)
3. SELECT * FROM films WHERE
     LOWER(title) LIKE '%{query}%'
     OR LOWER(original_title) LIKE '%{query}%'
     OR LOWER(directors) LIKE '%{query}%'
4. Results are further filtered by any active genre/decade/rating/status/runtime filters
5. RETURN matching films with match field noted (for highlighting)
```

**Edge Cases:**
- Query with special SQL characters (%, _): escape before LIKE query
- Unicode characters in titles (e.g., Japanese, Korean): match as-is with LOWER
- Query matches director but not title: film is included, director name is highlighted

##### Combined Filter Logic

**Purpose:** Apply multiple filters simultaneously with AND semantics.

**Inputs:**
- search_query: string (optional)
- genres: array of strings (optional, multi-select)
- decades: array of integers (optional, multi-select, e.g., [1980, 1990])
- rating_min: float (optional, 0.5-5.0)
- rating_max: float (optional, 0.5-5.0)
- watch_status: "all" | "watched" | "want_to_watch"
- runtime_min: integer (optional, 0-1440)
- runtime_max: integer (optional, 0-1440, 300 = "300+")

**Logic:**

```
1. Start with all films
2. IF search_query (2+ chars) THEN filter by text match (title, original_title, directors)
3. IF genres is non-empty THEN filter to films where genres JSON array contains ANY of selected genres
4. IF decades is non-empty THEN filter to films where floor(release_year / 10) * 10 IN decades
5. IF rating_min or rating_max THEN
     JOIN with ratings to get primary rating
     Filter to films where primary_rating >= rating_min AND primary_rating <= rating_max
6. IF watch_status != "all" THEN filter by watch_status field
7. IF runtime_min THEN filter to films where runtime_minutes >= runtime_min
8. IF runtime_max < 300 THEN filter to films where runtime_minutes <= runtime_max
   (300+ means no upper bound)
9. Apply current sort order
10. RETURN filtered, sorted list with total count
```

**Formulas:**
- `decade_group = floor(release_year / 10) * 10`
- `genre_match = genres_array contains ANY of selected_genres`
- `active_filter_count = count of non-default filter values`

**Edge Cases:**
- Film with null genres: excluded when genre filter is active
- Film with null release_year: excluded when decade filter is active
- Film with null runtime: excluded when runtime filter is active
- Film with no rating: excluded when rating filter is active
- All filters active, no matches: show "No films match" message
- 300+ runtime: means "300 minutes or more" (no upper cap)

**Sort/Filter/Ranking Logic:**
- **Available sort options:** Title A-Z, Title Z-A, Date Added (newest), Date Added (oldest), Date Watched (newest), Date Watched (oldest), Release Year (newest), Release Year (oldest), Rating (highest), Rating (lowest), Runtime (longest), Runtime (shortest)
- **Default sort:** Date Added (newest first)
- **Sort tiebreaker:** title A-Z when primary sort values are equal
- **Films with null values in sort field:** sorted to end of list (e.g., unrated films appear last when sorting by rating)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Search query too short (1 char) | No filtering applied, no error shown | User types more characters |
| Database query error | Toast: "Could not search library. Please try again." | User re-enters query or closes/reopens screen |
| Filter combination returns 0 results | "No films match your search and filters." with "Clear Filters" button | User clears filters or adjusts criteria |
| Rating slider handles cross | Slider prevents min > max (handles swap) | Min handle cannot pass max handle and vice versa |
| Runtime slider handles cross | Same behavior as rating slider | Handles constrained |

**Validation Timing:**
- Search: 300ms debounce after last keystroke
- Filters: immediate application on each change
- Sort: immediate on selection

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a library with 50 films,
   **When** the user types "inception" in the search bar,
   **Then** only films with "inception" in title, original_title, or directors are shown, with matched text highlighted.

2. **Given** a library with films across multiple genres,
   **When** the user taps the "Horror" and "Thriller" genre chips,
   **Then** only films tagged with Horror OR Thriller are shown, and the filter badge shows "(2)".

3. **Given** a library with films from multiple decades,
   **When** the user selects "1980s" and sets rating range to 4.0-5.0,
   **Then** only films from 1980-1989 with a primary rating between 4.0 and 5.0 are shown.

4. **Given** the library is filtered to show 15 films,
   **When** the user changes sort to "Rating (highest first)",
   **Then** the 15 filtered films re-sort by rating descending.

**Edge Cases:**

5. **Given** all filters are active and produce 0 results,
   **When** the user views the screen,
   **Then** the "No films match" message appears with a "Clear Filters" button that resets everything.

6. **Given** the runtime filter max is set to 300+,
   **When** a film has a runtime of 600 minutes,
   **Then** that film is included in the results (300+ means no upper bound).

**Negative Tests:**

7. **Given** the search bar has 1 character entered,
   **When** the user waits,
   **Then** no search filtering is applied (minimum 2 characters required).

8. **Given** a film has null genres,
   **When** the genre filter is active,
   **Then** that film is excluded from results.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| search matches title substring | query: "incep", film: "Inception" | match: true |
| search matches director | query: "nolan", film directors: '["Christopher Nolan"]' | match: true |
| search is case insensitive | query: "PARASITE", film: "Parasite" | match: true |
| search ignores 1-char query | query: "a" | no filter applied, all films returned |
| decade filter groups correctly | year: 1985 | decade_group: 1980 |
| decade filter groups boundary | year: 1990 | decade_group: 1990 |
| genre filter matches any selected | selected: ["Horror","Comedy"], film genres: '["Horror","Drama"]' | match: true (Horror matches) |
| genre filter excludes non-match | selected: ["Comedy"], film genres: '["Horror","Drama"]' | match: false |
| rating filter includes boundary | min: 4.0, max: 5.0, film rating: 4.0 | included |
| runtime 300+ means no upper bound | max: 300+, film runtime: 600 | included |
| active filter count | genre: 1, decade: 2, rating: custom, status: default | count: 3 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Search and filter combined | 1. Type "dark", 2. Select "2000s" decade | Only films with "dark" in title/director from 2000-2009 |
| Clear all filters | 1. Apply 3 filters, 2. Tap "Clear All Filters" | All filters reset, full library shown |
| Sort persists across filter changes | 1. Sort by rating highest, 2. Apply genre filter | Filtered results still sorted by rating highest |
| Zero results handling | 1. Filter to genre "Musical" + decade "1920s" (no matches) | "No films match" message displayed |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Find a specific film | 1. Library has 200 films, 2. Type "god" in search, 3. Filter to "1970s" | "The Godfather" and "The Godfather Part II" shown (if in library) |
| Browse decade | 1. Tap "1990s" chip, 2. Sort by rating highest | All 1990s films sorted by rating, count shows "X of Y films" |

---

### FM-007: Film Diary Calendar

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-007 |
| **Feature Name** | Film Diary Calendar |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to see a calendar view of my watching history, so that I can visualize when and how frequently I watch films throughout the month and year.

**Secondary:**
> As a casual viewer, I want to quickly see what I watched on a specific date, so that I can recall films from specific occasions or events.

#### 3.3 Detailed Description

The Film Diary Calendar presents the user's viewing history in a visual calendar format. Each day that the user watched one or more films shows a dot indicator (or poster thumbnail) on the calendar grid. Tapping a day reveals a list of films watched on that date, with poster, title, rating, and a link to the Film Detail screen.

The calendar defaults to the current month in a standard month grid layout (7 columns for days of the week, 5-6 rows for weeks). Users can swipe left/right to navigate between months and tap a year header to switch to a year picker for jumping to distant months.

Days with watched films are visually distinct from empty days. If a day has 1 film, a small poster thumbnail is shown in the cell. If a day has 2-3 films, 2-3 overlapping dot indicators are shown. If a day has 4+ films, a numbered badge (e.g., "4") is shown.

Below the calendar grid, a "day detail" section shows the films for the currently selected day. If no day is selected, it defaults to today (or the most recent day with a viewing). This detail section is a scrollable horizontal row of film cards showing poster, title, year, and rating.

The diary calendar reads from the `watched_date` field of Film records and the `viewing_date` field of Rating records (to capture rewatches logged via FM-015). It does not create or store its own data - it is a view over existing data.

A monthly summary bar at the bottom of the screen shows: "X films watched this month" and "Y hours total" for the currently displayed month.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records with watched_date field
- FM-004: Ratings and Reviews - Rating records with viewing_date for rewatch dates (optional, enhances diary)

**External Dependencies:**
- None (calendar operates on local data)

**Assumed Capabilities:**
- Device locale determines first day of week (Sunday vs. Monday)
- Local database is queryable by date range

#### 3.5 User Interface Requirements

##### Screen: Diary Calendar

**Layout:**
- Top navigation bar: "Diary" title, month/year label centered (e.g., "March 2026"), left/right chevron buttons for month navigation
- Calendar grid: 7-column grid (S/M/T/W/T/F/S or M/T/W/T/F/S/S based on locale)
  - Each cell is 48x48 points
  - Days in current month: normal text color
  - Days from adjacent months: dimmed text color
  - Today: circle highlight behind date number
  - Selected day: accent color circle behind date number
  - Days with viewings: dot indicator below date number (1 dot per film, max 3 dots; 4+ shows number badge)
- Day detail section (below calendar): horizontal scrollable row of film cards for selected day
  - Each card: poster (60x90), title below, year, and star rating (compact)
  - If no films on selected day: centered text "No films watched on this day"
- Monthly summary bar (fixed at bottom): "X films | Yh Zm total"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Month | No films watched in displayed month | Calendar grid with no dots, summary shows "0 films | 0h total" |
| Populated Month | 1+ days have viewings | Dots/badges on viewing days, summary with totals |
| Day Selected | User tapped a day | Accent circle on day, film cards shown in detail section |
| No Films on Day | Selected day has no viewings | Detail section: "No films watched on this day" |
| Year Picker | User tapped the month/year header | Modal overlay with scrollable year list (1888 to current year) |

**Interactions:**
- Tap day cell: selects that day, loads films in day detail section
- Swipe left on calendar: navigate to next month
- Swipe right on calendar: navigate to previous month
- Tap left chevron: navigate to previous month
- Tap right chevron: navigate to next month
- Tap month/year header: open year picker for quick navigation
- Tap film card in day detail: navigate to Film Detail screen
- Long press day cell: shows quick summary tooltip ("2 films, 4h 15m")

**Transitions/Animations:**
- Month transition: cross-fade with 200ms slide in swipe direction
- Day selection: accent circle scales up from 0 to full size, 150ms
- Film cards in day detail: slide in from bottom, staggered 100ms per card

##### Modal: Year Picker

**Layout:**
- Centered overlay with scrollable list of years
- Current year highlighted with accent color
- Years range from 1888 to current year
- Each row shows year and film count for that year (e.g., "2025 (47 films)")

**Interactions:**
- Tap year: jumps calendar to January of that year, dismisses picker
- Scroll: smooth scrolling through years
- Tap outside: dismisses picker without changing

#### 3.6 Data Requirements

##### Entity: DiaryEntry (view entity - optional materialized query)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film that was watched |
| viewing_date | TEXT | ISO date (YYYY-MM-DD), required | None | Date the film was watched |
| rating_id | TEXT (UUID) | Foreign key to Rating.id, optional | null | Associated rating record (if rated) |
| is_rewatch | INTEGER | 0 or 1 | 0 | Whether this is a rewatch entry |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

**Note:** DiaryEntry can be implemented as a materialized view or a separate table. The simplest implementation queries directly from Film.watched_date for first watches and Rating.viewing_date for rewatches. A separate table is useful if diary-specific metadata (e.g., viewing location, companions) is added later.

**Relationships:**
- DiaryEntry belongs to Film (many-to-one via film_id)
- DiaryEntry optionally belongs to Rating (one-to-one via rating_id)

**Indexes:**
- `viewing_date` - Calendar month queries
- `film_id, viewing_date` - Film-specific diary lookup

**Validation Rules:**
- `viewing_date`: Must be a valid ISO date, must not be in the future
- `film_id`: Must reference an existing Film record

**Example Data:**

```json
{
  "id": "d1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "film_id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "viewing_date": "2026-01-15",
  "rating_id": "r1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "is_rewatch": 0,
  "created_at": "2026-01-15T21:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Month Data Aggregation

**Purpose:** Aggregate all viewings for a given month to populate the calendar grid.

**Inputs:**
- year: integer
- month: integer (1-12)

**Logic:**

```
1. Calculate date range: first_day = YYYY-MM-01, last_day = last day of month
2. Query all diary entries (or Film.watched_date + Rating.viewing_date) in range:
   SELECT viewing_date, COUNT(*) as film_count
   FROM diary_entries
   WHERE viewing_date >= first_day AND viewing_date <= last_day
   GROUP BY viewing_date
3. For each day with film_count > 0, mark calendar cell with indicator:
   - 1 film: single dot
   - 2-3 films: 2-3 dots
   - 4+ films: number badge with count
4. RETURN map of { date: film_count } for the month
```

**Formulas:**
- `monthly_film_count = SUM(film_count) for all days in month`
- `monthly_total_minutes = SUM(film.runtime_minutes) for all viewings in month`
- `monthly_total_display = format_runtime(monthly_total_minutes)`

**Edge Cases:**
- Months with 0 viewings: empty calendar, summary shows "0 films | 0h total"
- Future dates: no viewing data shown (viewings cannot be in the future)
- Film watched on Feb 29 (leap year): displays correctly on leap year months, hidden on non-leap years
- Multiple viewings on same day: all shown in day detail section as separate cards

##### Day Detail Query

**Purpose:** Retrieve all films watched on a specific date.

**Inputs:**
- date: ISO date string (YYYY-MM-DD)

**Logic:**

```
1. Query diary entries for the date:
   SELECT de.*, f.title, f.poster_url, f.poster_cached_path, f.release_year, f.runtime_minutes,
          r.rating_value
   FROM diary_entries de
   JOIN films f ON de.film_id = f.id
   LEFT JOIN ratings r ON de.rating_id = r.id
   WHERE de.viewing_date = {date}
   ORDER BY de.created_at ASC
2. RETURN list of film cards with metadata
```

**Edge Cases:**
- Date with no viewings: return empty list, display "No films watched on this day"
- Same film watched twice on same date: both entries appear as separate cards

**Sort/Filter/Ranking Logic:**
- **Calendar default view:** Current month
- **Day detail sort:** Order added (created_at ascending)
- **No filtering within calendar:** All viewings are shown

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database query fails for month data | Toast: "Could not load diary. Please try again." | User navigates away and back |
| Year picker year has no data | Year row shows "0 films", calendar for that month shows empty | Normal behavior |
| Film record deleted after diary entry exists | Diary entry orphaned - filtered out of display | Automatic cleanup on next month load |
| Invalid date in database | Entry skipped, logged as warning | Data integrity check in settings |

**Validation Timing:**
- Month data loads on screen open and on month navigation
- Day detail loads on day selection

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user watched 3 films in March 2026 (on days 5, 12, and 20),
   **When** the user opens the Diary and navigates to March 2026,
   **Then** days 5, 12, and 20 show dot indicators, and the summary shows "3 films".

2. **Given** the user taps on March 12,
   **When** the day detail section loads,
   **Then** the film watched on March 12 appears as a card with poster, title, year, and rating.

3. **Given** the user watched 5 films on a single day (e.g., a movie marathon),
   **When** that day is shown in the calendar,
   **Then** a "5" badge appears on the day cell, and all 5 films appear in the day detail section.

4. **Given** the user swipes left on the calendar,
   **When** the month transitions,
   **Then** the next month loads with its viewing data and summary.

**Edge Cases:**

5. **Given** the user has watched 0 films in a particular month,
   **When** navigating to that month,
   **Then** the calendar shows no indicators and the summary reads "0 films | 0h total".

6. **Given** the user taps the month/year header,
   **When** the year picker opens,
   **Then** each year shows a film count, and tapping a year jumps to January of that year.

**Negative Tests:**

7. **Given** the calendar is showing the current month,
   **When** a day in the future is displayed,
   **Then** no viewing data or indicators appear on future days.

8. **Given** a diary entry references a deleted film,
   **When** the calendar loads,
   **Then** the orphaned entry is not displayed and does not cause an error.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| aggregates month data correctly | 3 viewings on different days | map with 3 entries, correct counts |
| counts multiple viewings on same day | 4 viewings on Jan 15 | { "2026-01-15": 4 } |
| calculates monthly film count | 10 diary entries in month | monthly_film_count: 10 |
| calculates monthly total runtime | 3 films: 120, 148, 95 min | 363 min, "6h 3m" |
| handles month with zero viewings | no entries | empty map, "0 films | 0h total" |
| determines dot vs badge display | count 3 | 3 dots |
| determines badge for 4+ | count 7 | badge showing "7" |
| handles leap year Feb 29 | viewing on 2024-02-29 | shown in Feb 2024 calendar |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Navigate months | 1. Open diary (current month), 2. Swipe left twice, 3. Swipe right once | Month advances 2, then retreats 1; data loads each time |
| Select day with viewing | 1. Navigate to month with viewings, 2. Tap day with dot | Day detail shows film card(s) for that day |
| Year picker navigation | 1. Tap month/year header, 2. Select 2024, 3. Calendar changes | Calendar shows January 2024 with correct data |
| Film card tap navigates to detail | 1. Select day, 2. Tap film card | Film Detail screen opens for that film |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Review monthly viewing history | 1. User has watched 15 films in current month, 2. Open Diary | Calendar shows 15 days with indicators, summary shows "15 films | Xh Ym total" |
| Find a specific viewing date | 1. User knows they watched "Dune" in October 2025, 2. Navigate to Oct 2025, 3. Find and tap the day | Film card shows "Dune" with its rating and details |

---

### FM-008: Viewing Statistics

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-008 |
| **Feature Name** | Viewing Statistics |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to see detailed statistics about my viewing habits (total films, total hours, average rating, genre breakdown, top directors), so that I can understand and reflect on my film consumption patterns.

**Secondary:**
> As a film student, I want to see genre and decade distribution charts, so that I can identify gaps in my viewing and discover eras or genres I have neglected.

#### 3.3 Detailed Description

Viewing Statistics aggregates all film and rating data into a comprehensive stats dashboard. The dashboard presents both lifetime statistics and time-period statistics (this month, this year, all time). Users can toggle between time periods to see how their habits change.

The stats dashboard is organized into distinct sections:

**Overview Cards:** A row of 4 headline metrics - Total Films Watched, Total Hours Watched, Average Rating, and Films This Year. Each card displays the current value prominently with a subtle label underneath.

**Genre Distribution:** A horizontal bar chart showing the percentage of films watched in each genre. Genres are sorted by frequency (most watched first). Each bar is labeled with the genre name, count, and percentage. Up to 20 genres are shown; genres with fewer than 1% are grouped under "Other".

**Decade Distribution:** A bar chart showing film count by release decade. Each bar represents a decade (1920s, 1930s, ..., 2020s) and shows the number of films watched from that era. This visualization helps users identify which eras they gravitate toward.

**Top Directors:** A ranked list of the user's top 10 most-watched directors, showing director name, film count, and average rating for that director's films.

**Top Actors:** A ranked list of the user's top 10 most-watched actors, showing actor name, film count, and average rating for films featuring that actor.

**Rating Breakdown:** A mini histogram showing the distribution of the user's ratings (how many films rated 0.5, 1.0, 1.5, ..., 5.0). This is also covered in more detail by FM-010 but is shown in summary form here.

**Monthly Activity:** A 12-month sparkline showing films watched per month for the current year, providing a visual sense of viewing frequency over time.

All statistics are computed from local data on demand. No pre-aggregation tables are required - queries run against the Film, Rating, and DiaryEntry tables directly. For libraries of up to 10,000 films, all stat computations should complete within 500ms.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records with genres, runtime, release_year, directors, cast, watched_date
- FM-004: Ratings and Reviews - Rating records for average and distribution calculations

**External Dependencies:**
- None (all stats are computed locally)

**Assumed Capabilities:**
- Local database supports aggregate queries (SUM, AVG, COUNT, GROUP BY)

#### 3.5 User Interface Requirements

##### Screen: Stats Dashboard

**Layout:**
- Top navigation bar: "Stats" title, time period toggle on the right (segmented control: "Month" / "Year" / "All Time")
- Scrollable vertical layout with the following sections:

Section 1 - Overview Cards:
- Horizontal row of 4 metric cards (2x2 grid on narrow screens)
- Card 1: "Films Watched" with large number (e.g., "247")
- Card 2: "Hours Watched" with large number (e.g., "412h")
- Card 3: "Average Rating" with large number and star icon (e.g., "3.8")
- Card 4: "Films This Year" with large number (e.g., "47")

Section 2 - Genre Distribution:
- Section header: "Genres"
- Horizontal bar chart, each bar labeled: genre name, count, percentage
- Bars are accent-colored with varying saturation based on percentage
- Maximum 20 genres shown; remainder grouped as "Other (X genres)"

Section 3 - Decade Distribution:
- Section header: "Decades"
- Vertical bar chart with decade labels on x-axis (1920s through 2020s)
- Each bar labeled with count at the top
- Missing decades (0 films) show an empty bar with "0"

Section 4 - Top Directors:
- Section header: "Top Directors"
- Ranked list, 10 entries max
- Each row: rank number, director name, film count, average rating (compact stars)

Section 5 - Top Actors:
- Section header: "Top Actors"
- Ranked list, 10 entries max
- Each row: rank number, actor name, film count, average rating (compact stars)

Section 6 - Rating Breakdown:
- Section header: "Rating Distribution"
- Compact histogram (10 bars for 0.5 through 5.0)
- Each bar labeled with count
- Link: "View full histogram (FM-010)"

Section 7 - Monthly Activity:
- Section header: "Monthly Activity (2026)"
- 12-bar chart or sparkline (Jan through Dec)
- Each bar shows film count for that month
- Current month highlighted with accent color

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Data | No watched films exist | Each section shows "Watch your first film to see statistics here" |
| Minimal Data | 1-5 films watched | Stats shown with small numbers; charts may look sparse |
| Full Data | 10+ films watched | Full charts and ranked lists |
| Loading | Stats computation in progress | Skeleton placeholders for each section, max 500ms |
| Time Period: Month | "Month" selected | All stats scoped to current calendar month |
| Time Period: Year | "Year" selected | All stats scoped to current calendar year |
| Time Period: All Time | "All Time" selected | All stats across entire library history |

**Interactions:**
- Tap time period toggle: re-computes all stats for selected period
- Tap genre bar: navigates to library filtered by that genre (FM-006)
- Tap decade bar: navigates to library filtered by that decade (FM-006)
- Tap director row: navigates to Director filmography view (FM-011)
- Tap actor row: navigates to Actor filmography view (FM-011)
- Tap rating bar: navigates to library filtered by that rating range (FM-006)

**Transitions/Animations:**
- Time period toggle: bars/numbers animate from old value to new value, 300ms ease-out
- Stats sections fade in staggered, 100ms per section
- Bar chart bars grow from 0 to final height, 200ms

#### 3.6 Data Requirements

No new entities are introduced. All stats are computed queries against Film, Rating, and DiaryEntry entities.

**Key Queries:**

| Statistic | Query Pattern |
|-----------|--------------|
| Total films watched | `COUNT(*) FROM films WHERE watch_status = 'watched' AND watched_date within period` |
| Total hours | `SUM(runtime_minutes) / 60 FROM films WHERE watch_status = 'watched' AND watched_date within period` |
| Average rating | `AVG(rating_value) FROM ratings WHERE rating_value IS NOT NULL AND viewing_date within period` |
| Genre distribution | Parse genres JSON, count occurrences per genre, compute percentage |
| Decade distribution | `GROUP BY floor(release_year / 10) * 10` |
| Top directors | Parse directors JSON, count occurrences, compute avg rating per director |
| Top actors | Parse cast JSON, count occurrences, compute avg rating per actor |
| Rating breakdown | `GROUP BY rating_value` from ratings |
| Monthly activity | `GROUP BY strftime('%m', watched_date)` for current year |

#### 3.7 Business Logic Rules

##### Total Hours Calculation

**Purpose:** Calculate the total time spent watching films.

**Inputs:**
- period: "month" | "year" | "all_time"

**Logic:**

```
1. Determine date range based on period:
   - "month": first day of current month to last day
   - "year": January 1 to December 31 of current year
   - "all_time": no date restriction
2. Query: SELECT SUM(runtime_minutes) FROM films
   WHERE watch_status = 'watched'
   AND runtime_minutes IS NOT NULL
   AND watched_date within date range
3. total_hours = floor(sum_minutes / 60)
4. RETURN total_hours
```

**Formulas:**
- `total_hours = floor(SUM(runtime_minutes) / 60)`
- `average_rating = SUM(rating_value) / COUNT(rated_films)` (where rated_films have non-null rating)
- `genre_distribution_pct = genre_count / total_films_with_genres * 100`
- `decade_group = floor(release_year / 10) * 10`

**Edge Cases:**
- Films with null runtime: excluded from total hours (not treated as 0)
- No rated films: average_rating shows "N/A"
- Division by zero in percentages: display 0% or "N/A"
- Film with multiple genres (e.g., "Sci-Fi" and "Action"): counted once in each genre
- Films with no genres: excluded from genre distribution
- Films with no release_year: excluded from decade distribution

##### Genre Distribution Calculation

**Purpose:** Compute the percentage breakdown of films by genre.

**Inputs:**
- films: array of Film records within the selected time period

**Logic:**

```
1. Collect all genres from all films (parse JSON arrays)
2. Count occurrences of each genre (a film with 3 genres adds 1 to each)
3. total_genre_assignments = SUM of all genre counts
4. FOR each genre:
     percentage = (genre_count / total_genre_assignments) * 100
     Round to 1 decimal place
5. Sort by count descending
6. IF more than 20 genres, group all genres ranked 21+ as "Other"
7. RETURN list of { genre, count, percentage }
```

**Edge Cases:**
- Film with empty genres array: excluded
- Single genre dominates (e.g., 80% Drama): shown at full bar width
- Exactly 20 genres: no "Other" group
- 21 genres: 21st+ grouped as "Other"

##### Top Directors Ranking

**Purpose:** Rank the user's most-watched directors by film count.

**Inputs:**
- films: array of Film records within the selected time period (with director data)

**Logic:**

```
1. Parse directors JSON array from each film
2. Count films per director (films with multiple directors count toward each)
3. For each director, compute average_rating from associated ratings
4. Sort by film count descending; tiebreaker: average_rating descending
5. RETURN top 10
```

**Edge Cases:**
- Directors with null name: excluded
- Film with multiple directors: each director gets +1 to their count
- Director with all unrated films: average rating shows "N/A"

**Sort/Filter/Ranking Logic:**
- **Default time period:** All Time
- **Genre bars:** sorted by count descending
- **Decade bars:** sorted chronologically (1920s through 2020s)
- **Director/Actor lists:** sorted by film count descending, tiebreaker average_rating descending

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Stats query fails | Toast: "Could not load statistics. Please try again." | User navigates away and back |
| Malformed genres JSON in database | Genre excluded from distribution | Logged as warning |
| Extremely large library (10,000+ films) | Stats may take >500ms; loading skeleton shown | Consider caching results |
| No films in selected time period | All sections show "No data for this period" | User selects different period |
| Division by zero in average | Display "N/A" instead of number | Not an error condition |

**Validation Timing:**
- Stats compute on screen open and on time period toggle
- No user input to validate

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has watched 50 films with an average rating of 3.7,
   **When** the user opens the Stats screen with "All Time" selected,
   **Then** the overview cards show "50" films, total hours, "3.7" average, and films this year.

2. **Given** the user's films span 5 genres,
   **When** the genre distribution section loads,
   **Then** 5 bars are shown, sorted by frequency, with correct percentages summing to approximately 100%.

3. **Given** the user selects "Year" time period,
   **When** the stats reload,
   **Then** all metrics reflect only films watched in the current calendar year.

4. **Given** the user's top director is Christopher Nolan (8 films, avg 4.2),
   **When** the Top Directors section loads,
   **Then** Nolan appears at rank #1 with "8 films" and "4.2" average rating.

**Edge Cases:**

5. **Given** the user has 0 watched films,
   **When** the Stats screen opens,
   **Then** all sections show "Watch your first film to see statistics here."

6. **Given** a film has 3 genres,
   **When** genre distribution is calculated,
   **Then** that film contributes 1 count to each of its 3 genres.

**Negative Tests:**

7. **Given** a film has null runtime_minutes,
   **When** total hours is calculated,
   **Then** that film is excluded from the sum (not treated as 0 minutes).

8. **Given** no films have been rated,
   **When** the average rating is displayed,
   **Then** it shows "N/A" instead of 0 or NaN.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates total hours | runtimes: [120, 148, 90] | total: 358 min = 5h |
| handles null runtimes in total | runtimes: [120, null, 90] | total: 210 min = 3h |
| calculates average rating | ratings: [3.0, 4.0, 5.0] | average: 4.0 |
| average rating with no ratings | ratings: [] | "N/A" |
| genre distribution percentages | genres: Drama(5), Horror(3), Comedy(2) | Drama: 50%, Horror: 30%, Comedy: 20% |
| genre distribution groups Other | 22 genres, 21st and 22nd have 1 film each | 20 shown + "Other (2 genres)" |
| decade grouping | year: 1985 | decade: 1980 |
| decade grouping boundary | year: 2000 | decade: 2000 |
| top directors ranking | Nolan(5), Spielberg(3), Kubrick(3, higher avg) | Nolan #1, Kubrick #2 (tiebreak: avg rating), Spielberg #3 |
| monthly activity counts | 3 films in Jan, 5 in Mar, 0 in Feb | [3, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0] |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Stats with time period filter | 1. Watch 10 films in Jan, 5 in Feb, 2. Open Stats, 3. Select "Month" (current = Mar with 0) | Shows 0 films for current month |
| Tap genre bar navigates | 1. Open Stats, 2. Tap "Horror" bar | Navigates to library filtered by Horror genre |
| Tap director row navigates | 1. Open Stats, 2. Tap top director | Navigates to Director filmography view |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Review viewing habits | 1. User has 100+ films, 2. Open Stats, 3. Browse all sections | All sections populated with correct counts, percentages, rankings |
| Compare year to all-time | 1. Toggle "Year", note stats, 2. Toggle "All Time", compare | Year shows subset of all-time; all-time >= year for every metric |

---

### FM-009: Year-in-Review

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-009 |
| **Feature Name** | Year-in-Review |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to see a year-in-review summary at the end of each year (or on demand for any past year), so that I can reflect on my viewing highlights, top-rated films, most-watched genres, and total watch time for the year.

**Secondary:**
> As a Letterboxd migrant, I want a year-in-review feature that matches or exceeds Letterboxd's "Year in Review" page, so that I do not lose this capability by switching to MyFilms.

#### 3.3 Detailed Description

Year-in-Review generates a visually rich, scrollable summary of the user's film watching activity for a specific calendar year. It functions as a narrative-style report with distinct sections that walk the user through their year in films.

The feature is inspired by Letterboxd's year-in-review page and Spotify Wrapped. Unlike those services, MyFilms generates the review entirely from local data with no network calls and no external aggregation.

The year-in-review is accessible from the Stats screen via a "Year in Review" button. The user can select any past year for which they have viewing data. The most recent completed year is shown by default (e.g., if the current date is March 2026, the default view is 2025). The current year can also be previewed as a "Year So Far" in-progress report.

Sections of the Year-in-Review:

1. **Headline Stats:** Total films watched, total hours, unique genres explored, unique directors, average rating.
2. **Monthly Breakdown:** Bar chart of films per month with counts.
3. **Top 5 Films:** The 5 highest-rated films of the year (by user rating), each showing poster, title, and rating.
4. **Most Watched Genre:** The genre with the highest film count, with runner-up genres listed.
5. **Most Watched Director:** The director with the highest film count, with runner-ups.
6. **Longest Film:** The film with the highest runtime watched that year.
7. **Shortest Film:** The film with the lowest runtime watched that year.
8. **First Film of the Year:** The first film watched (by watched_date) in January.
9. **Last Film of the Year:** The last film watched in December.
10. **Rating Patterns:** Average rating per month as a line chart, showing rating trends.
11. **Decade Exploration:** Which decades the user's films came from, pie or donut chart.

Each section animates into view as the user scrolls, creating a narrative experience. The entire report can be exported as a shareable image or PDF.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records with watched_date, genres, runtime, directors
- FM-004: Ratings and Reviews - Rating data for top films and average calculations
- FM-008: Viewing Statistics - Reuses stat computation patterns

**External Dependencies:**
- None (generated from local data)

**Assumed Capabilities:**
- User has watched at least 1 film in the selected year (otherwise shows empty state)

#### 3.5 User Interface Requirements

##### Screen: Year-in-Review

**Layout:**
- Full-screen scrollable view with dark themed background
- Year selector at top: "<" [Year] ">" with left/right arrows for adjacent years
- Sections laid out vertically with generous spacing between sections:

Section 1 - Headline:
- Large centered text: "[Year] in Film"
- 5 metric badges in a row: Films (count), Hours (total), Genres (unique count), Directors (unique count), Avg Rating (with star)

Section 2 - Monthly Breakdown:
- 12-bar chart, one bar per month, labeled "Jan" through "Dec"
- Each bar shows count at top
- Peak month highlighted with accent color

Section 3 - Top 5 Films:
- Horizontal scrollable row of 5 poster cards
- Each card: large poster (120x180), title below, star rating below title
- Rank badge (gold #1, silver #2, bronze #3, plain #4 and #5) overlaid on poster corner

Section 4 - Most Watched Genre:
- Large genre name with count (e.g., "Drama - 42 films")
- Below: runner-up genres in smaller text (e.g., "Followed by Thriller (28) and Sci-Fi (19)")

Section 5 - Most Watched Director:
- Director name, film count, and list of their films watched that year

Section 6 - Longest Film:
- Poster, title, runtime (e.g., "3h 21m"), release year

Section 7 - Shortest Film:
- Poster, title, runtime (e.g., "1h 12m"), release year

Section 8 - First Film of the Year:
- Poster, title, date watched (e.g., "January 1")

Section 9 - Last Film of the Year:
- Poster, title, date watched (e.g., "December 31")

Section 10 - Rating Patterns:
- Line chart with 12 data points (average rating per month)
- Y-axis: 0.5 to 5.0; X-axis: Jan through Dec
- Months with no ratings: gap in line (or interpolated as dotted line)

Section 11 - Decade Exploration:
- Donut chart showing film count by release decade
- Legend listing decades with counts and percentages

Footer:
- "Share" button (generates shareable image/PDF)
- "MyFilms - Your Private Film Diary" watermark

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full Year | Selected year is completed (past year) | All sections populated |
| Year So Far | Selected year is current year | Sections reflect data to date; header says "[Year] So Far" |
| No Data | No films watched in selected year | Centered: "You did not watch any films in [year]. Navigate to a different year." |
| Minimal Data | 1-3 films in year | Sections that require 5+ entries show "Not enough data" |
| Loading | Report is being generated | Progress bar at top, sections appear as they compute |

**Interactions:**
- Tap left arrow: load previous year's review
- Tap right arrow: load next year's review (disabled if already at current year)
- Tap film poster/card: navigate to Film Detail screen
- Tap director name: navigate to Director filmography (FM-011)
- Tap "Share": generates and opens share sheet with report as image
- Scroll: sections animate into view with staggered reveal

**Transitions/Animations:**
- Sections animate in from bottom with fade, triggered on scroll into viewport
- Bar charts grow from 0 to full height, 300ms
- Top 5 poster cards slide in horizontally with stagger, 150ms each
- Metric badges count up from 0 to final value, 500ms

#### 3.6 Data Requirements

No new entities are introduced. Year-in-Review is a computed view over Film, Rating, and DiaryEntry data for a specific year.

**Key Queries:**

| Section | Query Pattern |
|---------|--------------|
| Headline stats | Same as FM-008 but scoped to `watched_date BETWEEN '{year}-01-01' AND '{year}-12-31'` |
| Monthly breakdown | `GROUP BY strftime('%m', watched_date)` for 12 months |
| Top 5 films | `ORDER BY rating_value DESC LIMIT 5` joined with films for the year |
| Most watched genre | Genre count aggregation for the year, take max |
| Most watched director | Director count aggregation for the year, take max |
| Longest/shortest film | `ORDER BY runtime_minutes DESC/ASC LIMIT 1` for the year |
| First/last film | `ORDER BY watched_date ASC/DESC LIMIT 1` for the year |
| Rating patterns | `AVG(rating_value) GROUP BY strftime('%m', viewing_date)` for the year |
| Decade exploration | Same decade grouping as FM-008, scoped to year |

#### 3.7 Business Logic Rules

##### Year-in-Review Generation

**Purpose:** Compute all sections of the year-in-review for a given year.

**Inputs:**
- year: integer (e.g., 2025)

**Logic:**

```
1. Define date range: start = '{year}-01-01', end = '{year}-12-31'
2. Query all films with watch_status = 'watched' AND watched_date within range
3. IF count == 0 THEN RETURN empty_state
4. Compute each section:
   a. headline_stats:
      - total_films = COUNT(*)
      - total_hours = floor(SUM(runtime_minutes) / 60)
      - unique_genres = COUNT(DISTINCT genre values across all films)
      - unique_directors = COUNT(DISTINCT director values across all films)
      - average_rating = AVG(rating_value) from ratings within date range
   b. monthly_breakdown: COUNT per month (1-12), 0 for empty months
   c. top_5: SELECT film_id, rating_value ORDER BY rating_value DESC LIMIT 5
      (tiebreaker: watched_date ASC for films with same rating)
   d. most_watched_genre: genre with highest count; runner-ups = next 2
   e. most_watched_director: director with highest count; include their film list
   f. longest_film: MAX(runtime_minutes)
   g. shortest_film: MIN(runtime_minutes) WHERE runtime_minutes > 0
   h. first_film: MIN(watched_date)
   i. last_film: MAX(watched_date)
   j. rating_patterns: AVG(rating_value) per month
   k. decade_exploration: decade distribution same as FM-008
5. RETURN all sections as structured data
```

**Formulas:**
- `total_hours = floor(SUM(runtime_minutes) / 60)`
- `average_rating = SUM(rating_value) / COUNT(rated_films)`
- `genre_distribution_pct = genre_count / total_genre_assignments * 100`
- `monthly_avg_rating = SUM(rating_value for month) / COUNT(rated_films for month)`

**Edge Cases:**
- Year with 1 film: Top 5 shows 1 film, "Not enough data for Top 5" message
- Year with fewer than 5 rated films: Top list shows as many as available
- Month with no films: monthly breakdown bar shows 0, rating pattern has gap
- Current year (in progress): sections computed to date, labeled "So Far"
- Film watched on Dec 31 at 11:59 PM: included in that year (date-based, not timestamp)
- Film with null runtime: excluded from longest/shortest calculations
- All films unrated: average rating shows "N/A", top 5 section shows "No rated films"

##### Share Image Generation

**Purpose:** Generate a shareable image or PDF of the year-in-review.

**Logic:**

```
1. Render the year-in-review screen content to an off-screen canvas
2. Include: headline stats, top 5 posters, genre breakdown, key stats
3. Add watermark: "MyFilms - Your Private Film Diary"
4. Export as PNG (mobile) or PDF (web)
5. Open platform share sheet with the generated file
```

**Sort/Filter/Ranking Logic:**
- **Year selector:** Ranges from the earliest year with viewing data to the current year
- **Top 5 sort:** Rating descending, tiebreaker watched_date ascending
- **No filtering within year-in-review:** Shows all data for the selected year

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Year has no data | Centered message: "You did not watch any films in [year]." | User navigates to different year |
| Share image generation fails | Toast: "Could not generate share image. Please try again." | User retries |
| Malformed data in database | Section with bad data shows "Could not compute" | Other sections unaffected |
| Year with 1 film and no rating | Top 5 shows 1 film with "Not rated"; avg rating shows "N/A" | Not an error |

**Validation Timing:**
- Report generates on year selection
- No user input to validate

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user watched 47 films in 2025,
   **When** the user opens Year-in-Review for 2025,
   **Then** all 11 sections populate with correct data: 47 films, correct total hours, top 5 by rating.

2. **Given** the user's most-watched genre in 2025 was Drama (20 films),
   **When** the Most Watched Genre section loads,
   **Then** it shows "Drama - 20 films" with runner-up genres listed below.

3. **Given** the current year is 2026 and the user has watched 12 films so far,
   **When** the user views 2026's review,
   **Then** the header shows "2026 So Far" and all sections reflect the 12 films.

4. **Given** the user taps "Share",
   **When** the image generates,
   **Then** a share sheet opens with a PNG/PDF containing the year-in-review highlights.

**Edge Cases:**

5. **Given** the user watched exactly 1 film in 2024,
   **When** viewing 2024's review,
   **Then** sections show the single film in Top 5 (rank #1), it is both longest and shortest, both first and last.

6. **Given** a year has 0 films,
   **When** the user navigates to that year,
   **Then** the empty state message appears with navigation arrows to other years.

**Negative Tests:**

7. **Given** the year-in-review is showing 2025,
   **When** the user taps the right arrow (current year is 2026),
   **Then** 2026 loads as "Year So Far"; the right arrow is disabled (cannot go to 2027).

8. **Given** all films in a year are unrated,
   **When** the average rating and top 5 sections load,
   **Then** average shows "N/A" and top 5 shows "No rated films this year."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes headline stats for year | 47 films, 7800 total minutes, avg 3.8 | films: 47, hours: 130, avg: 3.8 |
| monthly breakdown with empty months | films in Jan(3), Mar(5), Dec(2) | [3,0,5,0,0,0,0,0,0,0,0,2] |
| top 5 selection | 10 rated films | top 5 by rating desc, tiebreak by date asc |
| top 5 with fewer than 5 rated | 3 rated films | returns 3 films |
| most watched genre | Drama(20), Horror(15), Sci-Fi(10) | genre: Drama, count: 20, runners: Horror, Sci-Fi |
| longest film | runtimes [90, 148, 201, 120] | film with 201 min |
| shortest film excludes null | runtimes [null, 90, 148] | film with 90 min |
| first and last film of year | dates [Jan 5, Mar 12, Dec 20] | first: Jan 5, last: Dec 20 |
| rating patterns by month | ratings in Jan(4.0, 3.0), Feb(5.0) | Jan avg: 3.5, Feb avg: 5.0 |
| handles year with 0 films | year: 2020, no films | empty state |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Year navigation | 1. Open year 2025, 2. Tap left arrow | Loads 2024 data; all sections refresh |
| Tap film in top 5 | 1. Open year review, 2. Tap top film poster | Navigates to Film Detail for that film |
| Current year preview | 1. Open review for current year | Shows "Year So Far" header, data reflects YTD |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Complete year review | 1. User watched 100 films in 2025, 2. Open 2025 review, 3. Scroll through all sections | All 11 sections show correct data; share button works |
| Share year review | 1. Open 2025 review, 2. Tap Share | Image generated, share sheet opens with report |

---

### FM-010: Ratings Histogram

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-010 |
| **Feature Name** | Ratings Histogram |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to see a full histogram of all my ratings (how many films I rated at each half-star value), so that I can understand my rating patterns and tendencies (e.g., whether I tend to rate generously or harshly).

**Secondary:**
> As a film student, I want to see my rating distribution alongside a mean and median, so that I can calibrate how I rate films relative to my own baseline.

#### 3.3 Detailed Description

The Ratings Histogram displays a detailed bar chart of the user's rating distribution across all 10 possible half-star values (0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0). Each bar shows the number of films rated at that value, and the tallest bar is highlighted to indicate the user's most common rating.

Below the histogram, summary statistics provide additional context: total rated films, mean rating, median rating, mode rating (most common), and standard deviation. These help users understand whether they rate generously (mean above 3.0), harshly (mean below 3.0), or neutrally.

The histogram can be scoped to a time period (same time period toggle as FM-008: Month, Year, All Time) so users can see how their rating habits change over time.

A "bell curve" indicator is optionally overlaid as a faint line to show what a normal distribution would look like at the user's mean and standard deviation, giving a visual comparison between the user's actual distribution and a theoretical normal one.

Users can tap any bar to see the list of films rated at that value, which navigates to the library filtered by that exact rating.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-004: Ratings and Reviews - Rating records with rating_value
- FM-008: Viewing Statistics - Shares time period toggle pattern

**External Dependencies:**
- None (computed from local data)

**Assumed Capabilities:**
- User has rated at least 1 film (otherwise shows empty state)

#### 3.5 User Interface Requirements

##### Screen: Ratings Histogram

**Layout:**
- Top navigation bar: "Rating Distribution" title
- Time period toggle below nav (segmented control: "Month" / "Year" / "All Time")
- Histogram section:
  - 10 vertical bars arranged horizontally
  - X-axis labels: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0
  - Each bar labeled with count at the top
  - Tallest bar highlighted with accent color; other bars use secondary color
  - Optional faint bell curve overlay (toggleable via settings)
  - Y-axis: auto-scaled to tallest bar
- Summary stats section (below histogram):
  - "Total Rated: X films"
  - "Mean: X.X" with star icon
  - "Median: X.X" with star icon
  - "Mode: X.X (most common)" with star icon
  - "Std Dev: X.XX"
- Unrated count: "X films not yet rated" in secondary text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Ratings | 0 rated films | Centered: "Rate your first film to see your rating distribution." |
| Few Ratings | 1-9 rated films | Histogram shown but sparse; bell curve overlay hidden; note: "More ratings needed for trend analysis" |
| Normal | 10+ rated films | Full histogram with all stats |
| Single Value | All ratings are the same value | One tall bar, all others at 0; std dev: 0.00 |
| Time Period: Month | Month selected | Histogram scoped to current month's ratings |
| Time Period: Year | Year selected | Histogram scoped to current year's ratings |
| Time Period: All Time | All Time selected | All ratings included |

**Interactions:**
- Tap bar: navigates to library filtered to films with that exact rating (FM-006)
- Tap time period toggle: recalculates histogram for selected period
- Long press bar: tooltip showing "X films rated Y.Y"

**Transitions/Animations:**
- Bars grow from 0 to full height, 200ms staggered left to right
- Time period toggle: bars animate from old values to new, 300ms
- Bell curve fades in after bars finish animating, 200ms

#### 3.6 Data Requirements

No new entities. Histogram queries the Rating entity from FM-004.

**Key Queries:**

| Statistic | Query |
|-----------|-------|
| Rating counts | `SELECT rating_value, COUNT(*) FROM ratings WHERE rating_value IS NOT NULL GROUP BY rating_value` |
| Mean | `SELECT AVG(rating_value) FROM ratings WHERE rating_value IS NOT NULL` |
| Median | Sort all rating_value, take middle value (or average of two middle values if even count) |
| Mode | rating_value with highest COUNT |
| Std Dev | `sqrt(AVG(rating_value^2) - AVG(rating_value)^2)` |
| Unrated count | `SELECT COUNT(*) FROM films WHERE watch_status = 'watched' AND id NOT IN (SELECT film_id FROM ratings WHERE rating_value IS NOT NULL)` |

#### 3.7 Business Logic Rules

##### Histogram Computation

**Purpose:** Compute the rating frequency distribution.

**Inputs:**
- period: "month" | "year" | "all_time"

**Logic:**

```
1. Determine date range based on period
2. Query: SELECT rating_value, COUNT(*) as count
   FROM ratings
   WHERE rating_value IS NOT NULL
   AND viewing_date within date range
   GROUP BY rating_value
   ORDER BY rating_value ASC
3. Fill missing values with 0 (e.g., if no films rated 1.5, set count to 0)
4. RETURN array of 10 { value, count } entries
```

##### Summary Statistics Computation

**Purpose:** Compute mean, median, mode, and standard deviation.

**Inputs:**
- ratings: array of rating_value floats

**Logic:**

```
1. IF ratings is empty THEN RETURN all "N/A"
2. mean = SUM(ratings) / COUNT(ratings)
   Round to 1 decimal place
3. Sort ratings ascending
   IF count is odd: median = middle value
   IF count is even: median = (lower_middle + upper_middle) / 2
   Round to 1 decimal place
4. mode = value with highest frequency
   IF tie: report all tied values (e.g., "3.5 and 4.0")
5. std_dev = sqrt( SUM((r - mean)^2 for r in ratings) / COUNT(ratings) )
   Round to 2 decimal places
6. RETURN { mean, median, mode, std_dev }
```

**Formulas:**
- `mean = SUM(rating_values) / COUNT(rating_values)`
- `median = middle value of sorted rating_values`
- `mode = rating_value with highest COUNT`
- `std_dev = sqrt(SUM((r_i - mean)^2) / n)`

**Edge Cases:**
- 1 rating: mean = median = mode = that value; std_dev = 0.00
- All same rating: std_dev = 0.00, single bar at max height
- Exactly 2 ratings (e.g., 2.0 and 4.0): median = 3.0, std_dev calculated normally
- Multiple modes (tie): report all tied values
- No ratings in selected period: "N/A" for all stats

**Sort/Filter/Ranking Logic:**
- **Bars ordered:** 0.5, 1.0, 1.5, ..., 5.0 (always left to right, low to high)
- **No sort options:** Fixed order

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No ratings exist | Empty state: "Rate your first film to see your rating distribution." | User rates a film |
| Stats query fails | Toast: "Could not load rating distribution." | User navigates away and back |
| Very few ratings (1-9) | Histogram shown but note: "More ratings needed for trend analysis" | Bell curve hidden |

**Validation Timing:**
- Histogram computes on screen open and on time period toggle
- No user input to validate

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has rated 50 films across various values,
   **When** the Ratings Histogram screen opens,
   **Then** 10 bars display with correct counts, the tallest bar is highlighted, and summary stats are shown.

2. **Given** the user taps the bar for rating 4.0,
   **When** navigation occurs,
   **Then** the library screen opens filtered to films with a 4.0 rating.

3. **Given** the user's mean rating is 3.6 and median is 4.0,
   **When** summary stats are displayed,
   **Then** "Mean: 3.6" and "Median: 4.0" are shown with star icons.

**Edge Cases:**

4. **Given** all 20 rated films have a rating of 4.0,
   **When** the histogram displays,
   **Then** only the 4.0 bar has height (count: 20); all other bars are at 0; std_dev shows "0.00".

5. **Given** the user has 0 rated films,
   **When** the histogram screen opens,
   **Then** the empty state is shown: "Rate your first film to see your rating distribution."

**Negative Tests:**

6. **Given** the user has 3 rated films (fewer than 10),
   **When** the histogram displays,
   **Then** the bell curve overlay is hidden and a note says "More ratings needed for trend analysis."

7. **Given** the user selects "Month" and has 0 ratings this month,
   **When** the histogram reloads,
   **Then** all bars are at 0 and stats show "N/A".

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| counts ratings per value | ratings: [3.0, 3.0, 4.0, 4.5, 4.5, 4.5] | {3.0: 2, 4.0: 1, 4.5: 3, all others: 0} |
| calculates mean | ratings: [3.0, 4.0, 5.0] | mean: 4.0 |
| calculates median odd count | ratings: [2.0, 3.5, 4.0] | median: 3.5 |
| calculates median even count | ratings: [2.0, 3.0, 4.0, 5.0] | median: 3.5 |
| calculates mode | ratings: [3.0, 3.0, 4.0, 4.5, 4.5, 4.5] | mode: 4.5 |
| calculates mode tie | ratings: [3.0, 3.0, 4.0, 4.0] | mode: "3.0 and 4.0" |
| calculates std dev | ratings: [2.0, 4.0] | std_dev: 1.00 |
| std dev of identical ratings | ratings: [4.0, 4.0, 4.0] | std_dev: 0.00 |
| fills missing values with zero | ratings: [3.0, 5.0] | 10 entries, 8 with count 0 |
| handles empty ratings | ratings: [] | all stats: "N/A" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Time period filtering | 1. Open histogram, 2. Select "Year", 3. Verify counts | Only ratings from current year shown |
| Bar tap navigation | 1. Open histogram, 2. Tap 4.0 bar | Library opens filtered to 4.0-rated films |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Analyze rating habits | 1. User has 100 rated films, 2. Open histogram | Full distribution shown, mean/median/mode/std_dev computed, tallest bar highlighted |

---

### FM-011: Actor and Director Browsing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-011 |
| **Feature Name** | Actor and Director Browsing |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to browse all films I have watched by a specific director, so that I can track how much of a director's filmography I have seen and find gaps.

**Secondary:**
> As a film student, I want to see all films featuring a specific actor in my library, so that I can explore an actor's career through my own watched history.

#### 3.3 Detailed Description

Actor and Director Browsing lets users view their library through the lens of filmmakers. Tapping a director name (from a Film Detail screen, Stats screen, or Year-in-Review) navigates to a Director Filmography screen showing all films by that director in the user's library. Similarly, tapping an actor name opens an Actor Filmography screen.

Each filmography screen shows:
- The filmmaker's name as a large header
- Summary stats: total films in library, films watched vs. want to watch, average user rating
- A chronological list of all films by that filmmaker in the user's library (sorted by release_year)
- Each film row shows poster, title, year, user rating, and watch status

The filmography is built entirely from the user's local library data. It does not fetch the filmmaker's complete filmography from TMDb (which would require network access and would show films not in the user's library). This keeps the feature privacy-first and offline-capable.

An optional "TMDb Filmography Lookup" button at the bottom of the screen allows the user to fetch the filmmaker's full filmography from TMDb, showing which films the user has watched (green check) and which they have not (grayed out with an "Add to Watchlist" button). This requires network access and is a convenience feature, not a core requirement.

Users can also access a "Browse by Director" or "Browse by Actor" index from the Stats screen, which shows an alphabetical list of all directors or actors in the user's library with their film counts.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records with directors (JSON array) and cast (JSON array with name and character)
- FM-002: TMDb Search - For optional TMDb filmography lookup

**External Dependencies:**
- Network access (optional, only for TMDb filmography lookup feature)
- TMDb API (optional, for `/person/{id}/movie_credits` endpoint)

**Assumed Capabilities:**
- Films have been added with director and/or cast metadata

#### 3.5 User Interface Requirements

##### Screen: Director/Actor Filmography

**Layout:**
- Top navigation bar: back button, filmmaker name as title
- Below nav: filmmaker summary card:
  - Name (large text)
  - "X films in your library" subtitle
  - "Y watched, Z on watchlist" breakdown
  - "Avg rating: X.X" (only for watched and rated films, or "N/A")
- Main area: scrollable vertical list of films, sorted by release_year (oldest first by default)
- Each film row: poster thumbnail (40x60), title, release year, user rating (compact stars or "Not rated"), watch status badge (green "Watched" or gray "Watchlist")
- Sort toggle at top-right: "Year" (default) or "Rating"
- Optional bottom section: "Look up full filmography on TMDb" button (requires network)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Populated | 1+ films by this filmmaker in library | Film list with summary stats |
| Single Film | Exactly 1 film | Single film shown, stats still displayed |
| All Watched | All films by filmmaker are watched | Summary shows "All X watched" |
| Mixed Status | Some watched, some on watchlist | Summary shows "Y watched, Z on watchlist" |
| TMDb Lookup Active | User tapped "Look up full filmography" | Loading indicator, then expanded list with unwatched films grayed out |
| TMDb Lookup Offline | No network when lookup tapped | Toast: "Filmography lookup requires internet connection." |

**Interactions:**
- Tap film row: navigates to Film Detail screen
- Tap sort toggle: switches between release year order and rating order
- Tap "Look up full filmography": fetches TMDb filmography, expands list
- Tap "Add to Watchlist" on TMDb result: adds film to library as want_to_watch

**Transitions/Animations:**
- Film list fades in, 150ms stagger per row
- TMDb filmography results append below existing films with slide-in animation

##### Screen: Browse by Director/Actor Index

**Layout:**
- Top navigation bar: "Directors" or "Actors" title, search bar
- Alphabetical scrollable list of filmmakers
- Each row: filmmaker name, film count badge (e.g., "5 films"), average rating (compact)
- Alphabet fast-scroll indicator on right edge
- Search bar filters list by name substring

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No directors/actors in library | "Add films with metadata to browse filmmakers" |
| Populated | 1+ filmmakers | Alphabetical list with counts |
| Search Active | User typing in search bar | Filtered list matching query |
| No Search Results | Query matches 0 filmmakers | "No filmmakers matching '[query]'" |

**Interactions:**
- Tap filmmaker row: navigates to Filmography screen for that person
- Tap/drag alphabet indicator: fast-scroll to that letter section
- Type in search: filters list in real-time (200ms debounce)

#### 3.6 Data Requirements

No new entities are introduced. Filmmaker data is extracted from Film.directors (JSON array of strings) and Film.cast (JSON array of objects with name and character fields).

**Computed Data:**

| Computation | Source | Query |
|-------------|--------|-------|
| All directors | Film.directors | Parse JSON arrays, collect unique director names across all films |
| All actors | Film.cast | Parse JSON arrays, collect unique actor names across all films |
| Films by director | Film.directors | Filter films where directors JSON contains the target name |
| Films by actor | Film.cast | Filter films where cast JSON contains object with matching name |
| Director film count | Films by director | COUNT of matching films |
| Director avg rating | Ratings for matching films | AVG(rating_value) for rated films |

#### 3.7 Business Logic Rules

##### Filmmaker Index Generation

**Purpose:** Build the alphabetical index of all directors or actors in the user's library.

**Inputs:**
- filmmaker_type: "director" | "actor"

**Logic:**

```
1. FOR each film in library:
   IF filmmaker_type == "director":
     Parse directors JSON array
     Add each director name to index
   ELSE:
     Parse cast JSON array
     Add each actor name to index
2. For each unique filmmaker name:
   Count total films
   Compute average rating (from primary ratings of their films)
3. Sort alphabetically by last name (split on space, sort by last token)
   Tiebreaker: first name alphabetical
4. RETURN list of { name, film_count, avg_rating }
```

**Edge Cases:**
- Director with null name: excluded from index
- Same person as director and actor: appears in both indexes independently
- Director name variations (e.g., "James Cameron" vs. "James F. Cameron"): treated as different people (no fuzzy matching)
- Film with empty directors array: no director entries generated
- Actor with no character name: still included in index

##### Filmography Retrieval

**Purpose:** Get all films by a specific filmmaker from the user's library.

**Inputs:**
- filmmaker_name: string
- filmmaker_type: "director" | "actor"

**Logic:**

```
1. IF filmmaker_type == "director":
     Query: SELECT * FROM films
     WHERE directors JSON array contains filmmaker_name
   ELSE:
     Query: SELECT * FROM films
     WHERE cast JSON array contains object with name = filmmaker_name
2. For each film, get primary rating (most recent via FM-004 logic)
3. Sort by release_year ASC (default) or by rating DESC
4. Compute summary:
   total_films = COUNT(*)
   watched_count = COUNT WHERE watch_status = 'watched'
   watchlist_count = COUNT WHERE watch_status = 'want_to_watch'
   avg_rating = AVG of primary ratings for rated films
5. RETURN { summary, films }
```

**Edge Cases:**
- Director of 0 films in library: should not appear in index (filtered out)
- JSON contains check is case-insensitive to handle minor case variations
- Film with multiple directors: appears in filmography for each director

**Sort/Filter/Ranking Logic:**
- **Filmmaker index default sort:** Alphabetical by last name
- **Filmography default sort:** Release year ascending (oldest first)
- **Alternative filmography sort:** Rating descending (highest first)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Malformed directors/cast JSON | Filmmaker excluded from index; logged as warning | Data integrity check in settings |
| TMDb filmography lookup fails | Toast: "Could not load filmography. Check your connection." | "Retry" button appears |
| TMDb filmography lookup offline | Toast: "Filmography lookup requires internet connection." | User connects to network |
| Filmmaker name is empty string | Excluded from index | Not displayed |

**Validation Timing:**
- Index builds on screen open (cached after first computation until data changes)
- TMDb lookup is user-initiated

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 5 Christopher Nolan films in their library,
   **When** the user taps "Christopher Nolan" on a Film Detail screen,
   **Then** the Director Filmography screen shows 5 films sorted by release year with summary stats.

2. **Given** the user opens "Browse by Director" from Stats,
   **When** the index loads,
   **Then** an alphabetical list of all directors appears with film counts and average ratings.

3. **Given** the filmmaker index shows 3 Nolan films watched and 1 on watchlist,
   **When** the filmography summary loads,
   **Then** it shows "4 films in your library" and "3 watched, 1 on watchlist".

4. **Given** the user taps "Look up full filmography on TMDb" for Nolan,
   **When** the TMDb API returns 12 films,
   **Then** 5 films show green check marks (in library), 7 show grayed out with "Add to Watchlist" buttons.

**Edge Cases:**

5. **Given** a film has 2 directors (e.g., "The Matrix" by Wachowskis),
   **When** viewing either director's filmography,
   **Then** the film appears in both directors' filmographies.

6. **Given** the filmmaker index is opened with no films having director metadata,
   **When** the screen loads,
   **Then** the empty state message appears: "Add films with metadata to browse filmmakers."

**Negative Tests:**

7. **Given** the user taps TMDb lookup while offline,
   **When** the request fails,
   **Then** a toast message appears: "Filmography lookup requires internet connection."

8. **Given** a film has a malformed directors JSON field,
   **When** the index builds,
   **Then** that film is excluded from the director index without crashing.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| extracts unique directors | films: [directors: '["Nolan"]'], [directors: '["Nolan","Spielberg"]'] | unique: ["Nolan", "Spielberg"] |
| sorts by last name | directors: ["Christopher Nolan", "Steven Spielberg", "Martin Scorsese"] | ["Nolan", "Scorsese", "Spielberg"] |
| counts films per director | Nolan: 5 films, Spielberg: 3 films | {Nolan: 5, Spielberg: 3} |
| computes director avg rating | Nolan films rated [4.0, 4.5, 5.0] | avg: 4.5 |
| handles empty directors array | directors: '[]' | no directors extracted |
| handles null directors | directors: null | no directors extracted |
| extracts actors from cast JSON | cast: '[{"name":"DiCaprio","character":"Cobb"}]' | actor: "DiCaprio" |
| case-insensitive filmmaker match | search: "nolan", director: "Nolan" | match: true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Navigate from film detail to director | 1. Open film by Nolan, 2. Tap director name | Director filmography opens with all Nolan films |
| Browse by director index | 1. Open Stats, 2. Tap "Browse by Director" | Alphabetical list of directors with counts |
| Search filmmaker index | 1. Open director index, 2. Type "Kub" | "Stanley Kubrick" appears in filtered list |
| TMDb filmography lookup | 1. Open Nolan filmography, 2. Tap "Look up full filmography" | TMDb results show with watched indicators |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Explore a director's work | 1. Watch 4 Kubrick films, 2. Open Kubrick filmography, 3. Look up TMDb filmography | 4 films with green checks, remaining Kubrick films shown grayed out with "Add" buttons |
| Build actor watchlist | 1. Open actor "Saoirse Ronan" filmography, 2. TMDb lookup, 3. Add 2 unwatched films | 2 new films added to watchlist, filmography shows updated counts |

---

### FM-012: Tags and Categorization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-012 |
| **Feature Name** | Tags and Categorization |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to add custom tags to films (e.g., "comfort watch", "visually stunning", "mind-bending", "foreign gem"), so that I can organize films by personal categories that go beyond standard genres.

**Secondary:**
> As a film student, I want to tag films by thematic elements (e.g., "class struggle", "existentialism", "unreliable narrator"), so that I can group films by analytical themes for study and comparison.

#### 3.3 Detailed Description

Tags and Categorization gives users a free-form tagging system for adding personal labels to films. Unlike genres (which are fixed, TMDb-sourced categories like "Drama" or "Sci-Fi"), tags are entirely user-defined. Users create tags as needed and assign them to any number of films. A film can have any number of tags, and a tag can be applied to any number of films.

Tags are simple text labels (max 50 characters each). They are case-insensitive for matching ("Comfort Watch" and "comfort watch" are the same tag) but preserve the casing of the first instance created. Users can create tags inline when adding or editing a film, or manage their full tag list from a dedicated Tag Management screen.

The library can be filtered by one or more tags (FM-006 integration). When filtering by multiple tags, the behavior is AND logic - only films that have ALL selected tags are shown. This allows precise filtering like "comfort watch" AND "sci-fi themed" to find science fiction comfort films.

A Tag Cloud or Tag List view shows all tags with their film counts, allowing users to tap any tag to see all films with that tag. Tags that are no longer assigned to any film can be deleted from the tag management screen.

Users can assign colors to tags for visual distinction. A predefined palette of 12 colors is available. Tags without a color assignment default to the accent color.

Maximum tags per film: 20. Maximum total tags in library: 200.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records must exist to attach tags to

**External Dependencies:**
- None (tags are entirely local data)

**Assumed Capabilities:**
- Local database supports many-to-many join tables

#### 3.5 User Interface Requirements

##### Component: Tag Input (inline on Film Detail / Edit Film)

**Layout:**
- Section header: "Tags"
- Horizontal scrollable row of tag chips (rounded rectangles with tag name, colored background)
- "+" button at the end of the row to add a new tag
- Each chip has a small "x" dismiss button (only in edit mode)

**Interactions:**
- Tap "+": opens tag picker/creator inline dropdown
- Tap "x" on chip: removes tag from this film (with no confirmation - immediate)
- Tap chip (not in edit mode): navigates to library filtered by that tag

##### Modal: Tag Picker/Creator

**Layout:**
- Dropdown or bottom sheet
- Search/create text input at top: "Search or create tag..."
- Below input: list of existing tags matching the query, each with checkbox and film count
- If query does not match any existing tag: "Create '[query]'" option at the top of the list
- Tags already assigned to the current film have filled checkboxes

**Interactions:**
- Type in input: filters existing tags by substring match (case-insensitive)
- Tap existing tag: toggles assignment to/from current film
- Tap "Create '[query]'": creates new tag, assigns it to current film, closes picker
- Tap outside: closes picker, changes are already saved

##### Screen: Tag Management

**Layout:**
- Top navigation bar: "Tags" title, accessible from Settings
- List of all tags in the library, sorted by film count descending
- Each row: colored tag chip, tag name, film count (e.g., "12 films"), color picker dot
- Swipe left on row: "Delete" action (deletes tag and all its film associations)
- Tap row: navigates to library filtered by that tag
- Bottom: total count "X tags"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No tags exist | Centered: "No tags yet. Add tags to films from the film detail screen." |
| Populated | 1+ tags exist | Sorted list of tags with counts |

**Interactions:**
- Tap tag row: navigates to library filtered by that tag
- Tap color dot: opens color picker (12 predefined colors)
- Swipe left: "Delete" with confirmation ("Delete tag '[name]'? This will remove the tag from all X films.")
- Tap tag name: inline edit to rename tag

#### 3.6 Data Requirements

##### Entity: Tag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, min 1 char after trim, max 50 chars, unique (COLLATE NOCASE) | None | Tag label |
| color | TEXT | Optional, one of 12 predefined hex values | null (uses accent color) | Tag chip background color |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

##### Entity: FilmTag (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film being tagged |
| tag_id | TEXT (UUID) | Foreign key to Tag.id, required | None | Tag being applied |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | When tag was applied |

**Relationships:**
- Tag has many Films through FilmTag (many-to-many)
- Film has many Tags through FilmTag (many-to-many)

**Indexes:**
- `Tag.name COLLATE NOCASE` (unique) - Dedup and lookup by name
- `FilmTag.film_id` - Get all tags for a film
- `FilmTag.tag_id` - Get all films for a tag
- `FilmTag.film_id, tag_id` (unique) - Prevent duplicate tag-film assignment

**Validation Rules:**
- `Tag.name`: Must not be empty after trim; max 50 characters; unique (case-insensitive)
- `Tag.color`: If provided, must be one of the 12 predefined hex values
- `FilmTag`: Same tag cannot be applied twice to the same film
- Maximum 20 tags per film (checked before adding)
- Maximum 200 total tags in library (checked before creating)

**Predefined Color Palette:**

| Color Name | Hex Value |
|-----------|-----------|
| Red | #E74C3C |
| Orange | #E67E22 |
| Yellow | #F1C40F |
| Green | #2ECC71 |
| Teal | #1ABC9C |
| Blue | #3498DB |
| Indigo | #6366F1 |
| Purple | #9B59B6 |
| Pink | #EC4899 |
| Rose | #F43F5E |
| Gray | #95A5A6 |
| Brown | #8B5E3C |

**Example Data:**

```json
{
  "tag": {
    "id": "t1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "name": "comfort watch",
    "color": "#2ECC71",
    "created_at": "2026-02-01T10:00:00Z",
    "updated_at": "2026-02-01T10:00:00Z"
  },
  "film_tag": {
    "id": "ft-001",
    "film_id": "f-inception",
    "tag_id": "t1a2b3c4...",
    "created_at": "2026-02-01T10:05:00Z"
  }
}
```

#### 3.7 Business Logic Rules

##### Tag Creation and Deduplication

**Purpose:** Create a new tag or find an existing one by name.

**Inputs:**
- name: string

**Logic:**

```
1. Trim whitespace from name
2. IF name is empty THEN RETURN validation error
3. IF name length > 50 THEN RETURN validation error
4. Query: SELECT * FROM tags WHERE name = {name} COLLATE NOCASE
5. IF result exists THEN RETURN existing tag (do not create duplicate)
6. Check total tag count: SELECT COUNT(*) FROM tags
   IF count >= 200 THEN RETURN limit error
7. INSERT new tag with name (preserving original casing)
8. RETURN new tag
```

**Edge Cases:**
- "comfort watch" and "Comfort Watch": treated as same tag (case-insensitive dedup)
- Leading/trailing spaces: trimmed before comparison
- Tag with only spaces: rejected (empty after trim)

##### Tag Filtering (AND Logic)

**Purpose:** Filter library to films that have ALL selected tags.

**Inputs:**
- selected_tag_ids: array of tag UUIDs

**Logic:**

```
1. IF selected_tag_ids is empty THEN RETURN all films (no filter)
2. Query: SELECT film_id FROM film_tags
   WHERE tag_id IN ({selected_tag_ids})
   GROUP BY film_id
   HAVING COUNT(DISTINCT tag_id) = {selected_tag_ids.length}
3. Filter library to only these film_ids
4. RETURN filtered film list
```

**Edge Cases:**
- Single tag selected: simple filter (show all films with that tag)
- Multiple tags, no films match all: empty result set
- Film with 0 tags: never appears when tag filter is active

**Sort/Filter/Ranking Logic:**
- **Tag management list sort:** Film count descending (most used first)
- **Tag picker sort:** Alphabetical by tag name
- **Tag chips on film detail:** Alphabetical order

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Tag limit reached (200) | Toast: "Maximum 200 tags reached. Delete unused tags to create new ones." | User deletes tags from Tag Management |
| Tag-per-film limit reached (20) | Toast: "Maximum 20 tags per film." | User removes a tag before adding new one |
| Duplicate tag name | Existing tag returned silently (no error) | Normal behavior |
| Tag delete with films | Confirmation: "Delete tag '[name]'? This will remove the tag from all X films." | User confirms or cancels |
| Database write fails | Toast: "Could not save tag. Please try again." | User retries |

**Validation Timing:**
- Tag name validation: on creation/rename (blur and save)
- Limit checks: before insert operations

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a film with no tags,
   **When** the user taps "+", types "comfort watch", and taps "Create 'comfort watch'",
   **Then** a new tag is created and assigned to the film, shown as a colored chip.

2. **Given** a tag "comfort watch" already exists,
   **When** the user types "comfort" in the tag picker for a different film,
   **Then** the existing tag appears in the dropdown; tapping it assigns it to the film.

3. **Given** 3 films have the tag "mind-bending",
   **When** the user taps the "mind-bending" chip on any film,
   **Then** the library filters to show exactly those 3 films.

4. **Given** a tag "comfort watch" has a green color,
   **When** the tag chip is displayed,
   **Then** the chip background is green (#2ECC71).

**Edge Cases:**

5. **Given** the user tries to create "Comfort Watch" when "comfort watch" already exists,
   **When** the creation query runs,
   **Then** the existing "comfort watch" tag is returned (no duplicate created).

6. **Given** a user has 200 tags,
   **When** they try to create a 201st tag,
   **Then** a toast shows "Maximum 200 tags reached."

**Negative Tests:**

7. **Given** a film has 20 tags,
   **When** the user tries to add a 21st tag,
   **Then** a toast shows "Maximum 20 tags per film."

8. **Given** the user enters only whitespace in the tag name,
   **When** creation is attempted,
   **Then** the tag is not created and a validation error appears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates tag with valid name | name: "comfort watch" | tag created with name "comfort watch" |
| deduplicates case-insensitive | existing: "comfort watch", new: "Comfort Watch" | returns existing tag |
| trims whitespace | name: "  comfort watch  " | tag name: "comfort watch" |
| rejects empty name | name: "   " | validation error |
| rejects name over 50 chars | name: 51 chars | validation error |
| AND filter with 2 tags | tags: [A, B], films: [f1(A,B), f2(A), f3(B)] | result: [f1] |
| AND filter with 1 tag | tags: [A], films: [f1(A,B), f2(A)] | result: [f1, f2] |
| validates color hex | color: "#2ECC71" | valid |
| rejects invalid color hex | color: "#ZZZZZZ" | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and assign tag | 1. Open film, 2. Add tag "favorite", 3. View tags | Tag chip appears on film |
| Remove tag from film | 1. Film has tag "favorite", 2. Tap x on chip | Tag removed from film, tag still exists in library |
| Delete tag entirely | 1. Open Tag Management, 2. Swipe "favorite", 3. Confirm delete | Tag deleted, removed from all films |
| Filter by tag | 1. Tag 3 films with "noir", 2. Tap "noir" chip | Library shows 3 films |
| Rename tag | 1. Open Tag Management, 2. Tap tag name, 3. Edit to new name | Tag renamed across all films |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Organize by themes | 1. Create tags: "mind-bending", "comfort watch", "tearjerker", 2. Assign to various films, 3. Filter library by "mind-bending" | Library shows only mind-bending tagged films |
| Manage tag library | 1. Create 5 tags, 2. Open Tag Management, 3. Delete unused tag, 4. Change color of another | 4 tags remain, colors updated |

---

### FM-013: Letterboxd CSV Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-013 |
| **Feature Name** | Letterboxd CSV Import |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a Letterboxd migrant, I want to import my complete Letterboxd data (watched films, ratings, reviews, watchlist, lists) from a CSV export, so that I can switch to MyFilms without losing years of film tracking history.

**Secondary:**
> As a casual viewer switching from Letterboxd, I want the import to be simple and reliable with a clear preview of what will be imported before I commit, so that I can trust the process with my data.

#### 3.3 Detailed Description

Letterboxd CSV Import allows users to import their film data from Letterboxd's CSV export files. Letterboxd provides a data export feature (Settings > Import & Export > Export Your Data) that produces a ZIP archive containing several CSV files: `films.csv`, `diary.csv`, `ratings.csv`, `reviews.csv`, `watchlist.csv`, and `lists.csv`.

The import process is designed to be safe, reversible (via undo within 30 seconds), and transparent. It follows these phases:

1. **File Selection:** User selects the Letterboxd ZIP archive or individual CSV files from their device.
2. **Parsing:** The app parses the CSV files and extracts structured data.
3. **Preview:** The app shows a summary of what will be imported (e.g., "247 watched films, 180 ratings, 42 reviews, 35 watchlist films, 5 lists").
4. **Duplicate Detection:** Films already in the library (matched by title + year) are flagged. The user chooses: skip duplicates, overwrite existing, or import as new.
5. **TMDb Enrichment (optional):** For each imported film, the app can optionally look up TMDb metadata to fill in poster, genres, cast, runtime, and other metadata. This requires network access and may take time for large imports (estimated: 1-2 seconds per film due to API rate limits).
6. **Import Execution:** Films, ratings, reviews, and lists are inserted into the database in a single transaction.
7. **Results Report:** A summary screen shows what was imported, what was skipped, and any errors.

The key Letterboxd CSV formats:

**films.csv columns:** Date, Name, Year, Letterboxd URI, Rating (0.5-5.0, optional)
**diary.csv columns:** Date, Name, Year, Letterboxd URI, Rating, Rewatch, Tags, Watched Date
**ratings.csv columns:** Date, Name, Year, Letterboxd URI, Rating
**reviews.csv columns:** Date, Name, Year, Letterboxd URI, Rating, Rewatch, Review, Tags
**watchlist.csv columns:** Date, Name, Year, Letterboxd URI
**lists.csv:** Multiple files, each with Date, Name, Year, Letterboxd URI, Description

The import creates Film records for each unique film, Rating records for each rating, Review text appended to the Rating record, DiaryEntry records for diary entries, and Collection records for Letterboxd lists.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film record structure
- FM-004: Ratings and Reviews - Rating/review record structure
- FM-005: Collections and Lists - Collection structure for Letterboxd lists
- FM-007: Film Diary Calendar - DiaryEntry structure for diary import

**External Dependencies:**
- File system access (to read selected CSV/ZIP files)
- Network access (optional, for TMDb metadata enrichment)

**Assumed Capabilities:**
- User has exported their data from Letterboxd as a ZIP archive
- Device supports file picker for selecting ZIP/CSV files

#### 3.5 User Interface Requirements

##### Screen: Import Source Selection

**Layout:**
- Top navigation bar: "Import Data" title
- List of import source options:
  - "Letterboxd" with Letterboxd icon and "Import from Letterboxd CSV export"
  - "IMDb" with IMDb icon and "Import from IMDb CSV export" (FM-019)
- Each option has a chevron indicating it navigates forward

**Interactions:**
- Tap "Letterboxd": navigates to Letterboxd Import screen

##### Screen: Letterboxd Import

**Layout:**
- Step indicator at top: "Step 1 of 4: Select File"
- Instructions text: "Export your data from Letterboxd (Settings > Import & Export > Export Your Data). Then select the ZIP archive below."
- "Select ZIP File" large button (centered)
- Below button: "Or select individual CSV files" link for advanced users

Step progression:
- Step 1: Select File
- Step 2: Preview (parsing complete, showing import summary)
- Step 3: Options (duplicate handling, TMDb enrichment toggle)
- Step 4: Import (progress and results)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Step 1: Ready | No file selected | Instructions and file select button |
| Step 1: File Selected | ZIP/CSV selected | File name shown, "Continue" button enabled |
| Step 2: Parsing | File being parsed | Progress bar, "Parsing [filename]..." |
| Step 2: Preview | Parse complete | Summary table: films, ratings, reviews, watchlist, lists with counts |
| Step 3: Options | User reviewing options | Duplicate handling radio buttons, TMDb enrichment toggle |
| Step 4: Importing | Import in progress | Progress bar with "Importing film X of Y...", estimated time remaining |
| Step 4: Complete | Import finished | Results summary with counts of imported, skipped, and errored items |
| Error: Invalid File | File is not valid CSV/ZIP | Error message: "This file does not appear to be a valid Letterboxd export." |
| Error: Parse Failed | CSV parsing failed | Error message with specific row/column details |

**Interactions:**
- Tap "Select ZIP File": opens device file picker, filtered to .zip files
- Tap "Or select individual CSV files": opens file picker for .csv files (multi-select)
- Tap "Continue" (Step 2): moves to options
- Toggle "Enrich with TMDb metadata": enables/disables network lookup
- Radio "Skip duplicates" / "Overwrite existing" / "Import as new": duplicate handling choice
- Tap "Start Import" (Step 3): begins import process
- Tap "Done" (Step 4): returns to library

**Transitions/Animations:**
- Step transitions: horizontal slide left, 250ms
- Progress bar: smooth fill animation
- Results appear with staggered fade-in

#### 3.6 Data Requirements

No new entities are introduced. Import creates records in existing entities: Film, Rating, Collection, CollectionFilm, DiaryEntry.

**CSV Parsing Rules:**

| Source File | Target Entity | Field Mapping |
|------------|--------------|---------------|
| films.csv: Name | Film.title | Direct mapping |
| films.csv: Year | Film.release_year | Direct mapping (integer) |
| films.csv: Rating | Rating.rating_value | Direct mapping (float, 0.5-5.0) |
| films.csv: Date | Film.created_at | ISO date parsing |
| diary.csv: Watched Date | DiaryEntry.viewing_date / Film.watched_date | ISO date parsing |
| diary.csv: Rewatch | Rating.is_rewatch | "Yes" = 1, else 0 |
| diary.csv: Tags | Tags (FM-012) | Comma-separated, create tags as needed |
| reviews.csv: Review | Rating.review_text | Direct mapping (text) |
| watchlist.csv: Name, Year | Film with watch_status = 'want_to_watch' | Creates Film record |
| lists.csv: (each file) | Collection + CollectionFilm | One Collection per list file |

**Example Letterboxd CSV Row (diary.csv):**

```csv
Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2025-12-15,Inception,2010,https://letterboxd.com/film/inception/,4.5,No,"sci-fi, mind-bending",2025-12-14
```

#### 3.7 Business Logic Rules

##### CSV Parsing Algorithm

**Purpose:** Parse Letterboxd CSV files into structured import candidates.

**Inputs:**
- file_contents: raw CSV text
- file_type: "films" | "diary" | "ratings" | "reviews" | "watchlist" | "lists"

**Logic:**

```
1. Split file into rows by newline (handle \r\n and \n)
2. Parse header row to identify column positions
3. FOR each data row:
   a. Parse fields respecting CSV quoting (fields with commas are quoted)
   b. Validate required fields (Name is always required)
   c. Normalize data:
      - Trim whitespace from all fields
      - Parse Year as integer
      - Parse Rating as float (0.5-5.0)
      - Parse Date as ISO date
      - Parse Rewatch as boolean ("Yes" = true)
      - Parse Tags as comma-separated list
   d. IF row is valid, add to import_candidates
   e. IF row is invalid, add to errors with row number and reason
4. RETURN { candidates: [...], errors: [...], total_rows }
```

**Edge Cases:**
- Empty rows: skipped
- Missing Year: film still imported, release_year = null
- Rating of 0 or missing: no Rating record created (unrated)
- Review with line breaks: CSV quoting handles this (review in quotes)
- Unicode characters in film titles: preserved as-is
- Duplicate film in same CSV (same title + year): imported once, second occurrence updates rating/review

##### Duplicate Detection

**Purpose:** Identify films in the import that already exist in the user's library.

**Inputs:**
- import_candidates: array of parsed film data
- existing_films: current library

**Logic:**

```
1. FOR each candidate:
   a. Match by title (case-insensitive) AND release_year
   b. IF match found:
      Mark candidate as "duplicate" with existing_film_id
   c. ELSE:
      Mark candidate as "new"
2. RETURN candidates with duplicate/new markers
3. Apply user's duplicate handling choice:
   - "skip": exclude duplicates from import
   - "overwrite": update existing records with import data
   - "import_as_new": create new records regardless (may result in duplicates)
```

**Edge Cases:**
- Same title, different year: not a duplicate
- Title with different capitalization: treated as duplicate (case-insensitive)
- Film in library by TMDb but not by title match: not detected as duplicate (conservative)

##### TMDb Enrichment

**Purpose:** Look up TMDb metadata for imported films to fill in posters, genres, cast, and runtime.

**Inputs:**
- films: array of Film records (title + year only from CSV)

**Logic:**

```
1. FOR each film (sequential, respecting TMDb rate limit of 40 req / 10 sec):
   a. Query TMDb: /search/movie?query={title}&year={year}
   b. IF results found:
      Take first result (highest relevance)
      Fetch details: /movie/{tmdb_id}?append_to_response=credits
      Update film record with: tmdb_id, genres, runtime, cast, directors, poster_url, synopsis, imdb_id
   c. IF no results: skip (film keeps title + year only)
   d. Update progress: "Enriching film X of Y..."
2. RETURN enrichment results: { enriched_count, not_found_count }
```

**Edge Cases:**
- TMDb search returns wrong film (different film with same title): user can correct later
- API rate limit exceeded: pause and retry after 10 seconds
- Network lost during enrichment: stop enrichment, keep already enriched films, import with partial enrichment
- Film title in non-English language: TMDb search may not find it; skip enrichment

**Formulas:**
- `estimated_time_seconds = film_count * 1.5` (average 1.5 seconds per TMDb lookup including rate limiting)

**Sort/Filter/Ranking Logic:**
- **Import order:** Films imported in CSV row order
- **Duplicate detection:** Title + year matching, case-insensitive

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid ZIP/CSV file | Error: "This file does not appear to be a valid Letterboxd export." | User selects correct file |
| CSV missing required columns | Error: "Missing required column: 'Name' in [filename]." | User re-exports from Letterboxd |
| Malformed CSV row | Row added to error list, import continues | Results report shows which rows failed with reasons |
| TMDb API rate limit | Progress paused, "Waiting for API rate limit..." | Auto-resumes after 10 seconds |
| Network lost during enrichment | "Network lost. X of Y films enriched. Continue without enrichment?" | User can finish import without enrichment |
| Import transaction fails | "Import failed. No data was saved. Please try again." | Full rollback, user retries |
| Disk space insufficient | "Not enough storage space. Free X MB to complete import." | User frees space |

**Validation Timing:**
- File validation: immediately after selection
- CSV parsing: during Step 2
- Duplicate detection: during Step 2 (after parsing)
- Import validation: during Step 4 (transactional)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a valid Letterboxd ZIP with 200 films, 150 ratings, and 30 reviews,
   **When** the user selects the file and runs the import with "Skip duplicates" and TMDb enrichment off,
   **Then** 200 Film records, 150 Rating records, and 30 reviews are created, and the results screen shows accurate counts.

2. **Given** a Letterboxd export contains 5 lists,
   **When** the import runs,
   **Then** 5 Collection records are created with the correct films assigned in order.

3. **Given** the user enables TMDb enrichment for 50 films,
   **When** the import runs,
   **Then** a progress bar shows "Enriching film X of 50...", estimated time is displayed, and enriched films have posters, genres, and cast.

4. **Given** 10 films from the import already exist in the library,
   **When** "Skip duplicates" is selected,
   **Then** 10 films are skipped and the results report shows "10 duplicates skipped."

**Edge Cases:**

5. **Given** a CSV row has a missing Name field,
   **When** parsing runs,
   **Then** the row is added to the error list and the import continues for valid rows.

6. **Given** the network is lost during TMDb enrichment at film 25 of 50,
   **When** the connection drops,
   **Then** a prompt appears asking to continue without enrichment; 25 films have metadata, 25 do not.

**Negative Tests:**

7. **Given** the user selects a JPEG file instead of a CSV/ZIP,
   **When** validation runs,
   **Then** an error message appears: "This file does not appear to be a valid Letterboxd export."

8. **Given** the import transaction fails mid-way,
   **When** the error occurs,
   **Then** the entire import is rolled back and no partial data is saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses films.csv correctly | valid CSV with 5 rows | 5 film candidates with title, year, rating |
| parses diary.csv with rewatch | row with Rewatch: "Yes" | is_rewatch: 1 |
| parses reviews with line breaks | review text spanning multiple lines (CSV quoted) | full review text preserved |
| handles missing rating | row with empty Rating column | rating_value: null |
| handles missing year | row with empty Year column | release_year: null |
| detects duplicate by title+year | import: "Inception" 2010, library: "Inception" 2010 | marked as duplicate |
| case-insensitive duplicate check | import: "inception" 2010, library: "Inception" 2010 | marked as duplicate |
| different year is not duplicate | import: "Dune" 2021, library: "Dune" 1984 | marked as new |
| estimates enrichment time | 100 films | estimated: 150 seconds |
| validates CSV has Name column | CSV without Name header | validation error |
| rejects non-CSV file | JPEG file | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full import flow | 1. Select ZIP, 2. Preview, 3. Skip duplicates, 4. Import | Films, ratings, reviews created; library populated |
| Import with enrichment | 1. Select CSV, 2. Enable TMDb, 3. Import | Films enriched with posters and metadata |
| Duplicate overwrite | 1. Import film rated 3.0, 2. Re-import same film rated 4.0 with overwrite | Rating updated to 4.0 |
| Partial CSV import | 1. Select only ratings.csv (not full ZIP) | Ratings imported for films that already exist; new films created with minimal data |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Migrate from Letterboxd | 1. Export data from Letterboxd, 2. Open MyFilms import, 3. Select ZIP, 4. Preview, 5. Import with enrichment | Full library migrated: films, ratings, reviews, lists all present |
| Incremental import | 1. Import initial data, 2. Watch 10 more on Letterboxd, 3. Export again, 4. Import with skip duplicates | Only 10 new films added; existing data unchanged |

---

### FM-014: Data Export (CSV/JSON)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-014 |
| **Feature Name** | Data Export (CSV/JSON) |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious viewer, I want to export all my film data in CSV and JSON formats, so that I own my data completely and can move it to another app or back it up locally.

**Secondary:**
> As a film enthusiast, I want to export specific subsets of my data (e.g., only ratings, only my watchlist, or only a specific collection), so that I can share curated lists without exporting everything.

#### 3.3 Detailed Description

Data Export provides comprehensive export capabilities for all user data in two formats: CSV (for spreadsheet compatibility and Letterboxd-compatible re-import) and JSON (for programmatic use and complete data preservation).

The export screen presents options for what to export: Full Library (all data), Films Only (film records without ratings/reviews), Ratings and Reviews, Watchlist, Diary Entries, Collections (each collection as a separate file or all in one), and Tags. Users select the scope, choose the format, and tap "Export". The generated file is saved to the device and the platform share sheet opens for sharing via email, AirDrop, Files app, or cloud storage.

CSV exports follow a flat structure with one row per record. For the full library export, the CSV includes all film fields plus the primary rating and latest review text (flattened). JSON exports preserve the full relational structure with nested objects (films containing their ratings, reviews, tags, and collection assignments).

Export file naming follows the pattern: `myfilms-[scope]-[YYYY-MM-DD].[csv|json]` (e.g., `myfilms-full-library-2026-03-07.csv`).

For large libraries (1000+ films), export generates a progress indicator and the file is built in chunks to avoid memory pressure. Export of 1000 films should complete within 5 seconds.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records to export
- FM-004: Ratings and Reviews - Rating/review records (optional)
- FM-005: Collections and Lists - Collection data (optional)
- FM-012: Tags and Categorization - Tag data (optional)

**External Dependencies:**
- File system write access
- Platform share sheet API

**Assumed Capabilities:**
- Device has sufficient storage for the export file

#### 3.5 User Interface Requirements

##### Screen: Export Data

**Layout:**
- Top navigation bar: "Export Data" title
- Export scope section:
  - Radio buttons:
    - "Full Library" (all films, ratings, reviews, tags, collections, diary)
    - "Films Only" (film records without associated data)
    - "Ratings and Reviews"
    - "Watchlist Only"
    - "Diary Entries"
    - "Collections" (with sub-option: specific collection picker or all)
    - "Tags and Assignments"
- Format section:
  - Segmented control: "CSV" / "JSON"
  - Below control: format description (CSV: "Spreadsheet-compatible, one row per record" / JSON: "Full data with nested relationships")
- "Export" button (large, primary action)
- Below button: estimated file size (e.g., "~2.4 MB for 500 films")

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Scope and format selected | "Export" button enabled |
| Exporting | Export in progress | Progress bar: "Generating export... X of Y records" |
| Complete | File generated | "Export complete! File saved." with share sheet opened |
| Error | Export failed | Error message with retry button |
| Empty | Selected scope has no data | "No data to export for this selection." Export button disabled |

**Interactions:**
- Tap scope radio: selects export scope
- Tap format toggle: switches between CSV and JSON
- Tap "Export": generates file, opens share sheet
- Tap "Collections" scope: expands to show collection picker (multi-select)

#### 3.6 Data Requirements

No new entities. Export reads from all existing entities and generates output files.

**CSV Column Definitions (Full Library export):**

| Column | Source | Notes |
|--------|--------|-------|
| Title | Film.title | Required |
| Original Title | Film.original_title | Optional |
| Year | Film.release_year | Optional |
| Director(s) | Film.directors | Comma-separated if multiple |
| Runtime (min) | Film.runtime_minutes | Integer |
| Genres | Film.genres | Comma-separated |
| Watch Status | Film.watch_status | "watched" or "want_to_watch" |
| Watched Date | Film.watched_date | ISO date |
| Rating | Primary rating value | 0.5-5.0 or empty |
| Review | Latest review text | Full text |
| Tags | Comma-separated tag names | From FilmTag joins |
| Collections | Comma-separated collection names | From CollectionFilm joins |
| TMDb ID | Film.tmdb_id | Integer or empty |
| IMDb ID | Film.imdb_id | String or empty |
| Date Added | Film.created_at | ISO datetime |

**JSON Structure (Full Library export):**

```json
{
  "export_date": "2026-03-07T10:00:00Z",
  "export_version": "1.0",
  "film_count": 247,
  "films": [
    {
      "title": "Inception",
      "release_year": 2010,
      "directors": ["Christopher Nolan"],
      "runtime_minutes": 148,
      "genres": ["Science Fiction", "Action", "Thriller"],
      "watch_status": "watched",
      "watched_date": "2026-01-15",
      "ratings": [
        { "value": 4.5, "date": "2026-01-15", "review": "...", "is_rewatch": false }
      ],
      "tags": ["mind-bending", "comfort watch"],
      "collections": ["Top 10", "Sci-Fi Favorites"],
      "tmdb_id": 27205,
      "imdb_id": "tt1375666"
    }
  ]
}
```

#### 3.7 Business Logic Rules

##### Export File Generation

**Purpose:** Generate an export file in the selected format with the selected scope.

**Inputs:**
- scope: "full_library" | "films_only" | "ratings_reviews" | "watchlist" | "diary" | "collections" | "tags"
- format: "csv" | "json"

**Logic:**

```
1. Query data based on scope:
   - "full_library": all films with all associated data
   - "films_only": films without ratings, reviews, tags, collections
   - "ratings_reviews": all ratings with film title/year for context
   - "watchlist": films WHERE watch_status = 'want_to_watch'
   - "diary": diary entries with film context
   - "collections": collection metadata + film assignments
   - "tags": tag metadata + film assignments
2. IF format == "csv":
     Generate CSV header row
     FOR each record: generate one row with fields joined by comma
     Handle special characters: quote fields containing commas, newlines, or quotes
     Use UTF-8 BOM for Excel compatibility
3. IF format == "json":
     Build nested JSON object
     Include export metadata (date, version, counts)
     Pretty-print with 2-space indentation
4. Generate filename: myfilms-{scope}-{YYYY-MM-DD}.{csv|json}
5. Write file to device temporary directory
6. Open share sheet with the file
7. RETURN { filename, file_size, record_count }
```

**Formulas:**
- `estimated_file_size_csv = record_count * 200 bytes` (approximate)
- `estimated_file_size_json = record_count * 500 bytes` (approximate, pretty-printed)

**Edge Cases:**
- Film with review containing commas: CSV field is double-quoted
- Film with review containing double quotes: quotes are escaped (doubled)
- Empty library: generates valid file with header row only (CSV) or empty array (JSON)
- Film with no tags, no collections: empty values in CSV, empty arrays in JSON

**Sort/Filter/Ranking Logic:**
- **Export order:** Films sorted by title A-Z (consistent, predictable output)
- **Ratings within a film (JSON):** sorted by viewing_date ascending

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data in selected scope | "No data to export for this selection." Export button disabled | User selects different scope |
| Disk space insufficient | "Not enough storage space. Need approximately X MB." | User frees space |
| File write fails | "Could not create export file. Please try again." | User retries |
| Share sheet cancelled | File remains in temp directory for 24 hours | User can re-export |

**Validation Timing:**
- Data availability check: on scope selection (to enable/disable Export button)
- File generation: on Export button tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 100 films, 80 ratings, and 20 reviews,
   **When** the user selects "Full Library" and "CSV" and taps Export,
   **Then** a CSV file is generated with 101 rows (1 header + 100 data rows), the share sheet opens, and the file is named `myfilms-full-library-2026-03-07.csv`.

2. **Given** the user selects "JSON" format,
   **When** the export runs,
   **Then** the JSON file contains nested film objects with ratings, reviews, tags, and collections.

3. **Given** the user selects "Watchlist Only",
   **When** the export runs,
   **Then** only films with watch_status = "want_to_watch" are included.

4. **Given** the user selects a specific collection "Top 10",
   **When** the export runs,
   **Then** only the 10 films in that collection are exported (in collection order).

**Edge Cases:**

5. **Given** the library is empty,
   **When** "Full Library" scope is selected,
   **Then** the Export button is disabled with message "No data to export."

6. **Given** a film review contains commas and double quotes,
   **When** exported as CSV,
   **Then** the review field is properly quoted and escaped.

**Negative Tests:**

7. **Given** insufficient storage space,
   **When** the export attempts to write the file,
   **Then** an error message shows the required space and no partial file is left.

8. **Given** the user cancels the share sheet,
   **When** the sheet dismisses,
   **Then** the export file is not deleted immediately (available in temp for 24 hours).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates correct CSV header | scope: "full_library" | "Title,Original Title,Year,..." header row |
| CSV escapes commas in fields | review: "Great film, loved it" | field: "\"Great film, loved it\"" |
| CSV escapes double quotes | review: 'He said "wow"' | field: "\"He said \"\"wow\"\"\"" |
| JSON includes export metadata | 100 films | { export_date, export_version: "1.0", film_count: 100 } |
| generates correct filename | scope: "watchlist", date: 2026-03-07 | "myfilms-watchlist-2026-03-07.csv" |
| estimates file size | 500 records, CSV | ~100 KB |
| handles empty library | 0 films | valid file with header only (CSV) or empty array (JSON) |
| sorts films by title | films: ["Zzz", "Aaa", "Mmm"] | CSV rows in order: Aaa, Mmm, Zzz |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full CSV export | 1. Add 10 films with ratings and tags, 2. Export full library CSV | CSV has 11 rows, all fields populated, tags comma-separated |
| Full JSON export | 1. Add 10 films with ratings and tags, 2. Export full library JSON | JSON has nested structure with ratings, tags, collections |
| Scoped export | 1. Add 20 films (15 watched, 5 watchlist), 2. Export watchlist only | CSV/JSON contains only 5 watchlist films |
| Re-import exported data | 1. Export as CSV, 2. Clear library, 3. Import the exported CSV | Library restored with all films |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Backup entire library | 1. User has 500 films, 2. Export full library as JSON, 3. Save to Files app | JSON file saved, ~250 KB, contains all data |
| Share collection | 1. Create "Best of 2025" collection, 2. Export collection as CSV | CSV with collection films shared via share sheet |

---

### FM-015: Rewatch Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-015 |
| **Feature Name** | Rewatch Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to log rewatches of films I have already seen, so that I can track how many times I have watched a film and how my opinion changes over time.

**Secondary:**
> As a casual viewer, I want to quickly log that I rewatched a film without having to re-enter all the film details, so that my diary accurately reflects my viewing history.

#### 3.3 Detailed Description

Rewatch Tracking allows users to log multiple viewings of the same film. When a user watches a film they have already logged as "watched", they can record a rewatch with a new viewing date, a new optional rating, and a new optional review. The original film record stays unchanged - a rewatch creates a new Rating record (with is_rewatch = 1) and a new DiaryEntry.

The Film Detail screen shows a "Log Rewatch" button (visible only for films with watch_status = "watched"). Tapping it opens a quick-log modal with: viewing date (defaults to today), rating picker (defaults to empty), and a review text field. The user can log the rewatch with minimal effort (just confirming the date) or add a full new rating and review.

The Film Detail screen displays a rewatch counter ("Watched X times") and a chronological list of all viewings in the Rating History section (introduced in FM-004). Each viewing shows: date, rating (if provided), review excerpt (if provided), and a "Rewatch" badge.

Rewatch data feeds into statistics (FM-008) and the diary calendar (FM-007). A rewatch counts as a separate viewing for "total films watched" counts but does not add a duplicate film to the library count. Statistics can differentiate between "unique films" and "total viewings" (unique films + rewatches).

The watchlist (FM-003) is not affected by rewatches - a film that is "watched" stays "watched" regardless of rewatches.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records with watch_status
- FM-004: Ratings and Reviews - Rating records with is_rewatch field
- FM-007: Film Diary Calendar - DiaryEntry for rewatch dates

**External Dependencies:**
- None (rewatches are local data)

**Assumed Capabilities:**
- User has at least one watched film to rewatch

#### 3.5 User Interface Requirements

##### Button: Log Rewatch (on Film Detail)

**Layout:**
- Positioned below the rating section on Film Detail screen
- Shown only when film watch_status = "watched"
- Button text: "Log Rewatch" with a refresh/repeat icon
- Below button: "Watched X times" counter (shown when X >= 2)

**Interactions:**
- Tap "Log Rewatch": opens Rewatch Log modal

##### Modal: Rewatch Log

**Layout:**
- Bottom sheet modal, half-height
- Title: "Log Rewatch"
- Film title and year as subtitle (e.g., "Inception (2010)")
- Form fields:
  - Viewing Date: date picker, defaults to today
  - Rating: half-star picker (0.5-5.0), defaults to empty (optional)
  - Review: multiline text input, placeholder "Any new thoughts?" (optional, max 10,000 chars)
- Footer: "Cancel" and "Log" buttons

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Modal opened | Date defaults to today, rating empty, review empty |
| Filled | User entered rating and/or review | "Log" button enabled (always enabled since date has default) |

**Interactions:**
- Tap "Log": creates new Rating record (is_rewatch = 1) and DiaryEntry, updates Film watched_date to rewatch date if it is more recent, closes modal
- Tap "Cancel": dismisses modal, no data saved
- Rating picker: same half-star interaction as FM-004

**Transitions/Animations:**
- Modal slides up, 250ms
- On log, brief success haptic and toast: "Rewatch logged"

##### Component: Rewatch Counter (on Film Detail)

**Layout:**
- Below "Log Rewatch" button
- Text: "Watched X times" (where X = count of all viewings including first watch)
- Only shown when X >= 2

#### 3.6 Data Requirements

No new entities are introduced. Rewatch tracking uses existing Rating and DiaryEntry entities with the is_rewatch flag.

**Modified Query Patterns:**

| Query | Purpose |
|-------|---------|
| `SELECT COUNT(*) FROM ratings WHERE film_id = ? AND (is_rewatch = 1 OR is_rewatch = 0)` | Total viewing count |
| `SELECT COUNT(*) FROM ratings WHERE film_id = ? AND is_rewatch = 1` | Rewatch count only |
| Total viewings = first watch + rewatches | Stats: total viewings across all films |
| Unique films = COUNT(DISTINCT film_id) from watched films | Stats: unique films watched |

#### 3.7 Business Logic Rules

##### Rewatch Logging

**Purpose:** Record a new viewing of an already-watched film.

**Inputs:**
- film_id: UUID (must have watch_status = "watched")
- viewing_date: ISO date (defaults to today)
- rating_value: float (optional, 0.5-5.0)
- review_text: string (optional, max 10,000 chars)

**Logic:**

```
1. Validate film exists and watch_status = "watched"
2. Create new Rating record:
   - film_id = film_id
   - rating_value = rating_value (or null)
   - review_text = review_text (or null)
   - viewing_date = viewing_date
   - is_rewatch = 1
3. Create new DiaryEntry record:
   - film_id = film_id
   - viewing_date = viewing_date
   - rating_id = new rating's id
   - is_rewatch = 1
4. IF viewing_date > film.watched_date THEN
     Update film.watched_date = viewing_date
5. RETURN success
```

**Edge Cases:**
- Rewatching on the same date as original watch: allowed (different Rating records)
- Rewatching a want_to_watch film: not allowed (must be marked as watched first)
- Rewatch with no rating and no review: allowed (just logs the viewing date)
- Multiple rewatches on the same day: each creates a separate Rating and DiaryEntry
- Deleting a rewatch rating: removes that specific viewing record; viewing count decreases

##### Viewing Count Calculation

**Purpose:** Count total viewings of a film (first watch + all rewatches).

**Inputs:**
- film_id: UUID

**Logic:**

```
1. first_watch = 1 (implied by watch_status = "watched")
2. rewatch_count = SELECT COUNT(*) FROM ratings WHERE film_id = {film_id} AND is_rewatch = 1
3. total_viewings = 1 + rewatch_count
4. RETURN total_viewings
```

**Alternative (if first watch also has a Rating record):**

```
1. total_viewings = SELECT COUNT(*) FROM ratings WHERE film_id = {film_id}
2. IF total_viewings == 0 THEN total_viewings = 1 (watched but no rating record)
3. RETURN total_viewings
```

**Formulas:**
- `total_viewings = 1 + COUNT(rewatches)`
- `unique_films = COUNT(DISTINCT film_id) WHERE watch_status = 'watched'`
- `total_viewings_all = unique_films + SUM(rewatch_counts)`

**Edge Cases:**
- Film watched but never rated: total_viewings = 1
- Film with 0 rewatch records: total_viewings = 1, "Watched X times" label hidden
- Film with 10 rewatches: total_viewings = 11

**Sort/Filter/Ranking Logic:**
- **Rewatch history sort:** Viewing date descending (most recent first)
- **No dedicated rewatch filter:** Rewatches appear in diary and stats naturally

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Film is not watched (want_to_watch) | "Log Rewatch" button not shown | User must mark as watched first |
| Rewatch date in the future | Date picker does not allow future dates | Picker max date = today |
| Database write fails | Toast: "Could not log rewatch. Please try again." | User retries |
| Review exceeds 10,000 characters | Character counter turns red, "Log" button disabled | User shortens review |

**Validation Timing:**
- Watch status check: before showing "Log Rewatch" button
- Date validation: date picker constraint (max = today)
- Review length: real-time as user types

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a film "Inception" watched on Jan 15 with rating 4.0,
   **When** the user taps "Log Rewatch", sets date to Mar 1, rates 4.5, and taps Log,
   **Then** a new Rating (is_rewatch=1) and DiaryEntry are created, Film.watched_date updates to Mar 1, viewing count shows "Watched 2 times".

2. **Given** a film with 3 total viewings,
   **When** the user views the Film Detail screen,
   **Then** "Watched 3 times" is shown and the Rating History lists all 3 viewings chronologically.

3. **Given** a film is rewatched on Mar 5,
   **When** the user opens the Diary for March,
   **Then** Mar 5 shows a dot with the rewatched film in the day detail.

**Edge Cases:**

4. **Given** a film was first watched and rewatched on the same date,
   **When** the viewing count is displayed,
   **Then** it shows "Watched 2 times" with 2 entries in Rating History.

5. **Given** a rewatch is logged with no rating and no review,
   **When** the Rating History displays,
   **Then** the rewatch entry shows the date, "Not rated", and "No review".

**Negative Tests:**

6. **Given** a film has watch_status = "want_to_watch",
   **When** the Film Detail screen loads,
   **Then** the "Log Rewatch" button is not shown.

7. **Given** the user attempts to log a rewatch with a future date,
   **When** using the date picker,
   **Then** future dates are not selectable (picker max = today).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates rewatch rating | film_id, date, rating 4.5 | Rating record with is_rewatch = 1, rating_value = 4.5 |
| creates rewatch diary entry | film_id, date Mar 1 | DiaryEntry with viewing_date Mar 1, is_rewatch = 1 |
| updates film watched_date if newer | film watched Jan 15, rewatch Mar 1 | film.watched_date = Mar 1 |
| does not update watched_date if older | film watched Mar 1, rewatch Jan 15 | film.watched_date = Mar 1 (unchanged) |
| calculates viewing count | 1 first watch + 3 rewatches | total_viewings: 4 |
| calculates viewing count no rewatches | watched, no rewatch records | total_viewings: 1 |
| allows rewatch with no rating | rating_value: null | Rating created with null rating |
| rejects rewatch on want_to_watch film | film.watch_status = "want_to_watch" | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log rewatch flow | 1. Open watched film, 2. Tap "Log Rewatch", 3. Set date and rating, 4. Tap Log | New rating created, viewing count incremented, diary updated |
| Rewatch appears in diary | 1. Log rewatch on Mar 5, 2. Open Diary for March | Mar 5 shows rewatch in day detail |
| Primary rating after rewatch | 1. First watch rated 3.0, 2. Rewatch rated 4.5 | Primary rating on Film Detail shows 4.5 |
| Delete rewatch | 1. Log rewatch, 2. Delete that rating from history | Viewing count decremented, diary entry removed |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Track multiple viewings | 1. Watch "Inception" Jan 15 (rate 4.0), 2. Rewatch Mar 1 (rate 4.5), 3. Rewatch Jun 15 (no rating) | 3 viewings in history, primary rating 4.5, "Watched 3 times", diary shows all 3 dates |

---

### FM-016: Decade Browsing

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-016 |
| **Feature Name** | Decade Browsing |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to browse my library organized by decade (1920s, 1930s, ..., 2020s), so that I can explore my collection through a historical lens and identify which eras I have watched the most.

**Secondary:**
> As a film student, I want to see how many films I have watched from each decade and identify gaps, so that I can set viewing goals for underrepresented eras.

#### 3.3 Detailed Description

Decade Browsing provides a dedicated screen for exploring the user's library through the lens of film release decades. The screen shows a vertical list of decades (from the earliest decade represented in the user's library to the most recent), each with a film count and the ability to expand to show the films from that decade.

Each decade row shows: the decade label (e.g., "1970s"), the number of films from that decade, the average user rating for films in that decade, and a progress-style visual showing how many films the user has from that decade relative to their largest decade (the decade with the most films gets a full-width bar).

Tapping a decade expands it inline (or navigates to a filtered library view) to show all films from that decade, sorted by release year ascending (then title ascending for same-year films). Each film shows poster, title, exact year, director, and user rating.

The Decade Browsing screen is accessible from the Stats screen and from the library filter panel (FM-006). It integrates with the decade filter in FM-006 - tapping "Browse Decade" from FM-006's decade chips navigates to this dedicated screen.

Films with no release_year are excluded from decade browsing. A footer note shows "X films have no release year and are not shown."

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records with release_year field
- FM-004: Ratings and Reviews - Rating data for per-decade average ratings

**External Dependencies:**
- None (computed from local data)

**Assumed Capabilities:**
- Films have been added with release_year metadata

#### 3.5 User Interface Requirements

##### Screen: Decade Browsing

**Layout:**
- Top navigation bar: "Decades" title
- Scrollable vertical list of decade rows
- Each row:
  - Decade label (e.g., "1970s") in large text
  - Film count badge (e.g., "23 films")
  - Average rating for the decade (compact stars + numeric, e.g., "3.8")
  - Horizontal progress bar showing relative size (decade with most films = 100% width)
  - Chevron indicating expandable
- Footer: "X films have no release year and are not shown" (if applicable)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No films have release_year | "Add films with release year data to browse by decade." |
| Populated | 1+ decades with films | List of decades from earliest to latest |
| Expanded | User tapped a decade | Film list appears below the decade row |
| All Empty | Library has films but none with release_year | "No films have release year data. Enrich your library via TMDb search." |

**Interactions:**
- Tap decade row: expands inline to show films from that decade
- Tap expanded film row: navigates to Film Detail
- Tap again on decade row: collapses the film list
- Long press decade row: quick stats tooltip ("23 films, avg 3.8, 52h total")

**Transitions/Animations:**
- Expand: films slide in from above with 150ms stagger
- Collapse: films slide out, 150ms
- Progress bars animate from 0 to width on screen load, 300ms

#### 3.6 Data Requirements

No new entities. Decade data is computed from Film.release_year.

**Key Queries:**

| Query | Purpose |
|-------|---------|
| `SELECT floor(release_year / 10) * 10 as decade, COUNT(*) FROM films WHERE release_year IS NOT NULL GROUP BY decade ORDER BY decade` | Decade counts |
| `SELECT * FROM films WHERE release_year >= {decade} AND release_year < {decade + 10} ORDER BY release_year, title` | Films in a specific decade |
| `AVG(rating_value) for films in decade` | Per-decade average rating |

#### 3.7 Business Logic Rules

##### Decade Grouping

**Purpose:** Group films by release decade.

**Inputs:**
- films: array of Film records with release_year

**Logic:**

```
1. Filter out films where release_year IS NULL
2. FOR each film:
     decade = floor(release_year / 10) * 10
3. GROUP BY decade
4. FOR each decade:
     film_count = COUNT
     avg_rating = AVG(primary_rating) WHERE rated
     total_runtime = SUM(runtime_minutes) WHERE not null
5. max_count = MAX(film_count) across all decades
6. FOR each decade:
     bar_width_pct = (film_count / max_count) * 100
7. Sort decades ascending (1920, 1930, ..., 2020)
8. RETURN list of { decade, film_count, avg_rating, total_runtime, bar_width_pct }
```

**Formulas:**
- `decade_group = floor(release_year / 10) * 10`
- `bar_width_pct = (decade_film_count / max_decade_film_count) * 100`

**Edge Cases:**
- Films from 1888-1899: grouped as "1880s"
- Films from 2020-2029: grouped as "2020s"
- Decade with 1 film: bar width is proportional (may be tiny relative to largest decade)
- All films in one decade: that decade has 100% bar, no other decades shown
- Film with release_year = 2000: grouped in "2000s" (not "1990s")

**Sort/Filter/Ranking Logic:**
- **Decades sorted:** Chronologically ascending
- **Films within decade:** Release year ascending, then title A-Z
- **No additional filter:** Shows all decades with data

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No films have release_year | "Add films with release year data to browse by decade." | User adds films via TMDb search |
| Query fails | Toast: "Could not load decade data." | User navigates away and back |

**Validation Timing:**
- Data loads on screen open
- No user input to validate

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has films from the 1970s (10), 1990s (25), and 2020s (40),
   **When** the Decade Browsing screen opens,
   **Then** three decades are listed with correct counts, 2020s has the widest bar (100%), 1990s at 62.5%, 1970s at 25%.

2. **Given** the user taps the "1990s" row,
   **When** the row expands,
   **Then** 25 films from 1990-1999 are shown sorted by year, each with poster, title, year, and rating.

3. **Given** a decade has an average rating of 4.2,
   **When** the decade row displays,
   **Then** "4.2" appears with compact star icons.

**Edge Cases:**

4. **Given** 5 films have no release_year,
   **When** the Decade Browsing screen loads,
   **Then** the footer shows "5 films have no release year and are not shown."

5. **Given** the user has only 1 film (from 2015),
   **When** the screen loads,
   **Then** a single decade "2010s" is shown with "1 film" and a full-width bar.

**Negative Tests:**

6. **Given** no films in the library have a release_year,
   **When** the screen loads,
   **Then** the empty state message is shown: "Add films with release year data to browse by decade."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| groups 1985 into 1980s | year: 1985 | decade: 1980 |
| groups 2000 into 2000s | year: 2000 | decade: 2000 |
| groups 1899 into 1890s | year: 1899 | decade: 1890 |
| calculates bar width percentage | counts: [10, 25, 40] | widths: [25%, 62.5%, 100%] |
| excludes null release_year | film with null year | excluded from all decades |
| computes per-decade avg rating | decade films rated [3.0, 4.0, 5.0] | avg: 4.0 |
| sorts decades ascending | decades: [2020, 1970, 1990] | sorted: [1970, 1990, 2020] |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Expand decade | 1. Open Decade Browsing, 2. Tap 1990s | Films from 1990-1999 shown sorted by year |
| Navigate to film from decade | 1. Expand decade, 2. Tap film | Film Detail opens for selected film |
| Decade after adding film | 1. Note 1990s has 10 films, 2. Add a 1995 film, 3. Reopen | 1990s shows 11 films |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Explore film history | 1. User has films from 5 decades, 2. Open Decade Browsing, 3. Expand each decade | Each decade shows correct films, bar widths reflect relative counts |

---

### FM-017: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-017 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user, I want to access settings for the MyFilms module where I can manage my data, customize preferences, and access import/export features, so that I have control over my film tracking experience.

**Secondary:**
> As a privacy-conscious viewer, I want the ability to delete all my film data from within settings, so that I can remove my data completely if needed.

#### 3.3 Detailed Description

Settings and Preferences provides a centralized configuration screen for the MyFilms module. It is accessible from the module's tab bar or navigation menu and contains sections for data management, display preferences, and module information.

The settings screen is organized into logical groups:

**Data Management:**
- Import Data (navigates to Import Source Selection - FM-013, FM-019)
- Export Data (navigates to Export Data screen - FM-014)
- Manage Tags (navigates to Tag Management - FM-012)
- Clear All Data (destructive action with confirmation)

**Display Preferences:**
- Default Sort Order (picker: 12 options from FM-006)
- Default Library View (picker: "Grid" or "List")
- Show Ratings on Library Cards (toggle, default on)
- Show Runtime on Library Cards (toggle, default on)
- Rating Display Style (picker: "Stars" or "Numeric" e.g., "4.5/5")

**Metadata:**
- TMDb Attribution ("Film data provided by TMDb" with link)
- Module Version (e.g., "MyFilms v1.0.0")
- Database Stats: total films, total ratings, total collections, total tags, database file size

**Danger Zone:**
- Clear All Data: deletes all Film, Rating, Collection, CollectionFilm, Tag, FilmTag, and DiaryEntry records

The "Clear All Data" action requires a two-step confirmation:
1. First tap: dialog "Delete all MyFilms data? This will permanently remove all films, ratings, reviews, collections, tags, and diary entries. This cannot be undone."
2. Second confirmation: type "DELETE" to confirm

After clearing, the module resets to its initial state as if freshly enabled.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Database records to manage
- FM-012: Tags and Categorization - Tag Management link
- FM-013: Letterboxd CSV Import - Import navigation
- FM-014: Data Export - Export navigation

**External Dependencies:**
- None

**Assumed Capabilities:**
- Module navigation structure exists
- Local database is accessible

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Top navigation bar: "Settings" title
- Scrollable list organized into sections:

Section 1 - Data Management:
- "Import Data" row with chevron (navigates to Import Source Selection)
- "Export Data" row with chevron (navigates to Export screen)
- "Manage Tags" row with chevron and tag count badge (e.g., "42 tags")

Section 2 - Display Preferences:
- "Default Sort Order" row with current value shown (e.g., "Date Added (newest)")
- "Library View" row with segmented control: "Grid" / "List"
- "Show Ratings" toggle (default on)
- "Show Runtime" toggle (default on)
- "Rating Style" row with picker: "Stars" / "Numeric"

Section 3 - Information:
- "Film data provided by TMDb" with TMDb logo, tappable link to tmdb.org
- "MyFilms v1.0.0"
- Database stats:
  - "Films: 247"
  - "Ratings: 180"
  - "Collections: 8"
  - "Tags: 42"
  - "Database size: 2.4 MB"

Section 4 - Danger Zone (red-tinted section):
- "Clear All Film Data" row in red text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Normal | Default | All settings shown with current values |
| Clear Confirmation 1 | User tapped "Clear All Film Data" | Dialog: "Delete all MyFilms data? ... This cannot be undone." with "Cancel" and "Delete" buttons |
| Clear Confirmation 2 | User tapped "Delete" in first dialog | Input dialog: "Type DELETE to confirm" with text input and "Confirm" button (disabled until "DELETE" typed) |
| Clearing | Deletion in progress | Progress spinner: "Deleting data..." |
| Cleared | Deletion complete | Toast: "All film data has been deleted." Settings refresh with zeroed counts |

**Interactions:**
- Tap "Import Data": navigates to Import Source Selection
- Tap "Export Data": navigates to Export screen
- Tap "Manage Tags": navigates to Tag Management
- Change sort order: picker opens with 12 options, selection saved immediately
- Toggle library view: preference saved immediately
- Toggle show ratings/runtime: preference saved immediately
- Change rating style: picker opens, selection saved immediately
- Tap "Clear All Film Data": first confirmation dialog
- Tap "Delete" in dialog: second confirmation (type DELETE)
- Type "DELETE" and confirm: all data deleted, module reset

#### 3.6 Data Requirements

##### Entity: UserPreference

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| preference_key | TEXT | Required, unique | None | Preference identifier (e.g., "default_sort") |
| preference_value | TEXT | Required | None | Preference value as string |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Preference Keys and Defaults:**

| Key | Type | Default | Valid Values |
|-----|------|---------|-------------|
| default_sort | string | "date_added_newest" | 12 sort option identifiers |
| library_view | string | "grid" | "grid", "list" |
| show_ratings | string | "true" | "true", "false" |
| show_runtime | string | "true" | "true", "false" |
| rating_style | string | "stars" | "stars", "numeric" |

**Indexes:**
- `preference_key` (unique) - Fast lookup by key

**Example Data:**

```json
{
  "id": "p1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "preference_key": "default_sort",
  "preference_value": "rating_highest",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Clear All Data

**Purpose:** Delete all MyFilms data and reset the module to initial state.

**Logic:**

```
1. Require two-step confirmation (dialog + type "DELETE")
2. Begin transaction
3. DELETE FROM film_tags
4. DELETE FROM collection_films
5. DELETE FROM diary_entries
6. DELETE FROM ratings
7. DELETE FROM tags
8. DELETE FROM collections
9. DELETE FROM films
10. VACUUM (reclaim database space)
11. Commit transaction
12. Reset all user preferences to defaults
13. Navigate to empty-state library
14. RETURN success
```

**Edge Cases:**
- User cancels at first dialog: no action
- User cancels at second dialog: no action
- User types "delete" (lowercase): not accepted, must be "DELETE"
- Transaction fails mid-delete: full rollback, no partial deletion
- Database is already empty: operation succeeds (no error)

##### Preference Persistence

**Purpose:** Save and load user preferences.

**Logic:**

```
1. ON preference change:
   UPSERT into user_preferences (preference_key, preference_value)
2. ON screen load:
   SELECT preference_value FROM user_preferences WHERE preference_key = {key}
   IF not found: use default value
3. Preferences take effect immediately (no "save" button)
```

**Sort/Filter/Ranking Logic:**
- **Settings list:** Fixed order (Data Management, Display Preferences, Information, Danger Zone)
- **No search or filter within settings**

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Preference save fails | Toast: "Could not save preference." | Value reverts to previous |
| Clear data fails | "Could not delete data. Please try again." Full rollback | User retries |
| Database stats query fails | Stats show "N/A" | Non-critical, settings still usable |

**Validation Timing:**
- Preferences save on change (immediate)
- Clear data validates confirmation text on submit

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the default sort is "Date Added (newest)",
   **When** the user changes it to "Rating (highest)",
   **Then** the preference is saved and the library uses the new sort order on next open.

2. **Given** the user taps "Clear All Film Data",
   **When** they confirm both dialogs and type "DELETE",
   **Then** all film data is removed, database stats show zeros, and the library is empty.

3. **Given** the user toggles "Show Runtime" off,
   **When** viewing the library,
   **Then** runtime badges are not shown on film cards.

**Edge Cases:**

4. **Given** the user types "delete" (lowercase) in the confirmation,
   **When** the confirm button is checked,
   **Then** the button remains disabled (requires exact "DELETE").

5. **Given** the database has 0 films,
   **When** "Clear All Film Data" is tapped,
   **Then** the operation succeeds silently (no error for empty database).

**Negative Tests:**

6. **Given** the user taps "Clear All Film Data",
   **When** they tap "Cancel" on the first dialog,
   **Then** no data is deleted.

7. **Given** a preference save fails,
   **When** the error occurs,
   **Then** the toggle/picker reverts to the previous value.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| saves preference | key: "default_sort", value: "rating_highest" | record upserted |
| loads preference with default | key: "default_sort", no record | returns "date_added_newest" |
| validates DELETE confirmation | input: "DELETE" | valid |
| rejects lowercase delete | input: "delete" | invalid |
| rejects partial match | input: "DELET" | invalid |
| clears all tables in order | 247 films, 180 ratings, etc. | all tables empty after clear |
| rollback on failure | error at step 6 | all tables unchanged |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Change sort preference | 1. Open Settings, 2. Change sort to "Title A-Z", 3. Open Library | Library sorted by title ascending |
| Toggle grid/list view | 1. Open Settings, 2. Switch to "List", 3. Open Library | Library displays as list (not grid) |
| Clear all data | 1. Open Settings, 2. Clear data (both confirmations), 3. Open Library | Library shows empty state, stats show 0 |
| Navigate to import | 1. Open Settings, 2. Tap "Import Data" | Import Source Selection screen opens |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Configure preferences | 1. Change sort, view, and rating style, 2. Close and reopen app | All preferences persisted and applied |
| Full data wipe | 1. Build library of 100 films, 2. Clear all data from settings | Module in fresh state, all data gone, preferences reset |

---

### FM-018: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-018 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a new user enabling MyFilms for the first time, I want a brief introduction that shows me how to add films and explains key features, so that I can start using the module effectively without confusion.

**Secondary:**
> As a Letterboxd migrant, I want the onboarding to offer an import option upfront, so that I can start with my existing data rather than an empty library.

#### 3.3 Detailed Description

Onboarding and First-Run provides a 3-screen welcome flow that appears when the user first enables the MyFilms module. The flow introduces the module's purpose, demonstrates the primary add-film flow, and offers quick-start options (import from Letterboxd, search TMDb, or skip to empty library).

The onboarding is skippable at any point via a "Skip" button. After completion (or skip), the onboarding does not show again (a flag is persisted). Users can replay the onboarding from Settings if desired.

**Screen 1: Welcome**
- Large MyFilms icon and name
- Headline: "Your Private Film Diary"
- Subtext: "Track every film you watch. Rate, review, and organize your viewing history. All data stays on your device."
- "Next" button

**Screen 2: How It Works**
- 3 illustrated feature highlights (icon + short text each):
  1. "Search & Log" - Find films via TMDb or add manually
  2. "Rate & Review" - Half-star ratings and personal reviews
  3. "Stats & Insights" - Year-in-review, genre breakdowns, viewing streaks
- "Next" button

**Screen 3: Get Started**
- Three action options:
  - "Import from Letterboxd" - navigates to Letterboxd Import (FM-013)
  - "Search for a Film" - navigates to TMDb Search (FM-002)
  - "Start with Empty Library" - goes directly to the empty library
- Each option is a large tappable card with icon, title, and description

After completing any of these paths (or skipping), the user lands on the Library screen. If they chose "Start with Empty Library", the library's empty state provides additional guidance.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-002: TMDb Search - For the "Search for a Film" quick-start path
- FM-013: Letterboxd CSV Import - For the "Import from Letterboxd" quick-start path

**External Dependencies:**
- None

**Assumed Capabilities:**
- Module is freshly enabled with no existing data

#### 3.5 User Interface Requirements

##### Screen: Onboarding (3-step pager)

**Layout:**
- Full-screen pager with 3 screens
- Page indicator dots at bottom (3 dots, current highlighted)
- "Skip" text button at top-right (visible on all 3 screens)
- Swipeable left/right between screens

Screen 1 - Welcome:
- Centered vertically:
  - Film reel icon (large, 80x80)
  - "MyFilms" title text (large, bold)
  - "Your Private Film Diary" subtitle
  - "Track every film you watch. Rate, review, and organize your viewing history. All data stays on your device." (body text, centered, max 3 lines)
- "Next" button at bottom

Screen 2 - How It Works:
- 3 feature highlights stacked vertically (each row: icon left, text right):
  - Search icon + "Search & Log" + "Find films via TMDb or add them manually."
  - Star icon + "Rate & Review" + "Half-star ratings and personal reviews for every film."
  - Chart icon + "Stats & Insights" + "Year-in-review, genre breakdowns, and viewing trends."
- "Next" button at bottom

Screen 3 - Get Started:
- "How would you like to start?" header
- 3 action cards stacked vertically:
  - Card 1: Import icon + "Import from Letterboxd" + "Bring your existing film data"
  - Card 2: Search icon + "Search for a Film" + "Find your first film on TMDb"
  - Card 3: Library icon + "Start Fresh" + "Begin with an empty library"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Screen 1 | First screen | Welcome content, Next button |
| Screen 2 | Second screen | Feature highlights, Next button |
| Screen 3 | Third screen | Three action cards |
| Skipped | User tapped Skip | Onboarding dismissed, lands on library |

**Interactions:**
- Tap "Next": advances to next screen
- Tap "Skip": dismisses onboarding, sets completion flag, navigates to library
- Swipe left: advances to next screen
- Swipe right: returns to previous screen
- Tap "Import from Letterboxd": sets completion flag, navigates to FM-013
- Tap "Search for a Film": sets completion flag, navigates to FM-002
- Tap "Start Fresh": sets completion flag, navigates to empty library

**Transitions/Animations:**
- Screen transitions: horizontal slide, 300ms ease-in-out
- Feature highlights on Screen 2: staggered fade-in, 200ms each
- Action cards on Screen 3: staggered scale-up from 0.9 to 1.0, 150ms each

#### 3.6 Data Requirements

##### Preference: Onboarding Completion

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| onboarding_completed | string | "false" | Whether onboarding has been shown and completed/skipped |

Stored in the UserPreference entity (FM-017).

#### 3.7 Business Logic Rules

##### Onboarding Gate

**Purpose:** Determine whether to show onboarding on module launch.

**Logic:**

```
1. On module first open:
   Query: SELECT preference_value FROM user_preferences
   WHERE preference_key = 'onboarding_completed'
2. IF result == "true" OR result exists THEN
     Skip onboarding, go directly to Library
3. ELSE
     Show onboarding flow
4. On completion (any path) or skip:
     UPSERT preference: onboarding_completed = "true"
```

**Edge Cases:**
- User kills app during onboarding: onboarding shows again on next launch (not yet set to "true")
- User clears all data (FM-017): onboarding_completed preference is reset, onboarding shows again
- User replays onboarding from Settings: temporarily bypasses the flag, does not reset it

**Sort/Filter/Ranking Logic:**
- Not applicable (onboarding is a linear flow)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Preference save fails | Onboarding may show again on next launch | Minor inconvenience, not critical |
| Navigation to import fails | Toast: "Could not open import." Returns to library | User accesses import from Settings |

**Validation Timing:**
- Onboarding gate check: on module launch
- Completion flag set: on any exit path (Next/Skip/action card)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user enables MyFilms for the first time,
   **When** the module opens,
   **Then** the 3-screen onboarding flow is shown starting at Screen 1.

2. **Given** the user taps "Next" on Screen 1 and Screen 2,
   **When** Screen 3 appears,
   **Then** three action cards are shown: Import, Search, Start Fresh.

3. **Given** the user taps "Search for a Film" on Screen 3,
   **When** navigation occurs,
   **Then** the TMDb Search screen opens and the onboarding completion flag is set.

4. **Given** the user has completed onboarding previously,
   **When** the module opens again,
   **Then** the onboarding is skipped and the Library screen is shown directly.

**Edge Cases:**

5. **Given** the user taps "Skip" on Screen 1,
   **When** the onboarding dismisses,
   **Then** the Library screen appears and onboarding will not show again.

6. **Given** the user clears all data from Settings,
   **When** the module opens again,
   **Then** the onboarding shows again (preference was reset).

**Negative Tests:**

7. **Given** the app is killed during onboarding (before any action or skip),
   **When** the module opens again,
   **Then** the onboarding shows again (flag was not set).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| shows onboarding when not completed | onboarding_completed: null | show onboarding: true |
| skips onboarding when completed | onboarding_completed: "true" | show onboarding: false |
| sets completion flag on skip | user skips | onboarding_completed = "true" |
| sets completion flag on action | user taps "Search" | onboarding_completed = "true" |
| resets flag on clear all data | clear all data | onboarding_completed reset |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full onboarding flow | 1. Enable module, 2. Next, Next, 3. Tap "Start Fresh" | Library shown, onboarding_completed set |
| Skip onboarding | 1. Enable module, 2. Tap "Skip" | Library shown, onboarding_completed set |
| Import from onboarding | 1. Enable module, 2. Next, Next, 3. Tap "Import from Letterboxd" | Import screen opens, onboarding_completed set |
| Onboarding not shown again | 1. Complete onboarding, 2. Close and reopen module | Library shown directly, no onboarding |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user starts fresh | 1. Enable MyFilms, 2. Go through onboarding, 3. Tap "Start Fresh" | Empty library with guidance text, onboarding never shows again |
| Letterboxd migrant | 1. Enable MyFilms, 2. Onboarding, 3. Tap "Import from Letterboxd", 4. Import data | Library populated, onboarding complete |

---

### FM-019: IMDb CSV Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-019 |
| **Feature Name** | IMDb CSV Import |
| **Priority** | P2 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user who tracks films on IMDb, I want to import my IMDb ratings and watchlist from a CSV export, so that I can migrate to MyFilms without manually re-entering hundreds of films.

**Secondary:**
> As a user switching from IMDb, I want the import to match IMDb's rating scale (1-10 integers) to MyFilms' half-star scale (0.5-5.0), so that my opinions are preserved with appropriate conversion.

#### 3.3 Detailed Description

IMDb CSV Import allows users to import their film data from IMDb's CSV export feature. IMDb provides two export options from a user's account: Ratings (Your Ratings > Export) and Watchlist (Watchlist > Export). Each produces a CSV file.

The IMDb rating scale is 1-10 (integers). MyFilms uses a 0.5-5.0 half-star scale. The import converts IMDb ratings to the MyFilms scale using the formula: `myfilms_rating = imdb_rating / 2`. This maps 1 to 0.5, 2 to 1.0, ..., 10 to 5.0. The conversion is lossless since IMDb's 10 integer values map exactly to MyFilms' 10 half-star values.

The import flow is similar to Letterboxd Import (FM-013) but with IMDb-specific CSV column handling:

**IMDb Ratings CSV columns:** Const (IMDb ID, e.g., "tt1375666"), Your Rating, Date Rated, Title, URL, Title Type, IMDb Rating, Runtime (mins), Year, Genres, Num Votes, Release Date, Directors
**IMDb Watchlist CSV columns:** Const, Created, Modified, Description, Title, URL, Title Type, IMDb Rating, Runtime (mins), Year, Genres, Num Votes, Release Date, Directors

The import process:
1. **File Selection:** User selects IMDb CSV file(s)
2. **Parsing:** App parses CSV and extracts data
3. **Type Filtering:** Only rows where Title Type = "movie" or "tvMovie" are imported (TV shows, episodes, etc., are skipped)
4. **Rating Conversion:** IMDb 1-10 ratings are converted to MyFilms 0.5-5.0
5. **Duplicate Detection:** Films already in library matched by IMDb ID (Const field) or title + year
6. **TMDb Enrichment (optional):** Look up TMDb metadata using IMDb ID for direct matching
7. **Import Execution:** Films and ratings inserted
8. **Results Report:** Summary of imported, skipped, converted, and errored items

TMDb enrichment is more accurate for IMDb imports than Letterboxd imports because IMDb provides the IMDb ID (the Const field), which TMDb can match directly via `/find/{imdb_id}?external_source=imdb_id`. This avoids the title-based search ambiguity.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film record structure
- FM-004: Ratings and Reviews - Rating record structure
- FM-013: Letterboxd CSV Import - Shares import flow UI pattern

**External Dependencies:**
- File system access (to read CSV files)
- Network access (optional, for TMDb enrichment via IMDb ID)

**Assumed Capabilities:**
- User has exported their ratings/watchlist from IMDb

#### 3.5 User Interface Requirements

##### Screen: IMDb Import

**Layout:**
- Follows same 4-step structure as Letterboxd Import (FM-013):
  - Step 1: Select File(s) (instructions reference IMDb export: Account > Your Ratings > Export)
  - Step 2: Preview (shows counts, notes rating conversion, shows skipped non-movie types)
  - Step 3: Options (duplicate handling, TMDb enrichment, rating conversion preview)
  - Step 4: Import progress and results

- Additional element in Step 2: "Rating Conversion Preview" table showing a sample:

| IMDb Rating | MyFilms Rating |
|-------------|---------------|
| 10 | 5.0 |
| 8 | 4.0 |
| 6 | 3.0 |
| 4 | 2.0 |
| 2 | 1.0 |

- Step 2 also shows: "X movies found, Y TV entries skipped (only movies are imported)"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Step 1: Ready | No file selected | Instructions for IMDb export |
| Step 2: Preview | Parse complete | Import counts with rating conversion preview |
| Step 3: Options | User reviewing options | Same as FM-013 but with rating conversion note |
| Step 4: Complete | Import finished | Results with converted rating counts |
| Error: Wrong Format | File is not IMDb CSV | "This file does not appear to be a valid IMDb export. Expected columns: Const, Your Rating, Title, Year." |

**Interactions:**
- Same as FM-013 import flow
- Rating conversion is automatic (no user choice needed)

#### 3.6 Data Requirements

No new entities. Import creates records in Film and Rating entities.

**CSV Parsing Rules:**

| Source Column | Target Field | Conversion |
|-------------|-------------|-----------|
| Const | Film.imdb_id | Direct (e.g., "tt1375666") |
| Title | Film.title | Direct |
| Year | Film.release_year | Integer |
| Your Rating | Rating.rating_value | `imdb_rating / 2` |
| Date Rated | Rating.viewing_date | ISO date parse |
| Genres | Film.genres | Comma-separated to JSON array |
| Runtime (mins) | Film.runtime_minutes | Integer, strip " mins" suffix if present |
| Directors | Film.directors | Comma-separated to JSON array |
| Title Type | (filter) | Only "movie" and "tvMovie" imported |

#### 3.7 Business Logic Rules

##### IMDb Rating Conversion

**Purpose:** Convert IMDb 1-10 integer ratings to MyFilms 0.5-5.0 half-star ratings.

**Inputs:**
- imdb_rating: integer (1-10)

**Logic:**

```
1. IF imdb_rating is null or empty THEN RETURN null (unrated)
2. IF imdb_rating < 1 OR imdb_rating > 10 THEN RETURN null (invalid)
3. myfilms_rating = imdb_rating / 2
4. RETURN myfilms_rating
```

**Formulas:**
- `myfilms_rating = imdb_rating / 2`

**Conversion Table:**

| IMDb | MyFilms |
|------|---------|
| 1 | 0.5 |
| 2 | 1.0 |
| 3 | 1.5 |
| 4 | 2.0 |
| 5 | 2.5 |
| 6 | 3.0 |
| 7 | 3.5 |
| 8 | 4.0 |
| 9 | 4.5 |
| 10 | 5.0 |

**Edge Cases:**
- IMDb rating of 0: treated as unrated (null)
- Non-integer rating (should not occur in IMDb export): round to nearest integer, then convert
- Rating field empty: treated as unrated

##### IMDb Duplicate Detection

**Purpose:** Match imported films against existing library using IMDb ID.

**Inputs:**
- imdb_id: string (e.g., "tt1375666")
- title: string
- year: integer

**Logic:**

```
1. IF imdb_id is provided THEN
     Query: SELECT id FROM films WHERE imdb_id = {imdb_id}
     IF match found THEN RETURN "duplicate" with existing film ID
2. Query: SELECT id FROM films WHERE title = {title} COLLATE NOCASE
   AND release_year = {year}
   IF match found THEN RETURN "possible_duplicate" with existing film ID
3. RETURN "unique"
```

**Edge Cases:**
- IMDb ID match is definitive (no ambiguity)
- Title+year match without IMDb ID: flagged as "possible_duplicate" (user decides)

##### Title Type Filtering

**Purpose:** Only import movies, not TV shows, episodes, shorts, etc.

**Logic:**

```
1. FOR each CSV row:
   IF Title Type IN ("movie", "tvMovie") THEN include
   ELSE skip (add to skipped_count)
2. Report: "X movies imported, Y non-movie entries skipped"
```

**Edge Cases:**
- "tvMovie" (TV movies): included (they are still feature-length films)
- "short": skipped by default
- "tvSeries", "tvEpisode", "tvMiniSeries": skipped
- Missing Title Type column: import all rows (assume movies)

**Sort/Filter/Ranking Logic:**
- **Import order:** CSV row order
- **Duplicate detection:** IMDb ID first (definitive), then title+year (possible)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid IMDb CSV | Error: "This file does not appear to be a valid IMDb export." | User selects correct file |
| Missing Const column | Warning: "IMDb IDs not found. Duplicate detection will use title+year only." | Import continues with reduced accuracy |
| Rating out of range (0 or >10) | Treated as unrated, added to warnings | Row imported without rating |
| TMDb lookup by IMDb ID fails | Film imported without enrichment | TMDb enrichment is best-effort |
| Non-UTF-8 encoding | Error: "File encoding not supported. Save as UTF-8 and try again." | User re-saves file |

**Validation Timing:**
- File format validation: on file selection
- CSV column validation: during parsing
- Rating conversion: during parsing
- Import execution: transactional

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an IMDb ratings CSV with 100 movie entries and 20 TV entries,
   **When** the user imports the file,
   **Then** 100 Film and Rating records are created, 20 TV entries are skipped, and the results show "100 movies imported, 20 non-movie entries skipped."

2. **Given** an IMDb rating of 8 for "Inception",
   **When** the rating is converted,
   **Then** a Rating record is created with rating_value = 4.0.

3. **Given** the TMDb enrichment is enabled and the CSV includes IMDb IDs,
   **When** enrichment runs,
   **Then** each film is looked up via `/find/{imdb_id}` and enriched with poster, genres, and cast.

4. **Given** a film with IMDb ID "tt1375666" already exists in the library,
   **When** the import encounters the same IMDb ID,
   **Then** it is flagged as a duplicate and the user's duplicate handling choice is applied.

**Edge Cases:**

5. **Given** an IMDb CSV has a movie with no rating (watchlist export),
   **When** the import processes it,
   **Then** a Film record is created with watch_status = "want_to_watch" and no Rating record.

6. **Given** an IMDb rating is 0 (should not normally occur),
   **When** the rating is converted,
   **Then** it is treated as unrated (null) and a warning is logged.

**Negative Tests:**

7. **Given** the user selects a file that is not an IMDb CSV,
   **When** validation runs,
   **Then** an error appears: "This file does not appear to be a valid IMDb export."

8. **Given** the import transaction fails,
   **When** the error occurs,
   **Then** the entire import is rolled back with no partial data.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| converts IMDb 10 to 5.0 | imdb_rating: 10 | myfilms_rating: 5.0 |
| converts IMDb 8 to 4.0 | imdb_rating: 8 | myfilms_rating: 4.0 |
| converts IMDb 1 to 0.5 | imdb_rating: 1 | myfilms_rating: 0.5 |
| handles null IMDb rating | imdb_rating: null | myfilms_rating: null |
| handles IMDb rating 0 | imdb_rating: 0 | myfilms_rating: null |
| filters movies only | types: ["movie", "tvSeries", "tvMovie"] | imported: 2, skipped: 1 |
| matches by IMDb ID | imdb_id: "tt1375666" (exists) | duplicate detected |
| parses IMDb CSV columns | valid IMDb CSV row | correct title, year, rating, imdb_id |
| parses genres from CSV | genres: "Drama, Thriller" | '["Drama","Thriller"]' |
| handles missing Title Type | row without Title Type | imported (assume movie) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full IMDb import | 1. Select IMDb ratings CSV, 2. Preview, 3. Import | All movies imported with converted ratings |
| IMDb watchlist import | 1. Select watchlist CSV, 2. Import | Films created as want_to_watch |
| Enrichment via IMDb ID | 1. Import with TMDb enrichment, 2. Check films | Films enriched via IMDb ID lookup |
| Duplicate detection | 1. Import 50 films, 2. Re-import same CSV with "Skip" | 0 new imports, 50 skipped |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Migrate from IMDb | 1. Export ratings from IMDb, 2. Open MyFilms import, 3. Select file, 4. Import with enrichment | All movies imported with converted ratings and TMDb metadata |

---

### FM-020: Film Goals and Challenges

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-020 |
| **Feature Name** | Film Goals and Challenges |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a film enthusiast, I want to set viewing goals (e.g., "Watch 100 films this year" or "Watch 10 films from the 1950s"), so that I can motivate myself to watch more broadly and track my progress.

**Secondary:**
> As a film student, I want to create themed challenges (e.g., "Complete Kubrick's filmography" or "Watch one film from every decade"), so that I can structure my viewing habits around learning objectives.

#### 3.3 Detailed Description

Film Goals and Challenges provides a goal-setting and progress-tracking system for film viewing. Users create goals with a target metric, a time period, and the system automatically tracks progress based on the user's library data.

Goals come in two types:

**Quantity Goals:** "Watch X films [in time period]." Example: "Watch 100 films in 2026." Progress is tracked as a simple count of films watched within the time period.

**Criteria Goals:** "Watch X films matching [criteria] [in time period]." Example: "Watch 10 horror films in 2026" or "Watch 5 films from the 1950s by December." Progress is tracked by counting films matching the criteria within the time period.

Each goal has:
- Title (user-defined or auto-generated from parameters)
- Target count (integer, 1-1000)
- Time period: a specific year, a date range, or "ongoing" (no end date)
- Optional criteria filter: genre, decade, director, tag, or any combination
- Progress: current count / target count
- Status: "in progress", "completed", "expired" (time period ended without completion)

Goals are displayed on a dedicated Goals screen accessible from the Stats tab. Each goal is a card showing title, progress bar (filled proportionally), "X of Y" count, and status badge. Completed goals show a celebratory visual (gold border, check mark).

Users can create up to 20 active goals. Completed and expired goals are archived and viewable in a "Past Goals" section.

No notifications or reminders are sent for goals - this is a passive tracking system, consistent with the privacy-first philosophy.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records with watched_date, genres, release_year, directors
- FM-006: Search and Filtering - Criteria matching logic for filtered goals
- FM-008: Viewing Statistics - Stats screen integration

**External Dependencies:**
- None (goals are local data)

**Assumed Capabilities:**
- User has watched at least some films (goals are meaningful with data)

#### 3.5 User Interface Requirements

##### Screen: Goals

**Layout:**
- Top navigation bar: "Goals" title, "+" button on right to create new goal
- Active Goals section: vertical list of goal cards
- Each card:
  - Title (bold, e.g., "Watch 100 Films in 2026")
  - Progress bar (accent-colored fill, gray background)
  - Progress text: "47 of 100" or "47%"
  - Time remaining: "8 months left" or "Due Dec 31, 2026"
  - Status badge: "In Progress" (blue), "Completed" (green), "Expired" (gray)
- Below active goals: "Past Goals" expandable section showing completed and expired goals

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No goals created | Centered: "Set a film watching goal to track your progress." with "Create Goal" button |
| Active | 1+ active goals | Goal cards sorted by deadline (soonest first) |
| All Complete | All goals completed | Active section empty, Past Goals section has entries |
| Completed Goal | Goal target reached | Green border on card, check icon, "Completed on [date]" |
| Expired Goal | Time period ended, target not reached | Gray card, "Expired - reached X of Y" |

**Interactions:**
- Tap "+": opens Create Goal modal
- Tap goal card: navigates to Goal Detail (shows qualifying films)
- Long press goal card: context menu with "Edit" and "Delete"
- Tap "Past Goals": expands/collapses archived goals section

##### Modal: Create/Edit Goal

**Layout:**
- Full-height modal sheet
- Title: "New Goal" or "Edit Goal"
- Form fields:
  - Goal Type: segmented control ["Quantity", "Criteria"]
  - Target Count: numeric input (1-1000)
  - Time Period: picker ["This Year", "Custom Date Range", "Ongoing"]
  - If Custom: start date picker and end date picker
  - If Criteria type, additional fields:
    - Genre filter (multi-select chips from 20 genres)
    - Decade filter (multi-select chips)
    - Director filter (text input with autocomplete from library)
    - Tag filter (multi-select from existing tags)
  - Title: auto-generated from parameters but editable (e.g., "Watch 10 Horror Films in 2026")
- Footer: "Cancel" and "Create" buttons

**Interactions:**
- Change parameters: title auto-updates unless user has manually edited it
- Tap "Create": creates goal, closes modal
- Tap "Cancel": dismisses with confirmation if unsaved changes

##### Screen: Goal Detail

**Layout:**
- Top navigation bar: goal title
- Progress section: large circular progress indicator, "X of Y films"
- Qualifying Films list: scrollable list of films that count toward this goal
- Each film row: poster, title, year, watched date, rating

#### 3.6 Data Requirements

##### Entity: Goal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| title | TEXT | Required, max 200 characters | Auto-generated | Goal display name |
| goal_type | TEXT | One of: 'quantity', 'criteria' | 'quantity' | Type of goal |
| target_count | INTEGER | Required, 1-1000 | None | Number of films to watch |
| current_count | INTEGER | Computed, 0-target_count | 0 | Current progress (cached, recomputed on change) |
| start_date | TEXT | ISO date, optional | null | Start of time period (null for "Ongoing") |
| end_date | TEXT | ISO date, optional | null | End of time period (null for "Ongoing") |
| criteria_genres | TEXT | Optional, JSON array | null | Genre filter criteria |
| criteria_decades | TEXT | Optional, JSON array of integers | null | Decade filter criteria |
| criteria_director | TEXT | Optional | null | Director name filter |
| criteria_tags | TEXT | Optional, JSON array | null | Tag filter criteria |
| status | TEXT | One of: 'active', 'completed', 'expired' | 'active' | Current goal status |
| completed_date | TEXT | ISO date, optional | null | Date goal was completed |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Indexes:**
- `status` - Filter active vs. archived goals
- `end_date` - Sort by deadline

**Validation Rules:**
- `target_count`: Must be between 1 and 1000
- `start_date` must be before or equal to `end_date` if both are provided
- Maximum 20 active goals (checked before creation)
- `title`: Max 200 characters

**Example Data:**

```json
{
  "id": "g1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "title": "Watch 100 Films in 2026",
  "goal_type": "quantity",
  "target_count": 100,
  "current_count": 47,
  "start_date": "2026-01-01",
  "end_date": "2026-12-31",
  "criteria_genres": null,
  "criteria_decades": null,
  "criteria_director": null,
  "criteria_tags": null,
  "status": "active",
  "completed_date": null,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-03-07T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Progress Calculation

**Purpose:** Compute the current progress count for a goal.

**Inputs:**
- goal: Goal record

**Logic:**

```
1. Start with all watched films:
   SELECT * FROM films WHERE watch_status = 'watched'
2. IF goal has time period (start_date and end_date):
   Filter: watched_date >= start_date AND watched_date <= end_date
3. IF goal_type == 'criteria':
   Apply criteria filters (same logic as FM-006 combined filters):
   - IF criteria_genres: film must have at least one matching genre
   - IF criteria_decades: film must be from a matching decade
   - IF criteria_director: film must have matching director
   - IF criteria_tags: film must have at least one matching tag
4. current_count = COUNT of matching films
5. IF current_count >= target_count AND status == 'active':
   Set status = 'completed'
   Set completed_date = today
6. Update goal.current_count
7. RETURN current_count
```

**Formulas:**
- `progress_pct = (current_count / target_count) * 100`
- `days_remaining = end_date - today` (if end_date exists and is future)
- `pace_required = (target_count - current_count) / days_remaining` (films per day needed to complete)

**Edge Cases:**
- Goal with no time period ("Ongoing"): never expires, progress accumulates indefinitely
- Film watched before goal was created but within the goal's date range: counts toward progress
- Film deleted after counting toward goal: progress decrements
- Goal completed exactly at target: status set to "completed"
- Goal exceeded (e.g., 105/100): shows "105 of 100" (overflow allowed)

##### Goal Expiration Check

**Purpose:** Mark goals as expired when their time period ends.

**Logic:**

```
1. On app launch and on goal screen open:
   SELECT * FROM goals WHERE status = 'active' AND end_date IS NOT NULL AND end_date < today
2. FOR each expired goal:
   Set status = 'expired'
   Update goal record
```

**Edge Cases:**
- Goal ending today: not expired until tomorrow
- Ongoing goal: never expires

**Sort/Filter/Ranking Logic:**
- **Active goals sort:** Deadline ascending (soonest first), then progress percentage descending
- **Past goals sort:** Completed/expired date descending (most recent first)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Active goal limit reached (20) | Toast: "Maximum 20 active goals. Complete or delete a goal to create a new one." | User deletes or archives goals |
| Target count 0 or negative | Inline validation: "Target must be between 1 and 1000" | User corrects value |
| End date before start date | Inline validation: "End date must be after start date" | User corrects dates |
| Progress computation fails | Goal card shows "?" for count | Recomputes on next screen load |

**Validation Timing:**
- Form validation: on blur and on Create/Save
- Goal limit check: before creation
- Expiration check: on app launch and screen open

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a goal "Watch 100 films in 2026" (quantity type, Jan 1 - Dec 31),
   **When** the goal is created,
   **Then** it appears on the Goals screen with progress "0 of 100" and an empty progress bar.

2. **Given** the user has watched 47 films in 2026,
   **When** the Goals screen loads,
   **Then** the "Watch 100 films in 2026" goal shows "47 of 100" with 47% progress bar fill.

3. **Given** the user creates a criteria goal "Watch 10 horror films in 2026",
   **When** they have watched 10 horror films in 2026,
   **Then** the goal status changes to "completed" with a green badge and celebratory visual.

4. **Given** a goal has an end date of Dec 31, 2026,
   **When** Jan 1, 2027 arrives and the goal is at 85/100,
   **Then** the goal status changes to "expired" with text "Expired - reached 85 of 100."

**Edge Cases:**

5. **Given** an "ongoing" goal with no end date,
   **When** years pass,
   **Then** the goal never expires and progress continues accumulating.

6. **Given** a film matching a criteria goal is deleted,
   **When** progress is recalculated,
   **Then** the current_count decrements by 1.

**Negative Tests:**

7. **Given** the user has 20 active goals,
   **When** they try to create a 21st,
   **Then** a toast shows "Maximum 20 active goals."

8. **Given** the user enters an end date before the start date,
   **When** validation runs,
   **Then** inline error: "End date must be after start date."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates quantity progress | 47 films in date range, target 100 | current: 47, pct: 47% |
| calculates criteria progress | 10 horror films in range, target 10 | current: 10, status: completed |
| marks goal completed at target | current: 100, target: 100 | status: "completed" |
| allows overflow | current: 105, target: 100 | status: "completed", shows "105 of 100" |
| marks goal expired | end_date: yesterday, current: 85, target: 100 | status: "expired" |
| ongoing goal never expires | end_date: null, any date | status: "active" |
| validates target range | target: 0 | validation error |
| validates target range upper | target: 1001 | validation error |
| validates date range | start: Mar 1, end: Feb 1 | validation error |
| criteria filter matches genre | criteria: ["Horror"], film genres: '["Horror","Thriller"]' | film counts toward goal |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create and track goal | 1. Create "Watch 50 in 2026", 2. Watch 5 films, 3. Open Goals | Progress shows 5 of 50 |
| Goal auto-completes | 1. Create "Watch 5 horror", 2. Watch 5 horror films | Goal status changes to completed |
| Goal detail shows films | 1. Create genre goal, 2. Tap goal | Qualifying films listed |
| Delete goal | 1. Long press goal, 2. Delete | Goal removed from list |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Annual viewing challenge | 1. Create "Watch 100 films in 2026", 2. Watch films throughout year, 3. Check progress periodically | Progress updates accurately, completes or expires at year end |
| Genre exploration goal | 1. Create "Watch 10 1950s films", 2. Seek out and watch 1950s films | Goal tracks only 1950s films, completes when 10 reached |

---

### FM-021: Streaming Availability

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | FM-021 |
| **Feature Name** | Streaming Availability |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a casual viewer, I want to see which streaming services have a film available, so that I can decide where to watch a film from my watchlist without checking each service individually.

**Secondary:**
> As a film enthusiast, I want to filter my watchlist by streaming service, so that I can decide what to watch tonight based on which services I subscribe to.

#### 3.3 Detailed Description

Streaming Availability shows users where a film can be streamed, rented, or purchased digitally. When viewing a film's detail screen, a "Where to Watch" section displays logos and names of streaming services (e.g., Netflix, Hulu, Amazon Prime, HBO Max, Apple TV+) that currently offer the film.

This feature uses the TMDb API's watch providers endpoint (`/movie/{tmdb_id}/watch/providers`), which returns data powered by JustWatch. The API provides streaming (subscription), rent, and buy options for each country. MyFilms defaults to the user's device locale country but allows changing the country in settings.

Streaming data is cached locally for 7 days per film to minimize API calls. After 7 days, the data is refreshed on next view if the device is online. If the device is offline, stale cached data is shown with a note: "Data may be outdated. Last updated [date]."

The watchlist can be filtered by streaming service: the user selects one or more services they subscribe to, and the watchlist shows only films available on those services. This filter is saved as a preference so users do not have to re-select each time.

A settings option allows users to configure their subscribed services. This list is used for the watchlist filter and for highlighting "available on your services" films in the library.

Privacy note: The only data sent to TMDb is the film's TMDb ID. No user identity, viewing history, or subscription information is transmitted. The subscribed services list is stored locally only.

#### 3.4 Prerequisites

**Feature Dependencies:**
- FM-001: Film Logging - Film records with tmdb_id
- FM-002: TMDb Search and Metadata - TMDb API infrastructure
- FM-003: Watchlist - Watchlist filtering integration

**External Dependencies:**
- Network access for TMDb watch providers API
- TMDb API key (same as FM-002)

**Assumed Capabilities:**
- Films have been added via TMDb search (have tmdb_id)
- Device has network connectivity (feature degrades gracefully without it)

#### 3.5 User Interface Requirements

##### Component: Where to Watch (on Film Detail)

**Layout:**
- Section header: "Where to Watch"
- Three sub-sections (each shown only if data exists):
  - "Stream": horizontal row of service logos for subscription streaming
  - "Rent": horizontal row of service logos for rental
  - "Buy": horizontal row of service logos for digital purchase
- Each logo: 32x32 rounded square with service logo, service name below in small text
- Country selector: small text link "Showing for: United States" with dropdown to change
- Attribution: "Data by JustWatch" (required by TMDb/JustWatch terms)
- Cache indicator: "Updated [date]" in secondary text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Available | Streaming data found | Service logos grouped by type (stream/rent/buy) |
| Not Available | No streaming options in user's country | "Not currently available for streaming in [country]." |
| No TMDb ID | Film has no tmdb_id (manually added) | "Streaming data requires TMDb metadata. Search TMDb to link this film." |
| Loading | API request in progress | Skeleton placeholders for service logos |
| Offline | No network and no cache | "Streaming data unavailable offline." |
| Stale Cache | Cache older than 7 days, offline | Shows cached data with "Data may be outdated. Last updated [date]." |
| Available on Subscribed | Film is on a user-subscribed service | Service logo has accent highlight/badge |

**Interactions:**
- Tap service logo: opens the service's deep link to the film (if available) or the service's app/website
- Tap country selector: dropdown to change country
- Tap "Data by JustWatch": opens justwatch.com in browser

##### Settings: Subscribed Services

**Layout (in FM-017 Settings screen):**
- New row in Display Preferences section: "My Streaming Services"
- Taps to open: list of common streaming services with checkboxes
- Services list: Netflix, Hulu, Amazon Prime Video, Disney+, HBO Max, Apple TV+, Peacock, Paramount+, Mubi, Criterion Channel, Tubi, Pluto TV, Crunchyroll, Shudder
- Multi-select with search bar to filter
- Selected services are saved as a preference

**Interactions:**
- Toggle service checkbox: saves preference immediately
- Search: filters service list

##### Watchlist Filter: By Streaming Service

**Layout (on Watchlist screen, FM-003):**
- New filter option: "Available on" with horizontal chips for user's subscribed services
- Selecting a service chip filters the watchlist to only films available on that service
- Multiple services: OR logic (film available on ANY selected service)

#### 3.6 Data Requirements

##### Entity: StreamingCache

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film this cache belongs to |
| tmdb_id | INTEGER | Required | None | TMDb movie ID used for the query |
| country_code | TEXT | Required, ISO 3166-1 (e.g., "US") | Device locale | Country for provider data |
| stream_providers | TEXT | JSON array of provider objects | '[]' | Subscription streaming options |
| rent_providers | TEXT | JSON array of provider objects | '[]' | Rental options |
| buy_providers | TEXT | JSON array of provider objects | '[]' | Digital purchase options |
| fetched_at | TEXT | ISO datetime | Current timestamp | When data was fetched from API |
| expires_at | TEXT | ISO datetime | fetched_at + 7 days | When cache expires |

**Provider Object Structure:**

```json
{
  "provider_id": 8,
  "provider_name": "Netflix",
  "logo_path": "/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg",
  "display_priority": 1
}
```

**Indexes:**
- `film_id, country_code` (unique) - One cache per film per country
- `expires_at` - Cleanup of expired cache entries

**Validation Rules:**
- `country_code`: Must be a valid ISO 3166-1 alpha-2 code
- `expires_at` = `fetched_at` + 7 days
- Cache is considered valid if `expires_at` > now

**Preference: Subscribed Services**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| subscribed_services | string (JSON array) | '[]' | List of provider IDs the user subscribes to |
| streaming_country | string | Device locale | Country code for streaming lookups |

#### 3.7 Business Logic Rules

##### Streaming Data Retrieval

**Purpose:** Get streaming availability for a film, with caching.

**Inputs:**
- film_id: UUID
- tmdb_id: integer
- country_code: string (ISO 3166-1, e.g., "US")

**Logic:**

```
1. Check cache: SELECT * FROM streaming_cache
   WHERE film_id = {film_id} AND country_code = {country_code}
2. IF cache exists AND expires_at > now THEN
     RETURN cached data
3. IF device is offline THEN
     IF stale cache exists THEN RETURN stale data with warning
     ELSE RETURN offline error
4. Query TMDb: GET /movie/{tmdb_id}/watch/providers
5. Extract data for country_code from response.results.{country_code}
6. Parse into stream_providers, rent_providers, buy_providers
7. UPSERT into streaming_cache
8. RETURN fresh data
```

**Edge Cases:**
- Film with no tmdb_id: feature unavailable, show message
- Country not in TMDb results: "Not available in [country]"
- TMDb API error: show cached data if available, or error message
- API rate limit: show cached data, retry later
- Service removed from TMDb data: disappears from cache on next refresh

##### Subscribed Service Highlighting

**Purpose:** Indicate which streaming options match the user's subscriptions.

**Logic:**

```
1. Load subscribed_services preference (array of provider IDs)
2. FOR each provider in film's streaming data:
   IF provider_id IN subscribed_services THEN
     Mark as "subscribed" (show accent highlight)
3. RETURN annotated provider list
```

##### Watchlist Streaming Filter

**Purpose:** Filter watchlist to films available on selected streaming services.

**Inputs:**
- selected_service_ids: array of provider IDs
- watchlist_films: array of Film records

**Logic:**

```
1. IF selected_service_ids is empty THEN RETURN all watchlist films
2. FOR each film in watchlist:
   Load streaming cache for film
   IF any stream_provider.provider_id IN selected_service_ids THEN
     Include film in filtered results
3. RETURN filtered films
```

**Formulas:**
- `cache_valid = expires_at > current_timestamp`
- `cache_ttl_days = 7`
- `provider_logo_url = "https://image.tmdb.org/t/p/original" + logo_path`

**Edge Cases:**
- Watchlist film with no TMDb ID: excluded from streaming filter
- Watchlist film with expired cache and offline: included but with "data may be outdated" note
- Film available on a service the user does not subscribe to: shown in regular color (no highlight)

**Sort/Filter/Ranking Logic:**
- **Providers within a category:** sorted by display_priority (TMDb ordering)
- **Watchlist streaming filter:** OR logic (film on ANY selected service passes)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Film has no tmdb_id | "Streaming data requires TMDb metadata." | User searches TMDb to link film |
| API request fails | Show cached data if available, or "Could not load streaming info." | Auto-retry on next view |
| Country not in TMDb data | "Not currently available for streaming in [country]." | User can change country |
| Offline, no cache | "Streaming data unavailable offline." | Feature available when back online |
| Offline, stale cache | Cached data shown with "Data may be outdated." | Data refreshes when online |
| API rate limit | Use cached data, retry after cooldown | Automatic |

**Validation Timing:**
- Cache check: on Film Detail screen load (for streaming section)
- API call: only if cache is missing or expired AND device is online
- Watchlist filter: on filter selection

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a film with tmdb_id = 27205 (Inception),
   **When** the Film Detail screen loads and the device is online,
   **Then** the "Where to Watch" section shows streaming, rent, and buy options with service logos.

2. **Given** the user has configured Netflix and Hulu as subscribed services,
   **When** viewing a film available on Netflix,
   **Then** the Netflix logo has an accent highlight indicating it is on a subscribed service.

3. **Given** the user opens the Watchlist and filters by "Netflix",
   **When** the filter is applied,
   **Then** only watchlist films available on Netflix for streaming are shown.

4. **Given** streaming data was fetched 3 days ago,
   **When** the Film Detail screen loads,
   **Then** cached data is shown without a new API call (cache valid for 7 days).

**Edge Cases:**

5. **Given** streaming data cache is 8 days old and the device is offline,
   **When** the Film Detail screen loads,
   **Then** stale cached data is shown with "Data may be outdated. Last updated [date]."

6. **Given** a film was added manually with no tmdb_id,
   **When** the Film Detail screen loads,
   **Then** the streaming section shows "Streaming data requires TMDb metadata."

**Negative Tests:**

7. **Given** the device is offline and no cache exists for the film,
   **When** the Film Detail screen loads,
   **Then** the streaming section shows "Streaming data unavailable offline."

8. **Given** the film is not available on any service in the user's country,
   **When** the streaming data loads,
   **Then** the section shows "Not currently available for streaming in [country]."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| returns cached data when valid | cache expires in 3 days | cached data returned, no API call |
| fetches new data when cache expired | cache expired 1 day ago | API called, new data cached |
| returns stale cache when offline | expired cache, offline | stale data with warning flag |
| returns error when offline no cache | no cache, offline | offline error |
| highlights subscribed service | subscribed: [8], provider_id: 8 | marked as "subscribed" |
| does not highlight non-subscribed | subscribed: [8], provider_id: 337 | not marked |
| filters watchlist by service | 5 films, 2 on Netflix | filtered: 2 films |
| handles film with no tmdb_id | tmdb_id: null | returns "no_tmdb_id" error |
| parses TMDb provider response | TMDb JSON for US | correct stream/rent/buy arrays |
| cache TTL is 7 days | fetched_at: now | expires_at: now + 7 days |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Fetch streaming data | 1. Open film detail for TMDb film, 2. Check "Where to Watch" | Service logos displayed, data cached |
| Cache hit | 1. View film detail (data cached), 2. Close and reopen | Cached data shown, no API call |
| Change country | 1. Open streaming section, 2. Change country to "GB" | New data fetched for UK, different services shown |
| Watchlist streaming filter | 1. Configure subscribed services, 2. Open watchlist, 3. Filter by service | Only matching films shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Find where to watch | 1. Add "Dune" from TMDb, 2. View detail, 3. Check "Where to Watch" | Streaming services shown (e.g., HBO Max), rent/buy options listed |
| Filter watchlist for movie night | 1. Build watchlist of 20 films, 2. Configure Netflix and Hulu, 3. Filter watchlist by Netflix | Only Netflix-available films shown, user picks one to watch |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Film** entity. Each Film can have multiple Ratings (one per viewing, supporting rewatches), multiple Tags (via a join table), and membership in multiple Collections (via a join table). DiaryEntry records create a timeline of viewings that can be displayed on a calendar. StreamingCache stores ephemeral provider data fetched from TMDb. Goals track user-defined viewing objectives with criteria-based progress tracking. UserPreference stores module configuration.

The Film entity stores both user data (watch status, watched date, added source) and metadata (title, director, cast, genres, runtime, poster) in a single record. Metadata may come from TMDb search, manual entry, or CSV import.

### 4.2 Complete Entity Definitions

#### Entity: Film

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| title | TEXT | Required, min 1 char after trim | None | Film title |
| original_title | TEXT | Optional | null | Original title for foreign-language films |
| directors | TEXT | Optional, JSON array as string | null | Director names as JSON array |
| cast | TEXT | Optional, JSON array of objects as string | null | Top-billed cast as JSON array |
| release_year | INTEGER | Optional, 1888-2100 | null | Year of theatrical release |
| runtime_minutes | INTEGER | Optional, 1-1440 | null | Runtime in minutes |
| genres | TEXT | Optional, JSON array as string | null | Genre tags as JSON array |
| language | TEXT | Optional | 'en' | ISO 639-1 language code |
| country | TEXT | Optional | null | Country of origin |
| synopsis | TEXT | Optional | null | Film synopsis or plot summary |
| poster_url | TEXT | Optional, valid URL | null | URL to poster image |
| poster_cached_path | TEXT | Optional | null | Local path to cached poster |
| tmdb_id | INTEGER | Optional, unique if present | null | TMDb movie identifier |
| imdb_id | TEXT | Optional | null | IMDb identifier (e.g., "tt1375666") |
| watch_status | TEXT | One of: 'watched', 'want_to_watch' | 'want_to_watch' | Current watch status |
| watched_date | TEXT | Optional, ISO date | null | Date the film was watched |
| added_source | TEXT | One of: 'search', 'manual', 'import_letterboxd', 'import_imdb' | 'manual' | How the film was added |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: Rating

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film this rating belongs to |
| rating_value | REAL | Optional, 0.5-5.0, step 0.5 | null | Half-star rating |
| review_text | TEXT | Optional, max 10,000 characters | null | Free-form review text |
| contains_spoilers | INTEGER | 0 or 1 | 0 | Whether review contains spoilers |
| viewing_date | TEXT | ISO date, required | Current date | Date of the viewing |
| is_rewatch | INTEGER | 0 or 1 | 0 | Whether this is a rewatch |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: Collection

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| title | TEXT | Required, min 1 char, max 100 chars | None | Collection name |
| description | TEXT | Optional, max 500 characters | null | Collection description |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: CollectionFilm

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| collection_id | TEXT (UUID) | Foreign key to Collection.id, required | None | Parent collection |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film in collection |
| position | INTEGER | Required, min 1 | Auto (next) | Order within collection |
| added_at | TEXT | ISO datetime, auto-set | Current timestamp | When added to collection |

#### Entity: Tag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, min 1, max 50, unique NOCASE | None | Tag label |
| color | TEXT | Optional, predefined hex | null | Chip background color |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: FilmTag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film being tagged |
| tag_id | TEXT (UUID) | Foreign key to Tag.id, required | None | Tag being applied |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | When tag was applied |

#### Entity: DiaryEntry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film that was watched |
| viewing_date | TEXT | ISO date, required | None | Date the film was watched |
| rating_id | TEXT (UUID) | Foreign key to Rating.id, optional | null | Associated rating record |
| is_rewatch | INTEGER | 0 or 1 | 0 | Whether this is a rewatch entry |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

#### Entity: StreamingCache

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| film_id | TEXT (UUID) | Foreign key to Film.id, required | None | Film this cache belongs to |
| tmdb_id | INTEGER | Required | None | TMDb movie ID |
| country_code | TEXT | Required, ISO 3166-1 | Device locale | Country for provider data |
| stream_providers | TEXT | JSON array | '[]' | Subscription streaming options |
| rent_providers | TEXT | JSON array | '[]' | Rental options |
| buy_providers | TEXT | JSON array | '[]' | Purchase options |
| fetched_at | TEXT | ISO datetime | Current timestamp | When data was fetched |
| expires_at | TEXT | ISO datetime | fetched_at + 7 days | Cache expiration |

#### Entity: Goal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| title | TEXT | Required, max 200 chars | Auto-generated | Goal display name |
| goal_type | TEXT | One of: 'quantity', 'criteria' | 'quantity' | Type of goal |
| target_count | INTEGER | Required, 1-1000 | None | Target number of films |
| current_count | INTEGER | Computed | 0 | Current progress |
| start_date | TEXT | ISO date, optional | null | Period start |
| end_date | TEXT | ISO date, optional | null | Period end |
| criteria_genres | TEXT | Optional, JSON array | null | Genre filter |
| criteria_decades | TEXT | Optional, JSON array | null | Decade filter |
| criteria_director | TEXT | Optional | null | Director filter |
| criteria_tags | TEXT | Optional, JSON array | null | Tag filter |
| status | TEXT | One of: 'active', 'completed', 'expired' | 'active' | Goal status |
| completed_date | TEXT | ISO date, optional | null | Completion date |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: UserPreference

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| preference_key | TEXT | Required, unique | None | Preference identifier |
| preference_value | TEXT | Required | None | Preference value as string |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Film -> Rating | one-to-many | A film has many ratings (one per viewing) |
| Film -> DiaryEntry | one-to-many | A film has many diary entries (one per viewing) |
| Film <-> Collection | many-to-many | A film belongs to many collections (via CollectionFilm) |
| Film <-> Tag | many-to-many | A film has many tags (via FilmTag) |
| Film -> StreamingCache | one-to-many | A film has one cache per country |
| Rating -> DiaryEntry | one-to-one | A diary entry optionally references a rating |
| Collection -> CollectionFilm | one-to-many | A collection contains many film assignments |
| Tag -> FilmTag | one-to-many | A tag is applied to many films |
| Goal (standalone) | none | Goals reference film criteria but have no foreign key to Film |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Film | idx_film_tmdb_id | tmdb_id (unique where not null) | TMDb deduplication |
| Film | idx_film_imdb_id | imdb_id | IMDb import deduplication |
| Film | idx_film_title | title COLLATE NOCASE | Sorted listing, search |
| Film | idx_film_watched_date | watched_date | Diary calendar, date filtering |
| Film | idx_film_release_year | release_year | Decade browsing, year sort |
| Film | idx_film_watch_status | watch_status | Watchlist vs. library filter |
| Rating | idx_rating_film_id | film_id | Ratings for a film |
| Rating | idx_rating_film_date | film_id, viewing_date DESC | Primary rating selection |
| Rating | idx_rating_value | rating_value | Statistics, histogram |
| Collection | idx_collection_title | title COLLATE NOCASE | Sorted listing |
| CollectionFilm | idx_cf_collection_position | collection_id, position | Ordered retrieval |
| CollectionFilm | idx_cf_film_id | film_id | Collections containing a film |
| CollectionFilm | idx_cf_unique | collection_id, film_id (unique) | Prevent duplicate assignment |
| Tag | idx_tag_name | name COLLATE NOCASE (unique) | Dedup and lookup |
| FilmTag | idx_ft_film_id | film_id | Tags for a film |
| FilmTag | idx_ft_tag_id | tag_id | Films with a tag |
| FilmTag | idx_ft_unique | film_id, tag_id (unique) | Prevent duplicate tag |
| DiaryEntry | idx_diary_date | viewing_date | Calendar month queries |
| DiaryEntry | idx_diary_film | film_id, viewing_date | Film diary lookup |
| StreamingCache | idx_sc_film_country | film_id, country_code (unique) | One cache per film/country |
| StreamingCache | idx_sc_expires | expires_at | Cache cleanup |
| Goal | idx_goal_status | status | Active vs. archived |
| UserPreference | idx_pref_key | preference_key (unique) | Fast lookup |

### 4.5 Table Prefix

**MyLife hub table prefix:** `fm_`

All table names in the SQLite database are prefixed to avoid collisions with other modules in the MyLife hub. Example: the `films` table becomes `fm_films`, the `ratings` table becomes `fm_ratings`.

Complete prefixed table list:
- `fm_films`
- `fm_ratings`
- `fm_collections`
- `fm_collection_films`
- `fm_tags`
- `fm_film_tags`
- `fm_diary_entries`
- `fm_streaming_cache`
- `fm_goals`
- `fm_user_preferences`

### 4.6 Migration Strategy

- Tables are created on module enable. Schema version is tracked in the module's migration array within the ModuleDefinition.
- Each migration is idempotent (safe to run multiple times).
- Migration order: films -> ratings -> collections -> collection_films -> tags -> film_tags -> diary_entries -> streaming_cache -> goals -> user_preferences.
- Data from standalone Letterboxd/IMDb exports can be imported via FM-013 and FM-019.
- Destructive migrations (column removal) are deferred to major versions only.
- A "Clear All Data" option in settings (FM-017) drops and recreates all tables.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Library | Film strip icon | Library | Main film library with search, filter, and sort |
| Diary | Calendar icon | Diary Calendar | Calendar view of viewing history |
| Watchlist | Bookmark icon | Watchlist | Films queued to watch, with priority and random pick |
| Stats | Bar chart icon | Stats Dashboard | Viewing statistics, year-in-review, goals |
| Settings | Gear icon | Settings | Data management, preferences, import/export |

### 5.2 Navigation Flow

```
[Tab 1: Library]
  ├── Film Detail
  │     ├── Edit Film (modal)
  │     ├── Rating Picker (inline)
  │     ├── Review Editor (modal)
  │     ├── Log Rewatch (modal)
  │     ├── Tag Picker (modal)
  │     ├── Add to Collection (modal)
  │     ├── Director Filmography
  │     │     └── TMDb Filmography Lookup
  │     └── Actor Filmography
  │           └── TMDb Filmography Lookup
  ├── TMDb Search
  │     └── TMDb Film Preview
  │           └── Film Detail
  ├── Add Film Manually (modal)
  ├── Search and Filtering (inline)
  └── Decade Browsing
        └── Film Detail

[Tab 2: Diary]
  └── Day Detail
        └── Film Detail

[Tab 3: Watchlist]
  ├── Film Detail
  ├── Reorder Mode
  └── Pick for Me (modal)

[Tab 4: Stats]
  ├── Stats Dashboard
  │     ├── Genre Distribution -> Library (filtered)
  │     ├── Decade Distribution -> Decade Browsing
  │     ├── Top Directors -> Director Filmography
  │     ├── Top Actors -> Actor Filmography
  │     └── Rating Distribution -> Ratings Histogram
  ├── Year-in-Review
  │     ├── Film Detail
  │     └── Share (system sheet)
  ├── Ratings Histogram
  │     └── Library (filtered by rating)
  ├── Goals
  │     ├── Create/Edit Goal (modal)
  │     └── Goal Detail
  │           └── Film Detail
  ├── Browse by Director
  │     └── Director Filmography
  └── Browse by Actor
        └── Actor Filmography

[Tab 5: Settings]
  ├── Import Data
  │     ├── Letterboxd Import (4-step flow)
  │     └── IMDb Import (4-step flow)
  ├── Export Data
  ├── Manage Tags
  │     └── Library (filtered by tag)
  └── Clear All Data (confirmation flow)
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Library | `/films` | Main film list with search/filter/sort | Tab 1 |
| Film Detail | `/films/:id` | Full film info, rating, review, tags | Library, Diary, Watchlist, Collections, Stats, Search |
| TMDb Search | `/films/search` | Search TMDb for films to add | Library (+), Onboarding |
| TMDb Film Preview | `/films/search/:tmdb_id` | Preview TMDb result before adding | TMDb Search |
| Diary Calendar | `/films/diary` | Calendar view of viewing history | Tab 2 |
| Watchlist | `/films/watchlist` | Prioritized list of films to watch | Tab 3 |
| Stats Dashboard | `/films/stats` | Viewing statistics with time period toggle | Tab 4 |
| Year-in-Review | `/films/stats/year/:year` | Annual viewing summary | Stats Dashboard |
| Ratings Histogram | `/films/stats/ratings` | Rating distribution chart | Stats Dashboard |
| Goals | `/films/stats/goals` | Viewing goals and challenges | Stats Dashboard |
| Goal Detail | `/films/stats/goals/:id` | Single goal with qualifying films | Goals |
| Director Filmography | `/films/people/director/:name` | Films by a specific director | Film Detail, Stats, Browse Directors |
| Actor Filmography | `/films/people/actor/:name` | Films featuring a specific actor | Film Detail, Stats, Browse Actors |
| Browse Directors | `/films/people/directors` | Alphabetical director index | Stats |
| Browse Actors | `/films/people/actors` | Alphabetical actor index | Stats |
| Decade Browsing | `/films/decades` | Films grouped by release decade | Stats, Library filter |
| Collections List | `/films/collections` | All user collections | Library navigation |
| Collection Detail | `/films/collections/:id` | Single collection with ordered films | Collections List |
| Settings | `/films/settings` | Preferences, data management | Tab 5 |
| Import Data | `/films/settings/import` | Import source selection | Settings |
| Letterboxd Import | `/films/settings/import/letterboxd` | 4-step Letterboxd CSV import | Import Data, Onboarding |
| IMDb Import | `/films/settings/import/imdb` | 4-step IMDb CSV import | Import Data |
| Export Data | `/films/settings/export` | Export scope and format selection | Settings |
| Tag Management | `/films/settings/tags` | Full tag list with edit/delete | Settings |
| Onboarding | `/films/onboarding` | 3-screen first-run experience | Module first launch |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://films` | Library | None |
| `mylife://films/:id` | Film Detail | id: UUID of film |
| `mylife://films/search` | TMDb Search | None |
| `mylife://films/search?query=:text` | TMDb Search (pre-filled) | query: search text |
| `mylife://films/diary` | Diary Calendar | None |
| `mylife://films/diary?date=:YYYY-MM-DD` | Diary (specific date) | date: ISO date |
| `mylife://films/watchlist` | Watchlist | None |
| `mylife://films/stats` | Stats Dashboard | None |
| `mylife://films/stats/year/:year` | Year-in-Review | year: integer |
| `mylife://films/collections/:id` | Collection Detail | id: UUID of collection |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Media diary sync | Films | Books | Films and Books both produce diary/calendar entries; hub can show a unified "media diary" combining reading and watching events | On film watched or book reading session logged |
| Shared rating component | Films | Books | Both modules use the same half-star rating widget (0.5-5.0 scale); the component is shared via @mylife/ui | Continuous - shared UI component |
| Year-in-review pattern | Films | Books | Both modules produce year-in-review summaries following the same template; hub can aggregate a "Year in Media" combining both | On year-in-review generation |
| Entertainment budget | Films | Budget | Film-related spending (theater tickets, streaming subscriptions, physical media) can be linked to Budget categories | Manual user linkage via Budget categories |
| Mood correlation | Films | Mood (future) | Film watching patterns (genre, frequency, time of day) could correlate with mood entries for mood-media insights | Cross-module analytics query (future) |
| Film habit tracking | Films | Habits (future) | "Watch one classic film per week" or similar film-based habits could be tracked via the Habits module | Habit check-in from Films diary |

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Film library (all films, metadata) | Local SQLite | At rest (OS-level) | No | Never leaves device |
| Ratings and reviews | Local SQLite | At rest (OS-level) | No | Personal opinions stored locally only |
| Collections and lists | Local SQLite | At rest (OS-level) | No | User-created organization |
| Tags | Local SQLite | At rest (OS-level) | No | User-defined labels |
| Diary entries | Local SQLite | At rest (OS-level) | No | Viewing history |
| User preferences | Local SQLite | At rest (OS-level) | No | Module settings |
| Streaming availability cache | Local SQLite | No | No | Ephemeral API cache, 7-day TTL |
| Poster image cache | Local file system | No | No | Cached from TMDb CDN |
| Goals | Local SQLite | At rest (OS-level) | No | User-set viewing objectives |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| TMDb film search | Find film metadata | Search query (film title text) | Film metadata (title, year, director, cast, poster URL, genres, runtime, synopsis) | Implicit (user initiates search) |
| TMDb film detail lookup | Fetch full metadata for a specific film | TMDb movie ID (integer) | Full film metadata including credits | Implicit (user selects a search result) |
| TMDb watch providers | Fetch streaming availability | TMDb movie ID (integer) | Streaming/rent/buy provider data per country | Implicit (user views film detail with streaming section) |
| TMDb filmography lookup | Fetch a filmmaker's complete filmography | TMDb person ID or search query | List of films by that person | User-initiated (taps "Look up full filmography") |
| TMDb poster image download | Cache poster images locally | Poster image path | JPEG image file | Implicit (poster display) |

### 7.3 Data That Never Leaves the Device

- Complete viewing history and watched dates
- Personal ratings (half-star values)
- Personal reviews and notes
- Watchlist and watchlist priorities
- Collections, lists, and their ordering
- Tags and tag assignments
- Diary entries and viewing patterns
- Goals, challenges, and progress
- Usage statistics and analytics data
- Subscribed streaming services list
- All user preferences and settings

### 7.4 User Data Ownership

- **Export:** Users can export all data in CSV and JSON formats (FM-014). CSV format is compatible with re-import.
- **Delete:** Users can delete all module data from Settings (FM-017). Requires typing "DELETE" to confirm. Irreversible.
- **Portability:** Export format is documented, human-readable, and designed for re-import into MyFilms or other tools.
- **Selective Delete:** Users can delete individual films, ratings, reviews, collections, tags, and goals.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| No account required | Module operates fully without any user account | Core privacy principle |
| No telemetry | Zero analytics, crash reporting, or usage tracking | No data collection of any kind |
| TMDb API key | Embedded in app binary, rate-limited (40 req/10 sec) | Key is for metadata lookup only, no user data transmitted |
| Local-only reviews | Reviews are never synced, shared, or uploaded | Even the export feature requires explicit user action |
| Spoiler protection | Reviews flagged as spoilers are collapsed by default | User must tap to reveal |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Collection | A user-created, ordered group of films. A film can belong to multiple collections. |
| Diary Entry | A record of a specific viewing event (date + film), shown on the diary calendar. |
| Film | A single movie record in the user's library, containing metadata and user data. |
| Half-Star Rating | A rating value from 0.5 to 5.0 in 0.5 increments (10 possible values). |
| Hub | The MyLife umbrella app that hosts MyFilms as one of its modules. |
| Letterboxd | A popular social film tracking platform with 15M+ users. Primary competitor. |
| Module | A self-contained feature unit within the MyLife hub (e.g., MyFilms, MyBooks). |
| Primary Rating | The most recent rating for a film. Displayed on film cards and used in statistics. |
| Rewatch | Logging a subsequent viewing of a film already marked as watched. Creates a new Rating and DiaryEntry. |
| Tag | A user-defined text label applied to films for personal categorization. |
| TMDb | The Movie Database - a free, community-driven API providing film metadata. |
| Viewing | A single instance of watching a film. Includes first watch and all rewatches. |
| Watchlist | The subset of films with watch_status = "want_to_watch", displayed as a prioritized queue. |
| Watch Status | Either "watched" or "want_to_watch" - the primary state of a film in the library. |
| Year-in-Review | An annual summary report of viewing statistics and highlights for a calendar year. |
| TMDb Enrichment | The process of fetching metadata from TMDb to fill in poster, genres, cast, and other fields for imported or manually-added films. |
| Decade Group | A 10-year range used for browsing and statistics, calculated as floor(release_year / 10) * 10. |
| Genre Distribution | The percentage breakdown of films by genre across the library or a time period. |
| Spoiler | A review flagged by the user as containing plot details that could diminish the viewing experience for others. |
| Streaming Cache | Locally stored streaming availability data fetched from TMDb/JustWatch, valid for 7 days. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (spec-myfilms agent) | Initial specification - Sections 1-2 and FM-001 through FM-003 |
| 1.1 | 2026-03-07 | Claude (Opus 4.6) | Complete specification - FM-004 through FM-021, Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should the TMDb API key be bundled or user-provided? | Bundled is simpler UX but risks key abuse; user-provided is more secure but adds friction | TBD | - |
| 2 | Should TV show tracking be a separate module or part of MyFilms? | P2 feature in design doc; could expand scope significantly | TBD | - |
| 3 | Should streaming availability data use TMDb/JustWatch or a dedicated API? | TMDb provides JustWatch data via its API at no additional cost | Using TMDb API (includes JustWatch data) | 2026-03-07 |
| 4 | Should the year-in-review be shareable as an interactive web page? | Would require server infrastructure, which conflicts with privacy-first | Share as static image/PDF only | 2026-03-07 |
| 5 | Should barcode/poster scanning (P2 in design doc) get a feature spec? | Medium complexity, niche use case | Deferred to v2 spec | - |
