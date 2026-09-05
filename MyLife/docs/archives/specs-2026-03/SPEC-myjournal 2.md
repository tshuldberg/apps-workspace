# MyJournal - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-myjournal agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyJournal
- **Tagline:** "Your thoughts, your device, your business"
- **Module ID:** `journal`
- **Feature ID Prefix:** `JR`
- **Table Prefix:** `jr_`
- **Accent Color:** #6366F1 (indigo)

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Daily Journaler (Dana) | Ages 25-45, writes daily or near-daily, currently uses Day One or a paper notebook, values consistency | Maintain a daily writing habit, track streaks, review past entries, export for safekeeping |
| Therapeutic Writer (Taylor) | Ages 20-50, uses journaling for mental health, may be in therapy, tracks mood and thought patterns | Record mood alongside entries, complete CBT thought records, prepare for therapy sessions, spot emotional patterns over time |
| Gratitude Practitioner (Grace) | Ages 18-60, follows gratitude journaling practices, may use a dedicated gratitude app | Log daily gratitude items with structured prompts, track gratitude streaks, review positive patterns |
| Privacy-Conscious Writer (Parker) | Any age, deeply concerned about journal privacy, may have switched away from Day One after Automattic acquisition | Absolute certainty that entries never leave the device, strong encryption, no cloud accounts, no third-party access |
| Reflective Thinker (Robin) | Ages 30-55, writes sporadically but in depth, values long-form reflection and reviewing past writing | Search across years of entries, use "On This Day" for nostalgia, analyze writing patterns, export to PDF for printing |
| Voice Journaler (Vince) | Ages 18-40, prefers speaking over typing, commutes or exercises while wanting to capture thoughts | Dictate entries via voice, have transcription stored as text, attach original audio, edit transcriptions |

### 1.3 Core Value Proposition

MyJournal is a privacy-first journaling app that stores every word, photo, and voice recording exclusively on-device. Users write rich text entries with markdown formatting, embed photos, record voice memos with automatic transcription, tag entries with moods and custom labels, and track their journaling consistency with streak calendars and heatmaps. Unlike Day One (acquired by Automattic with E2E encryption as a paid upsell), MyJournal encrypts all entries at rest with AES-256-GCM at no extra cost. Your innermost thoughts never touch a server.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Day One | Rich multimedia entries, location/weather metadata, polished UI, large user base | Acquired by Automattic (cloud-hosted data), E2E encryption costs extra ($35-50/yr), free users' private thoughts are readable by the company | Free E2E encryption for all entries, zero cloud dependency, no corporate data access |
| Reflectly | AI-guided journaling prompts, mood tracking, attractive onboarding | Cloud-stored data ($20-60/yr), AI analysis requires sending text to external servers, limited export | On-device prompts with no data transmission, full export capabilities, no subscription required |
| Grid Diary | Structured grid/mandala prompts reduce blank-page anxiety, clean design | Limited to grid format ($23/yr), no free-form entries, no encryption | Supports both free-form and structured templates, encryption included, no subscription |
| Gratitude | Dedicated gratitude journaling, affirmations, vision boards | Narrow focus ($23/yr), cloud-stored, limited analytics | Gratitude mode as one of many journaling modes, deeper analytics, fully offline |
| Stoic | Stoicism-based prompts, CBT thought records, mental wellness focus | Expensive ($40/yr), cloud-stored mood and mental health data, narrow philosophical angle | CBT and therapy tools without cloud exposure, broader journaling beyond Stoicism |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device in encrypted local storage
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full export (PDF, Markdown, plain text) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export
- E2E encryption (AES-256-GCM with PBKDF2-derived keys, 100,000 iterations) is included for all users at no cost, not gated behind a subscription

**Product-specific privacy notes:**

- **Journal entries are among the most sensitive personal data in existence.** Users write about relationships, fears, mental health struggles, legal situations, and private thoughts. The local-only architecture ensures this data is never transmitted, synced, or backed up to any cloud service.
- **Mood and mental health data** recorded in entries and mood tags remains entirely on-device. No third party can observe emotional patterns or mental health trends.
- **Voice recordings** are processed on-device for transcription. Audio files are stored locally and never uploaded to any transcription service.
- **Photo attachments** remain in local storage. No image analysis, no facial recognition, no metadata extraction is performed by external services.
- **CBT thought records and therapy preparation notes** are clinically sensitive material. These never leave the device under any circumstances.
- **Search queries** are executed locally against the on-device full-text search index. No search terms are transmitted externally.

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| JR-001 | Rich Text Editor (Markdown) | P0 | Core | None | Not Started |
| JR-002 | Daily Journaling with Prompts | P0 | Core | JR-001 | Not Started |
| JR-003 | Multiple Journals (Notebooks) | P0 | Data Management | JR-001 | Not Started |
| JR-004 | Tag System | P0 | Data Management | JR-001 | Not Started |
| JR-005 | Mood Tagging | P1 | Core | JR-001 | Not Started |
| JR-006 | Photo Attachments | P1 | Core | JR-001 | Not Started |
| JR-007 | Voice-to-Text Entries | P1 | Core | JR-001 | Not Started |
| JR-008 | E2E Encryption | P0 | Security | JR-001 | Not Started |
| JR-009 | Streak Tracking | P0 | Analytics | JR-001 | Not Started |
| JR-010 | Full-Text Search | P0 | Data Management | JR-001 | Not Started |
| JR-011 | Calendar Heatmap | P0 | Analytics | JR-009 | Not Started |
| JR-012 | Export (PDF / Markdown / Text) | P0 | Import/Export | JR-001 | Not Started |
| JR-013 | On This Day (Nostalgia) | P1 | Core | JR-001 | Not Started |
| JR-014 | Writing Analytics | P1 | Analytics | JR-001 | Not Started |
| JR-015 | CBT Thought Records | P2 | Core | JR-001, JR-005 | Not Started |
| JR-016 | Gratitude Journaling | P1 | Core | JR-001, JR-002 | Not Started |
| JR-017 | Templates | P1 | Data Management | JR-001 | Not Started |
| JR-018 | Automatic Metadata (Location, Weather) | P1 | Core | JR-001 | Not Started |
| JR-019 | Mood Analytics and Correlation | P1 | Analytics | JR-005, JR-014 | Not Started |
| JR-020 | Grid/Mandala Layout | P2 | Core | JR-001, JR-017 | Not Started |
| JR-021 | Affirmations Tracker | P2 | Core | JR-001 | Not Started |
| JR-022 | Philosophy/Stoic Prompts | P2 | Core | JR-002 | Not Started |
| JR-023 | Therapy Prep Templates | P2 | Core | JR-015, JR-017 | Not Started |
| JR-024 | Vision Board | P2 | Core | JR-006 | Not Started |
| JR-025 | Printed Books from Entries | P3 | Import/Export | JR-012 | Not Started |
| JR-026 | Settings and Preferences | P0 | Settings | None | Not Started |
| JR-027 | Onboarding and First-Run | P1 | Onboarding | JR-001, JR-003 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search
- **Analytics** - Stats, reports, insights, visualizations
- **Import/Export** - Data portability (export user data)
- **Security** - Encryption, access control, data protection
- **Settings** - User preferences, configuration, customization
- **Onboarding** - First-run experience, tutorials, sample data

---

## 3. Feature Specifications

### JR-001: Rich Text Editor (Markdown)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-001 |
| **Feature Name** | Rich Text Editor (Markdown) |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a daily journaler, I want to write rich text entries with headings, bold, italic, lists, and links, so that my journal entries are well-structured and readable.

**Secondary:**
> As a reflective thinker, I want to write long-form entries with markdown formatting that renders beautifully in reading mode, so that reviewing my past writing is a pleasant experience.

**Tertiary:**
> As a privacy-conscious writer, I want my text editor to work entirely offline with no external dependencies, so that my writing never passes through a third-party service.

#### 3.3 Detailed Description

The Rich Text Editor is the foundational feature of MyJournal. Every other feature depends on this editor for content creation. The editor supports a subset of Markdown syntax that covers the most common journaling formatting needs: headings (H1 through H3), bold, italic, strikethrough, unordered lists, ordered lists, checklists (task lists), blockquotes, horizontal rules, inline code, code blocks, and links.

The editor operates in two modes: edit mode and reading mode. In edit mode, users type raw text with optional toolbar assistance for formatting. The toolbar provides buttons for common formatting operations so users do not need to memorize Markdown syntax. In reading mode, Markdown is rendered as styled text with proper typography, spacing, and visual hierarchy.

The editor supports entries of up to 50,000 characters per entry. This limit accommodates even the most prolific journalers while preventing database performance issues. The editor auto-saves content every 5 seconds after the last keystroke, writing to the local database to prevent data loss. A visual indicator shows save status (saved, saving, unsaved changes).

The editor tracks word count and character count in real time, displayed in a subtle footer bar. This feeds into writing analytics (JR-014) and streak tracking (JR-009). Reading time is estimated at 200 words per minute and displayed alongside the word count.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local storage for persistent entry data
- System keyboard input

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Entry Editor

**Layout:**
- Top navigation bar displays the entry date (e.g., "March 6, 2026") centered, with a "Back" button on the left and a "Done" button on the right
- Below the nav bar is a formatting toolbar with horizontally scrollable icon buttons: Bold (B), Italic (I), Strikethrough (S), Heading (H), Unordered List, Ordered List, Checklist, Blockquote, Link, and a mode toggle (Edit/Read) at the far right
- The main content area is a full-screen text input that occupies all remaining vertical space
- A footer bar at the bottom (above the keyboard when visible) shows: word count (e.g., "247 words"), character count (e.g., "1,482 chars"), estimated reading time (e.g., "1 min read"), and a save status indicator (green dot = saved, yellow dot = saving, red dot = unsaved)
- When the keyboard is active, the formatting toolbar pins to the top of the keyboard accessory area on mobile platforms

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New Entry | Entry has no content yet | Editor is empty with placeholder text: "Start writing..." in secondary color. Cursor is active. Formatting toolbar visible |
| Editing | User is actively typing | Text input is active, keyboard visible, auto-save timer running, word count updating in real time |
| Reading Mode | User toggled to reading view | Markdown rendered as styled text. Text is not editable. Toolbar shows only the mode toggle button (switch back to Edit). Footer shows word count and reading time |
| Auto-Saving | 5 seconds elapsed since last keystroke | Save status indicator shows yellow dot with "Saving..." text for up to 500ms, then switches to green dot "Saved" |
| Save Failed | Database write error | Save status indicator shows red dot with "Save failed" text. Tap to retry. Content remains in memory |
| Character Limit | Entry exceeds 50,000 characters | Footer shows character count in warning color (amber at 45,000+, red at 49,000+). Input is blocked at 50,000 with a toast: "Entry limit reached (50,000 characters)" |

**Interactions:**
- Tap formatting button: wraps selected text with appropriate Markdown syntax (e.g., **bold**), or inserts syntax at cursor if no selection
- Tap Heading button: cycles through H1 (# ), H2 (## ), H3 (### ), and plain text
- Tap Link button: opens a small inline form with "Text" and "URL" fields, inserts `[text](url)` at cursor
- Tap mode toggle: switches between edit and reading mode, preserving scroll position
- Tap "Done": saves entry, dismisses keyboard, returns to previous screen
- Tap "Back": if unsaved changes exist, shows confirmation dialog "Discard unsaved changes?" with "Discard" and "Keep Editing" options. If no unsaved changes, navigates back immediately
- Swipe down on text area (when keyboard is visible): dismisses keyboard without leaving editor

**Transitions/Animations:**
- Mode toggle between edit and reading mode uses a 200ms crossfade
- Save status indicator transitions use a 150ms fade
- Formatting toolbar slides up with the keyboard (300ms, ease-out)

##### Screen: Entry Reading View

**Layout:**
- Top navigation bar with "Back" button, entry date, and "Edit" button (pencil icon)
- Main content area displays rendered Markdown with proper typography:
  - H1: 24pt, bold
  - H2: 20pt, bold
  - H3: 18pt, bold
  - Body: 16pt, regular
  - Blockquotes: indented with a left border accent bar (4px, accent color), italic
  - Lists: properly indented with bullet or number markers
  - Checklists: interactive checkboxes (checking/unchecking updates the entry content)
  - Links: accent-colored, tappable (opens in system browser)
  - Code blocks: monospaced font, subtle background color
- Below content: metadata section showing creation date, last edited date, word count, tags (if any), mood (if tagged), and journal/notebook name
- Footer action bar: "Edit", "Share" (exports rendered text), "Delete" (with confirmation)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full Content | Entry has text content | Rendered Markdown view with metadata |
| With Attachments | Entry has photos or voice recordings | Attachment thumbnails rendered inline where embedded, or in an attachments section below content |
| Minimal | Very short entry (under 20 words) | Content centered vertically with generous padding |

**Interactions:**
- Tap "Edit": switches to Entry Editor in edit mode
- Tap checkbox in checklist: toggles checked state, auto-saves
- Tap link: opens URL in system browser
- Long press on text: system copy/select menu
- Tap "Delete": confirmation dialog "Delete this entry? This cannot be undone." with "Delete" (destructive) and "Cancel"

#### 3.6 Data Requirements

##### Entity: Entry

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| journal_id | TEXT (UUID) | Required, references Journal.id | None | Parent journal/notebook |
| title | TEXT | Optional, max 500 chars | null | Entry title (optional, auto-derived from first line if blank) |
| content | TEXT | Required, max 50,000 chars | '' | Entry body in Markdown format |
| content_plain | TEXT | Auto-derived from content | '' | Plain text version for search indexing and word count |
| word_count | INTEGER | Computed, min 0 | 0 | Number of words in content_plain |
| char_count | INTEGER | Computed, min 0 | 0 | Number of characters in content |
| is_favorite | INTEGER | 0 or 1 | 0 | Whether the entry is starred/favorited |
| is_encrypted | INTEGER | 0 or 1 | 0 | Whether content is stored encrypted |
| entry_date | TEXT | ISO date (YYYY-MM-DD), required | Current date | The calendar date this entry represents |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Indexes:**
- `journal_id` - Filter entries by notebook
- `entry_date` - Sort by date, calendar views, streak calculation
- `created_at` - Default sort order
- `is_favorite` - Filter favorited entries
- `(journal_id, entry_date)` - Composite index for date-scoped queries within a journal

**Validation Rules:**
- `content`: Must not exceed 50,000 characters
- `entry_date`: Must be a valid ISO date string
- `journal_id`: Must reference an existing Journal record
- `word_count`: Recalculated on every content update as the count of whitespace-delimited tokens in content_plain
- `title`: If null or empty, the system derives it from the first non-empty line of content, truncated to 100 characters

**Example Data:**

```json
{
  "id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890",
  "journal_id": "j1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "title": "Morning Pages",
  "content": "# Morning Pages\n\nToday I woke up feeling rested for the first time in weeks. The rain was tapping against the window and I lay there just listening to it.\n\n## What I'm grateful for\n\n- A warm bed on a cold morning\n- The sound of rain\n- No meetings until 10am\n\n> \"The best time for new beginnings is now.\" - Unknown",
  "content_plain": "Morning Pages Today I woke up feeling rested for the first time in weeks. The rain was tapping against the window and I lay there just listening to it. What I'm grateful for A warm bed on a cold morning The sound of rain No meetings until 10am The best time for new beginnings is now. - Unknown",
  "word_count": 62,
  "char_count": 310,
  "is_favorite": 0,
  "is_encrypted": 0,
  "entry_date": "2026-03-06",
  "created_at": "2026-03-06T07:15:00Z",
  "updated_at": "2026-03-06T07:22:00Z"
}
```

#### 3.7 Business Logic Rules

##### Markdown Parsing

**Purpose:** Convert Markdown syntax to rendered styled text for reading mode

**Inputs:**
- `raw_content`: string - The raw Markdown text from the editor

**Logic:**

```
1. Parse raw_content using a Markdown parser
2. Support these syntax elements:
   - # H1, ## H2, ### H3 (headings)
   - **bold**, *italic*, ~~strikethrough~~
   - - item (unordered list)
   - 1. item (ordered list)
   - - [ ] unchecked, - [x] checked (checklists)
   - > blockquote
   - --- (horizontal rule)
   - `inline code`, ``` code block ```
   - [text](url) (links)
   - ![alt](path) (embedded images for photo attachments)
3. Strip Markdown syntax to produce content_plain
4. RETURN rendered output and plain text
```

**Edge Cases:**
- Empty content: renders nothing, word_count = 0
- Content with only whitespace: treated as empty
- Nested formatting (e.g., bold inside italic): supported up to 2 levels of nesting
- Malformed Markdown (unclosed bold, etc.): render as literal text, do not crash

##### Auto-Save Logic

**Purpose:** Persist entry content automatically to prevent data loss

**Inputs:**
- `content`: string - Current editor content
- `entry_id`: UUID - The entry being edited
- `last_save_time`: timestamp - When the last save occurred

**Logic:**

```
1. On each keystroke, reset a 5-second debounce timer
2. When the timer fires:
   a. Set save_status to "saving"
   b. Compute word_count = count(split(content_plain, whitespace))
   c. Compute char_count = length(content)
   d. Write (content, content_plain, word_count, char_count, updated_at) to database
   e. IF write succeeds: set save_status to "saved"
   f. IF write fails: set save_status to "failed", retain content in memory
3. On "Done" button tap: force an immediate save regardless of timer
4. On app backgrounding: force an immediate save
```

**Edge Cases:**
- Rapid typing: debounce prevents excessive writes; at most one write per 5 seconds
- App killed during save: on next launch, check for uncommitted content in a write-ahead recovery buffer
- Database locked: retry write up to 3 times with 500ms backoff, then report failure

##### Word Count Calculation

**Purpose:** Count words in an entry for analytics and display

**Inputs:**
- `content_plain`: string - Plain text content with Markdown syntax stripped

**Formulas:**
- `word_count = length(split(trim(content_plain), /\s+/))` where empty string yields 0
- `reading_time_minutes = ceil(word_count / 200)`
- `char_count = length(content)` (raw Markdown content, not plain text)

**Edge Cases:**
- Empty string: word_count = 0, reading_time = 0
- String with only whitespace: word_count = 0
- Single word: word_count = 1, reading_time = 1
- Markdown syntax characters: excluded from word_count (stripped in content_plain), included in char_count

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Auto-save database write fails | Save indicator turns red: "Save failed - tap to retry" | User taps indicator to retry. Content remains in memory. App retries on next auto-save cycle |
| Content exceeds 50,000 character limit | Toast: "Entry limit reached (50,000 characters)". Further input blocked | User deletes text to reduce length. Consider splitting into multiple entries |
| Malformed Markdown renders incorrectly | Raw Markdown text displayed as-is for unparseable sections | User corrects syntax in edit mode. No data loss |
| Keyboard does not appear | Editor appears but no keyboard | User taps the text area again. If persistent, system keyboard settings may need adjustment |
| Entry fails to load from database | Error screen: "Could not load this entry. Please try again." | User taps "Retry" or navigates back and tries again |

**Validation Timing:**
- Character count validation runs on every keystroke (counter updates in real time)
- Character limit enforcement (50,000) runs on keystroke, blocking input at the limit
- Title derivation runs on save (not on every keystroke)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens a new entry,
   **When** they type text in the editor,
   **Then** the word count and character count update in real time in the footer bar.

2. **Given** the user types Markdown syntax (e.g., `**bold text**`),
   **When** they toggle to reading mode,
   **Then** the text renders with proper formatting (bold text appears bold).

3. **Given** the user is editing an entry and stops typing for 5 seconds,
   **When** the auto-save timer fires,
   **Then** the entry is saved to the database and the save indicator shows a green "Saved" dot.

4. **Given** the user taps the Bold button on the formatting toolbar with text selected,
   **When** the button is tapped,
   **Then** the selected text is wrapped with `**` on both sides.

5. **Given** the user taps "Done",
   **When** the entry has unsaved changes,
   **Then** the entry is saved immediately and the user is returned to the previous screen.

**Edge Cases:**

6. **Given** the user has typed 49,990 characters,
   **When** they type 11 more characters,
   **Then** only 10 characters are accepted, the counter shows "50,000 / 50,000" in red, and a toast appears: "Entry limit reached".

7. **Given** the user toggles to reading mode,
   **When** the entry contains no content,
   **Then** reading mode displays "This entry is empty" in secondary text color.

**Negative Tests:**

8. **Given** the database is locked or corrupted,
   **When** auto-save attempts to write,
   **Then** the save indicator turns red showing "Save failed", and content remains safely in memory.
   **And** no entry data is lost or corrupted.

9. **Given** the user taps "Back" with unsaved changes,
   **When** the confirmation dialog appears,
   **Then** tapping "Discard" exits without saving, and tapping "Keep Editing" returns to the editor.
   **And** content is not modified by the confirmation dialog itself.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| counts words correctly for normal text | "Hello world today" | word_count: 3 |
| counts zero words for empty string | "" | word_count: 0 |
| counts zero words for whitespace-only string | "   \n\t  " | word_count: 0 |
| strips Markdown for plain text | "**bold** and *italic*" | content_plain: "bold and italic" |
| calculates reading time ceiling | word_count: 201 | reading_time_minutes: 2 |
| calculates reading time for zero words | word_count: 0 | reading_time_minutes: 0 |
| derives title from first line | content: "# My Day\nSome text" | title: "My Day" |
| derives title from plain first line | content: "A regular first line\nMore text" | title: "A regular first line" |
| truncates derived title at 100 chars | content: 150-character first line | title: first 100 characters + no ellipsis |
| enforces 50,000 char limit | 50,001 character string | validation error: character limit exceeded |
| wraps selected text with bold syntax | selected: "hello", action: bold | result: "**hello**" |
| inserts heading prefix at line start | cursor at start of line, action: H1 | result: "# " prepended to line |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create entry with auto-save | 1. Open new entry, 2. Type 20 words, 3. Wait 6 seconds | Entry appears in database with correct word_count, char_count, and updated_at |
| Edit existing entry | 1. Open existing entry, 2. Add text, 3. Tap Done | Entry updated_at changes, word_count recalculated, content reflects edits |
| Mode toggle preserves content | 1. Type text in edit mode, 2. Toggle to reading mode, 3. Toggle back to edit mode | Content is identical in both transitions, cursor position is reasonable |
| Back with unsaved changes | 1. Type text, 2. Tap Back immediately (before auto-save) | Confirmation dialog appears. "Discard" loses changes, "Keep Editing" returns to editor |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Write and save first journal entry | 1. Open app, 2. Tap "New Entry", 3. Type 100 words with bold and headings, 4. Tap Done | Entry saved in database, appears in entry list with correct date, word count shows 100, reading mode renders formatting correctly |
| Write a long entry | 1. Create new entry, 2. Paste 10,000 words of text, 3. Toggle to reading mode, 4. Tap Done | Entry saves successfully, word count accurate, reading mode renders without performance issues (under 500ms render time) |

---

### JR-002: Daily Journaling with Prompts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-002 |
| **Feature Name** | Daily Journaling with Prompts |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a daily journaler, I want to see a writing prompt when I open a new entry, so that I have a starting point and never face a blank page.

**Secondary:**
> As a gratitude practitioner, I want prompt categories (reflection, gratitude, creativity, self-discovery) so that I can choose prompts that match my journaling goals.

**Tertiary:**
> As a therapeutic writer, I want the option to skip prompts entirely and write free-form, so that prompts do not feel forced when I already know what to write about.

#### 3.3 Detailed Description

Daily Journaling with Prompts addresses the most common barrier to consistent journaling: not knowing what to write. The system provides a rotating library of writing prompts organized into categories. Each day, a new prompt is surfaced based on the user's preferred categories. All prompts are stored on-device and require no network access.

The prompt library ships with at least 365 built-in prompts (one per day for a full year without repeats) distributed across categories: Reflection (90), Gratitude (60), Self-Discovery (60), Creativity (45), Goals and Growth (45), Relationships (35), and Mindfulness (30). Users can also create custom prompts and add them to the rotation.

When creating a new entry, the user sees the daily prompt displayed above the editor. They can: (a) write using the prompt (prompt text is not inserted into entry content, it stays as context above), (b) tap "New Prompt" to get a different prompt from the same category, (c) tap "Change Category" to switch prompt categories, or (d) tap "Skip" to dismiss the prompt and write free-form. The used/skipped status of each prompt is tracked so prompts are not repeated until all prompts in a category have been shown.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Prompts display above the editor and feed into entry creation

**External Dependencies:**
- None (all prompts stored locally)

**Assumed Capabilities:**
- Entry editor is functional
- Local database is initialized

#### 3.5 User Interface Requirements

##### Component: Prompt Card

**Layout:**
- Positioned above the editor text area, below the formatting toolbar
- Card with subtle background color differentiated from the editor (slightly lighter or darker than editor background)
- Category label at top-left in small caps with category icon (e.g., "REFLECTION" with a mirror icon)
- Prompt text centered, 18pt font, regular weight, max 3 lines
- Below prompt text: a row of action buttons: "Use This" (primary), "New Prompt" (secondary), "Skip" (tertiary/text-only)
- "Change Category" link in bottom-right corner of the card

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Fresh Prompt | New entry opened, prompt not yet acted on | Full prompt card with all action buttons |
| Prompt Accepted | User tapped "Use This" | Card collapses to a single line showing the prompt text in muted color, with an "x" to dismiss. Editor becomes active with cursor |
| Prompt Skipped | User tapped "Skip" | Card dismisses with slide-up animation. Editor is full-screen |
| All Prompts Exhausted | All prompts in category have been shown | Card shows: "You have seen all [category] prompts! Prompts will reset." and resets the seen list |
| Prompt Disabled | User has turned off prompts in settings | No prompt card displayed. Editor opens in full-screen mode immediately |

**Interactions:**
- Tap "Use This": collapses prompt card to compact view, entry editor becomes active. The prompt_id is stored on the entry record for later reference
- Tap "New Prompt": animates current prompt out (fade-left) and new prompt in (fade-right) from the same category, excluding already-shown prompts
- Tap "Skip": prompt card slides up and disappears. Editor expands to fill the space. Entry is created with no prompt_id
- Tap "Change Category": shows a bottom sheet with category list (each with icon and prompt count remaining). Selecting a category loads a random unseen prompt from that category
- Tap "x" on collapsed prompt: fully dismisses the prompt reference from the entry (sets prompt_id to null)

**Transitions/Animations:**
- Prompt card collapse: 200ms slide-up to single-line height
- Prompt card dismiss: 200ms slide-up and fade-out
- New prompt swap: 150ms fade-left-out for old, 150ms fade-right-in for new

##### Modal: Category Selector

**Layout:**
- Bottom sheet, half-screen height
- Title: "Choose a Category"
- Vertical list of categories, each showing: category icon, category name, and remaining prompts count (e.g., "42 remaining")
- Tapping a category selects it, loads a prompt, and dismisses the sheet

#### 3.6 Data Requirements

##### Entity: Prompt

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| text | TEXT | Required, max 500 chars | None | The prompt question or statement |
| category | TEXT | Required, one of: 'reflection', 'gratitude', 'self_discovery', 'creativity', 'goals_growth', 'relationships', 'mindfulness', 'custom' | None | Prompt category |
| is_builtin | INTEGER | 0 or 1 | 1 | Whether this is a system-provided or user-created prompt |
| is_seen | INTEGER | 0 or 1 | 0 | Whether the user has been shown this prompt |
| seen_at | TEXT | ISO datetime, nullable | null | When the user was shown this prompt |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `category` - Filter prompts by category
- `(category, is_seen)` - Get unseen prompts in a category efficiently

**Validation Rules:**
- `text`: Must not be empty after trimming
- `category`: Must be one of the allowed values
- `is_builtin`: Cannot be changed after creation (built-in prompts are immutable)
- User-created prompts (`is_builtin = 0`) can be edited and deleted
- Built-in prompts cannot be deleted, only marked as seen

**Additions to Entry entity (from JR-001):**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| prompt_id | TEXT (UUID) | Optional, references Prompt.id | null | The prompt used for this entry, if any |

**Example Data:**

```json
{
  "id": "p1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "text": "What is one thing you learned about yourself this week?",
  "category": "self_discovery",
  "is_builtin": 1,
  "is_seen": 0,
  "seen_at": null,
  "created_at": "2026-01-01T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Prompt Selection Algorithm

**Purpose:** Select a prompt the user has not yet seen from their preferred category

**Inputs:**
- `preferred_category`: string - The user's selected prompt category
- `prompts_table`: Prompt[] - All prompts in the database

**Logic:**

```
1. Query: SELECT * FROM prompts WHERE category = preferred_category AND is_seen = 0 ORDER BY RANDOM() LIMIT 1
2. IF result exists:
   a. Mark prompt as seen: UPDATE prompts SET is_seen = 1, seen_at = NOW() WHERE id = result.id
   b. RETURN result
3. IF no unseen prompts remain:
   a. Reset all prompts in category: UPDATE prompts SET is_seen = 0, seen_at = NULL WHERE category = preferred_category
   b. Select a random prompt: SELECT * FROM prompts WHERE category = preferred_category ORDER BY RANDOM() LIMIT 1
   c. Mark as seen and RETURN
```

**Edge Cases:**
- Category has zero prompts (e.g., user deleted all custom prompts in "custom" category): show "No prompts available in this category. Try another category or add custom prompts."
- User rapidly taps "New Prompt": each tap selects a different unseen prompt. If only 1 unseen prompt remains, "New Prompt" button is disabled
- Database error during prompt query: show a fallback generic prompt: "What is on your mind today?"

##### Daily Prompt Cycling

**Purpose:** Present a fresh prompt each day without manual user action

**Inputs:**
- `today`: date - Current calendar date
- `last_prompt_date`: date - Date of the last prompt shown (from settings)

**Logic:**

```
1. On app launch or new entry creation:
   a. IF today != last_prompt_date:
      - Select a new prompt using Prompt Selection Algorithm
      - Store today as last_prompt_date in settings
      - Store selected prompt_id as today_prompt_id in settings
   b. ELSE:
      - Use today_prompt_id from settings (same prompt for same day)
2. If user taps "New Prompt", override today_prompt_id with the newly selected prompt
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Prompt database table missing or corrupted | No prompt card shown. Editor opens in free-form mode | App logs error. On next launch, attempt to re-seed built-in prompts |
| All prompts in all categories marked seen | System resets seen status for the selected category | Automatic. User sees a prompt without interruption |
| Custom prompt text is empty on save | Inline validation: "Prompt text cannot be empty" | User fills in prompt text before saving |
| Category selector fails to load categories | Toast: "Could not load categories." Category selector dismissed | User creates entry without prompt or tries again |

**Validation Timing:**
- Custom prompt text validated on save (not on keystroke)
- Category selection validated immediately (must be a valid enum value)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a new entry with prompts enabled,
   **When** the editor opens,
   **Then** a prompt card is displayed above the editor with a random unseen prompt from the user's preferred category.

2. **Given** the user taps "Use This" on a prompt,
   **When** the prompt is accepted,
   **Then** the prompt card collapses to a compact view, the editor activates, and the entry's prompt_id is set.

3. **Given** the user taps "New Prompt",
   **When** unseen prompts remain in the category,
   **Then** a different prompt is displayed with a swap animation.

4. **Given** the user taps "Skip",
   **When** the prompt is dismissed,
   **Then** the prompt card disappears, the editor fills the screen, and the entry has no prompt_id.

**Edge Cases:**

5. **Given** the user has seen all prompts in the "gratitude" category,
   **When** a new prompt is requested,
   **Then** all prompts in "gratitude" are reset to unseen and a fresh prompt is displayed.

6. **Given** the user opens the app twice on the same day,
   **When** creating new entries both times,
   **Then** the same daily prompt is shown both times (unless "New Prompt" was tapped).

**Negative Tests:**

7. **Given** the prompts table is empty or missing,
   **When** the user creates a new entry,
   **Then** no prompt card is shown and the editor opens normally in free-form mode.
   **And** no error is shown to the user.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| selects random unseen prompt from category | category: "reflection", 5 unseen prompts exist | Returns one prompt with is_seen = 0 |
| marks selected prompt as seen | prompt_id: "abc123" | prompt.is_seen = 1, prompt.seen_at is set |
| resets category when all seen | category: "gratitude", 0 unseen | All "gratitude" prompts reset to is_seen = 0 |
| returns fallback when no prompts exist | category: "custom", 0 total prompts | Returns fallback prompt text |
| preserves daily prompt on same day | today: "2026-03-06", last_prompt_date: "2026-03-06" | Returns same prompt_id as stored |
| rotates prompt on new day | today: "2026-03-07", last_prompt_date: "2026-03-06" | Returns new prompt_id, updates last_prompt_date |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Prompt flows into entry | 1. Open new entry, 2. Tap "Use This", 3. Write content, 4. Save | Saved entry has prompt_id set, prompt marked as seen |
| Skip prompt creates free-form entry | 1. Open new entry, 2. Tap "Skip", 3. Write content, 4. Save | Saved entry has prompt_id = null |
| Change category loads new prompt | 1. Open new entry, 2. Tap "Change Category", 3. Select "creativity" | New prompt from "creativity" category displayed |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Daily prompted journaling | 1. Open app day 1, create entry with prompt, 2. Open app day 2, create entry with prompt, 3. Open app day 3, create entry with prompt | 3 entries saved, each with different prompt_ids, 3 prompts marked as seen, streak count = 3 |

---

### JR-003: Multiple Journals (Notebooks)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-003 |
| **Feature Name** | Multiple Journals (Notebooks) |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an organized journaler, I want to create separate journals for different areas of my life (personal, work, travel, gratitude), so that my entries are organized by context rather than jumbled together.

**Secondary:**
> As a daily journaler, I want a default journal that catches all entries if I do not select one, so that I can write quickly without choosing a destination.

**Tertiary:**
> As a privacy-conscious writer, I want to set individual journals as "private" with an extra authentication step, so that especially sensitive journals have an additional layer of protection.

#### 3.3 Detailed Description

Multiple Journals allows users to create separate notebooks for different aspects of their lives. This mirrors the physical experience of having different notebooks for different purposes. The system creates a "My Journal" default journal on first launch, which cannot be deleted (but can be renamed). Users can create up to 50 additional journals.

Each journal has a name (up to 100 characters), an optional description (up to 500 characters), a color (chosen from a palette of 20 preset colors), an icon (chosen from a library of 80 icons), and a privacy setting (standard or private). Private journals require biometric authentication or PIN to open, providing an additional layer beyond the base E2E encryption.

Entries always belong to exactly one journal. Users can move entries between journals. The journal list screen shows all journals with entry counts and last-updated dates. Users can reorder journals by drag-and-drop, and the sort order persists.

When creating a new entry, the user can either: (a) tap "New Entry" from within a specific journal (entry is assigned to that journal), or (b) tap "New Entry" from the main screen (entry is assigned to the default journal, with an option to change before saving).

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Entries are the content within journals

**External Dependencies:**
- Biometric authentication hardware (for private journals, optional)
- Local storage for journal metadata

**Assumed Capabilities:**
- User can navigate between screens via tab bar
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Journal List

**Layout:**
- Top navigation bar displays "Journals" title, with a "+" button on the right to create a new journal
- Main content area is a vertically scrollable list of journal cards
- Each card shows: color accent bar on the left (4px wide, journal color), journal icon, journal name (bold), entry count (e.g., "47 entries"), last updated date (e.g., "Updated 2 hours ago"), and a lock icon if the journal is private
- The default journal has a subtle "Default" badge below its name
- Cards are ordered by user-defined sort order (persisted, drag-and-drop reorderable)
- Below the journal list: a summary bar showing "X journals, Y total entries"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| First Launch | Only the default journal exists | Default journal card shown. Below it: a suggestion card "Create your first custom journal" with preset options (Work, Travel, Gratitude, Dreams) |
| Multiple Journals | 2+ journals exist | Scrollable list of journal cards in user-defined order |
| Maximum Reached | 51 journals exist (default + 50) | "+" button disabled. Toast on tap: "Maximum of 50 custom journals reached" |
| Loading | Journals loading from database | Skeleton placeholder cards |
| Error | Database query fails | Inline error: "Could not load journals. Pull down to retry." |

**Interactions:**
- Tap journal card: navigates to Journal Detail (entry list filtered to that journal). If journal is private, biometric/PIN prompt first
- Long press journal card: opens context menu with "Edit", "Set as Default", "Move Entries", "Archive", "Delete" (delete not available for default journal)
- Drag and drop: reorder journals (haptic feedback on lift, visual indicator for drop target)
- Tap "+": opens Create Journal modal
- Pull-to-refresh: reloads journal list

**Transitions/Animations:**
- Journal card press: subtle scale-down (0.98) with 100ms duration
- Drag lift: card lifts with shadow, 150ms scale to 1.02
- Card reorder: other cards slide to accommodate with 200ms animation

##### Screen: Journal Detail (Entry List)

**Layout:**
- Top navigation bar with journal name and icon, "Back" button on left, overflow menu (three dots) on right with journal actions (Edit, Set as Default, Archive, Delete)
- Below nav bar: a journal-colored accent strip (2px) matching the journal's color
- Below accent strip: sort/filter bar with sort dropdown (Newest First, Oldest First, Most Words) and a view toggle (list/calendar)
- Main content area: scrollable list of entries belonging to this journal
- Each entry item shows: entry date (bold), title or first line preview (single line, truncated), word count, mood emoji (if mood-tagged), and favorite star icon
- Floating action button in bottom-right: "New Entry" (plus icon with journal color)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Journal has no entries | Centered illustration of an open notebook, heading: "No entries yet", subtext: "Start writing in this journal", primary button: "Write First Entry" |
| Populated | 1+ entries | Scrollable entry list |
| Filtered | Sort or filter applied | Filtered list with active filter indicator |

**Interactions:**
- Tap entry item: opens Entry Reading View
- Swipe left on entry: reveals "Move" (blue) and "Delete" (red) actions
- Tap floating action button: opens Entry Editor with journal_id preset
- Tap sort dropdown: changes entry order

##### Modal: Create/Edit Journal

**Layout:**
- Modal sheet sliding up from bottom, 70% screen height
- Title: "New Journal" or "Edit Journal"
- Form fields:
  - Name (required, text input, max 100 characters, placeholder: "Journal name")
  - Description (optional, multiline text input, max 500 characters, placeholder: "What is this journal for?")
  - Color (horizontal scrollable palette of 20 colors, tap to select, default: first color not already used)
  - Icon (grid of 80 icons organized by category, tap to select, default: notebook icon)
  - Privacy toggle: "Require authentication to open" (switch, default: off)
- Footer: "Cancel" (left), "Create" / "Save" (right, disabled until name is filled)

**Interactions:**
- Tap color swatch: selects color with a checkmark indicator
- Tap icon: selects icon with a highlight border
- Toggle privacy: if enabling, shows one-time notice: "You will need to authenticate each time you open this journal. Make sure you have biometric or PIN set up on your device."
- Tap "Create"/"Save": validates name, saves journal, dismisses modal
- Tap "Cancel": dismisses with confirmation if form has changes

##### Dialog: Move Entry to Journal

**Layout:**
- Bottom sheet with title: "Move to..."
- List of all journals (excluding current), each showing icon, color accent, name, and entry count
- "Cancel" button at bottom

**Interactions:**
- Tap journal: moves the entry to the selected journal, shows toast "Entry moved to [journal name]", dismisses sheet

#### 3.6 Data Requirements

##### Entity: Journal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, max 100 chars, unique | None | Journal display name |
| description | TEXT | Optional, max 500 chars | null | Journal description or purpose |
| color | TEXT | Required, hex color string | '#6366F1' | Journal accent color |
| icon | TEXT | Required, icon identifier string | 'notebook' | Journal icon identifier |
| is_default | INTEGER | 0 or 1, only one journal can be 1 | 0 | Whether this is the default journal |
| is_private | INTEGER | 0 or 1 | 0 | Whether this journal requires authentication |
| is_archived | INTEGER | 0 or 1 | 0 | Whether this journal is archived (hidden from main list) |
| sort_order | INTEGER | Min 0 | 0 | User-defined display order |
| entry_count | INTEGER | Computed, min 0 | 0 | Cached count of entries in this journal |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Indexes:**
- `is_default` - Quick lookup of the default journal
- `sort_order` - Ordered listing
- `is_archived` - Filter out archived journals
- `name COLLATE NOCASE` - Unique constraint check (case-insensitive)

**Validation Rules:**
- `name`: Must not be empty after trimming, max 100 characters, must be unique (case-insensitive)
- `color`: Must be a valid hex color string (e.g., "#FF5733")
- `is_default`: Exactly one journal must have `is_default = 1` at all times. Setting a new default clears the previous one
- Maximum 51 journals total (1 default + 50 custom)

**Example Data:**

```json
{
  "id": "j1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "name": "Personal",
  "description": "Daily thoughts and reflections",
  "color": "#6366F1",
  "icon": "notebook",
  "is_default": 1,
  "is_private": 0,
  "is_archived": 0,
  "sort_order": 0,
  "entry_count": 47,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-03-06T07:22:00Z"
}
```

#### 3.7 Business Logic Rules

##### Default Journal Enforcement

**Purpose:** Ensure exactly one journal is the default at all times

**Logic:**

```
1. On first launch: create "My Journal" with is_default = 1
2. When user sets a new default:
   a. BEGIN TRANSACTION
   b. UPDATE journals SET is_default = 0 WHERE is_default = 1
   c. UPDATE journals SET is_default = 1 WHERE id = new_default_id
   d. COMMIT
3. When user deletes a journal:
   a. IF journal.is_default = 1: block deletion, show error "Cannot delete the default journal"
   b. ELSE: proceed with deletion
4. When user deletes a journal that has entries:
   a. Show confirmation: "This journal has X entries. Move them to [default journal name] or delete them?"
   b. Option A: Move all entries to default journal, then delete the journal
   c. Option B: Delete all entries and the journal (irreversible, double confirmation)
```

**Edge Cases:**
- Database has zero journals (corruption): recreate default journal on next app launch
- Database has two default journals (corruption): keep the one with the lowest sort_order, unset the other

##### Journal Entry Count Cache

**Purpose:** Maintain an accurate entry count per journal without counting on every list load

**Logic:**

```
1. On entry creation: INCREMENT journal.entry_count WHERE id = entry.journal_id
2. On entry deletion: DECREMENT journal.entry_count WHERE id = entry.journal_id
3. On entry move (old_journal_id -> new_journal_id):
   a. DECREMENT journal.entry_count WHERE id = old_journal_id
   b. INCREMENT journal.entry_count WHERE id = new_journal_id
4. On journal list load: use cached entry_count (do not recount)
5. On pull-to-refresh: recalculate all entry_counts from scratch: UPDATE journals SET entry_count = (SELECT COUNT(*) FROM entries WHERE entries.journal_id = journals.id)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Duplicate journal name | Inline validation below name field: "A journal with this name already exists" | User changes the name. Validation clears on valid input |
| Delete journal with entries | Confirmation dialog with entry count and move/delete options | User chooses to move entries to default journal or delete all |
| Maximum journals reached | Toast: "Maximum of 50 custom journals reached" | User deletes or archives existing journals to make room |
| Private journal auth fails | Toast: "Authentication failed. Please try again." Journal does not open | User retries biometric or PIN. After 3 failures, show "Unable to authenticate" with option to try again later |
| Default journal missing on launch | System auto-creates a new default journal | Automatic recovery. User may notice journal list updated |
| Move entry fails (target journal deleted mid-operation) | Toast: "Could not move entry. The target journal no longer exists." | User reopens move dialog and selects a different journal |

**Validation Timing:**
- Journal name uniqueness validated on blur and on save
- Character limits validated on keystroke (counter shown when approaching limit)
- Color and icon selection validated immediately (limited to preset options)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user launches the app for the first time,
   **When** the database initializes,
   **Then** a default journal named "My Journal" exists with is_default = 1.

2. **Given** the user taps "+" on the Journal List,
   **When** they fill in name, select color and icon, and tap "Create",
   **Then** the new journal appears in the journal list with 0 entries.

3. **Given** the user taps a journal card,
   **When** the journal is not private,
   **Then** the Journal Detail screen opens showing entries for that journal.

4. **Given** the user long-presses a journal and selects "Set as Default",
   **When** the action completes,
   **Then** the selected journal shows the "Default" badge and the previous default journal loses it.

5. **Given** the user swipes left on an entry and taps "Move",
   **When** they select a target journal,
   **Then** the entry disappears from the current list, the source journal entry count decrements, and the target journal entry count increments.

**Edge Cases:**

6. **Given** the user has 51 journals (maximum),
   **When** they tap "+",
   **Then** a toast appears: "Maximum of 50 custom journals reached" and no create modal opens.

7. **Given** the user tries to delete the default journal,
   **When** the delete action is attempted,
   **Then** the system blocks deletion with: "Cannot delete the default journal. Set another journal as default first."

**Negative Tests:**

8. **Given** the user creates a journal with an empty name,
   **When** they tap "Create",
   **Then** the system shows inline validation: "Journal name is required" and does not create the journal.
   **And** the "Create" button remains disabled.

9. **Given** the user creates a journal with a name that already exists (case-insensitive),
   **When** they tap "Create",
   **Then** inline validation shows: "A journal with this name already exists."
   **And** no duplicate journal is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates default journal on first launch | empty database | One journal with is_default = 1, name = "My Journal" |
| enforces single default journal | set journal B as default when A is default | A.is_default = 0, B.is_default = 1 |
| prevents duplicate names (case-insensitive) | name: "Work" when "work" exists | validation error: duplicate name |
| enforces max 51 journals | 51 journals exist, create attempt | rejection: maximum reached |
| blocks default journal deletion | delete journal where is_default = 1 | rejection: cannot delete default |
| increments entry count on entry creation | journal.entry_count = 5, new entry created | journal.entry_count = 6 |
| decrements entry count on entry deletion | journal.entry_count = 5, entry deleted | journal.entry_count = 4 |
| transfers entry count on move | source.entry_count = 5, target.entry_count = 3, move 1 | source = 4, target = 4 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create journal and add entry | 1. Create "Travel" journal, 2. Open it, 3. Create entry, 4. Save | "Travel" journal shows 1 entry. Entry has journal_id matching "Travel" |
| Move entry between journals | 1. Create entry in "Personal", 2. Swipe left, tap "Move", 3. Select "Work" | Entry appears in "Work" list, gone from "Personal" list, counts updated |
| Delete journal with entries | 1. Create "Temp" journal, 2. Add 3 entries, 3. Delete "Temp", choose "Move to default" | "Temp" journal deleted, 3 entries now in default journal |
| Private journal requires auth | 1. Create private journal, 2. Navigate away, 3. Tap private journal | Biometric/PIN prompt appears before journal opens |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Organize journals for daily use | 1. Rename default to "Daily", 2. Create "Work" journal, 3. Create "Gratitude" journal, 4. Reorder by drag, 5. Add entries to each | 3 journals in custom order, each with entries, entry counts accurate |

---

### JR-004: Tag System

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-004 |
| **Feature Name** | Tag System |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an organized journaler, I want to tag my entries with custom labels (e.g., "work", "travel", "ideas"), so that I can quickly filter and find related entries across all journals.

**Secondary:**
> As a reflective thinker, I want tag autocomplete that suggests existing tags as I type, so that I maintain consistent naming and avoid near-duplicate tags.

**Tertiary:**
> As a daily journaler, I want to see a tag cloud or list showing my most-used tags, so that I can understand my journaling themes at a glance.

#### 3.3 Detailed Description

The Tag System provides flexible, user-driven organization across all journals. Users apply one or more tags to any entry. Tags are free-form text labels that are case-insensitive (stored in lowercase). A tag is created implicitly the first time it is applied to an entry; there is no separate "create tag" flow.

The system supports up to 20 tags per entry and a global maximum of 500 unique tags. Tag names are limited to 50 characters and may contain letters, numbers, hyphens, and underscores. Spaces in tag input are replaced with hyphens. Leading and trailing whitespace is trimmed before normalization.

Tag autocomplete activates after the user types 1 or more characters in the tag input field. Suggestions are ordered by frequency (most-used tags first), then alphabetically for ties. A tag management screen allows users to rename, merge, or delete tags globally. Renaming a tag updates all entries that use it. Merging two tags replaces all occurrences of the source tag with the target tag. Deleting a tag removes it from all entries.

Tags integrate with Full-Text Search (JR-010) so that searching for a tag name returns all entries with that tag. Tags also appear as filterable facets in the entry list and calendar views.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Tags are attached to entries created in the editor

**External Dependencies:**
- None (all tag data stored locally)

**Assumed Capabilities:**
- Entries exist in the database
- User can navigate to entry editor and entry list

#### 3.5 User Interface Requirements

##### Component: Tag Input Bar

**Layout:**
- Positioned below the entry editor content area and above the footer bar
- Horizontal scrollable row of tag chips (existing tags on this entry), followed by a text input field with placeholder "Add tag..."
- Each tag chip shows the tag name and an "x" button to remove it
- Tag chips use the module accent color as background with white text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Tags | Entry has no tags | Only the text input field visible with placeholder "Add tag..." |
| Has Tags | Entry has 1-19 tags | Scrollable chip row + input field |
| Max Tags | Entry has 20 tags | Chip row visible, input field hidden. Subtle label: "Maximum tags reached" |
| Autocomplete Active | User has typed 1+ characters | Dropdown below input showing matching existing tags, ordered by usage frequency |
| Creating New Tag | Typed text matches no existing tags | Autocomplete dropdown shows "Create '[typed text]'" as the first option |

**Interactions:**
- Type in input field: triggers autocomplete after 1 character, debounced by 150ms
- Tap autocomplete suggestion: adds that tag as a chip, clears input
- Tap "Create '[text]'": creates new tag, adds it as a chip, clears input
- Press Enter/Return in input: adds typed text as a tag (creates if new), clears input
- Tap "x" on chip: removes tag from this entry (does not delete the tag globally)
- Type comma or space: finalizes current tag input and starts a new one

**Transitions/Animations:**
- Tag chip appears with 150ms scale-in animation
- Tag chip removal: 150ms scale-out, remaining chips slide left to fill gap
- Autocomplete dropdown appears with 100ms fade-in

##### Screen: Tag Management

**Layout:**
- Accessible from Settings or via long-press on any tag chip
- Top navigation bar: "Manage Tags" title, "Done" button on right
- Search bar at top to filter displayed tags
- Scrollable list of all tags, each row showing: tag name, entry count (e.g., "used in 23 entries"), and a right-arrow disclosure indicator
- Sort options: Alphabetical (default), Most Used, Recently Used
- Bottom toolbar: "Merge Tags" button (select mode)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Tag List | Normal browsing | Full list of tags with counts |
| Search Active | User typing in search bar | Filtered list matching search query |
| Select Mode | "Merge Tags" tapped | Checkboxes on each row, "Merge Selected" button in toolbar |
| Empty | No tags exist | Centered message: "No tags yet. Tags will appear here as you add them to entries." |

**Interactions:**
- Tap tag row: opens Tag Detail with rename field and delete option
- Swipe left on tag: reveals "Rename" and "Delete" quick actions
- "Merge Tags" flow: select 2+ tags, tap "Merge", choose the surviving tag name, confirm
- Delete tag: confirmation dialog "Remove '[tag]' from all X entries?" with "Delete" and "Cancel"

##### Component: Tag Cloud (Dashboard Widget)

**Layout:**
- Optional widget on the hub dashboard or journal home screen
- Tags displayed in a cloud layout with font size proportional to usage frequency
- Minimum font size: 12pt (tags used 1-5 times)
- Maximum font size: 28pt (most-used tag)
- Tags colored using a gradient from muted to accent color based on recency

**Interactions:**
- Tap tag in cloud: navigates to entry list filtered by that tag

#### 3.6 Data Requirements

##### Entity: Tag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| name | TEXT | Required, max 50 chars, unique (case-insensitive), lowercase | None | Tag display name |
| usage_count | INTEGER | Min 0 | 0 | Cached count of entries using this tag |
| last_used_at | TEXT | ISO datetime, nullable | null | When this tag was last applied to an entry |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

##### Entity: EntryTag (Join Table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| entry_id | TEXT (UUID) | Required, references Entry.id | None | Entry reference |
| tag_id | TEXT (UUID) | Required, references Tag.id | None | Tag reference |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | When tag was applied |

**Primary Key:** Composite (entry_id, tag_id)

**Indexes:**
- `tag_id` - Look up all entries for a given tag
- `entry_id` - Look up all tags for a given entry
- `(tag_id, created_at)` - Tag usage timeline

**Validation Rules:**
- `name`: Must not be empty after trimming, max 50 characters, only letters, numbers, hyphens, underscores after normalization
- `name`: Stored in lowercase. Input "Work Notes" becomes "work-notes"
- Maximum 20 tags per entry (enforced on the EntryTag join table)
- Maximum 500 unique tags globally
- Duplicate tag assignment (same entry + same tag) is silently ignored

**Example Data:**

```json
{
  "tag": {
    "id": "t1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "name": "morning-routine",
    "usage_count": 34,
    "last_used_at": "2026-03-06T07:15:00Z",
    "created_at": "2026-01-15T08:00:00Z"
  },
  "entry_tag": {
    "entry_id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890",
    "tag_id": "t1a2b3c4-d5e6-7890-abcd-ef1234567890",
    "created_at": "2026-03-06T07:15:00Z"
  }
}
```

#### 3.7 Business Logic Rules

##### Tag Normalization

**Purpose:** Ensure consistent tag naming across all entries

**Inputs:**
- `raw_input`: string - User-typed tag text

**Logic:**

```
1. Trim leading and trailing whitespace
2. Convert to lowercase
3. Replace spaces with hyphens
4. Remove characters that are not letters, numbers, hyphens, or underscores
5. Collapse consecutive hyphens into a single hyphen
6. Remove leading and trailing hyphens
7. IF result is empty: reject with "Invalid tag name"
8. IF length > 50: truncate to 50 characters
9. RETURN normalized tag name
```

**Edge Cases:**
- Input "  Work Notes  " becomes "work-notes"
- Input "café & books" becomes "caf-books" (special characters stripped)
- Input "---" becomes "" (rejected as invalid)
- Input with only special characters: rejected as invalid

##### Tag Autocomplete

**Purpose:** Suggest existing tags as the user types

**Inputs:**
- `query`: string - Characters typed so far (1+)

**Logic:**

```
1. Normalize query using Tag Normalization rules
2. SELECT * FROM tags WHERE name LIKE '{normalized_query}%' ORDER BY usage_count DESC, name ASC LIMIT 10
3. IF results exist: return matching tags
4. APPEND to results: "Create '{normalized_query}'" as a synthetic option
5. RETURN results
```

##### Tag Merge

**Purpose:** Combine two or more tags into a single surviving tag

**Inputs:**
- `source_tag_ids`: UUID[] - Tags to be merged away
- `target_tag_id`: UUID - The surviving tag

**Logic:**

```
1. BEGIN TRANSACTION
2. FOR EACH source_tag_id in source_tag_ids:
   a. SELECT entry_id FROM entry_tags WHERE tag_id = source_tag_id
   b. FOR EACH entry_id:
      - IF NOT EXISTS (SELECT 1 FROM entry_tags WHERE entry_id = entry_id AND tag_id = target_tag_id):
        INSERT INTO entry_tags (entry_id, tag_id) VALUES (entry_id, target_tag_id)
      - DELETE FROM entry_tags WHERE entry_id = entry_id AND tag_id = source_tag_id
   c. DELETE FROM tags WHERE id = source_tag_id
3. UPDATE tags SET usage_count = (SELECT COUNT(*) FROM entry_tags WHERE tag_id = target_tag_id) WHERE id = target_tag_id
4. COMMIT
```

**Edge Cases:**
- Merging a tag into itself: no-op, silently succeed
- Merging when an entry already has both tags: remove duplicate join rows, keep only the target
- Source tag has entries the target does not: those entries gain the target tag

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Tag name invalid after normalization | Inline validation: "Tag name must contain at least one letter or number" | User edits the input |
| Duplicate tag on same entry | Silently ignored, no error shown | Tag chip does not appear twice |
| Max 20 tags per entry reached | Input field hidden, label: "Maximum tags reached" | User removes existing tags to add new ones |
| Max 500 global tags reached | Toast: "Maximum of 500 tags reached. Delete or merge unused tags." | User navigates to Tag Management to clean up |
| Tag rename conflicts with existing tag | Inline validation: "A tag with this name already exists. Merge instead?" with "Merge" action link | User taps "Merge" or chooses a different name |
| Tag merge fails mid-transaction | Toast: "Could not merge tags. Please try again." Transaction rolled back | User retries. No data lost due to transaction rollback |
| Delete tag confirmation | Dialog: "Remove '[tag]' from all X entries? This cannot be undone." | User confirms or cancels |

**Validation Timing:**
- Tag name normalization runs on input commit (Enter, comma, tap suggestion)
- Autocomplete runs on keystroke with 150ms debounce
- Duplicate check runs on tag add attempt (before chip insertion)
- Global limit check runs before creating a new tag record

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user types "travel" in the tag input on a new entry,
   **When** no "travel" tag exists yet,
   **Then** autocomplete shows "Create 'travel'" and tapping it adds a "travel" chip and creates the tag globally.

2. **Given** the user types "tra" in the tag input,
   **When** tags "travel", "training", and "transition" exist,
   **Then** autocomplete shows all three sorted by usage count descending.

3. **Given** the user taps "x" on a tag chip,
   **When** the tag is removed from the entry,
   **Then** the chip disappears, the tag's global usage_count decrements by 1, and the tag still exists globally.

4. **Given** the user navigates to Tag Management and selects "Merge Tags",
   **When** they select "travel" and "travelling" and merge into "travel",
   **Then** all entries previously tagged "travelling" now have "travel" instead, and "travelling" is deleted.

5. **Given** the user taps a tag in the Tag Cloud widget,
   **When** the navigation completes,
   **Then** the entry list shows only entries with that tag, across all journals.

**Edge Cases:**

6. **Given** the user types "  WORK notes  " in the tag input,
   **When** they press Enter,
   **Then** the tag is normalized to "work-notes" and added as a chip.

7. **Given** an entry already has 20 tags,
   **When** the user tries to add another,
   **Then** the tag input is hidden and a label reads "Maximum tags reached."

**Negative Tests:**

8. **Given** the user types "###" in the tag input,
   **When** they press Enter,
   **Then** inline validation shows "Tag name must contain at least one letter or number" and no tag is created.

9. **Given** 500 tags exist globally,
   **When** the user types a completely new tag name,
   **Then** a toast appears: "Maximum of 500 tags reached. Delete or merge unused tags."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| normalizes spaces to hyphens | "work notes" | "work-notes" |
| converts to lowercase | "TRAVEL" | "travel" |
| strips special characters | "café & books" | "caf-books" |
| rejects empty after normalization | "---" | validation error: invalid tag name |
| trims whitespace | "  hello  " | "hello" |
| truncates at 50 characters | 60-character input | first 50 characters |
| collapses consecutive hyphens | "work--notes" | "work-notes" |
| autocomplete returns matches sorted by usage | query: "tr", tags: travel(10), training(5) | [travel, training] |
| enforces max 20 tags per entry | entry with 20 tags, add attempt | rejection: maximum reached |
| enforces max 500 global tags | 500 tags exist, create new | rejection: maximum reached |
| merge updates entry associations | merge "travelling" into "travel" | entries re-associated, "travelling" deleted |
| merge handles duplicate entry-tag pairs | entry has both "travel" and "travelling", merge | entry has only "travel", one join row |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add tag to entry and verify persistence | 1. Create entry, 2. Add tag "morning", 3. Save, 4. Reopen entry | Tag chip "morning" is visible, tag exists in database |
| Tag autocomplete workflow | 1. Add tag "travel" to entry A, 2. Open entry B, type "tra" | Autocomplete suggests "travel" |
| Rename tag globally | 1. Add tag "wrok" to 5 entries, 2. Go to Tag Management, 3. Rename to "work" | All 5 entries now show "work" tag |
| Delete tag globally | 1. Tag "temp" on 3 entries, 2. Delete "temp" from Tag Management | Tag removed from all 3 entries, tag row deleted |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Organize entries with tags | 1. Create 5 entries, 2. Tag entries 1-3 with "morning", 3. Tag entries 3-5 with "gratitude", 4. Filter by "morning" | 3 entries shown. Entry 3 has both tags. Tag cloud shows both tags |

---

### JR-005: Mood Tagging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-005 |
| **Feature Name** | Mood Tagging |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a therapeutic writer, I want to tag each entry with my current mood using an emoji scale, so that I can track my emotional state over time.

**Secondary:**
> As a daily journaler, I want mood tagging to be optional and quick (a single tap), so that it does not slow down my writing flow.

**Tertiary:**
> As a gratitude practitioner, I want to see how my mood correlates with my gratitude practice, so that I can understand the emotional impact of gratitude journaling.

#### 3.3 Detailed Description

Mood Tagging allows users to attach an emotional state to each journal entry. The mood is selected from a 5-point emoji scale: Very Bad, Bad, Neutral, Good, Very Good. Users can also select from 30 specific emotion labels organized into 6 groups for finer granularity.

Mood selection is presented at the top of the entry editor as a horizontal row of 5 emoji buttons. Tapping one selects it (highlighted state); tapping the same one again deselects it (mood is optional). After selecting a primary mood emoji, an optional second row expands below showing 5 specific emotion labels for that mood level, allowing users to refine their mood. For example, selecting the "Bad" emoji reveals: "anxious", "sad", "frustrated", "lonely", "tired".

Mood data feeds into Mood Analytics and Correlation (JR-019) for trend visualization. The mood value is also stored as searchable metadata so Full-Text Search (JR-010) can filter by mood.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Mood is tagged on entries

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entry editor is functional
- Local database is initialized

#### 3.5 User Interface Requirements

##### Component: Mood Selector

**Layout:**
- Positioned at the top of the entry editor, above the prompt card (if present) or above the content area
- Horizontal row of 5 emoji buttons with labels below each:
  1. Very Bad (deeply frowning face)
  2. Bad (slightly frowning face)
  3. Neutral (neutral face)
  4. Good (slightly smiling face)
  5. Very Good (beaming face)
- When a mood is selected, a secondary row appears below with 5 emotion refinement chips
- Entire component has a max height of 80px (collapsed) or 120px (expanded with refinements)

**Mood Levels and Emotion Refinements:**

| Level | Value | Emoji | Refinement Emotions |
|-------|-------|-------|-------------------|
| Very Bad | 1 | deeply frowning | devastated, hopeless, overwhelmed, panicked, miserable |
| Bad | 2 | slightly frowning | anxious, sad, frustrated, lonely, tired |
| Neutral | 3 | neutral | calm, indifferent, contemplative, restless, uncertain |
| Good | 4 | slightly smiling | content, grateful, hopeful, productive, relaxed |
| Very Good | 5 | beaming | joyful, excited, proud, inspired, loved |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Unselected | No mood chosen | 5 emoji buttons in muted/desaturated color, all same size |
| Selected | One mood chosen | Selected emoji enlarged (1.3x scale) and fully saturated, others remain muted. Refinement row visible |
| Refined | Mood + specific emotion chosen | Selected emoji enlarged, one refinement chip highlighted |
| Disabled | User has disabled mood tagging in settings | Mood selector not visible |

**Interactions:**
- Tap emoji: selects that mood level (or deselects if already selected). Haptic feedback (light impact)
- Tap refinement chip: selects specific emotion. Only one refinement active at a time per mood level
- Tap selected refinement chip again: deselects refinement (keeps primary mood)
- Swipe up on mood selector: collapses to a single-line summary showing only the selected emoji and emotion label

**Transitions/Animations:**
- Mood selection: 200ms scale animation (selected emoji grows to 1.3x)
- Refinement row expand: 150ms slide-down
- Collapse to summary: 200ms slide-up

#### 3.6 Data Requirements

**Additions to Entry entity (from JR-001):**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| mood_level | INTEGER | Nullable, range 1-5 | null | Primary mood level (1=Very Bad, 5=Very Good) |
| mood_emotion | TEXT | Nullable, max 50 chars, must be from allowed list | null | Specific emotion refinement label |

**Indexes:**
- `mood_level` - Filter entries by mood
- `(mood_level, entry_date)` - Mood trends over time

**Validation Rules:**
- `mood_level`: Must be null or an integer between 1 and 5 (inclusive)
- `mood_emotion`: Must be null, or must be one of the 25 allowed emotion labels that corresponds to the selected mood_level (5 emotions per level)
- If `mood_emotion` is set, `mood_level` must also be set
- If `mood_level` is changed to a different level, `mood_emotion` is reset to null

**Allowed Emotion Labels by Level:**

```
Level 1: devastated, hopeless, overwhelmed, panicked, miserable
Level 2: anxious, sad, frustrated, lonely, tired
Level 3: calm, indifferent, contemplative, restless, uncertain
Level 4: content, grateful, hopeful, productive, relaxed
Level 5: joyful, excited, proud, inspired, loved
```

#### 3.7 Business Logic Rules

##### Mood Selection Logic

**Purpose:** Record mood state on a journal entry

**Inputs:**
- `entry_id`: UUID - The entry being edited
- `mood_level`: integer (1-5) or null - Selected mood level
- `mood_emotion`: string or null - Selected refinement emotion

**Logic:**

```
1. IF mood_level is null:
   a. Clear mood_level and mood_emotion on the entry
   b. RETURN
2. Validate mood_level is in range [1, 5]
3. IF mood_emotion is provided:
   a. Validate mood_emotion is in the allowed list for the given mood_level
   b. IF invalid: reject with "Invalid emotion for this mood level"
4. UPDATE entries SET mood_level = mood_level, mood_emotion = mood_emotion WHERE id = entry_id
5. Auto-save triggers normally (entry updated_at refreshed)
```

**Edge Cases:**
- User changes mood_level after selecting a refinement: refinement resets to null
- User deselects mood entirely: both mood_level and mood_emotion set to null
- Entry has no mood and user saves: entry saved with null mood fields, no validation error

##### Mood Distribution Calculation

**Purpose:** Calculate mood distribution for analytics display

**Inputs:**
- `date_range_start`: date - Start of analysis period
- `date_range_end`: date - End of analysis period

**Logic:**

```
1. SELECT mood_level, COUNT(*) as count FROM entries
   WHERE entry_date BETWEEN date_range_start AND date_range_end
   AND mood_level IS NOT NULL
   GROUP BY mood_level
2. Calculate percentage for each level: (count / total_with_mood) * 100
3. Calculate average mood: SUM(mood_level * count) / total_with_mood
4. RETURN distribution array and average
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Invalid mood_level value in database | Mood selector shows no selection | On next save, invalid value is overwritten with null or valid selection |
| mood_emotion does not match mood_level | Refinement ignored, primary mood displayed | On next save, mismatched emotion is cleared |
| Mood selector fails to render | Entry editor opens without mood selector, no error shown | User can still create entries without mood; functionality restored on next app restart |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens a new entry with mood tagging enabled,
   **When** the editor loads,
   **Then** the mood selector row is visible with 5 muted emoji buttons.

2. **Given** the user taps the "Good" emoji,
   **When** the mood is selected,
   **Then** the Good emoji scales up and saturates, refinement row shows: content, grateful, hopeful, productive, relaxed.

3. **Given** the user selects "Good" mood and "grateful" refinement,
   **When** the entry is saved,
   **Then** the entry record has mood_level = 4 and mood_emotion = "grateful".

4. **Given** the user taps the selected "Good" emoji again,
   **When** the mood is deselected,
   **Then** all emojis return to muted state, refinement row hides, and mood_level is set to null.

**Edge Cases:**

5. **Given** the user has selected "Bad" mood with "anxious" refinement,
   **When** they switch to "Good" mood,
   **Then** "anxious" is cleared, and the refinement row updates to show Good-level emotions.

6. **Given** mood tagging is disabled in settings,
   **When** the user opens the entry editor,
   **Then** no mood selector is visible and entry saves with mood_level = null.

**Negative Tests:**

7. **Given** a database record has mood_level = 6 (invalid),
   **When** the entry is loaded in the editor,
   **Then** the mood selector shows no selection and no error is displayed.

8. **Given** a database record has mood_level = 2 and mood_emotion = "joyful" (mismatch),
   **When** the entry is loaded,
   **Then** the Bad emoji is selected but no refinement chip is highlighted (mismatch ignored).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| accepts valid mood_level | mood_level: 3 | saved, mood_level = 3 |
| rejects mood_level out of range | mood_level: 6 | validation error |
| accepts valid emotion for level | level: 4, emotion: "grateful" | saved |
| rejects mismatched emotion | level: 4, emotion: "anxious" | validation error |
| clears emotion on level change | level: 2 -> 4, emotion was "sad" | mood_emotion = null |
| clears both on deselect | mood_level = null | mood_level = null, mood_emotion = null |
| calculates mood distribution | 3 entries: levels 3, 4, 5 | avg = 4.0, distribution: {3:33%, 4:33%, 5:33%} |
| handles no moods in range | date range with 0 mood-tagged entries | empty distribution, avg = null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Tag mood and verify persistence | 1. Create entry, 2. Select "Good" + "content", 3. Save, 4. Reopen | Mood selector shows Good selected with "content" refinement |
| Mood in entry list | 1. Create entry with "Very Good" mood, 2. View entry list | Entry row shows beaming emoji |
| Filter entries by mood | 1. Create 3 entries with moods 2, 4, 5, 2. Filter by mood_level >= 4 | 2 entries shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Track mood over a week | 1. Create 7 entries on consecutive days, 2. Assign moods (2,3,4,3,5,4,4), 3. View mood analytics | Average mood: 3.57, distribution chart shows Good most frequent (3 times), trend line visible |

---

### JR-006: Photo Attachments

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-006 |
| **Feature Name** | Photo Attachments |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a daily journaler, I want to embed photos directly in my journal entries, so that my entries capture visual memories alongside my writing.

**Secondary:**
> As a travel journaler, I want to take a photo with my camera and insert it inline in my entry, so that photos appear contextually within the narrative flow.

**Tertiary:**
> As a privacy-conscious writer, I want my photo attachments stored locally and never uploaded to any service, so that my visual memories are as private as my written words.

#### 3.3 Detailed Description

Photo Attachments allow users to embed images in journal entries. Photos can be sourced from the device camera (mobile only) or the photo library. On web, photos are uploaded from the local filesystem via a file picker.

Photos are inserted inline within the entry content using Markdown image syntax: `![caption](local-path)`. The editor renders these as inline images in reading mode. In edit mode, the image syntax is shown as plain text with a thumbnail preview above the syntax line.

Each entry supports up to 10 photo attachments. Photos are stored in a dedicated local directory on the device filesystem (not in the SQLite database). The database stores metadata records pointing to local file paths. Image files are stored as JPEG at 80% quality with a maximum dimension of 2048px on the longest edge. Original photos are resized on insertion; the original is not retained. Thumbnails (256px longest edge) are generated for list views and previews.

When an entry is deleted, its associated photo files are also deleted from the local filesystem. When a photo is removed from an entry, the photo file is deleted immediately.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Photos embed in entry content via Markdown image syntax

**External Dependencies:**
- Camera hardware (mobile, for capture)
- Photo library access permission (mobile)
- Filesystem access (all platforms)

**Assumed Capabilities:**
- Entry editor supports rendering inline images in reading mode
- Local filesystem is writable

#### 3.5 User Interface Requirements

##### Component: Photo Insert Button

**Layout:**
- Added to the formatting toolbar (JR-001) as a camera/image icon button, positioned after the Link button
- Tapping opens an action sheet with options: "Take Photo" (mobile only), "Choose from Library", "Cancel"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Available | Entry has fewer than 10 photos | Camera icon button in toolbar, normal color |
| Max Reached | Entry has 10 photos | Camera icon button grayed out, tap shows toast: "Maximum of 10 photos per entry" |
| Processing | Photo being resized/saved | Placeholder skeleton in content area where image will appear, with progress indicator |
| Error | Photo save failed | Placeholder shows error icon with "Tap to retry" |

**Interactions:**
- Tap camera icon: opens action sheet (mobile) or file picker (web)
- Take Photo: opens system camera, captured photo is resized and inserted at cursor position
- Choose from Library: opens system image picker (single selection), selected photo is resized and inserted at cursor position
- Long press on inline image (reading mode): opens context menu with "View Full Size", "Add Caption", "Remove Photo"
- Tap inline image (reading mode): opens full-screen image viewer with pinch-to-zoom

**Transitions/Animations:**
- Photo insertion: skeleton placeholder fades in at cursor, replaced by actual image with 200ms crossfade once processing completes
- Photo removal: image fades out (200ms), content reflows

##### Screen: Full-Screen Image Viewer

**Layout:**
- Full-screen dark overlay
- Image centered and scaled to fit screen
- Close button (X) in top-right corner
- Caption (if set) displayed at bottom in semi-transparent bar
- Pinch-to-zoom and pan gestures supported

**Interactions:**
- Pinch: zoom in/out (1x to 5x range)
- Pan: scroll when zoomed in
- Tap: toggle caption bar and close button visibility
- Swipe down: dismiss viewer

#### 3.6 Data Requirements

##### Entity: Attachment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| entry_id | TEXT (UUID) | Required, references Entry.id | None | Parent entry |
| type | TEXT | Required, one of: 'photo', 'voice' | None | Attachment type |
| file_path | TEXT | Required, local filesystem path | None | Path to the stored file |
| thumbnail_path | TEXT | Nullable, local filesystem path | null | Path to thumbnail image |
| file_size_bytes | INTEGER | Min 0 | 0 | File size in bytes |
| mime_type | TEXT | Required | None | MIME type (e.g., "image/jpeg") |
| width | INTEGER | Nullable, min 1 | null | Image width in pixels (after resize) |
| height | INTEGER | Nullable, min 1 | null | Image height in pixels (after resize) |
| caption | TEXT | Nullable, max 200 chars | null | User-provided caption |
| sort_order | INTEGER | Min 0 | 0 | Order within the entry |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `entry_id` - Get all attachments for an entry
- `(entry_id, sort_order)` - Ordered attachment list

**Validation Rules:**
- `file_path`: Must point to an existing file on the local filesystem
- `type`: Must be one of the allowed values
- `file_size_bytes`: Photos must be under 10MB after resize (enforced on save)
- `caption`: Max 200 characters
- Maximum 10 photo attachments per entry

**File Storage Structure:**

```
[app-data-dir]/
  journal/
    attachments/
      [entry_id]/
        [attachment_id].jpg       # Full-size image (max 2048px)
        [attachment_id]_thumb.jpg  # Thumbnail (max 256px)
```

#### 3.7 Business Logic Rules

##### Photo Processing Pipeline

**Purpose:** Resize, compress, and store a photo attachment

**Inputs:**
- `source_uri`: string - URI of the selected/captured photo
- `entry_id`: UUID - Entry to attach the photo to

**Logic:**

```
1. Validate entry has fewer than 10 photo attachments
2. Generate attachment_id (UUID)
3. Read source image from source_uri
4. Determine orientation from EXIF data, apply rotation correction
5. Strip all EXIF metadata (privacy: remove GPS, camera model, etc.)
6. Resize to fit within 2048x2048 bounding box (maintain aspect ratio)
7. Compress as JPEG at 80% quality
8. Write to: [app-data-dir]/journal/attachments/[entry_id]/[attachment_id].jpg
9. Generate thumbnail: resize to fit within 256x256 bounding box
10. Write thumbnail to: [app-data-dir]/journal/attachments/[entry_id]/[attachment_id]_thumb.jpg
11. Calculate file_size_bytes
12. Create Attachment record in database
13. Insert Markdown image syntax at cursor position: ![](attachment://[attachment_id])
14. RETURN attachment record
```

**Edge Cases:**
- Source image is already smaller than 2048px: no resize, still compress at 80%
- Source image has no EXIF data: skip EXIF steps
- Disk space insufficient: reject with "Not enough storage space for this photo"
- Source URI is invalid or inaccessible: reject with "Could not access the selected photo"

##### Attachment Cleanup

**Purpose:** Delete orphaned attachment files when entries or attachments are removed

**Logic:**

```
1. On entry deletion:
   a. SELECT file_path, thumbnail_path FROM attachments WHERE entry_id = deleted_entry_id
   b. Delete all referenced files from filesystem
   c. Delete all Attachment records from database
   d. Remove directory: [app-data-dir]/journal/attachments/[entry_id]/
2. On single attachment removal:
   a. Delete file at file_path
   b. Delete file at thumbnail_path (if exists)
   c. Delete Attachment record from database
   d. Remove Markdown image syntax from entry content
   e. If no more attachments for this entry, remove the entry attachment directory
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied | System permission dialog. If denied: "Camera access is needed to take photos. Enable in Settings." with "Open Settings" button | User grants permission in device settings |
| Photo library permission denied | System permission dialog. If denied: "Photo library access is needed to select photos. Enable in Settings." | User grants permission in device settings |
| Photo file too large after processing | Toast: "This photo could not be processed. Please try a different image." | User selects a different photo |
| Disk space insufficient | Toast: "Not enough storage space. Free up space on your device." | User frees device storage |
| Photo file missing on entry load | Broken image icon with "Photo unavailable" text in content area | User can delete the broken attachment reference |
| Maximum 10 photos reached | Camera icon grayed out, toast on tap: "Maximum of 10 photos per entry" | User removes existing photos to add new ones |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps the camera icon in the formatting toolbar,
   **When** the action sheet appears,
   **Then** options include "Take Photo" (mobile), "Choose from Library", and "Cancel".

2. **Given** the user selects a photo from their library,
   **When** the photo is processed,
   **Then** a JPEG image (max 2048px, 80% quality) is saved locally, a thumbnail is generated, and the image appears inline in the entry.

3. **Given** the user views the entry in reading mode,
   **When** they tap an inline photo,
   **Then** a full-screen image viewer opens with pinch-to-zoom support.

4. **Given** the user deletes an entry that has 3 photos,
   **When** the deletion completes,
   **Then** all 3 photo files and thumbnails are removed from the filesystem, and the attachment directory for that entry is deleted.

**Edge Cases:**

5. **Given** the user inserts the 10th photo,
   **When** the insert completes,
   **Then** the camera icon in the toolbar becomes grayed out and further taps show a toast.

6. **Given** the source photo contains GPS coordinates in EXIF data,
   **When** the photo is processed,
   **Then** all EXIF metadata is stripped from the stored file.

**Negative Tests:**

7. **Given** camera permission has been denied,
   **When** the user taps "Take Photo",
   **Then** a message directs them to enable camera access in device settings.

8. **Given** a photo's file has been manually deleted from the filesystem,
   **When** the entry is loaded in reading mode,
   **Then** a broken image placeholder shows "Photo unavailable" and the user can remove the reference.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| resizes photo to fit 2048px bounding box | 4000x3000 image | 2048x1536 output |
| preserves aspect ratio on resize | 1000x500 image | 1000x500 (no resize, already under limit) |
| strips EXIF metadata | image with GPS, camera model | output has no EXIF data |
| generates thumbnail at 256px | 2048x1536 image | 256x192 thumbnail |
| enforces max 10 photos per entry | entry with 10 photos, add attempt | rejection: maximum reached |
| compresses to JPEG 80% quality | PNG input | JPEG output, quality 80% |
| cleans up files on entry delete | entry with 3 attachments | 6 files deleted (3 full + 3 thumb), directory removed |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Insert photo from library | 1. Open entry, 2. Tap camera, 3. Choose from Library, 4. Select photo, 5. Save | Attachment record created, image file on disk, Markdown syntax in content |
| Remove photo from entry | 1. Open entry with photo, 2. Long-press image, 3. Tap "Remove Photo" | Photo file deleted, Attachment record deleted, Markdown syntax removed |
| Entry deletion cascades to photos | 1. Create entry with 2 photos, 2. Delete entry | Entry, 2 Attachment records, and 4 files (2 full + 2 thumb) all deleted |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Photo journal entry | 1. Create new entry, 2. Take photo with camera, 3. Write caption, 4. Choose photo from library, 5. Write more text, 6. Save | Entry has 2 inline photos, both with thumbnails, EXIF stripped, under 10MB each |

---

### JR-007: Voice-to-Text Entries

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-007 |
| **Feature Name** | Voice-to-Text Entries |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a voice journaler, I want to record a voice memo and have it automatically transcribed to text, so that I can journal by speaking when typing is inconvenient.

**Secondary:**
> As a commuter, I want to dictate journal entries while driving or walking, so that I can capture thoughts without looking at my phone.

**Tertiary:**
> As a reflective thinker, I want to keep the original audio recording alongside the transcription, so that I can listen back to the emotion and tone in my voice.

#### 3.3 Detailed Description

Voice-to-Text Entries allow users to dictate journal content using their device microphone. Audio is recorded, then transcribed to text using the device's on-device speech recognition engine. The transcription is inserted into the entry as editable text. Users can optionally retain the original audio recording as an attachment.

On-device speech recognition is used exclusively. No audio data is sent to any external transcription service. On iOS, this uses the Speech framework with on-device processing. On Android, this uses the SpeechRecognizer API with on-device models. On web, this uses the Web Speech API where available, with a fallback message if the browser does not support it.

Recordings have a maximum duration of 10 minutes per recording and 30 minutes total audio per entry. Audio files are stored as AAC format at 64kbps for efficient storage. A 10-minute recording is approximately 4.7MB.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Transcribed text is inserted into the editor

**External Dependencies:**
- Microphone hardware
- On-device speech recognition engine (iOS Speech framework, Android SpeechRecognizer)
- Microphone permission

**Assumed Capabilities:**
- Entry editor is functional
- Filesystem is writable for audio storage

#### 3.5 User Interface Requirements

##### Component: Voice Recording Button

**Layout:**
- Added to the formatting toolbar (JR-001) as a microphone icon, positioned after the Photo button
- When recording is active, the toolbar transforms: all other buttons hidden, replaced by a recording interface showing: pulsing red dot, elapsed time counter (MM:SS), waveform visualization, and a "Stop" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Not recording, mic available | Microphone icon in toolbar, normal color |
| Recording | Actively recording audio | Red pulsing dot, timer, waveform, "Stop" button. Editor content dimmed |
| Transcribing | Recording stopped, processing | Spinner with "Transcribing..." text in content area where text will appear |
| Complete | Transcription finished | Transcribed text inserted at cursor. Toast: "Transcription complete" |
| Unavailable | No mic or speech recognition unavailable | Microphone icon grayed out. Tap shows toast: "Voice recording is not available on this device" |
| Permission Denied | Microphone permission denied | Tap shows: "Microphone access is needed for voice entries. Enable in Settings." |

**Interactions:**
- Tap microphone icon: begins recording (with permission check). Toolbar transforms to recording interface
- Tap "Stop": stops recording, begins transcription
- Long press microphone icon: shows options "Record and Transcribe" (default), "Record Audio Only"
- During recording, tap anywhere outside toolbar: pauses recording with option to resume or stop

**Transitions/Animations:**
- Toolbar transform to recording mode: 200ms crossfade
- Pulsing red dot: continuous 1-second pulse cycle
- Waveform: real-time amplitude visualization
- Transcription insertion: text appears with a typewriter-style animation (optional, can be disabled in settings)

##### Component: Audio Player (Inline)

**Layout:**
- When audio is retained, an inline audio player appears in the entry content (below the transcribed text or at the attachment position)
- Player shows: play/pause button, waveform visualization, duration label, and a small "x" to remove the audio attachment
- Compact design: single row, max height 44px

**Interactions:**
- Tap play: begins audio playback from start
- Tap pause: pauses playback
- Tap/drag on waveform: seek to position
- Tap "x": confirmation "Remove audio recording? The transcription will remain." with "Remove" and "Cancel"

#### 3.6 Data Requirements

**Additions to Attachment entity (from JR-006):**

Audio attachments use the same Attachment entity with `type = 'voice'`:

| Field | Additional Notes for Voice Type |
|-------|-------------------------------|
| type | 'voice' |
| file_path | Path to AAC audio file |
| thumbnail_path | null (not applicable for audio) |
| mime_type | 'audio/aac' |
| width | null |
| height | null |
| duration_seconds | Additional field needed (see below) |

**Additional field on Attachment entity:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| duration_seconds | INTEGER | Nullable, min 1 | null | Audio duration in seconds (for voice attachments only) |
| transcription_status | TEXT | Nullable, one of: 'pending', 'complete', 'failed' | null | Status of speech-to-text transcription |

**Validation Rules:**
- Maximum recording duration: 600 seconds (10 minutes) per recording
- Maximum total audio per entry: 1800 seconds (30 minutes)
- Audio file size must be under 50MB per recording
- Audio stored as AAC at 64kbps

**File Storage Structure:**

```
[app-data-dir]/
  journal/
    attachments/
      [entry_id]/
        [attachment_id].aac       # Audio recording
```

#### 3.7 Business Logic Rules

##### Voice Recording Pipeline

**Purpose:** Record audio, transcribe to text, and optionally save the audio file

**Inputs:**
- `entry_id`: UUID - Entry to attach the voice recording to
- `keep_audio`: boolean - Whether to retain the original audio file

**Logic:**

```
1. Check microphone permission. If denied, prompt user and abort
2. Check on-device speech recognition availability. If unavailable, show error and abort
3. Begin audio recording:
   a. Format: AAC, 64kbps, mono, 44100Hz sample rate
   b. Start a timer counting elapsed seconds
   c. Display real-time waveform from audio levels
4. On "Stop" (or at 10-minute max):
   a. Stop recording
   b. Save raw audio to temporary file
   c. Begin on-device speech recognition:
      - Feed audio buffer to speech recognizer
      - Collect transcription result (may arrive in chunks)
      - Concatenate chunks into full transcription text
   d. Insert transcription text at cursor position in entry editor
5. IF keep_audio = true:
   a. Move audio file from temp to permanent storage: [app-data-dir]/journal/attachments/[entry_id]/[attachment_id].aac
   b. Create Attachment record with type = 'voice', duration, transcription_status = 'complete'
   c. Insert inline audio player Markdown: [audio](attachment://[attachment_id])
6. IF keep_audio = false:
   a. Delete temporary audio file
   b. No Attachment record created
7. RETURN transcription text
```

**Edge Cases:**
- Speech recognition returns empty result: insert placeholder "[No speech detected]" and notify user
- Speech recognition fails mid-transcription: insert partial transcription with "[transcription incomplete]" marker
- Recording interrupted by phone call: pause recording, resume when call ends (mobile)
- Recording reaches 10-minute limit: auto-stop and begin transcription
- Device runs low on storage during recording: stop recording, transcribe what was captured, warn user

##### Transcription Accuracy Notice

**Purpose:** Set user expectations about on-device transcription quality

**Logic:**

```
1. On first voice recording use, show a one-time notice:
   "Voice transcriptions are processed entirely on your device for privacy.
    Accuracy depends on your device's speech recognition capabilities.
    You can edit the transcribed text after recording."
2. Store notice_shown flag in settings to prevent repeated display
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Microphone permission denied | "Microphone access is needed for voice entries. Enable in Settings." with "Open Settings" button | User grants permission |
| Speech recognition unavailable | "Voice-to-text is not available on this device. You can still record audio." | User records audio-only without transcription |
| Transcription returns empty | "[No speech detected]" inserted, toast: "No speech was detected in the recording" | User can delete placeholder and re-record |
| Transcription fails | Partial text + "[transcription incomplete]" marker, toast: "Transcription could not be completed" | User edits text manually. Audio preserved if keep_audio is true |
| Recording exceeds 10 minutes | Auto-stop with toast: "Maximum recording time reached (10 minutes)" | Recording transcribed normally. User can start a new recording |
| Insufficient storage | "Not enough storage space for this recording. Free up space on your device." | User frees device storage |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps the microphone icon,
   **When** microphone permission is granted,
   **Then** the toolbar transforms to the recording interface with a pulsing red dot and timer.

2. **Given** the user is recording and taps "Stop" after 30 seconds,
   **When** transcription completes,
   **Then** the transcribed text appears in the entry editor at the cursor position.

3. **Given** the user chose "Record and Transcribe" with keep_audio = true,
   **When** transcription completes,
   **Then** an inline audio player appears below the transcribed text, and the audio file is stored locally.

4. **Given** the user plays back a stored audio recording,
   **When** they tap the play button on the inline audio player,
   **Then** audio plays through the device speaker with waveform progress visualization.

**Edge Cases:**

5. **Given** the recording reaches 10 minutes,
   **When** the limit is hit,
   **Then** recording auto-stops and transcription begins automatically.

6. **Given** the user records in a very noisy environment,
   **When** transcription returns empty,
   **Then** "[No speech detected]" is inserted and the user is notified.

**Negative Tests:**

7. **Given** microphone permission is denied,
   **When** the user taps the microphone icon,
   **Then** a message directs them to enable microphone access in device settings.

8. **Given** on-device speech recognition is not available (older device),
   **When** the user taps the microphone icon,
   **Then** a message explains voice-to-text is not available, with an option to record audio without transcription.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| enforces 10-minute max duration | recording at 600 seconds | auto-stop triggered |
| enforces 30-minute total per entry | entry with 25 min audio, new 6-min recording | rejection: total exceeds 30 minutes |
| calculates audio file size estimate | 10 min at 64kbps AAC | approximately 4.7MB |
| handles empty transcription result | speech recognizer returns "" | placeholder "[No speech detected]" |
| handles partial transcription | recognizer fails at 50% | partial text + "[transcription incomplete]" |
| validates audio format | input audio | output: AAC, 64kbps, mono |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Record and transcribe | 1. Tap mic, 2. Speak for 10 seconds, 3. Tap Stop | Transcribed text in editor, recording interface dismissed |
| Record with audio retention | 1. Long-press mic, 2. Select "Record and Transcribe", 3. Record 15 seconds, 4. Stop | Text in editor + inline audio player + AAC file on disk |
| Delete audio but keep text | 1. After transcription with audio, 2. Tap "x" on audio player, 3. Confirm | Audio file deleted, Attachment record deleted, transcribed text remains |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Voice journal during commute | 1. Open new entry, 2. Record 3 minutes of dictation, 3. Stop, 4. Edit transcription for accuracy, 5. Save with audio | Entry with edited transcription text, inline audio player, AAC file stored locally |

---

### JR-008: E2E Encryption

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-008 |
| **Feature Name** | E2E Encryption |
| **Priority** | P0 |
| **Category** | Security |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious writer, I want all my journal entries encrypted at rest on my device, so that even if my device is stolen or compromised, my private thoughts remain unreadable without my passphrase.

**Secondary:**
> As a therapeutic writer, I want encryption enabled by default with no extra cost, so that my mental health reflections and CBT records are protected without a subscription upsell.

**Tertiary:**
> As a daily journaler, I want encryption to be transparent and not slow down my writing experience, so that security does not come at the cost of usability.

#### 3.3 Detailed Description

E2E Encryption protects all journal content at rest using AES-256-GCM symmetric encryption. Unlike competitors (Day One charges extra for E2E encryption), MyJournal includes encryption for all users at no additional cost.

The encryption system uses a user-provided passphrase to derive an encryption key via PBKDF2 with 100,000 iterations and a 256-bit (32-byte) random salt. The derived key is 256 bits. Each entry is encrypted with a unique 96-bit (12-byte) initialization vector (IV), ensuring identical plaintext produces different ciphertext. The GCM authentication tag (128-bit) is appended to the ciphertext to detect tampering.

Encryption is opt-in per journal (via JR-003 private journals) or globally via settings. When enabled globally, all entry content, titles, and mood data are encrypted before writing to the database. Tags, entry dates, and structural metadata remain unencrypted to support search and calendar views. Photo and voice attachment files are encrypted separately using the same derived key.

The user's passphrase is never stored. Instead, a verification hash (SHA-256 of the derived key concatenated with a separate verification salt) is stored to confirm passphrase correctness on unlock. If the user forgets their passphrase, encrypted data is irrecoverable. A clear warning is shown during encryption setup.

Key derivation is performed once per session when the user enters their passphrase. The derived key is held in memory for the session duration and cleared on app backgrounding (configurable: immediately, after 1 minute, after 5 minutes, after 30 minutes).

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Content being encrypted

**External Dependencies:**
- Cryptographic library supporting AES-256-GCM, PBKDF2, and secure random number generation
- Secure memory handling for key material

**Assumed Capabilities:**
- Local database stores encrypted content blobs
- Filesystem stores encrypted attachment files

#### 3.5 User Interface Requirements

##### Screen: Encryption Setup

**Layout:**
- Accessible from Settings > Security > Enable Encryption
- Step 1: Information screen explaining encryption, with warnings about passphrase recovery
- Step 2: Passphrase creation form with two fields: "Create Passphrase" and "Confirm Passphrase"
- Passphrase strength meter below the first field (Weak / Fair / Strong / Very Strong)
- Step 3: Confirmation screen with checkbox: "I understand that if I forget my passphrase, my encrypted entries cannot be recovered"
- "Enable Encryption" button (disabled until checkbox is checked and passphrases match)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Information | Step 1 | Explanation of encryption with privacy benefits and passphrase warning |
| Passphrase Creation | Step 2 | Two passphrase fields with strength meter. Minimum 8 characters required |
| Strength: Weak | Passphrase < 8 chars or common password | Red meter, label "Weak" |
| Strength: Fair | 8-11 chars, some variety | Orange meter, label "Fair" |
| Strength: Strong | 12-15 chars with mixed case, numbers, or symbols | Green meter, label "Strong" |
| Strength: Very Strong | 16+ chars with high entropy | Blue meter, label "Very Strong" |
| Confirmation | Step 3 | Checkbox + warning + enable button |
| Processing | Encryption being applied to existing entries | Progress bar: "Encrypting entries... X of Y" |
| Complete | All entries encrypted | Success screen: "Encryption enabled. Your entries are now protected." |

**Interactions:**
- Type passphrase: real-time strength meter updates
- Tap "Enable Encryption": begins encrypting all existing entries (shows progress)
- Tap "Cancel": exits setup, no encryption applied

##### Screen: Passphrase Unlock

**Layout:**
- Full-screen modal presented when accessing encrypted content
- App icon at top center
- "Enter your passphrase" label
- Passphrase input field (obscured by default, with show/hide toggle)
- "Unlock" button
- Biometric unlock option below (if biometric is configured): "Unlock with Face ID / Touch ID"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Awaiting input | Passphrase field empty, Unlock button disabled |
| Input | User typing | Passphrase field filled, Unlock button enabled |
| Verifying | Unlock tapped | Spinner on Unlock button, input disabled |
| Failed | Passphrase incorrect | Shake animation on field, "Incorrect passphrase. X attempts remaining." |
| Locked Out | 5 consecutive failures | "Too many failed attempts. Try again in 5 minutes." Countdown timer shown |
| Biometric | Using Face ID / Touch ID | System biometric prompt |

**Interactions:**
- Tap "Unlock": derives key, verifies against stored hash, unlocks if correct
- Tap biometric option: triggers system biometric auth, retrieves key from secure keychain
- 5 failed attempts: 5-minute lockout. 10 failed attempts: 30-minute lockout
- Tap "Forgot Passphrase?": shows warning about data irrecoverability with option to disable encryption (deletes encrypted data)

##### Screen: Change Passphrase

**Layout:**
- Accessible from Settings > Security > Change Passphrase (only visible when encryption is enabled)
- Three fields: "Current Passphrase", "New Passphrase", "Confirm New Passphrase"
- Strength meter on new passphrase
- "Change Passphrase" button

**Interactions:**
- Validates current passphrase first
- Re-encrypts all entries with new key (shows progress)
- On success: "Passphrase changed successfully"

#### 3.6 Data Requirements

##### Entity: EncryptionConfig

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, always 'encryption_config' (singleton) | 'encryption_config' | Single config record |
| is_enabled | INTEGER | 0 or 1 | 0 | Whether encryption is active |
| key_salt | BLOB | 32 bytes, randomly generated | None | Salt for PBKDF2 key derivation |
| verification_salt | BLOB | 32 bytes, randomly generated | None | Salt for passphrase verification hash |
| verification_hash | BLOB | 32 bytes (SHA-256 output) | None | Hash to verify passphrase correctness |
| pbkdf2_iterations | INTEGER | Min 100,000 | 100000 | PBKDF2 iteration count |
| auto_lock_seconds | INTEGER | One of: 0, 60, 300, 1800 | 300 | Seconds before auto-lock on app background (0 = immediate) |
| biometric_enabled | INTEGER | 0 or 1 | 0 | Whether biometric unlock is configured |
| failed_attempts | INTEGER | Min 0 | 0 | Consecutive failed passphrase attempts |
| locked_until | TEXT | ISO datetime, nullable | null | Lockout expiry time after too many failures |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | When encryption was first enabled |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last config change |

**Modifications to Entry entity (from JR-001):**

When encryption is enabled, these fields change:
- `content`: stores AES-256-GCM ciphertext (base64-encoded) instead of plaintext Markdown
- `content_plain`: encrypted alongside content (not available for FTS when encrypted)
- `title`: encrypted (entry list shows "[Encrypted Entry]" until unlocked)
- `is_encrypted`: set to 1

Fields that remain unencrypted (for indexing and structure):
- `id`, `journal_id`, `entry_date`, `created_at`, `updated_at`, `word_count`, `char_count`, `is_favorite`, `is_encrypted`

**Encrypted Blob Format:**

```
[12-byte IV] + [ciphertext] + [16-byte GCM auth tag]
```

All stored as a single base64-encoded string in the content field.

#### 3.7 Business Logic Rules

##### Key Derivation

**Purpose:** Derive a 256-bit encryption key from the user's passphrase

**Inputs:**
- `passphrase`: string - User-provided passphrase (minimum 8 characters)
- `salt`: 32 bytes - Randomly generated salt stored in EncryptionConfig

**Formula:**

```
derived_key = PBKDF2(
  algorithm: SHA-256,
  passphrase: passphrase,
  salt: salt,
  iterations: 100000,
  key_length: 256 bits (32 bytes)
)
```

**Performance Target:** Key derivation must complete in under 2 seconds on the slowest supported device.

##### Entry Encryption

**Purpose:** Encrypt entry content before writing to the database

**Inputs:**
- `plaintext`: string - Entry content (Markdown text)
- `derived_key`: 32 bytes - The session encryption key

**Logic:**

```
1. Generate a random 12-byte IV (initialization vector)
2. Encrypt plaintext using AES-256-GCM:
   ciphertext, auth_tag = AES_256_GCM_ENCRYPT(
     key: derived_key,
     iv: iv,
     plaintext: UTF-8 encode(plaintext),
     additional_data: entry_id (for authenticated association)
   )
3. Concatenate: encrypted_blob = iv + ciphertext + auth_tag
4. Base64-encode the encrypted_blob
5. Store base64 string in entry.content
6. Set entry.is_encrypted = 1
7. RETURN
```

**Edge Cases:**
- Empty plaintext: encrypt the empty string (produces non-empty ciphertext due to IV and tag)
- Very large entry (50,000 chars): encryption must complete in under 100ms

##### Entry Decryption

**Purpose:** Decrypt entry content after reading from the database

**Inputs:**
- `encrypted_content`: string - Base64-encoded encrypted blob
- `derived_key`: 32 bytes - The session encryption key
- `entry_id`: string - Used as additional authenticated data

**Logic:**

```
1. Base64-decode encrypted_content to get encrypted_blob
2. Extract: iv = first 12 bytes, auth_tag = last 16 bytes, ciphertext = remaining bytes
3. Decrypt using AES-256-GCM:
   plaintext = AES_256_GCM_DECRYPT(
     key: derived_key,
     iv: iv,
     ciphertext: ciphertext,
     auth_tag: auth_tag,
     additional_data: entry_id
   )
4. IF decryption fails (auth tag mismatch):
   RETURN error: "Entry could not be decrypted. Data may be corrupted or the passphrase is incorrect."
5. UTF-8 decode plaintext
6. RETURN decrypted string
```

##### Passphrase Verification

**Purpose:** Verify that the entered passphrase matches without storing the passphrase

**Inputs:**
- `entered_passphrase`: string - What the user typed
- `key_salt`: 32 bytes - From EncryptionConfig
- `verification_salt`: 32 bytes - From EncryptionConfig
- `stored_verification_hash`: 32 bytes - From EncryptionConfig

**Logic:**

```
1. Derive key: derived_key = PBKDF2(entered_passphrase, key_salt, 100000 iterations, 256 bits)
2. Compute verification: computed_hash = SHA-256(derived_key + verification_salt)
3. Compare computed_hash with stored_verification_hash using constant-time comparison
4. IF match: passphrase is correct, store derived_key in session memory
5. IF no match: increment failed_attempts, check lockout thresholds
```

##### Passphrase Strength Scoring

**Purpose:** Assess passphrase quality for the strength meter

**Inputs:**
- `passphrase`: string - User-typed passphrase

**Logic:**

```
1. Start with score = 0
2. Length scoring:
   - 8-11 chars: score += 1
   - 12-15 chars: score += 2
   - 16+ chars: score += 3
3. Character variety:
   - Has lowercase letters: score += 1
   - Has uppercase letters: score += 1
   - Has digits: score += 1
   - Has symbols: score += 1
4. Penalty: if passphrase is in a top-1000 common passwords list: score = 1
5. Map score to strength:
   - 0-1: Weak
   - 2-3: Fair
   - 4-5: Strong
   - 6-7: Very Strong
```

##### Lockout Logic

**Purpose:** Throttle brute-force passphrase attempts

**Logic:**

```
1. On failed attempt: increment failed_attempts
2. IF failed_attempts >= 5 AND failed_attempts < 10:
   SET locked_until = NOW() + 5 minutes
3. IF failed_attempts >= 10:
   SET locked_until = NOW() + 30 minutes
4. On successful unlock: reset failed_attempts = 0, locked_until = null
5. On unlock attempt: check if NOW() < locked_until, if so reject immediately
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Passphrase too short (< 8 chars) | Inline validation: "Passphrase must be at least 8 characters" | User enters a longer passphrase |
| Passphrases do not match | Inline validation: "Passphrases do not match" | User re-enters confirmation |
| Incorrect passphrase on unlock | Shake animation, "Incorrect passphrase. X attempts remaining." | User re-enters. Lockout after 5 failures |
| Lockout active | "Too many failed attempts. Try again in X:XX." Countdown displayed | User waits for lockout to expire |
| Decryption fails (corrupted data) | "This entry could not be decrypted. The data may be corrupted." | Entry marked as corrupted, user can delete it |
| Forgot passphrase | "Your passphrase cannot be recovered. You can disable encryption, but all encrypted entries will be permanently deleted." | User accepts data loss or tries to remember passphrase |
| Encryption in progress interrupted | "Encryption was interrupted. X of Y entries encrypted. Resuming..." | App resumes encryption from where it stopped on next unlock |
| Biometric auth fails | "Authentication failed. Enter your passphrase instead." | Fallback to passphrase input |
| Key derivation too slow | Show spinner, "Deriving encryption key..." (should complete in < 2 seconds) | User waits. If > 5 seconds, show "This is taking longer than expected" |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user navigates to Settings > Security > Enable Encryption,
   **When** they create a passphrase and confirm it,
   **Then** all existing entries are encrypted with AES-256-GCM using a PBKDF2-derived key (100,000 iterations, 256-bit salt).

2. **Given** encryption is enabled and the user opens the app,
   **When** they enter the correct passphrase,
   **Then** the key is derived, entries are decrypted in memory, and the app functions normally.

3. **Given** the user creates a new entry while encryption is enabled,
   **When** the entry is auto-saved,
   **Then** the content stored in the database is encrypted (base64-encoded ciphertext, not readable plaintext).

4. **Given** the user changes their passphrase,
   **When** the change completes,
   **Then** all entries are re-encrypted with the new derived key and the old passphrase no longer works.

**Edge Cases:**

5. **Given** the user enters the wrong passphrase 5 times,
   **When** the 5th failure occurs,
   **Then** the app shows a 5-minute lockout countdown and blocks further attempts.

6. **Given** encryption was interrupted (app killed during bulk encryption),
   **When** the user reopens the app,
   **Then** encryption resumes from the last unencrypted entry with a progress indicator.

**Negative Tests:**

7. **Given** the user has forgotten their passphrase,
   **When** they tap "Forgot Passphrase?",
   **Then** the system warns that encrypted data is irrecoverable and offers to disable encryption (deleting all encrypted entries).

8. **Given** an encrypted entry's ciphertext has been tampered with,
   **When** decryption is attempted,
   **Then** the GCM authentication tag check fails and an error is shown: "This entry could not be decrypted."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| derives 256-bit key via PBKDF2 | passphrase: "test1234", salt: random 32 bytes, iterations: 100000 | 32-byte key output |
| same passphrase + salt produces same key | two derivations with identical inputs | identical keys |
| different salts produce different keys | same passphrase, different salts | different keys |
| encrypts and decrypts roundtrip | plaintext: "Hello world" | decrypt(encrypt(plaintext)) == plaintext |
| uses unique IV per encryption | encrypt same plaintext twice | different ciphertext blobs |
| detects tampering via GCM auth tag | modify 1 byte of ciphertext | decryption fails with auth error |
| base64 encodes encrypted blob | iv + ciphertext + tag | valid base64 string |
| passphrase verification matches | correct passphrase | verification hash matches |
| passphrase verification rejects | wrong passphrase | verification hash does not match |
| passphrase strength: weak | "password" | score: Weak |
| passphrase strength: strong | "MyC0mpl3x!Pass" | score: Strong |
| passphrase strength: very strong | "a-very-long-passphrase-with-numbers-123" | score: Very Strong |
| lockout after 5 failures | 5 consecutive wrong attempts | locked_until set to 5 minutes from now |
| lockout after 10 failures | 10 consecutive wrong attempts | locked_until set to 30 minutes from now |
| lockout resets on success | 3 failures then 1 success | failed_attempts = 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Enable encryption on existing entries | 1. Create 5 entries, 2. Enable encryption with passphrase, 3. Check database | All 5 entries have is_encrypted = 1, content is base64 ciphertext |
| Unlock and read entries | 1. Enable encryption, 2. Close app, 3. Reopen, 4. Enter passphrase | Entries display with decrypted plaintext content |
| Change passphrase | 1. Enable with passphrase A, 2. Change to passphrase B, 3. Close app, 4. Unlock with B | Entries accessible. Passphrase A no longer works |
| Biometric unlock flow | 1. Enable encryption, 2. Enable biometric, 3. Close app, 4. Unlock with biometric | Key retrieved from secure storage, entries decrypted |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full encryption lifecycle | 1. Create 10 entries, 2. Enable encryption, 3. Verify all encrypted, 4. Close app, 5. Reopen with passphrase, 6. Read entries, 7. Create new entry, 8. Change passphrase, 9. Verify access with new passphrase | All entries encrypted, readable after unlock, new entries encrypted on save |

---

### JR-009: Streak Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-009 |
| **Feature Name** | Streak Tracking |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a daily journaler, I want to see my current journaling streak (consecutive days with at least one entry), so that I am motivated to maintain my writing habit.

**Secondary:**
> As a goal-oriented writer, I want to see my longest-ever streak and total entries count, so that I can measure my long-term journaling consistency.

**Tertiary:**
> As a busy person, I want a configurable grace period (default 1 day) that forgives occasional missed days, so that a single busy day does not break a long streak.

#### 3.3 Detailed Description

Streak Tracking measures and displays the user's journaling consistency as consecutive days with at least one entry. The system calculates the current streak, longest streak, total entries, and total journaling days. These metrics are displayed prominently on the hub dashboard and the journal home screen.

A streak is defined as a sequence of consecutive calendar days where each day has at least one journal entry. The streak calculation uses the `entry_date` field (not `created_at`) so that backdated entries count for the correct day. The grace period (default: 1 day, configurable: 0-3 days) allows users to miss a configurable number of days without breaking their streak.

**Streak formula:**
- `streak = consecutive days with entries, counting backward from today`
- `grace_period` (default 1 day): number of consecutive days without an entry that are forgiven before the streak breaks
- If today has no entry and the grace period has not been exceeded, the streak continues (but is marked "at risk")
- If the gap between the most recent entry and today exceeds `grace_period + 1` days, the streak resets to 0

The system stores precomputed streak data and recalculates on entry creation, entry deletion, and entry date modification. This avoids expensive full scans on every dashboard load.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Entries are the basis for streak calculation

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entries have `entry_date` fields populated
- System clock provides current date

#### 3.5 User Interface Requirements

##### Component: Streak Badge (Dashboard Widget)

**Layout:**
- Displayed on the journal home screen and hub dashboard
- Primary display: large number showing current streak with a flame icon
- Secondary line: "day streak" (or "days" if > 1)
- Below: "Longest: X days" in muted text
- Background: subtle gradient using module accent color when streak is active, gray when streak is 0

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active Streak | Current streak >= 1, entry exists today | Flame icon (animated), streak number in bold, accent gradient background |
| At Risk | Current streak >= 1, no entry today, within grace period | Flame icon (dimmed, pulsing), streak number with "(at risk)" label, amber border |
| Broken | Current streak = 0 | Gray flame icon, "0" displayed, "Start a new streak today!" subtext |
| New Record | Current streak exceeds previous longest | Confetti animation on first view, "New record!" badge |
| First Day | First-ever entry just created | "1" with "Your streak has begun!" message |

**Interactions:**
- Tap streak badge: navigates to the Calendar Heatmap (JR-011) screen
- Long press: shows a tooltip with detailed stats: current streak, longest streak, total entries, total days journaled, percentage of days journaled since first entry

##### Component: Streak Milestone Notification

**Layout:**
- In-app celebration shown when the user hits streak milestones: 7, 14, 30, 60, 90, 180, 365 days
- Full-screen brief animation (1.5 seconds) with milestone number and congratulatory message
- "Keep it up!" dismissal button

#### 3.6 Data Requirements

##### Entity: StreakData

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, always 'streak_data' (singleton) | 'streak_data' | Single streak record |
| current_streak | INTEGER | Min 0 | 0 | Current consecutive-day streak |
| longest_streak | INTEGER | Min 0 | 0 | All-time longest streak |
| streak_start_date | TEXT | ISO date, nullable | null | First day of the current streak |
| last_entry_date | TEXT | ISO date, nullable | null | Most recent entry_date with an entry |
| total_entries | INTEGER | Min 0 | 0 | Total number of entries ever created |
| total_days_journaled | INTEGER | Min 0 | 0 | Total unique dates with at least one entry |
| grace_period_days | INTEGER | Range 0-3 | 1 | Number of missed days allowed before streak breaks |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last recalculation time |

**Indexes:**
- None needed (singleton record, accessed by primary key)

**Validation Rules:**
- `current_streak` must be >= 0
- `longest_streak` must be >= `current_streak` (updated whenever current exceeds longest)
- `grace_period_days` must be 0, 1, 2, or 3
- `streak_start_date` must be null when `current_streak` is 0
- `last_entry_date` must be null when `total_entries` is 0

#### 3.7 Business Logic Rules

##### Streak Calculation

**Purpose:** Determine the current consecutive-day streak, accounting for grace period

**Inputs:**
- `today`: date - Current calendar date
- `grace_period`: integer - Number of days that can be missed without breaking the streak (default: 1)

**Logic:**

```
1. Query all unique entry_dates in descending order:
   SELECT DISTINCT entry_date FROM entries ORDER BY entry_date DESC
2. IF no entries exist: current_streak = 0, RETURN
3. SET most_recent_entry_date = first result
4. SET gap_from_today = date_diff(today, most_recent_entry_date) in days
5. IF gap_from_today > (grace_period + 1):
   a. current_streak = 0 (streak is broken)
   b. RETURN
6. SET streak_count = 1
7. SET previous_date = most_recent_entry_date
8. FOR EACH subsequent entry_date (descending):
   a. SET gap = date_diff(previous_date, entry_date) in days
   b. IF gap == 1:
      streak_count += 1
      previous_date = entry_date
   c. ELSE IF gap == 0:
      CONTINUE (multiple entries on same day, already counted)
   d. ELSE IF gap <= (grace_period + 1):
      streak_count += 1 (grace period forgives the gap)
      previous_date = entry_date
   e. ELSE:
      BREAK (gap too large, streak ends here)
9. SET current_streak = streak_count
10. SET streak_start_date = previous_date (the oldest date in the streak)
11. IF current_streak > longest_streak: longest_streak = current_streak
12. Persist updated StreakData
```

**Edge Cases:**
- User backdates an entry to fill a gap: streak recalculates and may extend
- User deletes the only entry for a day mid-streak: streak recalculates and may break
- Grace period of 0: strict consecutive days only
- Grace period of 3: up to 3 consecutive missed days forgiven
- Multiple entries on the same day: count as 1 day for streak purposes
- Entry date in the future: ignored for streak calculation (only today and past count)

##### Streak Status Determination

**Purpose:** Classify the streak state for UI display

**Inputs:**
- `current_streak`: integer
- `last_entry_date`: date
- `today`: date
- `grace_period`: integer

**Logic:**

```
1. IF current_streak == 0: status = "broken"
2. ELSE IF last_entry_date == today: status = "active"
3. ELSE IF date_diff(today, last_entry_date) <= grace_period: status = "at_risk"
4. ELSE: status = "broken", recalculate streak (should have been caught)
5. RETURN status
```

##### Streak Recalculation Triggers

**Purpose:** Determine when to recalculate the streak

**Logic:**

```
Recalculate streak on:
1. Entry creation (new entry_date may extend streak)
2. Entry deletion (removed entry_date may break streak)
3. Entry date modification (changed entry_date may extend or break)
4. App launch (if last recalculation was on a different date than today)
5. Grace period setting change (different tolerance changes streak count)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Streak data corrupted | Dashboard shows streak as 0, "Recalculating..." | Full recalculation from entry dates on next launch |
| Current streak exceeds what dates support | Capped at calculated value | Automatic correction on recalculation |
| Clock manipulation detected (date jumped backward) | Streak frozen until date stabilizes | Streak recalculates when consistent date resumes |
| Streak recalculation slow (many entries) | Brief spinner on dashboard (< 500ms target) | Background recalculation, cached value shown until complete |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates entries on March 1, 2, 3, 4, 5, and today is March 5,
   **When** the dashboard loads,
   **Then** the streak badge shows "5" with a flame icon and "day streak" label.

2. **Given** the user has a 10-day streak and creates an entry today,
   **When** the entry is saved,
   **Then** the streak increments to 11 (or stays at 10 if an entry already existed today).

3. **Given** the user's streak reaches 30 days,
   **When** the 30th entry is saved,
   **Then** a milestone animation displays "30 Day Streak!" with a celebration animation.

4. **Given** the grace period is set to 1 day, the user has a 5-day streak, and they missed yesterday,
   **When** the dashboard loads today,
   **Then** the streak shows "5 (at risk)" with a dimmed pulsing flame.

**Edge Cases:**

5. **Given** the grace period is 1 day and the user missed 2 consecutive days,
   **When** the dashboard loads,
   **Then** the streak resets to 0 and shows "Start a new streak today!"

6. **Given** the user backdates an entry to fill a missed day within an otherwise broken streak,
   **When** the entry is saved,
   **Then** the streak recalculates and restores the continuous streak.

**Negative Tests:**

7. **Given** the streak data record is missing from the database,
   **When** the dashboard loads,
   **Then** the streak is recalculated from scratch using entry dates and a new StreakData record is created.

8. **Given** the user changes the grace period from 1 to 0,
   **When** the setting is saved,
   **Then** the streak recalculates immediately under the stricter rule and may show a lower count.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates streak from consecutive dates | dates: [Mar 1, 2, 3, 4, 5], today: Mar 5 | current_streak = 5 |
| streak breaks with 2-day gap (grace=1) | dates: [Mar 1, 2, 3, 6], today: Mar 6, grace=1 | current_streak = 1 |
| streak survives 1-day gap (grace=1) | dates: [Mar 1, 2, 4, 5], today: Mar 5, grace=1 | current_streak = 4 |
| streak 0 when no entries | no entries, today: Mar 5 | current_streak = 0 |
| multiple entries on same day count as 1 | dates: [Mar 5, Mar 5, Mar 5], today: Mar 5 | current_streak = 1 |
| at_risk status when today has no entry | last_entry: Mar 4, today: Mar 5, grace=1 | status = "at_risk" |
| broken status when gap exceeds grace | last_entry: Mar 3, today: Mar 5, grace=0 | status = "broken" |
| longest streak updates when surpassed | current=10, longest=8 | longest = 10 |
| backdate entry restores streak | dates: [Mar 1, 2, 4, 5], add Mar 3, grace=0 | current_streak = 5 |
| grace period 0 requires strict consecutive | dates: [Mar 1, 3], today: Mar 3, grace=0 | current_streak = 1 |
| grace period 3 forgives 3-day gap | dates: [Mar 1, 5], today: Mar 5, grace=3 | current_streak = 2 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create daily entries and track streak | 1. Create entries on 5 consecutive days | Dashboard shows streak = 5, longest = 5 |
| Delete mid-streak entry | 1. Streak of 5, 2. Delete day 3 entry (grace=0) | Streak recalculates, may break into two segments |
| Change grace period | 1. Streak of 3 with a 1-day gap, grace=1, 2. Change grace to 0 | Streak recalculates to a lower value |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Build a 30-day streak | 1. Create entries daily for 30 days, 2. View dashboard | Streak = 30, milestone animation shown, flame icon animated |

---

### JR-010: Full-Text Search

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-010 |
| **Feature Name** | Full-Text Search |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a reflective thinker, I want to search across all my journal entries by keyword, so that I can find past reflections on specific topics.

**Secondary:**
> As an organized journaler, I want search results to show which journal and date each match comes from, with highlighted matching text, so that I can quickly identify the entry I am looking for.

**Tertiary:**
> As a daily journaler with years of entries, I want search to be fast (under 200ms) even with thousands of entries, so that finding content never feels sluggish.

#### 3.3 Detailed Description

Full-Text Search provides instant search across all journal entry content, titles, and tags using SQLite FTS5 (Full-Text Search extension 5). FTS5 creates a separate virtual table that indexes tokenized entry content, enabling sub-200ms search across tens of thousands of entries.

The FTS5 index covers: entry content (plain text, Markdown stripped), entry titles, and tag names associated with entries. The index is rebuilt incrementally as entries are created, updated, or deleted. The search supports prefix matching (searching "morn" matches "morning"), phrase matching (quoted "morning routine"), and boolean operators (AND, OR, NOT).

Search results are ranked by relevance using FTS5's BM25 ranking function. Each result shows: entry title (or first line), matching text snippet with highlighted terms (bold), entry date, journal name, mood emoji (if present), and word count. Results are paginated with 20 results per page and infinite scroll.

When encryption is enabled (JR-008), FTS5 search is not available for encrypted entries (since plaintext is not stored). In this case, the search screen shows a notice: "Search is limited while encryption is enabled. Unlock entries to search their content." Unlocked entries in the current session can be searched in memory.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Content to be searched

**External Dependencies:**
- SQLite FTS5 extension (included by default in most SQLite builds)

**Assumed Capabilities:**
- Entries exist with content_plain populated
- Database supports FTS5 virtual tables

#### 3.5 User Interface Requirements

##### Screen: Search

**Layout:**
- Top: search bar with magnifying glass icon and text input, "Cancel" button on right
- Below search bar: filter chips row (scrollable horizontal): "All Journals" (dropdown to select specific journal), date range pill ("Any Time", "Past Week", "Past Month", "Past Year", "Custom"), mood filter (emoji row)
- Below filters: result count label (e.g., "23 results for 'morning routine'")
- Main area: scrollable list of search results
- Each result card shows: entry title (bold), snippet with highlighted matching terms, entry date, journal name with color dot, mood emoji (if tagged), word count

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Search bar empty, no query | Recent searches list (last 10 queries) with "Clear History" link. Below: suggested tags for quick filtering |
| Searching | User typing, debounce active | Typing indicator or spinner below search bar |
| Results | Query returned matches | Scrollable result cards with highlighted snippets |
| No Results | Query returned zero matches | Centered illustration, "No entries match '[query]'", suggestion: "Try different keywords or check your filters" |
| Encrypted Notice | Encryption enabled | Banner below search bar: "Some entries are encrypted. Unlock to include them in search." |
| Error | FTS5 query fails | "Search encountered an error. Try simplifying your query." |

**Interactions:**
- Type in search bar: triggers search after 300ms debounce
- Tap result card: navigates to Entry Reading View with search terms highlighted in the content
- Tap filter chip: applies filter and re-runs search
- Tap "Clear History": removes all saved recent searches with confirmation
- Pull down from results: re-runs current search
- Tap "Cancel": clears search and returns to previous screen

**Transitions/Animations:**
- Results appear with 150ms staggered fade-in (50ms delay between cards)
- Filter chip selection: 100ms background color transition

#### 3.6 Data Requirements

##### FTS5 Virtual Table: jr_entries_fts

```sql
CREATE VIRTUAL TABLE jr_entries_fts USING fts5(
  entry_id UNINDEXED,
  title,
  content_plain,
  tags,
  content=jr_entries,
  content_rowid=rowid,
  tokenize='porter unicode61'
);
```

**Columns:**
- `entry_id`: unindexed reference back to the entry (for joining)
- `title`: entry title (searchable)
- `content_plain`: plain text content with Markdown stripped (searchable)
- `tags`: space-separated tag names for this entry (searchable)

**Tokenizer:** `porter unicode61` - Porter stemming for English (matching "running" when searching "run") with Unicode support for international characters.

##### Entity: RecentSearch

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| query | TEXT | Required, max 200 chars | None | The search query text |
| result_count | INTEGER | Min 0 | 0 | Number of results returned |
| searched_at | TEXT | ISO datetime, auto-set | Current timestamp | When the search was performed |

**Validation Rules:**
- Maximum 10 recent searches stored (oldest deleted when limit exceeded)
- Duplicate queries update the existing record's `searched_at` and `result_count`

#### 3.7 Business Logic Rules

##### FTS5 Index Maintenance

**Purpose:** Keep the FTS5 index in sync with entry content

**Logic:**

```
1. On entry creation:
   INSERT INTO jr_entries_fts (entry_id, title, content_plain, tags)
   VALUES (entry.id, entry.title, entry.content_plain, space_join(entry.tags))

2. On entry update (content, title, or tags changed):
   DELETE FROM jr_entries_fts WHERE entry_id = entry.id
   INSERT INTO jr_entries_fts (entry_id, title, content_plain, tags)
   VALUES (entry.id, entry.title, entry.content_plain, space_join(entry.tags))

3. On entry deletion:
   DELETE FROM jr_entries_fts WHERE entry_id = entry.id

4. On tag addition/removal:
   Update the tags column for the affected entry in jr_entries_fts
```

##### Search Query Execution

**Purpose:** Execute a full-text search and return ranked results

**Inputs:**
- `query`: string - User's search query
- `journal_id`: UUID or null - Filter to specific journal
- `date_start`: date or null - Filter start date
- `date_end`: date or null - Filter end date
- `mood_level`: integer or null - Filter by mood
- `page`: integer - Pagination (0-indexed)
- `page_size`: integer - Results per page (default 20)

**Logic:**

```
1. Sanitize query: escape special FTS5 characters if not using boolean operators
2. Build FTS5 query:
   SELECT e.*, snippet(jr_entries_fts, 2, '<b>', '</b>', '...', 32) as snippet,
          rank
   FROM jr_entries_fts fts
   JOIN jr_entries e ON e.id = fts.entry_id
   WHERE jr_entries_fts MATCH '{sanitized_query}'
   [AND e.journal_id = journal_id if provided]
   [AND e.entry_date >= date_start if provided]
   [AND e.entry_date <= date_end if provided]
   [AND e.mood_level = mood_level if provided]
   ORDER BY rank
   LIMIT page_size OFFSET page * page_size
3. Count total results for pagination:
   SELECT COUNT(*) FROM jr_entries_fts WHERE jr_entries_fts MATCH '{sanitized_query}'
   [with same filters]
4. RETURN results with snippets and total count
```

**Edge Cases:**
- Empty query: return empty results (do not search)
- Query with only special characters: sanitize to empty, return empty results
- Very long query (> 200 chars): truncate to 200 characters
- Query with FTS5 syntax errors: catch error, fall back to simple LIKE search

##### BM25 Ranking

**Purpose:** Rank search results by relevance

**Logic:**

```
FTS5 BM25 ranks results by term frequency and inverse document frequency:
- Higher rank for entries where search terms appear more frequently
- Higher rank for entries where search terms appear in the title (title matches weighted 2x)
- Lower rank for common terms that appear in many entries (IDF)
- Column weights: title = 10.0, content_plain = 1.0, tags = 5.0

ORDER BY rank uses FTS5's built-in bm25() function:
ORDER BY bm25(jr_entries_fts, 10.0, 1.0, 5.0)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| FTS5 table missing or corrupted | Search returns no results, banner: "Search index is rebuilding..." | Background rebuild of FTS5 index from all entries |
| FTS5 query syntax error | "Search encountered an error. Try simpler keywords." | Fallback to LIKE query on content_plain |
| Search timeout (> 2 seconds) | Spinner, then: "Search is taking longer than expected. Try a more specific query." | User refines query. Consider index optimization |
| Encrypted entries excluded | Banner: "Some entries are encrypted. Unlock to include them in search." | User enters passphrase to decrypt for session |
| No results | "No entries match '[query]'" with suggestions | User tries different keywords or adjusts filters |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user types "morning routine" in the search bar,
   **When** 300ms debounce fires,
   **Then** results appear showing all entries containing "morning routine" with matching text highlighted in bold.

2. **Given** the user searches for "grateful",
   **When** results appear,
   **Then** entries containing "grateful", "gratitude", and "gratefulness" match (due to Porter stemming).

3. **Given** the user applies a "Past Month" date filter,
   **When** combined with a keyword search,
   **Then** only entries from the last 30 days matching the keyword are shown.

4. **Given** the user taps a search result,
   **When** the Entry Reading View opens,
   **Then** the search terms are highlighted within the entry content.

**Edge Cases:**

5. **Given** the user searches for a prefix "morn",
   **When** results appear,
   **Then** entries with "morning", "mornings", "mourn" (stemmed) are matched.

6. **Given** a user has 10,000 entries and searches for a common word,
   **When** the search executes,
   **Then** results appear in under 200ms with BM25 relevance ranking.

**Negative Tests:**

7. **Given** the FTS5 index is corrupted,
   **When** the user performs a search,
   **Then** a banner shows "Search index is rebuilding..." and a background rebuild begins.

8. **Given** encryption is enabled and entries are locked,
   **When** the user searches,
   **Then** encrypted entries are excluded and a banner explains why.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| sanitizes FTS5 special characters | query: "hello*" | sanitized: "hello" (or escaped) |
| matches exact phrase in quotes | query: '"morning routine"' | only entries with exact phrase |
| Porter stemming matches variants | query: "running" | matches "run", "running", "runs" |
| BM25 ranks title matches higher | "travel" in title vs body | title match ranked first |
| truncates query at 200 chars | 250-char query | truncated to 200 chars |
| returns empty for empty query | query: "" | 0 results |
| paginates results correctly | 50 results, page 1, size 20 | results 21-40 returned |
| filters by journal_id | query + journal_id filter | only results from that journal |
| filters by date range | query + date filter | only results within range |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Index entry on creation | 1. Create entry with "morning routine" in content, 2. Search "morning" | Entry appears in results |
| Update index on edit | 1. Create entry with "breakfast", 2. Edit to "dinner", 3. Search "breakfast" | No results. Search "dinner" finds it |
| Remove from index on delete | 1. Create entry, 2. Delete entry, 3. Search for its content | No results |
| Tag search | 1. Create entry tagged "travel", 2. Search "travel" | Entry appears in results |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Search across years of entries | 1. Create 100 entries over simulated dates, 2. Search for a keyword in 10 of them, 3. Apply date filter | Filtered results shown in under 200ms, correctly ranked by relevance |

---

### JR-011: Calendar Heatmap

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-011 |
| **Feature Name** | Calendar Heatmap |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a daily journaler, I want a calendar heatmap showing my journaling activity by day (similar to GitHub's contribution graph), so that I can visualize my consistency at a glance.

**Secondary:**
> As a goal-oriented writer, I want to see months and years of journaling history in the heatmap, so that I can observe long-term patterns in my writing habits.

**Tertiary:**
> As a mood-tracking user, I want the heatmap colors to optionally reflect mood instead of just activity, so that I can see emotional patterns across the calendar.

#### 3.3 Detailed Description

The Calendar Heatmap provides a visual representation of journaling activity over time, inspired by GitHub's contribution graph. Each day cell is colored based on journaling activity intensity: no entry (empty/lightest), 1 entry (light), 2-3 entries (medium), 4+ entries (dark/most intense).

The default view shows the current year with months arranged in a grid. Users can navigate to previous years. The heatmap supports two color modes: Activity Mode (default, using module accent color gradient) and Mood Mode (colors reflect average mood for that day: red for low mood, yellow for neutral, green for high mood).

Tapping a day cell shows a popover with that day's entry count, average mood (if tracked), and a "View Entries" link. Days with entries have a subtle dot indicator in addition to the color fill.

The heatmap also displays summary statistics for the visible time period: total entries, days journaled, journaling rate (percentage of days with at least one entry), and average entries per journaling day.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-009: Streak Tracking - Shares entry date data and consistency metrics

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entries have `entry_date` fields populated
- Screen dimensions are sufficient for heatmap rendering (minimum 320px width)

#### 3.5 User Interface Requirements

##### Screen: Calendar Heatmap

**Layout:**
- Top navigation bar: "Activity" title, year selector (left/right arrows around the year number)
- Below nav: toggle for "Activity" mode and "Mood" mode (segmented control)
- Main area: 12-month grid displayed in a GitHub-style contribution graph:
  - 7 rows (one per day of week: Mon-Sun), columns represent weeks
  - Each cell is a small square (approx 12x12 points) with rounded corners (2px radius)
  - Month labels along the top edge aligned to the first week of each month
  - Day-of-week labels along the left edge (Mon, Wed, Fri abbreviated)
- Below heatmap: streak info bar showing current streak, longest streak, fire emoji
- Below streak bar: summary statistics row: "Total Entries: X", "Days Journaled: Y", "Rate: Z%", "Avg/Day: W"
- Below summary: monthly breakdown list (12 rows, one per month) showing month name, entry count, and mini-sparkline

**Color Scales:**

Activity Mode (module accent color, default #6366F1 indigo):

| Level | Condition | Color |
|-------|-----------|-------|
| 0 | No entries | Background color (near-transparent, e.g., #1a1a2e) |
| 1 | 1 entry | Accent at 25% opacity |
| 2 | 2-3 entries | Accent at 50% opacity |
| 3 | 4-5 entries | Accent at 75% opacity |
| 4 | 6+ entries | Accent at 100% opacity |

Mood Mode (emotional color scale):

| Level | Condition | Color |
|-------|-----------|-------|
| No mood | No mood-tagged entries | Gray (#555) |
| Very Bad (1.0-1.5) | Average mood 1.0-1.5 | Deep red (#EF4444) |
| Bad (1.5-2.5) | Average mood 1.5-2.5 | Orange (#F97316) |
| Neutral (2.5-3.5) | Average mood 2.5-3.5 | Yellow (#EAB308) |
| Good (3.5-4.5) | Average mood 3.5-4.5 | Light green (#22C55E) |
| Very Good (4.5-5.0) | Average mood 4.5-5.0 | Bright green (#10B981) |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Current Year | Viewing current year | Heatmap for Jan 1 to today. Future days shown as outlined cells (no fill) |
| Past Year | Viewing a previous year | Full 12-month heatmap with all days filled |
| No Data | No entries in selected year | All cells at level 0, message: "No entries in [year]. Start journaling to fill this up!" |
| Loading | Heatmap data loading | Skeleton grid placeholder |

**Interactions:**
- Tap day cell: shows popover with date, entry count, average mood (if tracked), and "View Entries" button
- Tap "View Entries" in popover: navigates to entry list filtered to that date
- Swipe left/right on heatmap: navigate to next/previous year
- Tap year arrows: navigate years
- Tap Activity/Mood toggle: switches color mode with a 200ms crossfade
- Tap a monthly breakdown row: scrolls the heatmap to center that month

**Transitions/Animations:**
- Year navigation: 300ms horizontal slide transition
- Color mode switch: 200ms crossfade
- Day popover: 150ms scale-in from tapped cell

#### 3.6 Data Requirements

##### Computed Data: DayActivity

Not a stored entity; computed on the fly from entries:

```sql
SELECT entry_date, COUNT(*) as entry_count,
       AVG(mood_level) as avg_mood,
       SUM(word_count) as total_words
FROM jr_entries
WHERE entry_date BETWEEN '[year]-01-01' AND '[year]-12-31'
GROUP BY entry_date
ORDER BY entry_date
```

**Caching Strategy:**
- Compute DayActivity for the displayed year on screen load
- Cache in memory for the session (invalidate on entry create/update/delete)
- Past years can be cached more aggressively (data will not change unless entries are backdated)

#### 3.7 Business Logic Rules

##### Heatmap Level Calculation

**Purpose:** Assign a visual intensity level to each day

**Inputs:**
- `entry_count`: integer - Number of entries on this day

**Logic (Activity Mode):**

```
IF entry_count == 0: level = 0
ELSE IF entry_count == 1: level = 1
ELSE IF entry_count <= 3: level = 2
ELSE IF entry_count <= 5: level = 3
ELSE: level = 4
```

**Logic (Mood Mode):**

```
IF no mood-tagged entries on this day: level = "no_mood"
ELSE:
  avg_mood = AVG(mood_level) for entries on this day with mood_level IS NOT NULL
  IF avg_mood <= 1.5: level = "very_bad"
  ELSE IF avg_mood <= 2.5: level = "bad"
  ELSE IF avg_mood <= 3.5: level = "neutral"
  ELSE IF avg_mood <= 4.5: level = "good"
  ELSE: level = "very_good"
```

##### Summary Statistics Calculation

**Purpose:** Compute aggregate metrics for the visible time period

**Inputs:**
- `year`: integer - The year being viewed
- `entries_in_year`: DayActivity[] - Computed day-level data

**Logic:**

```
total_entries = SUM(entry_count) across all days in year
days_journaled = COUNT(days where entry_count > 0)
total_days_in_range = IF year == current_year: day_of_year(today) ELSE: 365 (or 366 for leap year)
journaling_rate = (days_journaled / total_days_in_range) * 100, rounded to 1 decimal
avg_entries_per_day = IF days_journaled > 0: total_entries / days_journaled, rounded to 1 decimal ELSE: 0
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Heatmap query fails | "Could not load activity data. Pull down to retry." | User pulls down to retry |
| Year has no data | All cells at level 0, "No entries in [year]" message | User navigates to a different year or starts journaling |
| Mood mode with no mood data | All cells show gray (no mood), notice: "Tag entries with moods to see mood patterns" | User starts mood-tagging entries |
| Rendering performance issue (very active year) | Limit cell animations, simplify rendering | Cap at level 4 regardless of entry count above 6 |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user navigates to the Calendar Heatmap screen,
   **When** the current year loads,
   **Then** a GitHub-style contribution graph is displayed with day cells colored by journaling activity intensity.

2. **Given** the user taps a day cell that has 3 entries,
   **When** the popover appears,
   **Then** it shows the date, "3 entries", average mood (if tagged), and a "View Entries" link.

3. **Given** the user toggles to Mood Mode,
   **When** the heatmap re-renders,
   **Then** day cells are colored on a red-to-green scale based on average mood for that day.

4. **Given** the user views the summary statistics,
   **When** they have 200 entries across 150 unique days in the current year (day 90),
   **Then** stats show: "200 entries, 150 days, 166.7% rate (150/90 days elapsed is capped display), 1.3 avg/day".

**Edge Cases:**

5. **Given** the user navigates to a year with zero entries,
   **When** the heatmap loads,
   **Then** all cells are at level 0 and a message reads "No entries in [year]."

6. **Given** the user taps a future date cell in the current year,
   **When** the popover appears,
   **Then** it shows the date and "No entries" with no "View Entries" link.

**Negative Tests:**

7. **Given** the heatmap query takes longer than 2 seconds,
   **When** loading completes,
   **Then** data is displayed (no timeout) but a warning is logged internally for performance investigation.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| level 0 for 0 entries | entry_count: 0 | level = 0 |
| level 1 for 1 entry | entry_count: 1 | level = 1 |
| level 2 for 3 entries | entry_count: 3 | level = 2 |
| level 3 for 5 entries | entry_count: 5 | level = 3 |
| level 4 for 6+ entries | entry_count: 8 | level = 4 |
| mood level very_bad for avg 1.2 | avg_mood: 1.2 | level = "very_bad" |
| mood level good for avg 4.0 | avg_mood: 4.0 | level = "good" |
| mood level no_mood when no mood data | no mood-tagged entries | level = "no_mood" |
| journaling rate calculation | 30 days journaled out of 90 elapsed | rate = 33.3% |
| avg entries per day | 60 entries across 30 days | avg = 2.0 |
| handles leap year correctly | year 2028 | 366 total days |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Heatmap reflects new entry | 1. View heatmap showing today as level 0, 2. Create entry, 3. Return to heatmap | Today's cell updates to level 1 |
| Year navigation | 1. View 2026 heatmap, 2. Swipe left to 2025 | 2025 heatmap loads with that year's data |
| Mood mode toggle | 1. View activity mode, 2. Toggle to mood mode | Colors change from accent gradient to mood gradient |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Review yearly journaling activity | 1. Journal for 30+ days, 2. Open Calendar Heatmap, 3. View activity mode, 4. Toggle to mood mode, 5. Tap a day, 6. Navigate to entries | Heatmap accurately reflects all activity, mood colors match, day popover shows correct counts |

---

### JR-012: Export (PDF / Markdown / Text)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-012 |
| **Feature Name** | Export (PDF / Markdown / Text) |
| **Priority** | P0 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious writer, I want to export my journal entries as PDF, Markdown, or plain text files, so that I have portable backups of my writing that are not locked into any app.

**Secondary:**
> As a reflective thinker, I want to export a date range of entries as a single formatted PDF, so that I can print or archive a period of my journal.

**Tertiary:**
> As a daily journaler, I want to export an entire journal (notebook) as a bundled file, so that I can transfer my writing to another device or share a travel journal with a friend.

#### 3.3 Detailed Description

Export provides three output formats for journal entries: PDF (formatted with typography, images, and metadata), Markdown (raw Markdown source files), and Plain Text (stripped of all formatting). Users can export a single entry, a date range, an entire journal, or all entries.

PDF exports render entries with proper heading styles, body text, embedded photos (inline), mood indicators, tag labels, and entry metadata (date, journal name, word count). The PDF header includes the journal name and export date range. Each entry starts on a new page (or after a horizontal rule for multi-entry continuous format, user-configurable).

Markdown exports produce one `.md` file per entry, organized in a folder structure by year and month. Each file includes YAML frontmatter with metadata (date, journal, tags, mood) and the raw Markdown content. A ZIP archive is generated for multi-entry exports.

Plain text exports produce one `.txt` file per entry with metadata as a plain text header block. ZIP archive for multi-entry exports.

If encryption is enabled (JR-008), entries must be decrypted before export. The exported files are not encrypted (they are plain exports for portability). A warning is shown: "Exported files will not be encrypted. Store them securely."

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Content to export

**External Dependencies:**
- PDF rendering library (platform-specific)
- File system access for saving exports
- Share sheet integration (mobile)

**Assumed Capabilities:**
- Entries exist with content
- System share sheet is available

#### 3.5 User Interface Requirements

##### Modal: Export Options

**Layout:**
- Bottom sheet, 60% screen height
- Title: "Export Entries"
- Scope selector: radio buttons for "This Entry", "Date Range", "This Journal", "All Entries"
- Date range picker (visible when "Date Range" selected): start date and end date fields
- Format selector: three cards showing PDF (with document icon), Markdown (with code icon), Plain Text (with text icon). Each card shows format name and a brief description
- PDF-specific option (visible when PDF selected): checkbox "One entry per page" (default: checked)
- Entry count preview: "X entries will be exported"
- Warning banner (if encryption enabled): "Exported files will not be encrypted. Store them securely."
- Footer: "Cancel" and "Export" buttons

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Configuring | User selecting options | Full form with scope, format, and options |
| Exporting | Export in progress | Progress bar: "Exporting... X of Y entries" |
| Complete | Export finished | "Export complete!" with "Share" button (opens system share sheet) and "Save to Files" button |
| Error | Export failed | "Export failed. Please try again." with retry button |
| No Entries | Selected scope has 0 entries | "No entries to export in the selected range." Export button disabled |

**Interactions:**
- Select scope: updates entry count preview
- Select format: shows/hides format-specific options
- Tap "Export": begins export generation with progress indicator
- Tap "Share": opens system share sheet with the generated file
- Tap "Save to Files": opens system file picker to choose save location

#### 3.6 Data Requirements

**No new entities required.** Export reads from existing Entry, Journal, Tag, and Attachment entities.

**Export File Structures:**

Markdown export (ZIP archive):

```
MyJournal-Export-2026-03-06/
  2026/
    03/
      2026-03-06-morning-pages.md
      2026-03-06-evening-reflection.md
    02/
      2026-02-15-travel-notes.md
  attachments/
    [attachment_id].jpg
    [attachment_id].aac
```

Markdown file format with YAML frontmatter:

```markdown
---
date: 2026-03-06
journal: Personal
tags: [morning-routine, gratitude]
mood: 4 (Good)
mood_emotion: grateful
word_count: 247
---

# Morning Pages

Today I woke up feeling rested...
```

Plain text file format:

```
Date: 2026-03-06
Journal: Personal
Tags: morning-routine, gratitude
Mood: Good (grateful)
Words: 247

Morning Pages

Today I woke up feeling rested...
```

#### 3.7 Business Logic Rules

##### PDF Generation

**Purpose:** Generate a formatted PDF from journal entries

**Inputs:**
- `entries`: Entry[] - Entries to export
- `one_per_page`: boolean - Whether each entry starts on a new page

**Logic:**

```
1. Initialize PDF document:
   - Page size: A4 (210mm x 297mm) or Letter (8.5" x 11"), based on device locale
   - Margins: 20mm all sides
   - Font: serif family for body, sans-serif for headers and metadata
2. Add cover page (for multi-entry exports):
   - Journal name or "MyJournal Export"
   - Date range: "[start_date] to [end_date]"
   - Entry count: "X entries"
   - Export date: today's date
3. FOR EACH entry:
   a. IF one_per_page AND not first entry: insert page break
   b. ELSE IF not first entry: insert horizontal rule with 20pt spacing
   c. Render metadata block: date (bold), journal name, tags (comma-separated), mood emoji + label
   d. Render entry title as H1
   e. Render Markdown content with styling:
      - Headings, bold, italic, lists, blockquotes
      - Inline images: embed at max 80% page width, maintain aspect ratio
      - Code blocks: monospaced font, light background
   f. Render word count in footer: "X words"
4. Generate PDF binary
5. RETURN PDF file
```

##### Markdown Export

**Purpose:** Generate Markdown files with frontmatter for each entry

**Logic:**

```
1. Create temporary directory structure: [export-name]/[year]/[month]/
2. FOR EACH entry:
   a. Generate filename: [entry_date]-[slugified-title].md
   b. Compose YAML frontmatter from entry metadata
   c. Write frontmatter + content to file
   d. IF entry has attachments:
      - Copy attachment files to [export-name]/attachments/
      - Update image references in content to use relative paths
3. Compress directory to ZIP archive
4. RETURN ZIP file
```

##### Plain Text Export

**Purpose:** Generate plain text files stripped of Markdown formatting

**Logic:**

```
1. Create temporary directory structure: [export-name]/[year]/[month]/
2. FOR EACH entry:
   a. Generate filename: [entry_date]-[slugified-title].txt
   b. Compose plain text header: Date, Journal, Tags, Mood, Words
   c. Write header + content_plain (Markdown stripped) to file
3. Compress directory to ZIP archive
4. RETURN ZIP file
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| PDF generation fails | "Could not generate PDF. Please try again or choose a different format." | User retries or selects Markdown/Text |
| Insufficient storage for export file | "Not enough storage space for the export. Free up space on your device." | User frees storage |
| Export interrupted (app backgrounded) | Export pauses, resumes when app returns to foreground | Automatic resume |
| Attachment file missing during export | Photo placeholder: "[Photo unavailable]" in PDF, skip file in Markdown ZIP | Export continues without missing attachment |
| Encrypted entries not decrypted | "Please unlock your entries before exporting." Export button disabled | User enters passphrase first |
| Very large export (1000+ entries) | Progress bar with entry count. Export runs in background thread | User can cancel with "Cancel Export" button |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects a single entry and PDF format,
   **When** they tap "Export",
   **Then** a formatted PDF is generated with the entry's title, content, metadata, and inline photos.

2. **Given** the user selects "This Journal" scope and Markdown format,
   **When** the export completes,
   **Then** a ZIP file is created containing one `.md` file per entry organized by year/month, each with YAML frontmatter.

3. **Given** the user taps "Share" after export,
   **When** the system share sheet opens,
   **Then** the exported file can be shared via AirDrop, email, Files, or any installed sharing target.

4. **Given** the user exports a date range of 30 entries as plain text,
   **When** the export completes,
   **Then** a ZIP file contains 30 `.txt` files with plain text headers and stripped content.

**Edge Cases:**

5. **Given** an entry has 5 inline photos,
   **When** exported as PDF,
   **Then** all 5 photos appear inline in the PDF at appropriate sizes.

6. **Given** encryption is enabled and entries are locked,
   **When** the user opens the export modal,
   **Then** a warning appears and the Export button is disabled until entries are unlocked.

**Negative Tests:**

7. **Given** an attachment file is missing from the filesystem,
   **When** the entry is exported as PDF,
   **Then** a placeholder text "[Photo unavailable]" appears where the image would be, and the export succeeds.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates valid PDF binary | 1 entry with title and content | non-zero byte PDF file |
| PDF includes metadata | entry with date, journal, tags, mood | PDF text contains date, journal name, tags, mood |
| Markdown frontmatter is valid YAML | entry metadata | parseable YAML frontmatter |
| filename slug generation | title: "Morning Pages!" | slug: "morning-pages" |
| plain text strips Markdown | content: "**bold** text" | output: "bold text" |
| ZIP contains correct structure | 3 entries from 2 months | ZIP has 2 month directories with 3 files total |
| handles entry with no title | entry with null title | filename uses entry_date only |
| handles entry with no attachments | entry, no photos | no attachments directory in export |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Export single entry as PDF | 1. Create entry with text + photo, 2. Export as PDF | PDF file with formatted text and embedded image |
| Export journal as Markdown ZIP | 1. Create 5 entries in "Travel" journal, 2. Export journal as Markdown | ZIP with 5 .md files, correct frontmatter |
| Export date range | 1. Create entries across 3 months, 2. Export last 30 days | Only entries within date range included |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full backup export | 1. Create 20 entries across 3 journals with photos and moods, 2. Export all entries as Markdown, 3. Share via AirDrop | ZIP with 20 .md files, organized by year/month, attachments directory with photos, share succeeds |

---

### JR-013: On This Day (Nostalgia)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-013 |
| **Feature Name** | On This Day (Nostalgia) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a reflective thinker, I want to see what I wrote on this date in previous years, so that I can revisit past thoughts and observe how I have changed over time.

**Secondary:**
> As a daily journaler, I want "On This Day" to appear automatically on the home screen when historical entries exist, so that I discover past memories without actively searching.

**Tertiary:**
> As a gratitude practitioner, I want to re-read old gratitude entries, so that I am reminded of things I was thankful for in the past.

#### 3.3 Detailed Description

On This Day surfaces journal entries from previous years that share the same calendar date (month and day) as today. This feature creates a nostalgia loop that increases engagement and provides a powerful self-reflection tool.

On the journal home screen, an "On This Day" card appears when historical entries exist for today's date. The card shows a preview of the most recent historical entry with the year displayed prominently. If entries exist from multiple years, a horizontal page indicator shows how many years have entries. Users swipe left/right to browse entries from different years.

The feature also supports a dedicated "On This Day" screen accessible from the journal navigation, which shows a timeline view of all entries from today's date across all years, ordered newest to oldest.

If encryption is enabled, On This Day previews show "[Encrypted Entry]" until the session is unlocked.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Entries to surface

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entries exist with `entry_date` spanning multiple years

#### 3.5 User Interface Requirements

##### Component: On This Day Card (Home Screen)

**Layout:**
- Card positioned below the streak badge on the journal home screen
- Only visible when entries from previous years exist for today's month and day
- Card header: "On This Day" with a clock/rewind icon, year badge on right (e.g., "2025")
- Card body: entry title (or first line preview), first 2 lines of content preview, mood emoji (if tagged)
- Card footer: page dots indicating how many years have entries. Swipe horizontally to browse
- "See All" link in top-right corner of the card

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Single Year | One previous year has entries for today's date | Card with entry preview, no page dots |
| Multiple Years | 2+ previous years have entries | Card with entry preview + horizontal page dots, swipeable |
| No History | No previous years have entries for today's date | Card is not visible |
| Encrypted | Entries exist but are encrypted and locked | Card shows year badges with "[Encrypted Entry]" preview |
| Dismissed | User dismissed the card for today | Card hidden until tomorrow |

**Interactions:**
- Swipe left/right: browse entries from different years
- Tap card: opens the entry in Entry Reading View
- Tap "See All": navigates to the On This Day timeline screen
- Tap "x" dismiss button: hides the card for today (reappears tomorrow)

##### Screen: On This Day Timeline

**Layout:**
- Top navigation bar: "On This Day - [Month Day]" title (e.g., "On This Day - March 6")
- Vertical timeline with year markers on the left edge
- Each year section shows: year label (large, bold), entry previews for that date from that year
- Each entry item: title, first 3 lines of content preview, mood emoji, word count, journal name

**Interactions:**
- Tap entry: opens Entry Reading View
- Scroll: browse years vertically (newest first)

#### 3.6 Data Requirements

**No new entities required.** On This Day queries existing entries by month and day.

**Query:**

```sql
SELECT * FROM jr_entries
WHERE strftime('%m-%d', entry_date) = strftime('%m-%d', 'now')
AND strftime('%Y', entry_date) < strftime('%Y', 'now')
ORDER BY entry_date DESC
```

**Indexes:**
- A functional index on `strftime('%m-%d', entry_date)` would be ideal but is not supported by SQLite. Instead, rely on the existing `entry_date` index and filter in the application layer, or maintain a computed `month_day` TEXT column (format 'MM-DD') for efficient lookups.

**Optional addition to Entry entity:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| month_day | TEXT | Computed, format 'MM-DD' | Derived from entry_date | For efficient On This Day lookups |

#### 3.7 Business Logic Rules

##### On This Day Query

**Purpose:** Find entries from previous years matching today's month and day

**Inputs:**
- `today`: date - Current calendar date

**Logic:**

```
1. Extract month and day from today: mm_dd = format(today, 'MM-DD')
2. Query entries:
   SELECT * FROM jr_entries
   WHERE month_day = mm_dd
   AND entry_date < date(today, 'start of year')
   ORDER BY entry_date DESC
3. Group results by year
4. IF results exist: show On This Day card
5. ELSE: hide On This Day card
```

**Edge Cases:**
- February 29 entries: on non-leap years, February 29 entries are not surfaced (no February 29 exists). Optionally, surface them on February 28 with a note: "From Feb 29 (leap year)"
- First year of journaling: no historical entries exist, card is hidden
- Entries from the current year but a past date: not included (only previous years)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| On This Day query fails | Card not shown (silent failure) | No disruption to user experience. Query retried on next home screen load |
| Entry referenced in card was deleted | Card refreshes and shows next available entry or hides | Automatic |
| Very many years of entries (10+) | Horizontal scrolling with page dots (may need truncation at 10+ dots) | Show first 10 years with "X more years" indicator |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has an entry from March 6, 2025 and today is March 6, 2026,
   **When** the journal home screen loads,
   **Then** an "On This Day" card appears showing a preview of the March 6, 2025 entry with "2025" badge.

2. **Given** entries exist from 2024 and 2025 for today's date,
   **When** the user swipes left on the On This Day card,
   **Then** the 2024 entry preview appears with page dots showing 2 of 2.

3. **Given** the user taps "See All" on the On This Day card,
   **When** the timeline screen opens,
   **Then** all entries from previous years for today's date are shown in a vertical timeline grouped by year.

**Edge Cases:**

4. **Given** no entries exist from previous years for today's date,
   **When** the home screen loads,
   **Then** no On This Day card is shown.

5. **Given** an entry from February 29, 2024 exists and today is February 28, 2025 (non-leap year),
   **When** the home screen loads on February 28,
   **Then** the leap year entry is optionally surfaced with a note "From Feb 29 (leap year)."

**Negative Tests:**

6. **Given** all historical entries for today's date are encrypted and locked,
   **When** the On This Day card appears,
   **Then** it shows "[Encrypted Entry]" as the preview text.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| finds entries matching today's month-day | today: Mar 6, entries on Mar 6 2025, Mar 6 2024 | 2 results |
| excludes current year entries | today: Mar 6 2026, entry on Mar 6 2026 | 0 results |
| groups results by year | 3 entries: 2025, 2024, 2023 | 3 groups, newest first |
| handles February 29 on non-leap year | today: Feb 28, entry on Feb 29 2024 | optionally returns entry with note |
| returns empty when no history | first year of journaling | empty result set |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| On This Day card appears | 1. Create entry dated Mar 6 2025, 2. Set today to Mar 6 2026, 3. View home screen | Card shows with 2025 entry preview |
| Navigate to full entry from card | 1. On This Day card visible, 2. Tap card | Entry Reading View opens for the historical entry |
| Dismiss card | 1. On This Day card visible, 2. Tap "x", 3. Check home screen | Card hidden. Returns next day |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Revisit memories over 3 years | 1. Create entries on same date for 3 simulated years, 2. View On This Day card, 3. Swipe through years, 4. Tap "See All" | All 3 years visible in card and timeline, entries accessible |

---

### JR-014: Writing Analytics

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-014 |
| **Feature Name** | Writing Analytics |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a daily journaler, I want to see statistics about my writing habits (total words, average entry length, most productive time of day), so that I can understand and optimize my journaling practice.

**Secondary:**
> As a reflective thinker, I want to see my word count trends over weeks and months, so that I can observe whether my writing is becoming more or less detailed over time.

**Tertiary:**
> As a goal-oriented writer, I want to set a daily word count target and track my progress toward it, so that I am motivated to write a meaningful amount each day.

#### 3.3 Detailed Description

Writing Analytics provides comprehensive statistics about the user's journaling habits. The analytics screen displays metrics computed from entry data, organized into sections: overview, time patterns, word count trends, and journal breakdown.

**Key formulas:**
- `avg_words = SUM(word_count) / COUNT(entries)` (average words per entry)
- `most_active_hour = MODE(HOUR(created_at))` (the hour of day with the most entries created)
- `most_active_day = MODE(DAYOFWEEK(entry_date))` (the day of week with the most entries)
- `words_per_week`: rolling 7-day sum of word counts, displayed as a line chart
- `longest_entry`: MAX(word_count) across all entries, with entry reference
- `shortest_entry`: MIN(word_count) across all entries where word_count > 0

Users can set an optional daily word count goal (e.g., 300 words). When set, the analytics screen shows progress toward the goal for today and a historical completion rate. A notification or badge can remind the user if they have not met their daily goal by a configurable time.

Analytics data is computed from the entries in the database and is never transmitted externally. All calculations run locally.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Word count and timestamp data from entries

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entries exist with `word_count`, `created_at`, and `entry_date` populated

#### 3.5 User Interface Requirements

##### Screen: Writing Analytics

**Layout:**
- Top navigation bar: "Writing Analytics" title
- Scrollable content organized in card sections:

**Section 1: Overview Stats (4-stat grid)**
- Total words written (all time)
- Total entries
- Average words per entry
- Total journaling days

**Section 2: Daily Goal Progress (if goal is set)**
- Circular progress ring showing today's word count vs. goal
- "X / Y words today" label
- Below ring: "Goal met X of last 30 days (Z%)" completion rate

**Section 3: Time Patterns**
- "Most Active Hour" with clock icon and hour label (e.g., "7:00 AM")
- "Most Active Day" with calendar icon and day label (e.g., "Sunday")
- Horizontal bar chart showing entries per hour of day (24 bars)
- Horizontal bar chart showing entries per day of week (7 bars)

**Section 4: Word Count Trend**
- Line chart showing weekly word count over the last 12 weeks
- X-axis: week labels. Y-axis: word count
- Trend indicator: arrow up/down with percentage change from previous 12-week period

**Section 5: Records**
- "Longest Entry": word count, title, date, tap to view
- "Shortest Entry": word count, title, date, tap to view
- "Most Productive Day": date, entry count, total words

**Section 6: Journal Breakdown**
- Horizontal stacked bar or pie chart showing word count distribution by journal
- Below chart: list of journals with word count, entry count, and percentage

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Full Data | 10+ entries exist | All sections populated with data and charts |
| Minimal Data | 1-9 entries exist | Overview stats shown, charts may show "Not enough data for trends" |
| No Data | 0 entries exist | "Start journaling to see your writing analytics!" with illustration |
| Goal Active | Daily word goal set | Daily goal progress section visible |
| Goal Not Set | No daily goal | Section hidden, "Set a daily word goal" prompt link |

**Interactions:**
- Tap "Longest Entry" or "Shortest Entry": navigates to that entry
- Tap "Set a daily word goal": opens goal configuration modal
- Tap time period selector: switches analytics between "Last 30 Days", "Last 90 Days", "Last Year", "All Time"
- Pull-to-refresh: recomputes all analytics

##### Modal: Daily Goal Configuration

**Layout:**
- Bottom sheet with title "Daily Word Goal"
- Numeric input for goal (e.g., 300 words), with stepper buttons (+50 / -50)
- Suggested goals: "200 words (~1 min)", "500 words (~2.5 min)", "1,000 words (~5 min)"
- Reminder toggle: "Remind me if I haven't written by [time picker]"
- "Save" and "Cancel" buttons
- "Remove Goal" option (if goal is currently set)

#### 3.6 Data Requirements

##### Entity: WritingGoal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, always 'writing_goal' (singleton) | 'writing_goal' | Single goal record |
| daily_word_target | INTEGER | Nullable, min 50, max 10000 | null | Daily word count goal |
| reminder_enabled | INTEGER | 0 or 1 | 0 | Whether a reminder is set |
| reminder_time | TEXT | HH:MM format, nullable | null | Time to send reminder if goal not met |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | When goal was first set |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification |

**Analytics are computed, not stored.** All metrics are derived from the Entry table at query time.

#### 3.7 Business Logic Rules

##### Average Words Per Entry

**Purpose:** Calculate the mean word count across all entries

**Formula:**
```
avg_words = SUM(word_count) / COUNT(entries)
IF COUNT(entries) == 0: avg_words = 0
Round to nearest integer for display.
```

##### Most Active Hour

**Purpose:** Determine the hour of day when the user most frequently creates entries

**Formula:**
```
most_active_hour = MODE(EXTRACT(HOUR FROM created_at))

Query:
SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour, COUNT(*) as count
FROM jr_entries
GROUP BY hour
ORDER BY count DESC
LIMIT 1

IF tie: return the earliest hour among tied values
IF no entries: return null
```

##### Most Active Day of Week

**Purpose:** Determine the day of week with the most entries

**Formula:**
```
most_active_day = MODE(DAYOFWEEK(entry_date))

Query:
SELECT CAST(strftime('%w', entry_date) AS INTEGER) as dow, COUNT(*) as count
FROM jr_entries
GROUP BY dow
ORDER BY count DESC
LIMIT 1

Day mapping: 0=Sunday, 1=Monday, ..., 6=Saturday
IF tie: return the first day of the week among tied values
IF no entries: return null
```

##### Weekly Word Count Trend

**Purpose:** Calculate rolling weekly word counts for trend visualization

**Logic:**
```
FOR EACH week in the last 12 weeks:
  week_start = Monday of that week
  week_end = Sunday of that week
  weekly_words = SUM(word_count) WHERE entry_date BETWEEN week_start AND week_end

Trend percentage:
  current_12_weeks_total = SUM(weekly_words for weeks 1-12)
  previous_12_weeks_total = SUM(weekly_words for weeks 13-24)
  IF previous_12_weeks_total > 0:
    trend_pct = ((current_12_weeks_total - previous_12_weeks_total) / previous_12_weeks_total) * 100
  ELSE:
    trend_pct = null (no comparison data)
```

##### Daily Goal Completion Check

**Purpose:** Determine if the user has met their daily word goal today

**Logic:**
```
1. today_words = SUM(word_count) WHERE entry_date = today
2. IF daily_word_target IS NOT NULL:
   goal_met = today_words >= daily_word_target
   progress_pct = MIN((today_words / daily_word_target) * 100, 100)
3. 30-day completion rate:
   days_with_goal_met = COUNT(DISTINCT entry_date) WHERE entry_date >= today - 30
     AND (SELECT SUM(word_count) FROM entries WHERE entry_date = d) >= daily_word_target
   completion_rate = (days_with_goal_met / 30) * 100
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Analytics computation slow | Spinner on analytics screen, "Calculating..." label | Compute in background, cache results |
| Zero entries | "Start journaling to see your writing analytics!" | User creates entries |
| Goal value invalid (< 50 or > 10000) | Inline validation on goal input | User adjusts value |
| Trend data insufficient (< 12 weeks of entries) | Show available weeks, label "Not enough data for full trend" | User continues journaling |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 50 entries with a total of 15,000 words,
   **When** they open the Writing Analytics screen,
   **Then** they see: Total Words: 15,000, Total Entries: 50, Avg Words/Entry: 300.

2. **Given** the user creates most entries at 7 AM,
   **When** the time patterns section loads,
   **Then** "Most Active Hour" shows "7:00 AM" and the hourly bar chart highlights the 7 AM bar.

3. **Given** the user sets a daily goal of 500 words and has written 350 words today,
   **When** the goal progress section loads,
   **Then** the circular progress ring shows 70% filled with "350 / 500 words today".

4. **Given** the user's weekly word count has increased by 25% over the last 12 weeks vs. the prior 12,
   **When** the trend section loads,
   **Then** a green up arrow shows "+25%" next to the trend line.

**Edge Cases:**

5. **Given** the user has only 3 entries,
   **When** the analytics screen loads,
   **Then** overview stats are shown but charts display "Not enough data for trends."

6. **Given** a tie exists for most active hour (7 AM and 9 PM both have 15 entries),
   **When** the metric is computed,
   **Then** the earliest hour (7 AM) is displayed.

**Negative Tests:**

7. **Given** the user sets a daily goal of 30 words (below minimum 50),
   **When** they tap "Save",
   **Then** inline validation shows "Minimum goal is 50 words."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| avg_words with entries | word_counts: [100, 200, 300] | avg = 200 |
| avg_words with no entries | empty | avg = 0 |
| most_active_hour | created_at hours: [7, 7, 7, 9, 9] | hour = 7 |
| most_active_hour tie-break | hours: [7, 7, 21, 21] | hour = 7 (earliest) |
| most_active_day | entry_dates on Mon, Mon, Fri | day = Monday |
| weekly word count | 12 weeks of entries | 12 weekly totals |
| trend percentage | current: 5000, previous: 4000 | trend = +25% |
| trend with no previous data | current: 5000, previous: 0 | trend = null |
| daily goal met | today_words: 600, target: 500 | goal_met = true, progress = 100% |
| daily goal not met | today_words: 200, target: 500 | goal_met = false, progress = 40% |
| 30-day completion rate | 20 of 30 days met goal | rate = 66.7% |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Analytics reflect new entry | 1. View analytics (50 entries), 2. Create entry with 500 words, 3. Refresh analytics | Total entries = 51, total words increased by 500 |
| Set and track daily goal | 1. Set goal to 300, 2. Create entry with 200 words, 3. View goal progress | Progress ring shows 66.7%, "200 / 300 words today" |
| Analytics with multiple journals | 1. Create entries in 3 journals, 2. View journal breakdown | Pie chart shows 3 segments with correct percentages |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Review writing habits | 1. Journal for 30+ days, 2. Open analytics, 3. Set daily goal, 4. Review time patterns, 5. Check trends | All analytics populated, goal tracking active, time patterns and trends accurate |

---

### JR-015: CBT Thought Records

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-015 |
| **Feature Name** | CBT Thought Records |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a therapeutic writer, I want to create structured CBT (Cognitive Behavioral Therapy) thought records, so that I can challenge negative thinking patterns using an evidence-based framework.

**Secondary:**
> As someone in therapy, I want to review past thought records and see patterns in my cognitive distortions, so that I can discuss recurring themes with my therapist.

**Tertiary:**
> As a mental health advocate, I want CBT tools included at no cost with full privacy, so that therapeutic journaling tools are accessible without subscription fees or cloud exposure.

#### 3.3 Detailed Description

CBT Thought Records implement the structured Cognitive Behavioral Therapy thought recording framework within journal entries. A thought record guides the user through a multi-step process: identifying a triggering situation, capturing the automatic negative thought, labeling the emotion and its intensity, identifying the cognitive distortion at play, and formulating a rational alternative response.

The CBT thought record follows this evidence-based flow:
1. **Situation**: What happened? Where were you? Who were you with?
2. **Automatic Thought**: What went through your mind? What are you telling yourself?
3. **Emotion**: What emotion(s) are you feeling? How intense (0-100%)?
4. **Cognitive Distortion**: Which thinking error applies? (15 recognized types)
5. **Rational Response**: What would you tell a friend in this situation? What is the evidence for and against?
6. **Outcome**: How do you feel now? Rate the new emotion intensity (0-100%)

The 15 cognitive distortion types:
1. All-or-Nothing Thinking
2. Overgeneralization
3. Mental Filter
4. Disqualifying the Positive
5. Jumping to Conclusions (Mind Reading)
6. Jumping to Conclusions (Fortune Telling)
7. Magnification (Catastrophizing)
8. Minimization
9. Emotional Reasoning
10. Should Statements
11. Labeling
12. Personalization
13. Blame
14. Always Being Right
15. Fallacy of Fairness

Thought records are stored as structured data linked to a journal entry. The parent entry can contain additional free-text journaling alongside the structured record. Thought records feed into Mood Analytics (JR-019) for distortion frequency analysis.

All CBT data is stored locally and, if encryption is enabled, is encrypted with the same AES-256-GCM scheme as regular entries. This data is among the most clinically sensitive material in the app.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Thought records are linked to entries
- JR-005: Mood Tagging - Emotion tracking is integrated into the record

**External Dependencies:**
- None (all processing local)

**Assumed Capabilities:**
- Entry editor is functional
- Mood tagging (emotion labels) is available

#### 3.5 User Interface Requirements

##### Screen: Thought Record Wizard

**Layout:**
- Full-screen wizard with step indicator at top (6 dots, current step highlighted)
- Step title and brief instruction text below indicator
- Main content area: form field(s) for the current step
- Footer: "Back" (left), step counter "2 of 6" (center), "Next" (right)
- "Save & Close" link in top-right (saves partial record as draft)

**Step 1: Situation**
- Text area: "Describe the situation" (placeholder: "What happened? Where were you? Who was there?")
- Max 1,000 characters
- Date and time auto-populated with current timestamp (editable)

**Step 2: Automatic Thought**
- Text area: "What went through your mind?" (placeholder: "What were you telling yourself?")
- Max 1,000 characters
- Belief rating: "How strongly do you believe this thought?" slider 0-100%

**Step 3: Emotion**
- Emotion selector: grid of common emotions (the 25 emotions from JR-005 mood refinements, plus 5 additional: ashamed, guilty, jealous, disgusted, embarrassed = 30 total)
- Multiple selection allowed (can feel multiple emotions simultaneously)
- For each selected emotion: intensity slider 0-100%
- "Add Custom Emotion" option for unlisted emotions

**Step 4: Cognitive Distortion**
- Scrollable list of 15 cognitive distortions
- Each distortion shows: name, brief description (1 sentence), and an example
- Multiple selection allowed (thoughts can involve multiple distortions)
- "Learn More" link next to each distortion for a detailed explanation

**Step 5: Rational Response**
- Text area: "What is a more balanced way to think about this?" (placeholder: "What would you tell a friend? What is the evidence for and against your automatic thought?")
- Max 2,000 characters
- "Evidence For" and "Evidence Against" sub-sections (optional structured input)

**Step 6: Outcome**
- For each emotion selected in Step 3: re-rate intensity 0-100%
- New belief rating for the automatic thought: slider 0-100% (compare to Step 2)
- Overall outcome note: text area, max 500 characters

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| In Progress | User is completing steps | Step indicator shows current progress |
| Draft | User tapped "Save & Close" before finishing | Entry shows "Draft thought record" badge, can be resumed |
| Complete | All 6 steps finished | Entry shows "Complete thought record" badge |
| Review | User opens a completed thought record | Read-only view of all 6 steps with visual comparison of before/after emotion intensities |

**Interactions:**
- Tap "Next": validates current step, advances to next step
- Tap "Back": returns to previous step (preserving input)
- Tap "Save & Close": saves current progress as draft
- Tap cognitive distortion: selects/deselects it (multi-select)
- Tap "Learn More" on a distortion: expands an inline explanation card
- Slide emotion intensity: updates the 0-100% value in real time
- On final step "Done": saves complete thought record and returns to entry

##### Component: Thought Record Summary (Entry View)

**Layout:**
- Inline card within the entry content (or as a distinct section below free-text content)
- Compact view: situation summary (first line), primary emotion + intensity, distortion labels, and before/after comparison bar
- Tap to expand: full step-by-step thought record in read-only view
- Color-coded before/after intensity comparison (red = high, green = low)

#### 3.6 Data Requirements

##### Entity: ThoughtRecord

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier |
| entry_id | TEXT (UUID) | Required, references Entry.id | None | Parent entry |
| status | TEXT | Required, one of: 'draft', 'complete' | 'draft' | Completion status |
| situation | TEXT | Nullable, max 1,000 chars | null | Step 1: triggering situation |
| situation_date | TEXT | ISO datetime, nullable | null | When the situation occurred |
| automatic_thought | TEXT | Nullable, max 1,000 chars | null | Step 2: automatic thought |
| thought_belief_before | INTEGER | Nullable, range 0-100 | null | Step 2: belief rating before (%) |
| rational_response | TEXT | Nullable, max 2,000 chars | null | Step 5: balanced thought |
| evidence_for | TEXT | Nullable, max 1,000 chars | null | Step 5: evidence supporting the thought |
| evidence_against | TEXT | Nullable, max 1,000 chars | null | Step 5: evidence against the thought |
| thought_belief_after | INTEGER | Nullable, range 0-100 | null | Step 6: belief rating after (%) |
| outcome_note | TEXT | Nullable, max 500 chars | null | Step 6: overall outcome note |
| current_step | INTEGER | Range 1-6 | 1 | Last completed step (for draft resumption) |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

##### Entity: ThoughtRecordEmotion

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| thought_record_id | TEXT (UUID) | Required, references ThoughtRecord.id | None | Parent thought record |
| emotion_name | TEXT | Required, max 50 chars | None | Emotion label |
| intensity_before | INTEGER | Range 0-100 | 0 | Intensity in Step 3 (%) |
| intensity_after | INTEGER | Nullable, range 0-100 | null | Re-rated intensity in Step 6 (%) |

##### Entity: ThoughtRecordDistortion

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| thought_record_id | TEXT (UUID) | Required, references ThoughtRecord.id | None | Parent thought record |
| distortion_type | TEXT | Required, one of 15 allowed types | None | Cognitive distortion identifier |

**Indexes:**
- `entry_id` on ThoughtRecord - Find thought record for an entry
- `thought_record_id` on ThoughtRecordEmotion - Emotions for a record
- `thought_record_id` on ThoughtRecordDistortion - Distortions for a record
- `distortion_type` on ThoughtRecordDistortion - Frequency analysis across records

**Allowed Distortion Types:**

```
all_or_nothing, overgeneralization, mental_filter, disqualifying_positive,
mind_reading, fortune_telling, magnification, minimization,
emotional_reasoning, should_statements, labeling, personalization,
blame, always_being_right, fallacy_of_fairness
```

#### 3.7 Business Logic Rules

##### Thought Record Completion

**Purpose:** Track progress through the 6-step wizard

**Logic:**

```
1. Each step validates its inputs before advancing:
   - Step 1: situation must have at least 1 character
   - Step 2: automatic_thought must have at least 1 character
   - Step 3: at least 1 emotion must be selected with intensity > 0
   - Step 4: at least 1 distortion must be selected
   - Step 5: rational_response must have at least 1 character
   - Step 6: at least 1 emotion re-rated and thought_belief_after set
2. On each "Next": update current_step, save data to ThoughtRecord
3. On "Save & Close": save current state, set status = 'draft'
4. On Step 6 "Done": set status = 'complete'
5. Drafts can be resumed from the last completed step
```

##### Distortion Frequency Analysis

**Purpose:** Calculate which cognitive distortions appear most frequently across all thought records

**Logic:**

```
SELECT distortion_type, COUNT(*) as frequency
FROM jr_thought_record_distortions trd
JOIN jr_thought_records tr ON tr.id = trd.thought_record_id
WHERE tr.status = 'complete'
GROUP BY distortion_type
ORDER BY frequency DESC
```

This feeds into Mood Analytics (JR-019) to show the user their most common thinking errors.

##### Emotional Impact Score

**Purpose:** Measure how much a thought record reduced emotional intensity

**Logic:**

```
FOR EACH emotion in ThoughtRecordEmotion:
  reduction = intensity_before - intensity_after
  reduction_pct = (reduction / intensity_before) * 100

Average reduction across all emotions = overall emotional impact score
Positive score = thought record helped
Zero or negative = thought record did not reduce intensity
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Step validation fails | Inline error on the field: "Please describe the situation" (or similar) | User fills required field |
| Draft save fails | Toast: "Could not save draft. Retrying..." with auto-retry | Auto-retry 3 times. If all fail, keep data in memory |
| Thought record data corrupted | "This thought record could not be loaded." with option to delete | User deletes corrupted record |
| Distortion list fails to load | Show 15 distortions as hardcoded fallback (they are static content) | Automatic fallback |
| Emotion intensity slider unresponsive | User can type the percentage value directly in a text field alternative | Alternative input method |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user starts a new thought record from an entry,
   **When** the wizard opens,
   **Then** Step 1 (Situation) is displayed with a text area, date/time, and step indicator showing 1 of 6.

2. **Given** the user completes all 6 steps,
   **When** they tap "Done" on Step 6,
   **Then** the thought record is marked complete, the entry shows a "Complete thought record" badge, and the summary card appears in the entry view.

3. **Given** the user has completed 10 thought records,
   **When** distortion frequency is analyzed,
   **Then** the most common distortion types are ranked by frequency (e.g., "All-or-Nothing Thinking: 7 times").

4. **Given** the user rated anxiety at 85% in Step 3 and 35% in Step 6,
   **When** the summary view shows the comparison,
   **Then** a visual bar shows the 50-point reduction with color coding (red to green).

**Edge Cases:**

5. **Given** the user taps "Save & Close" at Step 3,
   **When** the draft is saved,
   **Then** the entry shows "Draft thought record" badge, and reopening the record resumes at Step 4.

6. **Given** the user selects 5 emotions in Step 3,
   **When** they reach Step 6,
   **Then** all 5 emotions appear for re-rating.

**Negative Tests:**

7. **Given** the user tries to advance from Step 1 with an empty situation field,
   **When** they tap "Next",
   **Then** inline validation shows "Please describe the situation."

8. **Given** the user tries to advance from Step 4 with no distortions selected,
   **When** they tap "Next",
   **Then** inline validation shows "Select at least one cognitive distortion."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| validates situation not empty | situation: "" | validation error |
| validates at least 1 emotion selected | emotions: [] | validation error |
| validates at least 1 distortion selected | distortions: [] | validation error |
| calculates emotional impact score | before: [80, 60], after: [30, 40] | avg reduction = 35 (50 + 20) / 2 |
| draft saves at correct step | save at step 3 | current_step = 3, status = 'draft' |
| complete sets status | finish step 6 | status = 'complete' |
| distortion frequency count | 10 records, 7 have "all_or_nothing" | frequency: all_or_nothing = 7 |
| belief reduction comparison | before: 90, after: 40 | reduction = 50, reduction_pct = 55.6% |
| handles 0 intensity_before | before: 0, after: 0 | reduction = 0, no division by zero |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete thought record | 1. Start record on entry, 2. Complete all 6 steps | ThoughtRecord status = 'complete', emotions and distortions saved |
| Resume draft | 1. Start record, complete steps 1-3, 2. Save & Close, 3. Reopen | Wizard opens at step 4 with steps 1-3 data preserved |
| Distortion analysis | 1. Create 5 complete records with various distortions, 2. View analysis | Distortion frequency list ranked correctly |
| Delete draft | 1. Create draft record, 2. Delete from entry | ThoughtRecord and child records deleted |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| CBT session workflow | 1. Create entry, 2. Start thought record, 3. Work through all 6 steps (situation about work stress, automatic thought "I will fail", anxious at 85%, all-or-nothing distortion, rational response with evidence, anxiety reduced to 40%), 4. Save | Complete thought record attached to entry, summary card shows before/after comparison, distortion logged for frequency tracking |

---

### JR-016: Gratitude Journaling

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-016 |
| **Feature Name** | Gratitude Journaling |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a gratitude practitioner, I want a dedicated "3 Things" gratitude template that prompts me to list three things I am grateful for each day, so that I can maintain a structured gratitude practice.

**Secondary:**
> As a daily journaler, I want to track my gratitude streak separately from my general journaling streak, so that I can measure my consistency in gratitude-specific practice.

**Tertiary:**
> As a reflective thinker, I want to review past gratitude entries and see recurring themes in what I appreciate, so that I can identify consistent sources of joy and meaning.

#### 3.3 Detailed Description

Gratitude Journaling provides a structured mode for recording daily gratitude. The core template is "3 Things I'm Grateful For Today" with three numbered text fields plus an optional free-text "Why?" expansion for each item. Users can also choose a "5 Things" variant or free-form gratitude writing.

Gratitude entries are tagged automatically with a "gratitude" system tag and stored in the user's designated gratitude journal (or default journal if no dedicated gratitude journal is set). A separate gratitude streak tracks consecutive days with at least one gratitude entry, independent of the general journaling streak (JR-009).

A "Gratitude Review" section on the analytics screen shows: total gratitude entries, gratitude streak, most-mentioned gratitude themes (derived from keyword frequency analysis on gratitude entries), and a word cloud of gratitude items.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Content creation
- JR-002: Daily Journaling with Prompts - Template-based entry creation

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entry editor and tag system are functional

#### 3.5 User Interface Requirements

##### Screen: Gratitude Entry

**Layout:**
- Top bar: "Gratitude" title with a heart icon, date
- Mode selector: "3 Things" (default), "5 Things", "Free Write"
- For structured mode (3 or 5 Things):
  - Numbered fields (1., 2., 3. / or 1.-5.) each with a text input (max 200 chars)
  - Below each field: expandable "Why?" section (tap to reveal a multiline text area, max 500 chars)
  - Below all fields: optional free-text area "Anything else you're grateful for?" (max 2,000 chars)
- For free write mode: standard entry editor (JR-001) with a gratitude-themed header
- Footer: "Save" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No items filled in | Numbered fields with placeholders: "I'm grateful for..." |
| Partial | 1-2 items filled | Filled items have checkmarks, remaining are empty |
| Complete | All items filled | All items have checkmarks, "Save" button highlighted |
| Today Done | Gratitude entry already exists for today | "Today's gratitude" summary shown, "Edit" and "Add Another" options |

**Interactions:**
- Type in numbered field: item text saved on blur
- Tap "Why?" below a field: expands a detail area for elaboration
- Tap "Save": creates entry with structured gratitude content, auto-tags with "gratitude"
- Tap "Add Another": starts a second gratitude entry for today

#### 3.6 Data Requirements

**Additions to Entry entity (from JR-001):**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| entry_type | TEXT | One of: 'standard', 'gratitude', 'thought_record' | 'standard' | Type of entry for template differentiation |

##### Entity: GratitudeItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| entry_id | TEXT (UUID) | Required, references Entry.id | None | Parent entry |
| item_number | INTEGER | Required, range 1-5 | None | Position in the list |
| item_text | TEXT | Required, max 200 chars | None | The gratitude item |
| why_text | TEXT | Nullable, max 500 chars | null | Elaboration on why grateful |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `entry_id` on GratitudeItem - Items for an entry
- `(entry_id, item_number)` - Ordered item list

#### 3.7 Business Logic Rules

##### Gratitude Streak Calculation

**Purpose:** Track consecutive days with at least one gratitude entry

**Logic:**

```
Same algorithm as JR-009 Streak Calculation, but filtered to:
SELECT DISTINCT entry_date FROM jr_entries WHERE entry_type = 'gratitude'
```

The gratitude streak is stored separately from the general streak and displayed on the gratitude screen and analytics.

##### Gratitude Theme Extraction

**Purpose:** Identify recurring themes in gratitude items

**Logic:**

```
1. Collect all item_text from GratitudeItem records
2. Tokenize and normalize (lowercase, remove stopwords)
3. Count word frequencies
4. Return top 20 words as "gratitude themes"
5. Display as a word cloud on the analytics screen
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Gratitude item text empty on save | Inline validation: "Write at least one thing you're grateful for" | User fills in at least 1 item |
| Structured data save fails | Toast: "Could not save. Retrying..." | Auto-retry, content preserved in memory |
| Theme extraction slow | Show cached themes, compute in background | Background refresh |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens a new gratitude entry in "3 Things" mode,
   **When** they fill in 3 items and tap "Save",
   **Then** an entry is created with entry_type = 'gratitude', auto-tagged "gratitude", and 3 GratitudeItem records stored.

2. **Given** the user has logged gratitude entries on 5 consecutive days,
   **When** the gratitude screen loads,
   **Then** the gratitude streak shows "5" with a heart icon.

3. **Given** the user has 30 gratitude entries mentioning "family" frequently,
   **When** the theme analysis runs,
   **Then** "family" appears prominently in the gratitude word cloud.

**Edge Cases:**

4. **Given** the user fills in only 1 of 3 items,
   **When** they tap "Save",
   **Then** the entry saves successfully (not all items are required, only at least 1).

**Negative Tests:**

5. **Given** the user taps "Save" with all fields empty,
   **When** validation runs,
   **Then** inline error: "Write at least one thing you're grateful for."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates gratitude entry with items | 3 items filled | entry_type = 'gratitude', 3 GratitudeItem records |
| auto-tags with gratitude | save gratitude entry | tag "gratitude" applied |
| calculates gratitude streak | 5 consecutive days with gratitude entries | gratitude_streak = 5 |
| extracts top themes | 50 items mentioning "family" 20 times | "family" in top themes |
| allows partial items | only item 1 filled | saves successfully, 1 GratitudeItem record |
| rejects all-empty save | 0 items filled | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Gratitude entry lifecycle | 1. Open gratitude mode, 2. Fill 3 items with "Why?", 3. Save, 4. Reopen | 3 items displayed with elaborations |
| Gratitude streak tracking | 1. Log gratitude 3 consecutive days, 2. Check streak | Gratitude streak = 3 |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| 30-day gratitude challenge | 1. Log "3 Things" daily for 30 days, 2. View analytics | Gratitude streak = 30, theme word cloud populated, 90 GratitudeItems stored |

---

### JR-017: Templates

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-017 |
| **Feature Name** | Templates |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an organized journaler, I want to create reusable entry templates with pre-filled structure and headings, so that I can quickly start entries in formats I use repeatedly.

**Secondary:**
> As a therapeutic writer, I want built-in templates for common journaling formats (morning pages, evening reflection, weekly review, therapy prep), so that I have structure without creating templates from scratch.

**Tertiary:**
> As a daily journaler, I want to assign a default template to a journal, so that every new entry in that journal starts with my preferred structure.

#### 3.3 Detailed Description

Templates provide reusable entry structures that pre-fill the editor with headings, sections, and placeholder text. The system ships with 10 built-in templates covering common journaling formats. Users can create custom templates from scratch or by saving any existing entry as a template.

Built-in templates:
1. Morning Pages (free-write prompt with date header)
2. Evening Reflection (What went well? What could improve? What did I learn?)
3. Weekly Review (Goals accomplished, challenges, next week priorities)
4. Gratitude Journal (3 Things template, same structure as JR-016 but as a generic template)
5. Mood Check-In (How am I feeling? What is contributing to this? What do I need?)
6. Dream Journal (Dream description, emotions, symbols, interpretation)
7. Travel Journal (Location, highlights, photos, food, reflections)
8. Book Reflection (Title, author, key quotes, my thoughts, rating)
9. Therapy Prep (Topics to discuss, wins since last session, challenges, questions for therapist)
10. Goal Setting (Goal description, why important, action steps, timeline, obstacles)

Templates can be assigned as the default for a specific journal, so every new entry in that journal starts with the template structure. Templates can also be selected manually when creating any new entry.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Templates populate the editor

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entry editor supports pre-filled content

#### 3.5 User Interface Requirements

##### Screen: Template Library

**Layout:**
- Top navigation bar: "Templates" title, "+" button to create new template
- Section: "Built-in Templates" (10 templates, non-deletable)
- Section: "My Templates" (user-created, editable and deletable)
- Each template card shows: name, preview of first 2 lines, and "Use" button
- Search bar at top to filter templates by name

**Interactions:**
- Tap "Use": creates a new entry pre-filled with the template content in the selected journal
- Long press template card: context menu with "Edit" (custom only), "Duplicate", "Set as Journal Default", "Delete" (custom only)
- Tap "+": opens template editor (same as entry editor, but saves as a template instead of an entry)

##### Modal: Template Selector (New Entry)

**Layout:**
- Shown when user taps "New Entry" (optional, configurable: always show, or only show if journal has a default template)
- Grid or list of templates with "Blank Entry" as the first option
- Quick-use: most recently used template highlighted

#### 3.6 Data Requirements

##### Entity: Template

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| name | TEXT | Required, max 100 chars | None | Template name |
| content | TEXT | Required, max 50,000 chars | None | Template content in Markdown |
| is_builtin | INTEGER | 0 or 1 | 0 | Whether this is a system-provided template |
| usage_count | INTEGER | Min 0 | 0 | How many times this template has been used |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Additions to Journal entity (from JR-003):**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| default_template_id | TEXT (UUID) | Nullable, references Template.id | null | Default template for new entries in this journal |

**Indexes:**
- `is_builtin` on Template - Separate built-in from custom
- `usage_count` on Template - Sort by most used

#### 3.7 Business Logic Rules

##### Template Application

**Purpose:** Pre-fill a new entry with template content

**Logic:**

```
1. When user creates a new entry:
   a. IF journal has default_template_id AND user has not chosen a different template:
      Load template content and pre-fill entry editor
   b. ELSE IF user selected a template from the selector:
      Load selected template content and pre-fill entry editor
   c. ELSE:
      Open blank entry
2. Increment template.usage_count
3. Entry is independent of template after creation (editing entry does not affect template)
```

**Edge Cases:**
- Template references in content (e.g., "[your name]" placeholders): treated as literal text, user replaces manually
- Template deleted after entries created from it: entries are unaffected (content was copied, not linked)
- Journal default template deleted: journal.default_template_id set to null

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Template content empty | Inline validation: "Template must have content" | User adds content |
| Template name duplicate | Inline validation: "A template with this name already exists" | User changes name |
| Default template missing | New entries open blank (fallback) | Automatic fallback |
| Built-in template corrupted | Re-seed from hardcoded template data | Automatic on next launch |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the Template Library,
   **When** the screen loads,
   **Then** 10 built-in templates are shown in the "Built-in" section.

2. **Given** the user taps "Use" on the "Evening Reflection" template,
   **When** the entry editor opens,
   **Then** the editor is pre-filled with the template headings and placeholder text.

3. **Given** the user creates a custom template and assigns it as default for "Work" journal,
   **When** they create a new entry in "Work" journal,
   **Then** the editor opens pre-filled with the custom template content.

**Edge Cases:**

4. **Given** a journal's default template is deleted,
   **When** a new entry is created in that journal,
   **Then** the entry opens blank (graceful fallback).

**Negative Tests:**

5. **Given** the user tries to delete a built-in template,
   **When** the delete action is attempted,
   **Then** the system blocks it: "Built-in templates cannot be deleted."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| pre-fills editor with template content | template.content = "# Evening\n..." | editor content matches template |
| increments usage_count | use template | usage_count += 1 |
| blocks built-in deletion | delete built-in template | rejection: cannot delete |
| allows custom deletion | delete custom template | template deleted |
| clears default_template_id when template deleted | delete template that is journal default | journal.default_template_id = null |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create custom template | 1. Tap "+", 2. Write content, 3. Save | Template appears in "My Templates" |
| Save entry as template | 1. Open existing entry, 2. "Save as Template" | New template created with entry content |
| Journal default template | 1. Set template as default for journal, 2. Create entry in journal | Entry pre-filled with template |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Template-driven workflow | 1. Create "Daily Review" custom template, 2. Set as default for "Personal" journal, 3. Create 5 entries in "Personal" | All 5 entries start with template structure, template usage_count = 5 |

---

### JR-018: Automatic Metadata (Location, Weather)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-018 |
| **Feature Name** | Automatic Metadata (Location, Weather) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a travel journaler, I want my journal entries to automatically capture my current location and weather conditions, so that I have rich context about when and where I was writing.

**Secondary:**
> As a daily journaler, I want location and weather metadata to be optional and configurable, so that I can disable it if I prefer not to share location data even locally.

**Tertiary:**
> As a privacy-conscious writer, I want metadata capture to work entirely on-device (no location data transmitted to external services except an optional weather API call), so that my location history stays private.

#### 3.3 Detailed Description

Automatic Metadata captures contextual information at the time of entry creation: geographic coordinates (latitude/longitude), reverse-geocoded place name (city, state/province, country), current weather conditions (temperature, description, icon), and the device's current time zone. All metadata is optional and independently toggleable in settings.

Location is captured using the device's location services (GPS on mobile, browser geolocation API on web). Reverse geocoding converts coordinates to a human-readable place name using on-device geocoding where available, or a privacy-respecting API as a fallback.

Weather data is fetched from a free, open weather API (e.g., Open-Meteo, which requires no API key and does not track users). The request sends only latitude and longitude (no user identifiers). Weather is fetched once on entry creation and stored; it is not updated retroactively.

Location coordinates are stored locally and never transmitted beyond the optional weather API call. If the user disables weather but enables location, no network requests are made.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Metadata attached to entries

**External Dependencies:**
- Device location services (GPS/network)
- Weather API (Open-Meteo or similar, optional)
- Location permission (user-granted)

**Assumed Capabilities:**
- Device has location hardware
- Network access for weather (optional)

#### 3.5 User Interface Requirements

##### Component: Metadata Bar (Entry Editor)

**Layout:**
- Positioned below the mood selector and above the content area
- Compact single row showing: location pin icon + place name, weather icon + temperature
- Tap to expand: shows full details (coordinates, timezone, weather description)
- "x" button on each metadata item to remove it from this entry

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Capturing | Metadata being fetched | Skeleton placeholders with subtle pulse animation |
| Complete | All metadata captured | Location and weather displayed in compact row |
| Partial | Location captured but weather failed (or vice versa) | Available metadata shown, failed item omitted |
| Disabled | User has disabled metadata in settings | No metadata bar visible |
| Permission Denied | Location permission not granted | No location shown. "Enable location in Settings" link if user taps the area |

**Interactions:**
- Tap metadata bar: expand to show full details
- Tap "x" on location: remove location from this entry (does not disable for future entries)
- Tap "x" on weather: remove weather from this entry

##### Screen: Entry Reading View (Metadata Section)

**Layout:**
- Below the entry content: metadata card showing location (pin icon + place name), weather (icon + temperature + description), and timezone
- Tap location: opens a map preview showing the entry's location (using a static map image or embedded map)

#### 3.6 Data Requirements

**Additions to Entry entity (from JR-001):**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| latitude | REAL | Nullable, range -90 to 90 | null | GPS latitude |
| longitude | REAL | Nullable, range -180 to 180 | null | GPS longitude |
| place_name | TEXT | Nullable, max 200 chars | null | Reverse-geocoded location name |
| timezone | TEXT | Nullable, IANA timezone ID | null | Device timezone at entry creation |
| weather_temp_c | REAL | Nullable | null | Temperature in Celsius |
| weather_description | TEXT | Nullable, max 100 chars | null | Weather description (e.g., "Partly Cloudy") |
| weather_icon | TEXT | Nullable | null | Weather icon identifier |

**Indexes:**
- `(latitude, longitude)` - Location-based queries (future map view)

#### 3.7 Business Logic Rules

##### Metadata Capture Pipeline

**Purpose:** Capture location and weather when a new entry is created

**Logic:**

```
1. On new entry creation (if metadata enabled):
   a. Request current location from device:
      - Accuracy: "balanced" (city-level, not GPS-precise, to conserve battery)
      - Timeout: 5 seconds
   b. IF location received:
      - Store latitude, longitude
      - Reverse geocode to place_name (on-device first, API fallback)
      - Store timezone from device
   c. IF weather enabled AND location received:
      - Fetch weather from Open-Meteo API:
        GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true
      - Parse response: temperature, weather_description, weather_icon
      - Store weather data on entry
   d. IF location fails: skip location and weather, no error shown
2. All metadata capture is non-blocking (entry editor opens immediately, metadata populates asynchronously)
```

**Edge Cases:**
- Location permission not yet requested: prompt user on first entry creation with metadata enabled
- Location timeout: skip silently, entry created without location
- Weather API down: skip weather, location still captured
- Airplane mode: skip both, no error shown
- User edits entry later from a different location: original metadata preserved (not overwritten)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Location permission denied | No location metadata captured, no error | User can enable in device settings |
| Location timeout (5 seconds) | Metadata bar shows "Location unavailable" then hides | Entry saved without location |
| Weather API error | Location captured but no weather | Entry has location but no weather data |
| Network unavailable | Location captured (GPS works offline), no weather | Weather omitted |
| Invalid coordinates from device | Coordinates discarded | Entry saved without location |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has location and weather enabled in settings,
   **When** they create a new entry,
   **Then** the metadata bar shows their current city and current weather within 5 seconds of entry creation.

2. **Given** an entry has location metadata,
   **When** the user views the entry in reading mode,
   **Then** the metadata section shows "San Francisco, CA" with a map pin and "18C Partly Cloudy" with a weather icon.

3. **Given** the user disables location metadata in settings,
   **When** they create a new entry,
   **Then** no location or weather data is captured and the metadata bar is not visible.

**Edge Cases:**

4. **Given** the user is in airplane mode,
   **When** they create a new entry with metadata enabled,
   **Then** GPS location is captured but weather is omitted (no error shown).

**Negative Tests:**

5. **Given** location permission has been denied at the system level,
   **When** the user creates a new entry,
   **Then** no location data is captured, and the metadata bar does not appear.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| stores latitude and longitude | coords: (37.7749, -122.4194) | entry.latitude = 37.7749, entry.longitude = -122.4194 |
| reverse geocodes to place name | coords: (37.7749, -122.4194) | place_name = "San Francisco, CA, US" |
| parses weather API response | valid API JSON | temp, description, icon extracted |
| handles location timeout | timeout after 5s | location fields remain null |
| handles weather API error | HTTP 500 | weather fields remain null, location preserved |
| validates coordinate range | latitude: 95 | rejection: invalid coordinates |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full metadata capture | 1. Enable location + weather, 2. Create entry | Entry has location, weather, and timezone |
| Location only (no weather) | 1. Enable location, disable weather, 2. Create entry | Entry has location and timezone, no weather |
| Metadata disabled | 1. Disable all metadata, 2. Create entry | Entry has no metadata fields populated |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Travel journal with metadata | 1. Enable metadata, 2. Create entries in 3 cities, 3. View entries | Each entry shows different city and weather, metadata preserved on re-read |

---

### JR-019: Mood Analytics and Correlation

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-019 |
| **Feature Name** | Mood Analytics and Correlation |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a therapeutic writer, I want to see my mood trends over weeks and months as a line chart, so that I can observe long-term emotional patterns.

**Secondary:**
> As someone in therapy, I want to see which tags, journals, and writing times correlate with better or worse moods, so that I can share actionable insights with my therapist.

**Tertiary:**
> As a mood-tracking user, I want a monthly mood summary with average mood, best day, worst day, and most common emotions, so that I can reflect on my emotional month.

#### 3.3 Detailed Description

Mood Analytics and Correlation provides comprehensive mood trend analysis and cross-referencing with other journal data. The feature builds on Mood Tagging (JR-005) and Writing Analytics (JR-014) to surface insights about emotional patterns.

Key analytics:
- **Mood Trend Line**: daily, weekly, or monthly average mood over time as a line chart
- **Mood Distribution**: pie or bar chart showing percentage breakdown by mood level
- **Emotion Frequency**: ranked list of most-used specific emotions (from mood refinements)
- **Tag-Mood Correlation**: which tags are associated with higher/lower moods (e.g., entries tagged "exercise" have avg mood 4.2 vs. overall avg 3.5)
- **Time-Mood Correlation**: mood patterns by hour of day and day of week
- **Journal-Mood Correlation**: average mood per journal
- **CBT Distortion Frequency**: most common cognitive distortions from thought records (JR-015), ranked by frequency
- **Monthly Summary Card**: auto-generated summary of the month's mood data with highlights

All analytics are computed locally from on-device data. No mood or emotional data is ever transmitted.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-005: Mood Tagging - Mood data source
- JR-014: Writing Analytics - Shared analytics infrastructure

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entries exist with mood_level and mood_emotion populated

#### 3.5 User Interface Requirements

##### Screen: Mood Analytics

**Layout:**
- Top navigation bar: "Mood Insights" title
- Time period selector: "Week", "Month", "3 Months", "Year", "All Time"
- Scrollable card sections:

**Section 1: Mood Trend Line**
- Line chart with mood level (1-5) on Y-axis, time on X-axis
- Data points plotted as dots with connecting lines
- Average mood line (dashed horizontal)
- Trend arrow: up/down with direction compared to previous period

**Section 2: Mood Distribution**
- Horizontal bar chart showing percentage for each mood level (1-5)
- Each bar colored with the corresponding mood emoji color

**Section 3: Top Emotions**
- Ranked list of the 10 most-used specific emotions with count and bar width
- e.g., "grateful (23 times)", "anxious (18 times)"

**Section 4: Correlations**
- "Tags That Lift Your Mood" subsection: tags associated with above-average mood, sorted by positive delta
- "Tags That Lower Your Mood" subsection: tags associated with below-average mood
- "Best Day for Your Mood" and "Worst Day" with day-of-week labels
- "Best Time for Your Mood" with hour label

**Section 5: CBT Summary (if thought records exist)**
- "Most Common Distortions" ranked list (from JR-015 data)
- "Average Emotional Impact" (average intensity reduction across thought records)

**Section 6: Monthly Summary Card**
- Card with month name, average mood, emoji representing overall mood
- Best day: date + mood level
- Worst day: date + mood level
- Top emotion: most frequent specific emotion
- Entries with mood: count

**Interactions:**
- Tap time period selector: reloads all analytics for the selected period
- Tap a data point on the trend line: shows popover with date, mood level, and emotion
- Tap a correlation tag: navigates to entries filtered by that tag
- Tap Monthly Summary "View Details": navigates to that month's entries

#### 3.6 Data Requirements

**No new entities required.** All analytics are computed from existing Entry (mood_level, mood_emotion), EntryTag, ThoughtRecord, and ThoughtRecordDistortion data.

**Key Queries:**

Tag-Mood Correlation:
```sql
SELECT t.name, AVG(e.mood_level) as avg_mood, COUNT(*) as entry_count
FROM jr_entry_tags et
JOIN jr_tags t ON t.id = et.tag_id
JOIN jr_entries e ON e.id = et.entry_id
WHERE e.mood_level IS NOT NULL
AND e.entry_date BETWEEN ? AND ?
GROUP BY t.name
HAVING entry_count >= 3
ORDER BY avg_mood DESC
```

Time-Mood Correlation:
```sql
SELECT CAST(strftime('%H', created_at) AS INTEGER) as hour,
       AVG(mood_level) as avg_mood
FROM jr_entries
WHERE mood_level IS NOT NULL
GROUP BY hour
```

#### 3.7 Business Logic Rules

##### Tag-Mood Correlation

**Purpose:** Identify tags that correlate with higher or lower moods

**Logic:**

```
1. Calculate overall_avg_mood = AVG(mood_level) across all mood-tagged entries in period
2. FOR EACH tag with >= 3 mood-tagged entries:
   tag_avg_mood = AVG(mood_level) for entries with this tag
   delta = tag_avg_mood - overall_avg_mood
3. Sort tags by delta:
   - Positive delta = "Tags That Lift Your Mood"
   - Negative delta = "Tags That Lower Your Mood"
4. Require minimum 3 entries to avoid spurious correlations
```

##### Monthly Summary Generation

**Purpose:** Auto-generate a month-end mood summary

**Logic:**

```
1. On the first day of each month (or on-demand):
   a. Query all mood-tagged entries from the previous month
   b. Calculate: avg_mood, best_day (max avg_mood for a single day), worst_day (min avg_mood)
   c. Count emotion frequencies, identify top emotion
   d. Generate summary card data
2. Store summary in memory/cache (not a separate entity)
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No mood data in period | "No mood data for this period. Tag entries with moods to see insights." | User starts mood-tagging |
| Insufficient data for correlations | "Not enough data for tag correlations (need 3+ mood-tagged entries per tag)" | User continues journaling |
| Chart rendering error | Fallback to numeric table display | Data still accessible in table format |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 30 mood-tagged entries over the past month,
   **When** they open Mood Analytics,
   **Then** a trend line shows daily mood values, distribution shows percentage breakdown, and top emotions are ranked.

2. **Given** entries tagged "exercise" have an average mood of 4.5 and overall average is 3.5,
   **When** the correlation section loads,
   **Then** "exercise" appears in "Tags That Lift Your Mood" with a +1.0 delta indicator.

3. **Given** 10 completed thought records exist,
   **When** the CBT summary section loads,
   **Then** cognitive distortions are ranked by frequency with counts.

**Edge Cases:**

4. **Given** only 2 entries are tagged with "travel" (below minimum 3),
   **When** correlations are computed,
   **Then** "travel" is excluded from the correlation list.

**Negative Tests:**

5. **Given** no entries have mood_level set,
   **When** the user opens Mood Analytics,
   **Then** all sections show "No mood data" messages with guidance to start mood-tagging.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates tag-mood correlation | tag "exercise" avg 4.5, overall avg 3.5 | delta = +1.0 |
| excludes tags with < 3 entries | tag with 2 mood-tagged entries | excluded from results |
| ranks emotions by frequency | grateful(10), anxious(8), calm(5) | [grateful, anxious, calm] |
| calculates monthly summary | 30 entries, moods 1-5 | avg, best day, worst day, top emotion |
| handles zero mood entries | no mood data | null/empty results, no errors |
| time-mood correlation | entries at 7AM avg 4.2, 10PM avg 2.8 | best_hour = 7, worst_hour = 22 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full mood analytics flow | 1. Create 20 mood-tagged entries with tags, 2. Open Mood Analytics | Trend line, distribution, correlations all populated |
| CBT integration | 1. Create 5 thought records, 2. Open Mood Analytics | CBT distortion frequency section visible |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Monthly mood review | 1. Journal with moods for 30 days, 2. Tag entries with various tags, 3. Complete 3 thought records, 4. View analytics | Trend line, correlations, emotion rankings, CBT summary, monthly card all accurate |

---

### JR-020: Grid/Mandala Layout

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-020 |
| **Feature Name** | Grid/Mandala Layout |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a journaler who struggles with blank-page anxiety, I want a grid layout that divides my entry into smaller, focused cells with individual prompts, so that I can write in manageable chunks instead of facing an empty page.

**Secondary:**
> As a daily journaler, I want to create custom grid layouts with my own prompts, so that I can design a daily reflection grid that matches my personal practice.

**Tertiary:**
> As a reflective thinker, I want to review past grid entries in their original layout, so that I can see how my responses to the same prompts evolve over time.

#### 3.3 Detailed Description

Grid/Mandala Layout provides an alternative entry format inspired by Grid Diary ($23/yr). Instead of a single free-text area, the entry is divided into a grid of cells (2x2, 3x3, or custom), where each cell has its own prompt and response area. This reduces the intimidation of a blank page by breaking journaling into small, focused questions.

The system ships with 5 built-in grid layouts:
1. **Morning Check-In (2x2)**: How am I feeling? / What is my top priority today? / What am I grateful for? / What would make today great?
2. **Evening Reflection (2x2)**: What went well today? / What could I improve? / What did I learn? / How am I feeling now?
3. **Weekly Review (3x3)**: Accomplishments / Challenges / Lessons / Health & Energy / Relationships / Work & Career / Personal Growth / Fun & Recreation / Goals for Next Week
4. **Mindfulness Check (2x3)**: Body Scan / Current Emotion / Stressors / Coping Strategy / Gratitude / Intention
5. **Decision Matrix (2x2)**: Situation / Pros / Cons / Decision

Users can create custom grids by choosing a grid size (minimum 2x1, maximum 4x4 = 16 cells), naming each cell, and optionally adding prompt text. Custom grids are saved to the Template entity (JR-017) with a `layout_type` of `'grid'` and grid configuration stored as structured content.

Each cell has a maximum of 1,000 characters. The total entry content is assembled by concatenating all cells into a single Markdown document (each cell becomes a section with its prompt as a heading), enabling full-text search and export compatibility.

Grid entries are stored with `entry_type = 'grid'` and the structured cell data is stored in GratitudeItem-style child records (GridCell entity).

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Grid cells use the same text editing infrastructure
- JR-017: Templates - Grid layouts are stored as a template subtype

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entry editor and template system are functional

#### 3.5 User Interface Requirements

##### Screen: Grid Entry Editor

**Layout:**
- Top navigation bar: "Grid Entry" title with layout name (e.g., "Morning Check-In"), "Done" button (right)
- Below nav bar: grid layout selector dropdown showing the current layout name, tap to switch layouts
- Main content area: cells arranged in a grid based on the layout configuration (e.g., 2 columns x 2 rows)
- Each cell is a rounded card containing:
  - Cell header: prompt text in secondary color (e.g., "How am I feeling?"), max 1 line
  - Cell body: multiline text input, max 1,000 characters
  - Character count: subtle bottom-right counter (e.g., "142/1,000")
- Grid scrolls vertically if cells exceed screen height
- Footer: total word count (sum of all cells), save status indicator

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Grid | All cells blank | Each cell shows prompt text as placeholder |
| Partial | Some cells filled | Filled cells show content, unfilled show placeholder |
| Complete | All cells have content | All cells show content, subtle checkmark on each |
| Reviewing | Reading mode | Cells are read-only, content rendered with Markdown |

**Interactions:**
- Tap a cell: focuses the text input for that cell, keyboard appears
- Swipe between cells (mobile): tab-order navigation left-to-right, top-to-bottom
- Tap layout selector: shows bottom sheet with available grid layouts (built-in + custom)
- Tap "Done": saves grid entry, assembles Markdown content from cells
- Pinch-to-zoom (mobile): resize grid cells for better readability

**Transitions/Animations:**
- Cell focus: 150ms border highlight animation (accent color)
- Grid layout switch: 300ms crossfade to new grid arrangement

##### Screen: Grid Layout Builder

**Layout:**
- Top bar: "New Grid Layout" title, "Save" button
- Grid size selector: rows (1-4) and columns (1-4) steppers, live preview updates as values change
- Grid preview: shows the layout with editable prompt text in each cell
- Each cell in the preview has a text input for the cell prompt
- Layout name field: text input, max 50 characters
- Bottom: "Preview" button to test the layout with dummy text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Configuring | User is setting grid size | Stepper controls visible, grid preview updates live |
| Editing Prompts | User is typing cell prompts | Prompt inputs active in each cell |
| Invalid | No layout name or zero cells | "Save" button disabled with inline validation |

#### 3.6 Data Requirements

##### Entity: GridCell

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| entry_id | TEXT (UUID) | Required, references Entry.id | None | Parent entry |
| cell_row | INTEGER | Required, range 0-3 | None | Row position (0-indexed) |
| cell_col | INTEGER | Required, range 0-3 | None | Column position (0-indexed) |
| prompt | TEXT | Required, max 200 chars | None | Cell prompt/heading text |
| content | TEXT | Nullable, max 1,000 chars | null | User's response text |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Additions to Entry entity (from JR-001):**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| grid_rows | INTEGER | Nullable, range 1-4 | null | Grid row count (for grid entries only) |
| grid_cols | INTEGER | Nullable, range 1-4 | null | Grid column count (for grid entries only) |

**Additions to Template entity (from JR-017):**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| layout_type | TEXT | One of: 'standard', 'grid' | 'standard' | Template layout type |
| grid_config | TEXT | Nullable, JSON string | null | Grid configuration (rows, cols, cell prompts) |

**Indexes:**
- `entry_id` on GridCell - Cells for an entry
- `(entry_id, cell_row, cell_col)` - Unique cell position within an entry

**Validation Rules:**
- `cell_row` and `cell_col` must not exceed the grid dimensions defined on the parent entry
- `prompt` must not be empty
- Each (entry_id, cell_row, cell_col) combination must be unique
- Grid size minimum: 2 total cells (e.g., 2x1, 1x2). Maximum: 4x4 = 16 cells

**Example Data (grid_config JSON):**

```json
{
  "rows": 2,
  "cols": 2,
  "cells": [
    { "row": 0, "col": 0, "prompt": "How am I feeling?" },
    { "row": 0, "col": 1, "prompt": "What is my top priority today?" },
    { "row": 1, "col": 0, "prompt": "What am I grateful for?" },
    { "row": 1, "col": 1, "prompt": "What would make today great?" }
  ]
}
```

#### 3.7 Business Logic Rules

##### Grid Content Assembly

**Purpose:** Convert grid cell data into a unified Markdown entry for search and export

**Logic:**

```
1. FOR EACH cell in grid (ordered by row ASC, col ASC):
   a. Append "### {cell.prompt}\n\n" to Markdown output
   b. Append "{cell.content}\n\n" (or empty line if no content)
2. Store assembled Markdown in entry.content
3. Store stripped plain text in entry.content_plain
4. Calculate entry.word_count from content_plain
```

**Edge Cases:**
- Empty cells: included in Markdown as heading with no body text
- Cell content with Markdown formatting: preserved and rendered in reading mode
- Grid layout changed after creation: existing cell data is remapped if possible, orphaned cells are preserved in a "Previous Responses" section

##### Grid Template Instantiation

**Purpose:** Create a grid entry from a grid template

**Logic:**

```
1. Load template where layout_type = 'grid'
2. Parse grid_config JSON
3. Create new Entry with entry_type = 'grid', grid_rows, grid_cols
4. Create GridCell records for each cell in grid_config
5. Increment template.usage_count
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Cell content exceeds 1,000 characters | Character counter turns red, input blocked at limit | User shortens text |
| Grid layout corrupted (invalid grid_config JSON) | "This grid layout could not be loaded." with option to create new | User creates new grid layout |
| Cell save fails | Cell border turns red, "Could not save this cell. Retrying..." | Auto-retry 3 times, content preserved in memory |
| Grid size set to 1x1 | Inline validation: "Grid must have at least 2 cells" | User increases rows or columns |
| Custom grid layout name empty | "Save" disabled, inline message: "Give your grid layout a name" | User enters name |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a new grid entry using the "Morning Check-In" layout,
   **When** the grid editor opens,
   **Then** 4 cells are displayed in a 2x2 grid with the correct prompts, and each cell accepts text input.

2. **Given** the user fills in all 4 cells of a 2x2 grid and taps "Done",
   **When** the entry is saved,
   **Then** the entry.content contains Markdown with each prompt as an H3 heading followed by the response, and word_count reflects the total words across all cells.

3. **Given** the user creates a custom 3x3 grid layout with 9 prompts,
   **When** they save the layout and create an entry from it,
   **Then** the grid entry shows 9 cells arranged in 3 rows and 3 columns with the custom prompts.

4. **Given** a grid entry exists with responses,
   **When** the user views it in reading mode,
   **Then** all cells are displayed in their original grid layout with rendered content.

**Edge Cases:**

5. **Given** the user fills in only 2 of 4 cells in a grid,
   **When** they tap "Done",
   **Then** the entry saves successfully with empty cells included in the Markdown as headings with no body.

6. **Given** a grid entry is searched using full-text search (JR-010),
   **When** a search term matches content in any cell,
   **Then** the grid entry appears in search results (search operates on the assembled content_plain).

**Negative Tests:**

7. **Given** the user tries to create a grid layout with 1 row and 1 column,
   **When** they attempt to save,
   **Then** validation blocks with "Grid must have at least 2 cells."

8. **Given** the user types more than 1,000 characters in a single cell,
   **When** they reach the limit,
   **Then** further input is blocked and the character counter shows "1,000/1,000" in red.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| assembles grid to Markdown | 4 cells with content | Markdown with 4 H3 sections |
| assembles grid with empty cells | 2 of 4 cells filled | Markdown with 4 H3 sections, 2 with content, 2 empty |
| calculates word count from grid | cells: ["hello world", "foo bar baz"] | word_count = 5 |
| validates minimum grid size | rows=1, cols=1 | validation error: minimum 2 cells |
| validates maximum grid size | rows=5, cols=5 | validation error: maximum 4x4 |
| parses grid_config JSON | valid JSON string | GridConfig object with rows, cols, cells |
| rejects invalid grid_config | malformed JSON | parse error, grid not loaded |
| enforces cell character limit | 1,001 chars | truncated to 1,000 or blocked |
| ensures unique cell positions | duplicate (row=0, col=0) | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create grid entry from built-in layout | 1. Select "Morning Check-In" layout, 2. Fill cells, 3. Save | Entry saved with entry_type='grid', 4 GridCell records, assembled Markdown |
| Custom grid layout creation | 1. Open grid builder, 2. Set 3x2, 3. Name prompts, 4. Save layout | Template saved with layout_type='grid', grid_config populated |
| Grid entry in search | 1. Create grid entry with "vacation" in a cell, 2. Search for "vacation" | Grid entry appears in search results |
| Grid entry export | 1. Create grid entry, 2. Export as Markdown | Exported file contains grid prompts as headings |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Weekly review workflow | 1. Select "Weekly Review" 3x3 grid, 2. Fill all 9 cells with weekly reflections, 3. Save, 4. View in reading mode, 5. Search for a term from one cell | Grid entry saved with 9 cells, displayed in 3x3 layout, searchable via full-text search |

---

### JR-021: Affirmations Tracker

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-021 |
| **Feature Name** | Affirmations Tracker |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a gratitude practitioner, I want to see a daily affirmation on my journal home screen and track which affirmations resonate with me, so that I start each journaling session with a positive mindset.

**Secondary:**
> As a daily journaler, I want to create my own custom affirmations and schedule them to appear on specific days or rotate randomly, so that my affirmation practice is personalized.

**Tertiary:**
> As a therapeutic writer, I want to save affirmations that I find meaningful and revisit them later, so that I build a personal library of positive self-talk.

#### 3.3 Detailed Description

Affirmations Tracker displays a daily affirmation on the journal home screen and allows users to build a personal library of positive statements. The feature ships with a library of 100 built-in affirmations organized into 8 categories: Self-Worth (15), Resilience (12), Growth (12), Health (12), Relationships (12), Gratitude (12), Productivity (12), and Peace (13).

Each day, one affirmation is displayed prominently on the home screen. The selection algorithm cycles through the user's active affirmation pool in a pseudo-random order, ensuring no repetition until all affirmations in the pool have been shown. Users can "favorite" an affirmation to increase its frequency (favorites appear 2x as often), dismiss one to skip it permanently, or write a journal entry inspired by the affirmation with one tap.

Users create custom affirmations (max 200 characters each) that are added to their affirmation pool alongside the built-in ones. Custom affirmations can be edited, deleted, or categorized.

An affirmation streak tracks consecutive days where the user has viewed and acknowledged (tapped "I affirm" or wrote a journal entry from) the daily affirmation. The streak uses the same grace period logic as the general journaling streak (JR-009): 1-day grace period, calculated at midnight local time.

Analytics show: total affirmations viewed, total affirmed, favorite affirmations, most-used categories, and affirmation streak history.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Writing entries inspired by affirmations

**External Dependencies:**
- None

**Assumed Capabilities:**
- Home screen layout can display a card component
- Local time zone is available for daily rotation

#### 3.5 User Interface Requirements

##### Component: Daily Affirmation Card (Home Screen)

**Layout:**
- Prominent card at the top of the home screen (or configurable position)
- Card background: subtle gradient or accent-tinted background
- Affirmation text: centered, large font (20pt), medium weight, max 3 lines
- Below text: category label in secondary color (e.g., "Self-Worth")
- Action row at bottom of card:
  - "I Affirm" button (primary action, checkmark icon) - acknowledges the affirmation
  - Heart icon (toggle favorite)
  - "Write About This" button (pen icon) - opens a new entry with the affirmation as the first line
  - "Skip" (x icon) - dismisses this affirmation permanently
- Swipe left/right on card: browse to previous/next affirmation (does not change today's daily)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New | Daily affirmation not yet seen today | Card prominent with full styling, "I Affirm" button active |
| Affirmed | User tapped "I Affirm" today | Card shows checkmark overlay with "Affirmed" label, muted styling |
| Written | User wrote an entry from this affirmation | Card shows "Entry written" badge, link to the entry |
| Dismissed | User skipped this affirmation | Card shows next affirmation in pool |
| Empty Pool | All affirmations have been dismissed | Card shows "No affirmations available. Add custom affirmations or reset dismissed ones." |

**Interactions:**
- Tap "I Affirm": marks today's affirmation as acknowledged, updates streak, card transitions to Affirmed state
- Tap heart: toggles favorite status (filled/outlined heart)
- Tap "Write About This": opens new entry editor with affirmation text as the opening line
- Tap "Skip": removes affirmation from pool, loads next one
- Long press card: opens context menu with "View All Affirmations", "Settings"

##### Screen: Affirmation Library

**Layout:**
- Top bar: "Affirmations" title, "+" button (add custom), search bar
- Tab bar: "All", "Built-in", "Custom", "Favorites", "Dismissed"
- Scrollable list of affirmation cards, grouped by category
- Each card shows: affirmation text, category tag, favorite indicator, usage count
- Swipe right on card: favorite/unfavorite
- Swipe left on card: dismiss/restore

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Populated | Affirmations exist | List of affirmation cards grouped by category |
| Empty Custom | No custom affirmations created | "Custom" tab shows "Write your own affirmations" prompt with "+" button |
| Search Active | User typing in search bar | Filtered results matching affirmation text |
| No Results | Search yields no matches | "No affirmations match your search" |

#### 3.6 Data Requirements

##### Entity: Affirmation

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| text | TEXT | Required, max 200 chars | None | Affirmation text |
| category | TEXT | Required, one of 8 categories | None | Category for grouping |
| is_builtin | INTEGER | 0 or 1 | 0 | Whether this is a system-provided affirmation |
| is_favorite | INTEGER | 0 or 1 | 0 | User favorited this affirmation |
| is_dismissed | INTEGER | 0 or 1 | 0 | User permanently skipped this affirmation |
| times_shown | INTEGER | Min 0 | 0 | Number of times displayed as daily affirmation |
| times_affirmed | INTEGER | Min 0 | 0 | Number of times user tapped "I Affirm" |
| last_shown_date | TEXT | ISO date, nullable | null | Last date this was the daily affirmation |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Allowed Categories:**
```
self_worth, resilience, growth, health, relationships, gratitude, productivity, peace
```

##### Entity: AffirmationLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| affirmation_id | TEXT (UUID) | Required, references Affirmation.id | None | Which affirmation |
| log_date | TEXT | ISO date, required | Current date | Date of interaction |
| action | TEXT | Required, one of: 'shown', 'affirmed', 'wrote_entry', 'dismissed' | None | What the user did |
| entry_id | TEXT (UUID) | Nullable, references Entry.id | null | Linked entry (if user wrote about it) |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `is_dismissed` on Affirmation - Filter active affirmations
- `is_favorite` on Affirmation - Filter favorites
- `category` on Affirmation - Group by category
- `last_shown_date` on Affirmation - Daily selection algorithm
- `(log_date, action)` on AffirmationLog - Streak and analytics queries
- `affirmation_id` on AffirmationLog - History for a specific affirmation

**Validation Rules:**
- `text`: must not be empty after trimming, must not exceed 200 characters
- `category`: must be one of the 8 allowed values
- Built-in affirmations cannot be edited or deleted (is_builtin = 1)
- Dismissed affirmations are excluded from the daily rotation pool

#### 3.7 Business Logic Rules

##### Daily Affirmation Selection

**Purpose:** Select one affirmation to display each day

**Logic:**

```
1. Build the active pool: all affirmations WHERE is_dismissed = 0
2. Separate favorites (is_favorite = 1) and non-favorites
3. Selection algorithm (weighted rotation):
   a. Sort active pool by last_shown_date ASC NULLS FIRST (least recently shown first)
   b. Among ties, favorites get 2x weight (appear in the sorted list twice)
   c. Select the first item in the sorted list
   d. Update: last_shown_date = today, times_shown += 1
4. Cache today's selection so it remains stable throughout the day
5. Selection rotates at midnight local time
```

**Edge Cases:**
- First launch: all last_shown_date values are null, select randomly from the full pool
- All affirmations dismissed: show "No affirmations available" state
- Single affirmation in pool: show it every day
- Date change during active use: card refreshes automatically on date boundary

##### Affirmation Streak

**Purpose:** Track consecutive days the user has engaged with the daily affirmation

**Logic:**

```
1. A day counts as "affirmed" if AffirmationLog contains at least one record
   with action IN ('affirmed', 'wrote_entry') for that log_date
2. Streak calculation follows the same algorithm as JR-009:
   - Walk backward from today through consecutive affirmed dates
   - 1-day grace period: if yesterday was missed but the day before was affirmed,
     the streak is not broken until end of today
   - Calculate at midnight local time
3. Store current_streak and longest_streak in the affirmation settings
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Daily selection fails (database error) | Show last known affirmation from cache | Retry on next app launch |
| Custom affirmation text empty | Inline validation: "Write your affirmation" | User enters text |
| Custom affirmation exceeds 200 chars | Character counter turns red, input blocked | User shortens text |
| Affirmation log write fails | Affirmation still displayed, action not recorded | Silent retry, no user disruption |
| All affirmations dismissed | Card shows "No affirmations available" with "Reset Dismissed" button | User taps to restore all dismissed affirmations |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens the home screen on a new day,
   **When** the daily affirmation loads,
   **Then** a new affirmation (different from yesterday's) is displayed in the card with "I Affirm", heart, "Write About This", and "Skip" actions.

2. **Given** the user taps "I Affirm" on today's affirmation,
   **When** the action is recorded,
   **Then** the card transitions to "Affirmed" state, the affirmation streak increments by 1, and the AffirmationLog records action='affirmed'.

3. **Given** the user taps "Write About This",
   **When** the entry editor opens,
   **Then** the editor is pre-filled with the affirmation text as the first line, and saving the entry creates an AffirmationLog with action='wrote_entry' linked to the entry.

4. **Given** the user has 100 built-in affirmations and 5 custom affirmations in the pool,
   **When** 105 consecutive days pass (all shown once),
   **Then** the rotation restarts, and favorites appear approximately twice as often as non-favorites.

**Edge Cases:**

5. **Given** the user has dismissed all but 1 affirmation,
   **When** the daily affirmation loads,
   **Then** the remaining affirmation is shown every day.

6. **Given** the user favorited an affirmation that was shown yesterday,
   **When** today's selection runs,
   **Then** the favorited one is not immediately repeated (least-recently-shown logic still applies).

**Negative Tests:**

7. **Given** the user tries to create a custom affirmation with empty text,
   **When** they tap "Save",
   **Then** inline validation shows "Write your affirmation."

8. **Given** the user tries to delete a built-in affirmation,
   **When** the delete action is attempted,
   **Then** the system blocks it: "Built-in affirmations cannot be deleted. You can dismiss it instead."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| selects least-recently-shown affirmation | 5 affirmations, last_shown: [null, null, "2026-03-01", "2026-03-03", "2026-03-05"] | selects one of the two null entries |
| favorites get 2x weight | 1 favorite (shown 5 days ago), 1 non-fav (shown 5 days ago) | favorite appears with higher probability |
| excludes dismissed affirmations | 3 active, 2 dismissed | pool size = 3 |
| calculates affirmation streak | affirmed 7 consecutive days | streak = 7 |
| grace period applies | affirmed days 1-5, missed day 6, currently day 7 | streak = 5 (grace period active until end of day 7) |
| streak broken after grace | affirmed days 1-5, missed days 6-7, currently day 8 | streak = 0 |
| validates affirmation text length | 201 characters | validation error |
| validates empty text | "" (empty) | validation error |
| blocks built-in deletion | delete where is_builtin=1 | rejection |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Daily affirmation lifecycle | 1. View affirmation, 2. Tap "I Affirm", 3. Check streak | Log created, streak updated, card transitions to Affirmed |
| Write entry from affirmation | 1. View affirmation, 2. Tap "Write About This", 3. Write entry, 4. Save | Entry created with affirmation as first line, AffirmationLog has entry_id |
| Custom affirmation CRUD | 1. Create custom, 2. Edit text, 3. Favorite, 4. Delete | Custom affirmation created, updated, favorited, deleted |
| Dismiss and restore | 1. Dismiss affirmation, 2. Check pool, 3. Restore from Dismissed tab | Excluded from pool, then re-included |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| 30-day affirmation practice | 1. View and affirm daily for 30 days, 2. Write entries from 5 affirmations, 3. Favorite 10, 4. Dismiss 3, 5. View analytics | Streak = 30, 30 affirmed logs, 5 wrote_entry logs, favorites appear more often in rotation, dismissed excluded from pool |

---

### JR-022: Philosophy/Stoic Prompts

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-022 |
| **Feature Name** | Philosophy/Stoic Prompts |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a reflective thinker, I want a daily Stoic or philosophical quote with a reflection prompt, so that I can engage with timeless wisdom as part of my journaling practice.

**Secondary:**
> As a daily journaler, I want to write a journal entry responding to a philosophical prompt, so that my daily writing has a meaningful starting point.

**Tertiary:**
> As a therapeutic writer, I want to explore different philosophical traditions (Stoicism, Buddhism, Existentialism, Pragmatism), so that my reflections draw from diverse perspectives.

#### 3.3 Detailed Description

Philosophy/Stoic Prompts provides a daily philosophical quote paired with a reflection question, inspired by the Stoic app ($40/yr). The system ships with a library of 365 quotes (one for each day of the year) drawn from multiple philosophical traditions. Each quote includes the text, author attribution, philosophical tradition, and a paired reflection prompt.

The 365 quotes are distributed across 5 traditions:
- **Stoicism** (120 quotes): Marcus Aurelius, Seneca, Epictetus, Zeno of Citium
- **Buddhism** (75 quotes): Thich Nhat Hanh, Pema Chodron, the Dhammapada, Shunryu Suzuki
- **Existentialism** (60 quotes): Viktor Frankl, Albert Camus, Simone de Beauvoir, Jean-Paul Sartre
- **Pragmatism** (55 quotes): William James, John Dewey, Ralph Waldo Emerson
- **General Wisdom** (55 quotes): Rumi, Lao Tzu, Kahlil Gibran, Maya Angelou

Each day, one quote-and-prompt pair is displayed. The selection follows a calendar-anchored rotation: quote #1 on January 1, quote #2 on January 2, and so on. This ensures all users see the same quote on the same day (a community touchpoint even in a privacy-first app). Leap years use quote #60 for February 29.

Users can favorite quotes, write journal entries from prompts (with the quote pre-filled as an opening blockquote), and filter the library by philosophical tradition.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-002: Daily Journaling with Prompts - Quote-driven entries use the prompt system

**External Dependencies:**
- None (all quotes are bundled on-device)

**Assumed Capabilities:**
- Home screen can display a daily content card
- Entry editor supports blockquote formatting

#### 3.5 User Interface Requirements

##### Component: Daily Philosophy Card (Home Screen)

**Layout:**
- Card below the affirmation card (or above, configurable in settings)
- Quote text in italic, large font (18pt), centered
- Attribution line below: "- Author Name" in secondary color
- Tradition badge: small colored tag (e.g., "Stoicism" in blue, "Buddhism" in amber)
- Reflection prompt: regular weight, 16pt, below a subtle divider (e.g., "How does this apply to a challenge you face today?")
- Action row: "Reflect on This" button (opens entry editor), heart icon (favorite), share icon (copy quote to clipboard)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Today's Quote | Daily quote loaded | Full card with quote, attribution, prompt |
| Reflected | User wrote an entry from this quote | Card shows "Reflected" badge with link to entry |
| Favorited | User tapped heart | Heart icon filled |
| Loading | Quote data not yet loaded | Skeleton placeholder (rare, data is local) |

**Interactions:**
- Tap "Reflect on This": opens new entry with quote as blockquote, reflection prompt as H3 heading
- Tap heart: toggles favorite
- Tap share icon: copies quote + attribution to system clipboard
- Swipe left/right: browse previous/next day's quotes (does not change today's)
- Tap tradition badge: opens library filtered to that tradition

##### Screen: Philosophy Library

**Layout:**
- Top bar: "Philosophy" title, search bar
- Filter tabs: "All", "Stoicism", "Buddhism", "Existentialism", "Pragmatism", "General", "Favorites"
- Scrollable list of quote cards, each showing: quote text (truncated to 2 lines), author, tradition badge, favorite indicator
- Tap card: expands to full quote with reflection prompt

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| All Quotes | No filter applied | 365 quotes listed, most recent first |
| Filtered | Tradition filter active | Only quotes from selected tradition |
| Search Active | User searching | Quotes matching search text in quote or author |
| Favorites Only | Favorites tab selected | Only favorited quotes |

#### 3.6 Data Requirements

##### Entity: PhilosophyQuote

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| day_number | INTEGER | Required, range 1-366, unique | None | Calendar day (1 = Jan 1, 366 = Dec 31 leap year) |
| quote_text | TEXT | Required, max 500 chars | None | The quote text |
| author | TEXT | Required, max 100 chars | None | Attribution |
| tradition | TEXT | Required, one of 5 traditions | None | Philosophical tradition |
| reflection_prompt | TEXT | Required, max 300 chars | None | Paired reflection question |
| is_favorite | INTEGER | 0 or 1 | 0 | User favorited |
| times_reflected | INTEGER | Min 0 | 0 | Number of entries written from this quote |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

**Allowed Traditions:**
```
stoicism, buddhism, existentialism, pragmatism, general_wisdom
```

**Indexes:**
- `day_number` on PhilosophyQuote - Daily lookup by calendar day (unique)
- `tradition` on PhilosophyQuote - Filter by tradition
- `is_favorite` on PhilosophyQuote - Filter favorites

**Validation Rules:**
- `day_number` must be unique across all quotes
- `quote_text` must not be empty
- `reflection_prompt` must not be empty
- Quotes are seeded on first launch and are read-only (users cannot edit built-in quotes)

**Example Data:**

```json
{
  "id": "q1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "day_number": 66,
  "quote_text": "The happiness of your life depends upon the quality of your thoughts.",
  "author": "Marcus Aurelius",
  "tradition": "stoicism",
  "reflection_prompt": "What is one thought pattern you could improve today?",
  "is_favorite": 0,
  "times_reflected": 0,
  "created_at": "2026-03-06T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Quote Selection

**Purpose:** Determine which quote to show today

**Logic:**

```
1. Calculate day_of_year = ordinal day number of today's date (1-366)
2. SELECT * FROM jr_philosophy_quotes WHERE day_number = day_of_year
3. IF leap year AND day_of_year = 60 (Feb 29): use day_number = 366
4. IF no quote found for day_of_year: fallback to day_number = ((day_of_year - 1) MOD 365) + 1
5. Cache result for the day (re-query on date change)
```

**Edge Cases:**
- Leap year February 29: uses quote #366
- Quote database not yet seeded: trigger seed on first access, show loading state
- Multiple app launches in one day: same quote shown (cached by date)

##### Reflection Entry Creation

**Purpose:** Create a journal entry pre-filled with the quote and reflection prompt

**Logic:**

```
1. User taps "Reflect on This"
2. Create new entry with content:
   "> {quote_text}\n> - {author}\n\n### {reflection_prompt}\n\n"
3. Open entry editor with cursor positioned after the prompt heading
4. On save: increment quote.times_reflected
5. Tag entry with "philosophy" and tradition name (e.g., "stoicism")
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Quote database not seeded | "Loading quotes..." spinner, seed runs in background | Automatic seeding on first launch |
| Quote for today not found | Show random quote from library with note "Quote of the Day" | Automatic fallback |
| Clipboard copy fails | Toast: "Could not copy to clipboard" | User manually selects and copies |
| Quote data corrupted | Re-seed from bundled data | Automatic on next launch |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** it is March 7 (day 66 of the year),
   **When** the user opens the home screen,
   **Then** the daily philosophy card shows quote #66 with author, tradition badge, and reflection prompt.

2. **Given** the user taps "Reflect on This" on a Marcus Aurelius quote,
   **When** the entry editor opens,
   **Then** the editor is pre-filled with the quote as a blockquote, the reflection prompt as an H3 heading, and the cursor is below the heading.

3. **Given** the user saves a reflection entry,
   **When** the entry is created,
   **Then** the entry is auto-tagged with "philosophy" and "stoicism", and the quote's times_reflected increments by 1.

4. **Given** the user taps the share icon on a quote,
   **When** the action completes,
   **Then** the quote text and author attribution are copied to the system clipboard, and a toast confirms "Copied to clipboard."

**Edge Cases:**

5. **Given** it is February 29 in a leap year,
   **When** the daily quote loads,
   **Then** quote #366 is displayed (the leap year bonus quote).

6. **Given** the user browses forward to tomorrow's quote by swiping,
   **When** they return to "Today" view,
   **Then** today's original quote is displayed (browsing does not change the daily selection).

**Negative Tests:**

7. **Given** the quote database has not been seeded yet,
   **When** the home screen loads for the first time,
   **Then** a loading spinner is shown while seeding completes, followed by the daily quote.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| selects correct quote for day 66 | today = March 7 | day_number = 66 |
| selects quote 366 for leap day | today = Feb 29, leap year | day_number = 366 |
| formats reflection entry content | quote + author + prompt | Markdown with blockquote, attribution, H3 prompt |
| increments times_reflected on save | save reflection entry | times_reflected += 1 |
| toggles favorite | tap heart | is_favorite flips 0/1 |
| copies quote to clipboard | share action | clipboard contains "quote\n- author" |
| filters by tradition | filter = "stoicism" | only stoicism quotes returned |
| counts quotes per tradition | full library | stoicism=120, buddhism=75, existentialism=60, pragmatism=55, general=55 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Daily quote lifecycle | 1. Open app, 2. View daily quote, 3. Tap "Reflect on This", 4. Write and save entry | Quote displayed, entry created with quote content, tagged "philosophy" + tradition |
| Favorite and browse | 1. Favorite today's quote, 2. Open library, 3. Filter "Favorites" | Favorited quote appears in favorites list |
| Quote seeding | 1. First launch, 2. Wait for seeding | 365 quotes seeded (366 including leap day), daily quote visible |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| 30-day philosophy practice | 1. View daily quote for 30 consecutive days, 2. Reflect on 10 quotes, 3. Favorite 5, 4. Browse library by tradition | 30 days of quote history, 10 reflection entries tagged with philosophy, 5 favorites saved, library filterable by tradition |

---

### JR-023: Therapy Prep Templates

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-023 |
| **Feature Name** | Therapy Prep Templates |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As someone in therapy, I want structured templates that help me prepare for therapy sessions by organizing topics, wins, challenges, and questions, so that I make the most of my limited session time.

**Secondary:**
> As a therapeutic writer, I want to link my therapy prep notes to related CBT thought records, so that I can reference specific situations and patterns during my session.

**Tertiary:**
> As a privacy-conscious therapy client, I want my therapy preparation notes stored with the same on-device encryption as all other entries, so that even sensitive clinical material is protected.

#### 3.3 Detailed Description

Therapy Prep Templates provide purpose-built templates for therapy session preparation and post-session reflection. While the generic Templates feature (JR-017) includes a basic "Therapy Prep" template, this feature adds deeper, therapy-specific functionality: structured session prep with auto-populated data from recent entries, linkable thought records, and a session history timeline.

The system ships with 4 therapy-specific templates:

1. **Pre-Session Prep**
   - Topics I Want to Discuss (ordered list, user prioritizes)
   - Wins Since Last Session (what went well)
   - Challenges Since Last Session (struggles, setbacks)
   - Mood Trend Summary (auto-populated from JR-019 mood data for the period since last session)
   - Thought Records to Review (auto-populated links to incomplete or recent thought records from JR-015)
   - Questions for My Therapist (specific questions to ask)

2. **Post-Session Reflection**
   - Key Takeaways (what I learned)
   - Action Items / Homework (tasks assigned by therapist)
   - How I Feel After Session (mood tag, 1-5 scale)
   - Follow-Up Questions (things to bring up next time)

3. **Crisis Plan**
   - Warning Signs (what to watch for)
   - Coping Strategies (ranked by effectiveness)
   - Support Contacts (names and numbers)
   - Professional Resources (therapist, crisis lines)
   - Safe Actions (what to do in the moment)

4. **Progress Check-In**
   - Original Goals (from first session, editable)
   - Current Progress (self-assessment per goal, 1-10 scale)
   - New Goals (emerging priorities)
   - Patterns I Have Noticed (recurring themes from thought records)
   - What Is Working / What Is Not

Therapy prep entries use `entry_type = 'therapy_prep'` and are auto-tagged with "therapy". The Pre-Session Prep template auto-populates mood trend and thought record data from the period since the last therapy prep entry (or the last 14 days if no previous session exists). This auto-population pulls data from JR-019 and JR-015 but does not require those features to be enabled - if they are disabled, those sections show "Enable Mood Tagging / CBT Thought Records for auto-populated data."

A session timeline shows all therapy prep entries in chronological order, providing a history of therapy sessions. Users can navigate between sessions to track progress over time.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-015: CBT Thought Records - Linkable thought records in prep templates (optional, degrades gracefully)
- JR-017: Templates - Template infrastructure

**External Dependencies:**
- None

**Assumed Capabilities:**
- Entry editor and template system are functional
- CBT and mood data available (optional)

#### 3.5 User Interface Requirements

##### Screen: Therapy Prep Entry

**Layout:**
- Top bar: template name (e.g., "Pre-Session Prep"), date, "Done" button
- Below top bar: session indicator "Session #N" (auto-incremented) with "Since last session: X days" label
- Main content area: structured sections matching the template, each as a collapsible card:
  - Section header (tappable to collapse/expand)
  - Section content: text areas, lists, or auto-populated data
  - Auto-populated sections have a "Refreshed from your data" label and a refresh icon
- Footer: "Save" button, "Preview as PDF" option

**Auto-Populated Sections (Pre-Session Prep):**

| Section | Data Source | Display |
|---------|------------|---------|
| Mood Trend Summary | JR-019 mood data since last session | Mini trend line, average mood, top emotions |
| Thought Records to Review | JR-015 records since last session | List of thought record summaries with situation preview, tap to view full record |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New Session | First therapy prep entry | All sections empty, session #1, no auto-populated data |
| Returning | Previous sessions exist | Session number auto-incremented, auto-populated sections filled |
| No CBT Data | CBT feature disabled or no records | Thought Records section shows "Enable CBT Thought Records for auto-populated data" |
| No Mood Data | Mood tagging disabled or no data | Mood Trend section shows "Enable Mood Tagging for auto-populated data" |
| Complete | All required sections filled | "Save" button highlighted |

**Interactions:**
- Tap section header: collapses/expands that section
- Tap auto-populated thought record: opens full thought record view
- Tap "Preview as PDF": generates a print-ready version (uses JR-012 export)
- Tap "Done": saves entry, increments session counter
- Drag to reorder topics in "Topics I Want to Discuss": reorder by priority

##### Screen: Session Timeline

**Layout:**
- Vertical timeline showing all therapy prep entries chronologically
- Each node shows: session #, date, template type (Pre-Session / Post-Session / etc.), preview of first topic
- Tap a node: opens that therapy prep entry
- Filter: "Pre-Session", "Post-Session", "Crisis Plan", "Progress Check-In", "All"

#### 3.6 Data Requirements

**Additions to Entry entity (from JR-001):**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| therapy_session_number | INTEGER | Nullable, min 1 | null | Auto-incremented session number (for therapy_prep entries) |
| therapy_template_type | TEXT | Nullable, one of: 'pre_session', 'post_session', 'crisis_plan', 'progress_checkin' | null | Which therapy template was used |

##### Entity: TherapyTopic

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| entry_id | TEXT (UUID) | Required, references Entry.id | None | Parent therapy prep entry |
| section | TEXT | Required, one of: 'topics', 'wins', 'challenges', 'questions', 'takeaways', 'action_items', 'followup_questions', 'warning_signs', 'coping_strategies', 'support_contacts', 'safe_actions', 'original_goals', 'new_goals', 'patterns', 'working', 'not_working' | None | Which section this belongs to |
| content | TEXT | Required, max 1,000 chars | None | Topic/item text |
| sort_order | INTEGER | Required, min 0 | 0 | Position within section |
| is_completed | INTEGER | 0 or 1 | 0 | For action items: whether completed |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

**Indexes:**
- `entry_id` on TherapyTopic - Topics for a session
- `(entry_id, section, sort_order)` - Ordered topics within a section
- `therapy_session_number` on Entry - Session history queries
- `therapy_template_type` on Entry - Filter by template type

**Validation Rules:**
- `therapy_session_number` auto-increments from the maximum existing value + 1 for entries with `entry_type = 'therapy_prep'`
- `section` must be a valid section identifier for the chosen therapy_template_type
- `content` must not be empty after trimming

#### 3.7 Business Logic Rules

##### Session Number Auto-Increment

**Purpose:** Assign sequential session numbers to therapy prep entries

**Logic:**

```
1. On creating a new therapy_prep entry:
   a. max_session = SELECT MAX(therapy_session_number)
      FROM jr_entries WHERE entry_type = 'therapy_prep'
   b. IF max_session IS NULL: new_session = 1
      ELSE: new_session = max_session + 1
   c. Set therapy_session_number = new_session
2. Session numbers are never reused (deleting a session does not renumber)
```

##### Auto-Population Pipeline

**Purpose:** Pre-fill therapy prep sections with recent journal data

**Logic:**

```
1. Find the most recent therapy_prep entry:
   last_session_date = SELECT MAX(entry_date) FROM jr_entries
     WHERE entry_type = 'therapy_prep'
   IF NULL: last_session_date = today - 14 days
2. Mood Trend Summary (requires JR-019):
   a. Query mood_level from entries between last_session_date and today
   b. Calculate: avg_mood, mood_trend (up/down/stable), top 3 emotions
   c. Populate "Mood Trend Summary" section
3. Thought Records to Review (requires JR-015):
   a. Query thought records where created_at >= last_session_date
   b. Include both complete and draft records
   c. For each: show situation (truncated to 100 chars) and distortion types
   d. Populate "Thought Records to Review" section
4. If either feature is disabled: show fallback text in that section
```

**Edge Cases:**
- First therapy session ever: use 14-day lookback window
- No mood data in the period: section shows "No mood data recorded since your last session"
- No thought records in the period: section shows "No thought records since your last session"
- Very long gap between sessions (90+ days): still query all data in the gap, but display a note "It has been {N} days since your last session"

##### Section Mapping by Template Type

**Purpose:** Define which sections belong to which template type

**Logic:**

```
pre_session: [topics, wins, challenges, questions]
post_session: [takeaways, action_items, followup_questions]
crisis_plan: [warning_signs, coping_strategies, support_contacts, safe_actions]
progress_checkin: [original_goals, new_goals, patterns, working, not_working]
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Auto-population fails | Section shows "Could not load recent data" with manual entry fallback | User types content manually |
| Session number conflict | Use MAX + 1 query at save time (not creation time) to prevent race conditions | Automatic resolution |
| Topic save fails | Toast: "Could not save this item. Retrying..." | Auto-retry, content preserved in memory |
| Thought record link broken (record deleted) | "This thought record is no longer available" | Link removed from list |
| PDF preview fails | Toast: "Could not generate preview. Try exporting instead." | User uses standard export (JR-012) |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens a new "Pre-Session Prep" therapy template,
   **When** the entry loads,
   **Then** it shows "Session #N" (auto-incremented), all 6 sections are visible, and auto-populated sections show data from the period since the last session.

2. **Given** the user has 5 mood-tagged entries and 2 thought records since the last session,
   **When** the auto-populated sections load,
   **Then** "Mood Trend Summary" shows the average mood and top emotions, and "Thought Records to Review" lists the 2 records with situation previews.

3. **Given** the user fills in all sections of a Pre-Session Prep and taps "Done",
   **When** the entry is saved,
   **Then** the entry has entry_type='therapy_prep', therapy_session_number is set, all TherapyTopic records are stored, and the entry is auto-tagged "therapy".

4. **Given** the user opens the Session Timeline,
   **When** the timeline loads with 10 previous sessions,
   **Then** all 10 sessions are displayed chronologically with session numbers, dates, and template types.

**Edge Cases:**

5. **Given** CBT Thought Records (JR-015) is not enabled,
   **When** the user opens a Pre-Session Prep,
   **Then** the "Thought Records to Review" section shows "Enable CBT Thought Records for auto-populated data" instead of linked records.

6. **Given** this is the user's first therapy prep entry,
   **When** the session loads,
   **Then** session number is 1, and auto-populated sections use a 14-day lookback window.

7. **Given** it has been 120 days since the last therapy prep entry,
   **When** the new session loads,
   **Then** auto-populated data covers the full 120-day gap with a note "It has been 120 days since your last session."

**Negative Tests:**

8. **Given** the user tries to save a therapy prep entry with all sections empty,
   **When** they tap "Done",
   **Then** validation requires at least one section to have content: "Add at least one item to any section before saving."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| auto-increments session number | existing max = 5 | new session = 6 |
| first session number | no existing sessions | session = 1 |
| calculates lookback period | last session 30 days ago | lookback = 30 days |
| default lookback for first session | no previous sessions | lookback = 14 days |
| maps sections to template type | template = 'pre_session' | sections = [topics, wins, challenges, questions] |
| validates at least one section filled | all sections empty | validation error |
| auto-tags with therapy | save therapy prep | tag "therapy" applied |
| handles missing CBT data | CBT disabled | fallback text, no error |
| handles missing mood data | no mood entries in period | fallback text, no error |
| handles long gap | 120 days since last session | note displayed, all data queried |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Pre-session prep with auto-population | 1. Create 5 mood-tagged entries and 2 thought records, 2. Open Pre-Session Prep | Mood trend and thought record sections auto-populated |
| Post-session reflection | 1. Open Post-Session Reflection template, 2. Fill takeaways and action items, 3. Save | Entry saved with correct template type and section data |
| Session timeline | 1. Create 5 therapy prep entries, 2. Open Session Timeline | 5 nodes displayed chronologically with correct session numbers |
| Crisis plan creation | 1. Open Crisis Plan template, 2. Fill warning signs, coping strategies, contacts, 3. Save | Entry saved with crisis_plan template type |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| 3-month therapy journey | 1. Create Pre-Session Prep biweekly for 3 months (6 sessions), 2. Create Post-Session Reflections after each, 3. Create 1 Crisis Plan, 4. Create 1 Progress Check-In, 5. View Session Timeline | 14 therapy entries, session numbers 1-14, timeline shows all sessions, auto-populated data reflects journal activity between sessions |

---

### JR-024: Vision Board

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-024 |
| **Feature Name** | Vision Board |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a goal-oriented journaler, I want to create a visual collage of images, quotes, and goals on a vision board, so that I can visualize my aspirations and review them regularly.

**Secondary:**
> As a gratitude practitioner, I want to create multiple vision boards for different life areas (career, health, relationships, travel), so that I can keep my aspirations organized by theme.

**Tertiary:**
> As a privacy-conscious writer, I want my vision board images stored locally on-device with the same encryption as journal entries, so that my personal goals and aspirations remain private.

#### 3.3 Detailed Description

Vision Board provides a visual goal-setting tool where users create collages of images, text cards, and quotes arranged on a free-form canvas. This feature is inspired by the Gratitude app ($23/yr) but implemented with full privacy (no cloud storage of vision images).

Users create vision boards by adding items to a canvas. Each item is one of 4 types:
- **Image**: a photo from the device gallery or camera, cropped and positioned on the canvas
- **Text Card**: a text block with customizable background color and font size (for goals, mantras, or notes)
- **Quote Card**: a quote pulled from the Philosophy library (JR-022) or custom-entered, styled with a decorative border
- **Goal Card**: a goal with a title, target date, and progress bar (0-100%)

Items are arranged on a free-form canvas that supports drag-to-position, pinch-to-resize, and rotation gestures. The canvas has a fixed aspect ratio of 3:4 (portrait) or 4:3 (landscape), selectable at creation time. Canvas dimensions are 1200x1600 pixels (portrait) or 1600x1200 pixels (landscape) for export quality.

Users can create up to 10 vision boards. Each board has a title and an optional cover image (the board thumbnail in the list view). Vision boards are stored as entries with `entry_type = 'vision_board'` and the board items are stored as structured child records.

A "Daily Vision" feature can set one board as the daily screensaver that appears when the app launches (configurable in settings). Users can also export a board as a high-resolution image (PNG) for use as a phone wallpaper or for printing.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-006: Photo Attachments - Image handling infrastructure

**External Dependencies:**
- Device camera and photo gallery access (for image items)

**Assumed Capabilities:**
- Image picker and cropping tools are available
- Canvas rendering for item positioning

#### 3.5 User Interface Requirements

##### Screen: Vision Board List

**Layout:**
- Top bar: "Vision Boards" title, "+" button to create new board
- Grid of board thumbnails (2 columns), each showing:
  - Board cover image or auto-generated thumbnail of the canvas
  - Board title below thumbnail
  - Item count badge (e.g., "8 items")
  - Star indicator if set as "Daily Vision" board
- Maximum 10 boards shown, 11th blocked with a message

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No boards created | Illustration with "Create Your First Vision Board" prompt and "+" button |
| Populated | 1+ boards exist | Grid of board thumbnails |
| At Limit | 10 boards exist | "+" button disabled with tooltip "Maximum 10 vision boards" |

**Interactions:**
- Tap board thumbnail: opens that board's canvas editor
- Long press board: context menu with "Rename", "Set as Daily Vision", "Duplicate", "Export as Image", "Delete"
- Tap "+": opens new board creation (name input, orientation selection)

##### Screen: Vision Board Canvas

**Layout:**
- Full-screen canvas with the board's items arranged on a background
- Top bar (overlay, auto-hides after 3 seconds of inactivity): board title, "Done" button, "Add Item" button, overflow menu (Export, Settings, Delete Board)
- Bottom toolbar (overlay): item type selector (Image, Text, Quote, Goal) appears when "Add Item" is tapped
- Selected item shows resize handles (corners) and a rotation handle (top center)
- Double-tap an item to edit its content

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Canvas | No items added | Canvas with centered prompt "Tap + to add your first item" |
| Editing | Items on canvas, user interacting | Item selection handles visible, toolbar visible |
| Viewing | User has not interacted for 3 seconds | Clean view with items only, toolbar auto-hidden |
| Item Selected | User tapped an item | Selection border, resize handles, delete icon in corner |
| Item Editing | User double-tapped item | Text input active (for text/quote/goal cards), or crop tool (for images) |

**Interactions:**
- Tap "Add Item": shows item type selector at bottom
- Select item type: adds new item at canvas center, enters editing mode
- Drag item: moves it on canvas (snaps to grid at 10px intervals for alignment)
- Pinch item: resizes proportionally (minimum 50x50px, maximum canvas size)
- Rotate item: two-finger rotation gesture or rotation handle drag
- Double-tap text/quote/goal item: opens inline editor for text content
- Double-tap image item: opens crop/replace options
- Tap delete icon on selected item: confirmation "Remove this item?" with "Remove" and "Cancel"
- Tap "Done": saves canvas state, returns to board list
- Tap "Export as Image": generates a PNG at 1200x1600 or 1600x1200 and presents system share sheet

**Transitions/Animations:**
- Toolbar auto-hide: 300ms fade out after 3 seconds idle
- Item selection: 150ms border appear animation
- New item added: 200ms scale-up from center

##### Modal: Goal Card Editor

**Layout:**
- Inline editor within the canvas (appears when double-tapping a goal card)
- Fields: Goal title (max 100 chars), target date (date picker), progress (slider 0-100%)
- "Save" and "Cancel" buttons

#### 3.6 Data Requirements

##### Entity: VisionBoard

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| entry_id | TEXT (UUID) | Required, references Entry.id | None | Parent entry (entry_type='vision_board') |
| title | TEXT | Required, max 100 chars | None | Board title |
| orientation | TEXT | Required, one of: 'portrait', 'landscape' | 'portrait' | Canvas orientation |
| background_color | TEXT | Nullable, hex color | '#1A1A2E' | Canvas background color |
| is_daily_vision | INTEGER | 0 or 1 | 0 | Show on app launch |
| item_count | INTEGER | Min 0 | 0 | Number of items on board |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

##### Entity: VisionBoardItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| board_id | TEXT (UUID) | Required, references VisionBoard.id | None | Parent board |
| item_type | TEXT | Required, one of: 'image', 'text', 'quote', 'goal' | None | Item type |
| content | TEXT | Nullable, max 500 chars | null | Text content (for text/quote/goal items) |
| image_path | TEXT | Nullable | null | Local file path for image items |
| position_x | REAL | Required, range 0-1 | 0.5 | Horizontal position (normalized, 0=left, 1=right) |
| position_y | REAL | Required, range 0-1 | 0.5 | Vertical position (normalized, 0=top, 1=bottom) |
| width | REAL | Required, range 0.05-1.0 | 0.3 | Item width (normalized fraction of canvas) |
| height | REAL | Required, range 0.05-1.0 | 0.3 | Item height (normalized fraction of canvas) |
| rotation_deg | REAL | Range -180 to 180 | 0 | Rotation in degrees |
| z_index | INTEGER | Min 0 | 0 | Stacking order (higher = in front) |
| background_color | TEXT | Nullable, hex color | null | Background color for text/quote/goal cards |
| font_size | INTEGER | Nullable, range 12-48 | 18 | Font size for text items |
| goal_target_date | TEXT | Nullable, ISO date | null | Target date for goal items |
| goal_progress | INTEGER | Nullable, range 0-100 | 0 | Progress percentage for goal items |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Indexes:**
- `board_id` on VisionBoardItem - Items for a board
- `(board_id, z_index)` - Rendering order
- `is_daily_vision` on VisionBoard - Quick lookup for daily vision feature

**Validation Rules:**
- Maximum 10 VisionBoard records per user
- Maximum 50 VisionBoardItem records per board
- `position_x` and `position_y` use normalized coordinates (0 to 1) for resolution independence
- `width` and `height` minimum 0.05 (5% of canvas) to prevent invisible items
- Image items must have a valid image_path; text/quote/goal items must have content
- Only one VisionBoard can have is_daily_vision = 1 at a time

**Example Data:**

```json
{
  "id": "vb1a2b3c-d4e5-6789-abcd-ef1234567890",
  "entry_id": "e1f2a3b4-c5d6-7890-abcd-ef1234567890",
  "title": "2026 Career Goals",
  "orientation": "portrait",
  "background_color": "#1A1A2E",
  "is_daily_vision": 1,
  "item_count": 5,
  "created_at": "2026-03-06T10:00:00Z",
  "updated_at": "2026-03-06T11:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Daily Vision Display

**Purpose:** Show a vision board on app launch as a motivational screensaver

**Logic:**

```
1. On app launch (if Daily Vision is enabled in settings):
   a. Query: SELECT * FROM jr_vision_boards WHERE is_daily_vision = 1
   b. IF found: render the board's canvas as a full-screen overlay
   c. Display for 5 seconds or until user taps "Continue to Journal"
   d. Fade out and show the normal home screen
2. If no board is set as daily vision: skip the overlay entirely
```

**Edge Cases:**
- Daily vision board has no items: skip the overlay
- Daily vision board deleted: is_daily_vision is cleared, skip overlay
- Multiple boards with is_daily_vision = 1 (data inconsistency): use the most recently updated one

##### Canvas Export

**Purpose:** Export a vision board as a high-resolution PNG image

**Logic:**

```
1. Render the canvas at full resolution:
   - Portrait: 1200 x 1600 pixels
   - Landscape: 1600 x 1200 pixels
2. Render background color
3. FOR EACH item in z_index order (lowest first):
   a. Compute pixel position: px_x = position_x * canvas_width, px_y = position_y * canvas_height
   b. Compute pixel dimensions: px_w = width * canvas_width, px_h = height * canvas_height
   c. Apply rotation_deg
   d. Render item (image, text card, quote card, or goal card with progress bar)
4. Encode as PNG
5. Present system share sheet with the image
```

##### Board Limit Enforcement

**Purpose:** Limit users to 10 vision boards

**Logic:**

```
1. On "Create New Board":
   board_count = SELECT COUNT(*) FROM jr_vision_boards
   IF board_count >= 10:
     Show toast: "Maximum 10 vision boards. Delete a board to create a new one."
     Block creation
   ELSE:
     Proceed with creation
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Image file missing (deleted from device) | Placeholder with "Image not found" text | User can replace the image item |
| Canvas save fails | Toast: "Could not save board. Retrying..." | Auto-retry, canvas state preserved in memory |
| Export fails (insufficient storage) | Toast: "Not enough storage to export. Free up space and try again." | User frees device storage |
| Board limit reached | Toast: "Maximum 10 vision boards" | User deletes a board first |
| Item limit reached (50 per board) | Toast: "Maximum 50 items per board" | User removes items or creates another board |
| Image too large (> 10MB) | "Image is too large. Please use a smaller image or crop it." | User selects a smaller image |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user creates a new vision board named "2026 Goals" in portrait orientation,
   **When** the canvas opens,
   **Then** an empty portrait canvas is displayed with a prompt to add the first item.

2. **Given** the user adds an image, a text card ("Launch my app"), and a goal card ("Save $10,000", target Dec 2026, progress 25%),
   **When** they arrange items by dragging and resizing,
   **Then** all items are positioned and sized as placed, and tapping "Done" saves the canvas state.

3. **Given** the user sets a board as "Daily Vision",
   **When** they launch the app the next day,
   **Then** the board is displayed as a full-screen overlay for 5 seconds before fading to the home screen.

4. **Given** a board has 5 items,
   **When** the user taps "Export as Image",
   **Then** a high-resolution PNG (1200x1600) is generated and the system share sheet appears.

**Edge Cases:**

5. **Given** the user has 10 vision boards,
   **When** they try to create an 11th,
   **Then** creation is blocked with "Maximum 10 vision boards."

6. **Given** a board has an image item whose source file was deleted from the device,
   **When** the board opens,
   **Then** the image item shows a placeholder with "Image not found" and the rest of the board loads normally.

7. **Given** a board is set as Daily Vision but has 0 items,
   **When** the app launches,
   **Then** the Daily Vision overlay is skipped (empty boards are not shown).

**Negative Tests:**

8. **Given** the user tries to add a 51st item to a board,
   **When** the add action is attempted,
   **Then** a toast shows "Maximum 50 items per board."

9. **Given** the user tries to add an image larger than 10MB,
   **When** the image picker returns,
   **Then** an error shows "Image is too large" and the item is not added.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| normalized position to pixels (portrait) | position_x=0.5, canvas_w=1200 | px_x = 600 |
| normalized position to pixels (landscape) | position_x=0.25, canvas_w=1600 | px_x = 400 |
| enforces board limit | existing boards = 10 | creation blocked |
| enforces item limit | existing items = 50 | addition blocked |
| daily vision toggle clears previous | set board B as daily, board A was daily | A.is_daily_vision = 0, B.is_daily_vision = 1 |
| validates minimum item size | width = 0.03 | validation error (min 0.05) |
| validates rotation range | rotation_deg = 200 | clamped or rejection |
| renders z_index order | items with z_index [0, 2, 1] | rendered in order 0, 1, 2 |
| handles missing image | image_path points to deleted file | placeholder rendered |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create board with mixed items | 1. Create board, 2. Add image, text, quote, goal items, 3. Position and resize, 4. Save | All 4 items saved with positions, types, and content |
| Daily vision lifecycle | 1. Create board with items, 2. Set as Daily Vision, 3. Relaunch app | Board displayed as overlay, then home screen |
| Export board | 1. Create board with items, 2. Export as PNG | Valid PNG file at correct resolution |
| Delete board | 1. Create board, 2. Add items, 3. Delete board | Board, items, and associated images cleaned up |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Annual vision board | 1. Create "2026 Vision" board (portrait), 2. Add 8 images from gallery, 3. Add 4 text cards with goals, 4. Add 2 goal cards with deadlines, 5. Set as Daily Vision, 6. Export as wallpaper | Board saved with 14 items, displayed on app launch, exported PNG at 1200x1600, items at correct positions |

---

### JR-025: Printed Books from Entries

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-025 |
| **Feature Name** | Printed Books from Entries |
| **Priority** | P3 |
| **Category** | Import/Export |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a reflective thinker, I want to turn my journal entries into a printed physical book, so that I can hold my memories and reflections in a tangible form.

**Secondary:**
> As a long-time journaler, I want to select a date range and customize the book layout (cover, font, page size), so that the printed book feels personal and intentional.

**Tertiary:**
> As a gift giver, I want to create a printed book of my travel journal or gratitude entries to give as a gift, so that I can share meaningful memories in a physical format.

#### 3.3 Detailed Description

Printed Books from Entries allows users to compile their journal entries into a formatted book layout and export a print-ready PDF. The user selects entries by date range, journal, tag, or entry type. The system generates a paginated book layout with a cover page, table of contents, and formatted entry pages. Users customize the book by choosing a cover design, title, font, and page size.

This feature does not integrate with a third-party print-on-demand service in the initial version. Instead, it generates a high-quality, print-ready PDF (with proper margins, bleed, and trim marks) that the user can upload to any print-on-demand service (Blurb, Lulu, Amazon KDP) or take to a local print shop. A future version may add direct integration with a print partner.

Supported book formats:
- **6x9 inches** (standard trade paperback): 15.24 x 22.86 cm
- **5.5x8.5 inches** (digest): 13.97 x 21.59 cm
- **8.5x11 inches** (letter): 21.59 x 27.94 cm

The book generation process:
1. User selects entries to include (by date range, journal, tags, or manual selection)
2. User customizes: book title, subtitle, author name, cover design (5 built-in templates), body font (4 options), and page size
3. System generates a preview showing estimated page count and a few sample pages
4. User confirms and the system generates the full PDF
5. PDF is saved to the device and available for sharing/printing

Cover design templates:
1. **Minimalist**: solid color background, centered title in large serif font
2. **Photo Cover**: user-selected cover image with title overlay
3. **Classic**: bordered design with decorative corners, title in serif font
4. **Modern**: bold sans-serif title with accent color bar
5. **Nature**: muted earth-tone gradient with script font title

Body font options:
1. Georgia (serif, classic)
2. Merriweather (serif, modern)
3. Open Sans (sans-serif, clean)
4. Source Code Pro (monospaced, typewriter feel)

Photo attachments from entries are included inline at their original positions. Mood tags appear as subtle emoji markers next to entry dates. Metadata (location, weather) is shown as a small footer on each entry's first page.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-012: Export (PDF / Markdown / Text) - PDF generation infrastructure

**External Dependencies:**
- PDF rendering engine capable of multi-page document generation
- Font files for the 4 body font options (bundled with app)

**Assumed Capabilities:**
- PDF generation library can handle images, custom fonts, and precise page dimensions
- Device has sufficient storage for PDF output (estimated 5-50MB per book)

#### 3.5 User Interface Requirements

##### Screen: Book Builder

**Layout:**
- Step-by-step wizard with 4 steps:

**Step 1: Select Entries**
- Date range selector (start date, end date)
- Filter options: by journal, by tag, by entry type
- Entry count: "127 entries selected (est. 142 pages)"
- "Select All" / "Deselect All" toggles
- Individual entry checkboxes in a scrollable list (date, title preview)
- Minimum 1 entry, maximum 500 entries per book

**Step 2: Customize Book**
- Book title: text input (max 100 chars)
- Subtitle: text input (max 200 chars, optional)
- Author name: text input (max 100 chars)
- Cover design: 5 template thumbnails in a horizontal scroll, tap to select
- If "Photo Cover" selected: image picker for cover photo
- Page size: 3 radio buttons (6x9, 5.5x8.5, 8.5x11)
- Body font: 4 font name options with sample text preview

**Step 3: Preview**
- Estimated page count
- 3 sample pages rendered as thumbnails (cover, first entry, middle entry)
- Tap a thumbnail to see full-size preview
- "Back" to change settings, "Generate Book" to proceed

**Step 4: Generation**
- Progress bar with page count: "Generating page 47 of 142..."
- Estimated time remaining
- "Cancel" button
- On completion: "Your book is ready!" with "Save to Files", "Share", and "Preview Full Book" buttons

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Entry Selection | User choosing entries | Filterable entry list with checkboxes |
| No Entries | Date range/filter yields 0 entries | "No entries match your filters. Adjust the date range or filters." |
| Too Many Entries | More than 500 selected | Warning: "Maximum 500 entries per book. Please narrow your selection." |
| Customizing | User choosing options | Cover, font, and page size options |
| Previewing | Sample pages generated | Thumbnail previews with page estimate |
| Generating | PDF being built | Progress bar with page counter |
| Complete | PDF generated | Success screen with save/share options |
| Generation Failed | PDF creation error | "Could not generate book. Please try again." with "Retry" button |

**Interactions:**
- Tap date range: opens date pickers for start and end dates
- Tap filter toggle: shows/hides journal and tag filter options
- Tap entry checkbox: toggles selection
- Tap cover template: selects that design, shows preview
- Tap "Generate Book": begins PDF creation (estimated 1-3 minutes for 100+ entries)
- Tap "Save to Files": saves PDF to device file system
- Tap "Share": opens system share sheet with the PDF

#### 3.6 Data Requirements

##### Entity: BookProject

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key | Auto | Unique identifier |
| title | TEXT | Required, max 100 chars | None | Book title |
| subtitle | TEXT | Nullable, max 200 chars | null | Book subtitle |
| author_name | TEXT | Required, max 100 chars | None | Author name on cover |
| cover_design | TEXT | Required, one of: 'minimalist', 'photo', 'classic', 'modern', 'nature' | 'minimalist' | Cover template |
| cover_image_path | TEXT | Nullable | null | Cover photo path (for 'photo' design) |
| page_size | TEXT | Required, one of: '6x9', '5.5x8.5', '8.5x11' | '6x9' | Book dimensions |
| body_font | TEXT | Required, one of: 'georgia', 'merriweather', 'open_sans', 'source_code_pro' | 'georgia' | Body text font |
| entry_count | INTEGER | Min 1, max 500 | None | Number of entries included |
| page_count | INTEGER | Nullable, min 1 | null | Estimated or actual page count |
| pdf_path | TEXT | Nullable | null | Path to generated PDF |
| status | TEXT | Required, one of: 'draft', 'generating', 'complete', 'failed' | 'draft' | Generation status |
| date_range_start | TEXT | ISO date, required | None | Entry selection start date |
| date_range_end | TEXT | ISO date, required | None | Entry selection end date |
| filter_journal_ids | TEXT | Nullable, JSON array | null | Journal ID filter |
| filter_tag_ids | TEXT | Nullable, JSON array | null | Tag ID filter |
| filter_entry_types | TEXT | Nullable, JSON array | null | Entry type filter |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Indexes:**
- `status` on BookProject - Find in-progress or completed books
- `created_at` on BookProject - Recent projects first

**Validation Rules:**
- `entry_count` must be between 1 and 500
- `date_range_start` must be before or equal to `date_range_end`
- If `cover_design` is 'photo', `cover_image_path` must not be null
- `title` and `author_name` must not be empty after trimming

#### 3.7 Business Logic Rules

##### Page Count Estimation

**Purpose:** Estimate the number of pages before generating the full PDF

**Logic:**

```
1. Calculate total content size:
   total_words = SUM(word_count) for selected entries
   total_images = COUNT(photo attachments) for selected entries
2. Estimate pages by format:
   - 6x9: ~250 words per page, each image = 0.5 pages
   - 5.5x8.5: ~200 words per page, each image = 0.5 pages
   - 8.5x11: ~350 words per page, each image = 0.75 pages
3. estimated_pages = CEIL(total_words / words_per_page) + CEIL(total_images * image_page_factor)
4. Add fixed pages: cover (1) + title page (1) + table of contents (CEIL(entry_count / 20)) + back cover (1)
5. RETURN estimated_pages
```

**Edge Cases:**
- Entries with no text but only images: each image counts as 0.5 or 0.75 pages
- Very long entries (5,000+ words): may span multiple pages, estimate is approximate
- Estimated page count displayed as a range: "{estimate - 5} to {estimate + 5} pages" for accuracy

##### PDF Generation Pipeline

**Purpose:** Build the formatted book PDF from selected entries

**Logic:**

```
1. Set book project status = 'generating'
2. Initialize PDF document at selected page_size with margins:
   - Inner margin: 0.75 inches (binding side)
   - Outer margin: 0.5 inches
   - Top margin: 0.75 inches
   - Bottom margin: 0.5 inches
3. Render cover page using selected template
4. Render title page: title, subtitle, author
5. Render table of contents:
   - One line per entry: date + title (or first line) + page number
   - Dot leaders between title and page number
   - Multi-page TOC if > 20 entries per page
6. FOR EACH selected entry (chronological order):
   a. Start new page (or continue if previous entry was short)
   b. Render entry header: date, journal name, mood emoji (if tagged), location (if available)
   c. Render Markdown content as styled text using selected body font
   d. Embed inline images at 300 DPI (resize to fit page width minus margins)
   e. Track page numbers for TOC
7. Render back cover (blank or with a subtitle/colophon)
8. Update BookProject: page_count, pdf_path, status = 'complete'
9. Report progress: emit page count updates for the progress bar
```

**Edge Cases:**
- Entry with only an image (no text): image centered on page with date header
- Entry exceeding 10 pages: all pages included, no truncation
- Font missing: fallback to system serif font
- Image file missing: placeholder with "Image not available" text

##### Entry Selection Query

**Purpose:** Fetch entries matching the user's selection criteria

**Logic:**

```
SELECT e.* FROM jr_entries e
WHERE e.entry_date BETWEEN :start AND :end
AND (:journal_ids IS NULL OR e.journal_id IN (:journal_ids))
AND (:entry_types IS NULL OR e.entry_type IN (:entry_types))
AND (:tag_ids IS NULL OR e.id IN (
  SELECT et.entry_id FROM jr_entry_tags et WHERE et.tag_id IN (:tag_ids)
))
ORDER BY e.entry_date ASC, e.created_at ASC
LIMIT 500
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Zero entries match filters | "No entries match your filters" | User adjusts date range or filters |
| More than 500 entries selected | "Maximum 500 entries per book. Narrow your selection." | User applies stricter filters |
| PDF generation fails mid-process | "Could not generate book. Please try again." with "Retry" button | User retries, partial PDF cleaned up |
| Insufficient storage for PDF | "Not enough storage. Free up {estimated_size}MB." | User frees storage |
| Image in entry cannot be loaded | Placeholder in PDF: "Image not available" | Book continues generating |
| Cover photo invalid | "Could not load cover image. Choose another." | User selects different image |
| Generation takes > 5 minutes | Progress bar continues, "This may take a while for large books" note | No timeout, user can cancel |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects 50 entries from January to March 2026,
   **When** the page estimate loads,
   **Then** it shows an estimated page count (e.g., "58 to 68 pages") based on word counts and images.

2. **Given** the user chooses "Classic" cover, 6x9 page size, and Georgia font,
   **When** they view the preview,
   **Then** 3 sample pages are displayed showing the cover, a formatted entry, and the table of contents.

3. **Given** the user taps "Generate Book" with 50 entries selected,
   **When** generation completes,
   **Then** a print-ready PDF is saved to the device with proper margins, embedded images, and a table of contents with accurate page numbers.

4. **Given** the generated PDF is opened in a PDF viewer,
   **When** the user scrolls through it,
   **Then** each entry starts with a date header, content is formatted with the selected font, and images are embedded inline at readable resolution.

**Edge Cases:**

5. **Given** the user selects only 1 entry,
   **When** the book is generated,
   **Then** the PDF contains: cover, title page, TOC (1 entry), the entry page(s), and back cover.

6. **Given** an entry contains an image whose file has been deleted from the device,
   **When** the book is generated,
   **Then** the image position shows "Image not available" placeholder text and the rest of the entry renders normally.

**Negative Tests:**

7. **Given** the user selects 0 entries (date range with no entries),
   **When** they try to proceed to Step 2,
   **Then** the system blocks with "No entries match your filters."

8. **Given** the user selects 501 entries,
   **When** they try to proceed,
   **Then** the system blocks with "Maximum 500 entries per book."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| estimates pages for 6x9 | 5000 words, 10 images | ~25 pages (20 text + 5 image) + fixed pages |
| estimates pages for 8.5x11 | 5000 words, 10 images | ~22 pages (14 text + 8 image) + fixed pages |
| validates entry count minimum | 0 entries | validation error |
| validates entry count maximum | 501 entries | validation error |
| validates date range | start > end | validation error |
| generates TOC | 25 entries | 2-page TOC (20 per page) |
| calculates margins | 6x9, inner margin | 0.75 inch inner, 0.5 inch outer |
| renders entry header | entry with date, journal, mood | formatted header string |
| handles missing image | image_path invalid | placeholder text in output |
| validates cover_image required for photo | design='photo', no image | validation error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full book generation | 1. Select 20 entries, 2. Customize (Classic, 6x9, Georgia), 3. Generate | PDF created with cover, TOC, 20 entries, correct margins |
| Filtered book | 1. Filter by journal "Travel" and tag "vacation", 2. Select entries, 3. Generate | Only matching entries included |
| Photo cover | 1. Select "Photo Cover", 2. Choose image, 3. Generate | Cover page shows user's image with title overlay |
| Book with images | 1. Select entries containing photos, 2. Generate | Photos embedded inline in PDF at 300 DPI |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Year-in-review book | 1. Select all entries from 2025 (200 entries), 2. Title "My 2025 Journal", 3. Classic cover, 6x9, Merriweather font, 4. Generate, 5. Save to Files, 6. Share via email | PDF saved (est. 250-300 pages), shareable, print-ready with margins, embedded images, TOC with accurate page numbers |

---

### JR-026: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-026 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a daily journaler, I want to configure my journaling preferences (default journal, reminders, encryption, daily goal), so that the app works the way I want without adjusting settings each time.

**Secondary:**
> As a privacy-conscious writer, I want to enable or disable encryption, biometric lock, and metadata capture from a central settings screen, so that I have full control over my privacy configuration.

**Tertiary:**
> As a journal user, I want to export all my data, delete all module data, or reset the app from settings, so that I maintain full control over my information.

#### 3.3 Detailed Description

Settings and Preferences provides a central configuration screen for all MyJournal options. Settings are grouped into logical sections and persist locally in the database. The settings screen is the single source of truth for all configurable behavior across the module.

Settings Sections:

**General:**
- Default journal: dropdown of existing journals (selects which journal new entries go to by default)
- Default template: dropdown of templates (selects the default template for new entries)
- Entry font size: slider (12-24pt, default 16pt)
- Show word count in editor: toggle (default on)
- Show reading time in editor: toggle (default on)
- Auto-save interval: 3, 5, or 10 seconds (default 5)

**Daily Practice:**
- Daily reminder: toggle (default off)
- Reminder time: time picker (default 9:00 PM, only shown if reminder enabled)
- Daily word goal: number input (50-10,000, nullable - no goal by default)
- Show daily affirmation: toggle (default on, requires JR-021)
- Show daily philosophy quote: toggle (default on, requires JR-022)

**Privacy & Security:**
- Enable encryption: toggle (default off, see JR-008 for encryption details)
- Change encryption passphrase: button (only shown if encryption enabled)
- Biometric lock: toggle (default off, only available if device supports biometrics)
- Lock timeout: 1 minute, 5 minutes, 15 minutes, 30 minutes, immediately (default 5 minutes, only shown if biometric lock enabled)
- Auto-capture location: toggle (default off, requires JR-018)
- Auto-capture weather: toggle (default off, requires JR-018 and location enabled)

**Data Management:**
- Export all data: button - triggers export wizard (JR-012)
- Import data: button - opens import screen (future feature placeholder)
- Delete all journal data: button - destructive, double confirmation required
- Clear search index: button - rebuilds FTS5 index

**About:**
- Module version
- Entry count, journal count, total word count
- Storage used (database + attachments)
- Licenses and attributions

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this feature is standalone but references other features' settings)

**External Dependencies:**
- Local notification system (for daily reminders)
- Biometric authentication hardware (for biometric lock)

**Assumed Capabilities:**
- Settings persistence layer (key-value store in SQLite)
- Device supports local notifications

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Scrollable screen with grouped settings sections
- Each section has a header label in secondary color (e.g., "GENERAL", "DAILY PRACTICE", "PRIVACY & SECURITY", "DATA MANAGEMENT", "ABOUT")
- Settings items use platform-standard patterns:
  - Toggles: label on left, switch on right
  - Selectors: label on left, current value on right, tap to open picker
  - Numeric inputs: label on left, stepper or text input on right
  - Buttons: full-width tappable rows with chevron or destructive styling

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Fresh install | All settings at default values |
| Configured | User has changed settings | Settings reflect saved values |
| Encryption Active | Encryption enabled | Lock icon next to encryption toggle, passphrase change option visible |
| Biometric Active | Biometric lock enabled | Lock timeout selector visible |
| Reminder Active | Daily reminder enabled | Time picker visible below toggle |

**Interactions:**
- Toggle a switch: setting immediately persists, no save button needed
- Tap a selector: opens picker/dropdown with options
- Tap "Delete all journal data": first confirmation dialog "Delete all journal entries, notebooks, tags, templates, and attachments?", then second confirmation "This cannot be undone. Type DELETE to confirm." with text input
- Tap "Change encryption passphrase": opens passphrase change flow (current passphrase, new passphrase, confirm new passphrase)
- Tap "Export all data": navigates to export screen (JR-012)
- Tap "Clear search index": shows spinner while rebuilding, toast on completion

**Transitions/Animations:**
- Conditional sections (reminder time, lock timeout) slide in/out with 200ms animation when parent toggle changes
- Destructive actions (delete all data) use a red-tinted confirmation dialog

#### 3.6 Data Requirements

##### Entity: Setting

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, setting key name | None | Setting identifier (e.g., "default_journal_id") |
| value | TEXT | Nullable | None | Setting value (stored as string, parsed by type) |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**Setting Keys and Defaults:**

| Key | Type | Default | Valid Values |
|-----|------|---------|-------------|
| default_journal_id | UUID | null (first journal created) | Any valid journal ID |
| default_template_id | UUID | null (blank entry) | Any valid template ID |
| editor_font_size | integer | 16 | 12-24 |
| show_word_count | boolean | true | true, false |
| show_reading_time | boolean | true | true, false |
| auto_save_interval_seconds | integer | 5 | 3, 5, 10 |
| daily_reminder_enabled | boolean | false | true, false |
| daily_reminder_time | string | "21:00" | HH:mm format |
| daily_word_goal | integer | null | 50-10000, or null |
| show_daily_affirmation | boolean | true | true, false |
| show_daily_philosophy | boolean | true | true, false |
| encryption_enabled | boolean | false | true, false |
| biometric_lock_enabled | boolean | false | true, false |
| lock_timeout_minutes | integer | 5 | 1, 5, 15, 30, 0 (0 = immediately) |
| auto_capture_location | boolean | false | true, false |
| auto_capture_weather | boolean | false | true, false |

**Indexes:**
- `id` on Setting - Primary key lookup (already indexed)

**Validation Rules:**
- `editor_font_size` must be an integer between 12 and 24
- `auto_save_interval_seconds` must be one of [3, 5, 10]
- `daily_word_goal` must be null or an integer between 50 and 10,000
- `lock_timeout_minutes` must be one of [0, 1, 5, 15, 30]
- `daily_reminder_time` must be a valid HH:mm string
- `auto_capture_weather` can only be true if `auto_capture_location` is true (weather requires location)
- `biometric_lock_enabled` can only be true if `encryption_enabled` is true

#### 3.7 Business Logic Rules

##### Settings Persistence

**Purpose:** Save and load settings with immediate effect

**Logic:**

```
1. On setting change:
   a. Validate value against constraints
   b. Upsert into Setting table: INSERT OR REPLACE INTO jr_settings (id, value, updated_at)
   c. Broadcast setting change event to active components
2. On setting read:
   a. Query Setting table for key
   b. IF not found: return default value from the defaults table above
   c. Parse string value to expected type
3. Settings are loaded once on module initialization and cached in memory
4. Cache is updated on each write
```

**Edge Cases:**
- Setting key not in database: return default value
- Invalid value stored (data corruption): return default and log warning
- Setting changed while editor is open: editor picks up new value on next keystroke (e.g., font size change applies immediately)

##### Daily Reminder Scheduling

**Purpose:** Schedule a local notification to remind the user to journal

**Logic:**

```
1. On daily_reminder_enabled = true:
   a. Parse daily_reminder_time as HH:mm
   b. Schedule a repeating daily local notification at that time
   c. Notification title: "Time to Journal"
   d. Notification body: "Take a few minutes to write about your day."
   e. Tap notification: opens the app to the entry editor with a new entry
2. On daily_reminder_enabled = false:
   a. Cancel the scheduled notification
3. On daily_reminder_time changed:
   a. Cancel existing notification
   b. Reschedule at new time
```

##### Data Deletion

**Purpose:** Delete all journal module data (nuclear option)

**Logic:**

```
1. User taps "Delete all journal data"
2. First confirmation dialog: "Delete all journal entries, notebooks, tags, templates, and attachments?"
   Options: "Cancel" / "Delete Everything"
3. Second confirmation dialog: "This cannot be undone. Type DELETE to confirm."
   Text input must match "DELETE" exactly (case-sensitive)
4. On confirmation:
   a. Delete all records from: jr_entries, jr_journals, jr_tags, jr_entry_tags,
      jr_templates, jr_gratitude_items, jr_thought_records, jr_thought_record_emotions,
      jr_thought_record_distortions, jr_grid_cells, jr_affirmations, jr_affirmation_logs,
      jr_philosophy_quotes, jr_therapy_topics, jr_vision_boards, jr_vision_board_items,
      jr_book_projects, jr_settings, jr_entry_attachments, jr_entries_fts
   b. Delete attachment files from local storage
   c. Reset encryption state
   d. Reset all in-memory caches
   e. Navigate to onboarding screen (JR-027)
5. This operation is irreversible. No backup is created.
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Setting write fails | Toast: "Could not save setting. Please try again." | Auto-retry, previous value preserved |
| Invalid setting value | Inline validation: "Value must be between X and Y" | User adjusts value |
| Notification permission denied | "Enable notifications in device settings to use reminders" link | User adjusts device settings |
| Biometric not available on device | Biometric lock toggle disabled with label "Not available on this device" | Not available |
| Data deletion fails mid-process | "Could not delete all data. Some data may remain." | User can retry from settings |
| Encryption toggle while entries exist | Warning: "This will encrypt/decrypt all existing entries. This may take a moment." | User confirms, progress spinner shown |
| Weather enabled without location | Toast: "Location must be enabled for weather capture" | auto_capture_location toggled on first |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens Settings,
   **When** the screen loads,
   **Then** all settings sections are displayed with current values (or defaults for unconfigured settings).

2. **Given** the user toggles "Daily reminder" on and sets the time to 8:00 PM,
   **When** the settings are saved,
   **Then** a local notification is scheduled for 8:00 PM daily with "Time to Journal" title.

3. **Given** the user changes the editor font size from 16 to 20,
   **When** they open the entry editor,
   **Then** the editor text is displayed at 20pt.

4. **Given** the user taps "Delete all journal data" and completes both confirmations,
   **When** deletion completes,
   **Then** all journal tables are empty, attachment files are deleted, and the app navigates to the onboarding screen.

**Edge Cases:**

5. **Given** the user enables weather capture without location enabled,
   **When** they toggle weather on,
   **Then** location is automatically enabled first (or toast explains the dependency).

6. **Given** the user enables biometric lock without encryption enabled,
   **When** they toggle biometric lock on,
   **Then** encryption is automatically enabled first (with appropriate warning about encrypting existing entries).

7. **Given** a setting value is corrupted in the database,
   **When** the settings screen loads,
   **Then** the default value is used for the corrupted setting and the rest of settings load normally.

**Negative Tests:**

8. **Given** the user enters a daily word goal of 25 (below minimum 50),
   **When** validation runs,
   **Then** inline error: "Minimum goal is 50 words."

9. **Given** the user enters a font size of 30 (above maximum 24),
   **When** validation runs,
   **Then** inline error: "Font size must be between 12 and 24."

10. **Given** the user taps "Delete all journal data" but types "delete" (lowercase) in the confirmation,
    **When** they try to confirm,
    **Then** the confirmation is rejected: "Type DELETE (all caps) to confirm."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| returns default for missing key | key "nonexistent" | returns null or defined default |
| returns default for corrupted value | font_size stored as "abc" | returns 16 (default) |
| validates font size range | value = 25 | validation error |
| validates auto_save_interval | value = 7 | validation error (not 3, 5, or 10) |
| validates word goal range | value = 25 | validation error (min 50) |
| enforces weather requires location | weather=true, location=false | validation error or auto-enable location |
| enforces biometric requires encryption | biometric=true, encryption=false | validation error or auto-enable encryption |
| validates reminder time format | value = "25:99" | validation error |
| validates deletion confirmation text | input = "delete" | rejection (must be "DELETE") |
| accepts valid deletion confirmation | input = "DELETE" | confirmation accepted |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Settings persistence | 1. Change font size to 20, 2. Close and reopen settings | Font size shows 20 |
| Reminder scheduling | 1. Enable reminder at 8 PM, 2. Check notification schedule | Notification scheduled for 20:00 daily |
| Font size applies to editor | 1. Set font to 20, 2. Open entry editor | Editor text at 20pt |
| Delete all data | 1. Delete all data (double confirm), 2. Check tables | All jr_ tables empty, onboarding shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full settings configuration | 1. Set default journal to "Personal", 2. Set font to 18, 3. Enable reminder at 9 PM, 4. Set daily goal to 300 words, 5. Enable encryption, 6. Enable biometric lock at 5 min timeout, 7. Enable location + weather | All settings persisted, editor uses 18pt font, reminder scheduled, encryption active, biometric lock active, metadata captured on new entries |

---

### JR-027: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | JR-027 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a new user, I want a brief onboarding flow that introduces MyJournal's key features and helps me set up my first journal, so that I can start writing immediately without confusion.

**Secondary:**
> As a privacy-conscious user, I want the onboarding to clearly explain that my data stays on-device and that encryption is free, so that I trust the app before writing anything personal.

**Tertiary:**
> As a user switching from Day One, I want an import option during onboarding so that I can bring my existing journal entries into MyJournal without starting from scratch.

#### 3.3 Detailed Description

Onboarding and First-Run guides new users through initial setup and introduces the app's core features and privacy model. The onboarding flow consists of 5 screens (swipeable or tap-to-advance) followed by 2 setup steps. The entire flow takes 60-90 seconds and can be skipped at any point.

**Onboarding Screens (informational, swipeable):**

1. **Welcome** - "Welcome to MyJournal" with app icon and tagline "Your thoughts, your device, your business." Accent-colored background with the module's indigo theme.

2. **Privacy Promise** - "Your words stay on your device." Illustration of a locked phone. Three bullet points:
   - "Every entry is stored locally, never uploaded"
   - "Free encryption for all your entries (Day One charges $35-50/yr for this)"
   - "No accounts, no cloud, no telemetry"

3. **Features Overview** - "Everything you need to journal." Grid of 6 feature icons with labels:
   - Rich text editor
   - Multiple journals
   - Mood tracking
   - Streak calendar
   - Full-text search
   - Templates & prompts

4. **Extras Preview** - "And more to discover." Grid of 4 P2 feature icons:
   - CBT thought records
   - Gratitude journaling
   - Vision boards
   - Philosophy prompts

5. **Get Started** - "Let's set up your journal." Call-to-action button: "Set Up My Journal"

**Setup Steps (interactive):**

**Step A: Create First Journal**
- Prompt: "Name your first journal"
- Text input with placeholder "Personal Journal" (pre-filled, editable)
- 3 quick-select options below: "Personal", "Work", "Travel"
- Tapping a quick-select fills the text input with that name
- "Next" button

**Step B: Quick Preferences**
- Enable daily reminder? Toggle (default off), time picker if enabled
- Enable encryption? Toggle (default off), passphrase input if enabled (with strength indicator)
- Import from Day One? "Import" button (future feature, shows "Coming soon" for now)
- "Start Journaling" button

After completing setup (or skipping), the user lands on the home screen with their first journal created and an optional sample entry demonstrating features.

#### 3.4 Prerequisites

**Feature Dependencies:**
- JR-001: Rich Text Editor - Editor must be ready for the user's first entry
- JR-003: Multiple Journals - Journal creation during onboarding

**External Dependencies:**
- None

**Assumed Capabilities:**
- Module is initialized and database is ready
- Notification permission can be requested (for reminders)

#### 3.5 User Interface Requirements

##### Screen: Onboarding Carousel (Screens 1-5)

**Layout:**
- Full-screen cards, one per screen
- Each card has:
  - Illustration or icon area (top 40% of screen)
  - Title (24pt, bold)
  - Subtitle or bullet points (16pt, secondary color)
  - Page indicator dots at bottom (5 dots)
  - "Skip" button in top-right corner
- Last card (Screen 5): large "Set Up My Journal" button instead of page dots

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| First Launch | No journals exist | Onboarding starts automatically |
| Returning User | User completed onboarding | Onboarding is never shown again |
| After Data Delete | User deleted all data from settings | Onboarding shown again (clean state) |
| Skipped | User tapped "Skip" | Jump to home screen with a default journal auto-created (named "My Journal") |

**Interactions:**
- Swipe left: advance to next screen
- Swipe right: return to previous screen
- Tap page indicator dot: jump to that screen
- Tap "Skip": skip all remaining screens and setup, create default journal, go to home screen
- Tap "Set Up My Journal" (Screen 5): advance to Step A

**Transitions/Animations:**
- Screen transitions: 300ms horizontal slide
- Illustrations: subtle scale-in animation (200ms) when each screen becomes visible
- "Set Up My Journal" button: pulse animation to draw attention

##### Screen: Setup Step A (Create First Journal)

**Layout:**
- Title: "Name your first journal" (20pt, bold)
- Text input: pre-filled with "Personal Journal", focused on load, keyboard visible
- Below input: 3 pill buttons ("Personal", "Work", "Travel") for quick selection
- "Next" button at bottom (disabled if input is empty)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Screen loads | "Personal Journal" pre-filled, cursor at end |
| Custom Name | User is typing | Custom text in input, quick-select pills unselected |
| Quick Selected | User tapped a pill | Pill highlighted, text input shows selected name |
| Invalid | Input empty | "Next" button disabled, no error message |

##### Screen: Setup Step B (Quick Preferences)

**Layout:**
- Title: "Quick Preferences" (20pt, bold)
- Subtitle: "You can change these anytime in Settings"
- Three preference rows:
  - "Daily Reminder" - toggle + time picker (collapsed if off)
  - "Encrypt My Entries" - toggle + passphrase field (collapsed if off)
  - "Import from Day One" - button (shows "Coming Soon" badge)
- "Start Journaling" button at bottom (always enabled)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Screen loads | All toggles off, "Start Journaling" active |
| Reminder On | User toggled reminder | Time picker visible (default 9 PM) |
| Encryption On | User toggled encryption | Passphrase input visible with strength indicator |
| Weak Passphrase | Passphrase < 8 characters | Strength indicator: "Weak" in red |
| Strong Passphrase | Passphrase >= 12 characters with mixed case + numbers | Strength indicator: "Strong" in green |

**Interactions:**
- Toggle reminder: shows/hides time picker
- Toggle encryption: shows/hides passphrase input
- Tap "Import from Day One": toast "Day One import coming in a future update"
- Tap "Start Journaling": creates journal, applies settings, navigates to home screen

#### 3.6 Data Requirements

##### Entity: OnboardingState

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, fixed value 'onboarding' | 'onboarding' | Singleton record |
| is_completed | INTEGER | 0 or 1 | 0 | Whether onboarding has been completed |
| completed_at | TEXT | ISO datetime, nullable | null | When onboarding was completed |
| created_first_journal | INTEGER | 0 or 1 | 0 | Whether the first journal was created |
| sample_entry_created | INTEGER | 0 or 1 | 0 | Whether the sample entry was generated |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

**No new indexes needed** (singleton record, always queried by primary key).

**Validation Rules:**
- Only one OnboardingState record exists (id = 'onboarding')
- `is_completed` set to 1 only after at least one journal exists

#### 3.7 Business Logic Rules

##### Onboarding Flow Control

**Purpose:** Determine whether to show onboarding on app launch

**Logic:**

```
1. On module initialization:
   a. Query: SELECT is_completed FROM jr_onboarding_state WHERE id = 'onboarding'
   b. IF not found OR is_completed = 0:
      Show onboarding flow
   c. IF is_completed = 1:
      Show home screen
2. On "Skip" at any point:
   a. Create default journal named "My Journal"
   b. Set is_completed = 1
   c. Navigate to home screen
3. On "Start Journaling" (after Step B):
   a. Create journal with the name from Step A
   b. Apply settings from Step B (reminder, encryption)
   c. Create sample entry (if not already created)
   d. Set is_completed = 1, created_first_journal = 1
   e. Navigate to home screen
```

##### Sample Entry Generation

**Purpose:** Create a sample entry that demonstrates features

**Logic:**

```
1. After onboarding completes (not skipped):
   a. Create entry in the first journal with content:
      "# Welcome to MyJournal! \n\n
      This is your first entry. Here are some things you can do:\n\n
      ## Write with Markdown\n\n
      Use **bold**, *italic*, and ~~strikethrough~~ formatting.\n\n
      ## Make Lists\n\n
      - Grocery shopping\n
      - Call mom\n
      - [x] Download MyJournal\n\n
      ## Stay Consistent\n\n
      Your streak calendar tracks your journaling consistency.
      Try to write a little every day!\n\n
      > \"The life of every man is a diary in which he means to write one story,
      > and writes another.\" - J.M. Barrie\n\n
      Feel free to edit or delete this entry. Happy journaling!"
   b. Tag entry with "welcome"
   c. Set sample_entry_created = 1
2. Sample entry is a normal entry (can be edited, deleted, exported)
```

**Edge Cases:**
- App killed during onboarding: on next launch, onboarding resumes (is_completed still 0)
- User deletes all data: is_completed reset to 0, onboarding shown again
- Sample entry already exists (re-onboarding after data wipe): new sample created, old one is gone (data was wiped)

##### Passphrase Strength Calculation

**Purpose:** Evaluate passphrase strength during onboarding encryption setup

**Logic:**

```
1. Score calculation:
   length_score:
     < 8 chars: 0
     8-11 chars: 1
     12-15 chars: 2
     16+ chars: 3
   complexity_score:
     +1 for lowercase letters
     +1 for uppercase letters
     +1 for digits
     +1 for special characters
   total_score = length_score + complexity_score (max 7)
2. Strength levels:
   0-2: "Weak" (red)
   3-4: "Fair" (amber)
   5-6: "Strong" (green)
   7: "Very Strong" (green with checkmark)
3. Minimum requirement: total_score >= 3 (at least "Fair")
4. Display strength bar (0-100% fill) mapped from total_score
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Journal creation fails during setup | Toast: "Could not create journal. Please try again." | "Retry" button on the setup screen |
| Journal name empty at Step A | "Next" button disabled | User enters a name |
| Journal name already exists | Inline validation: "A journal with this name already exists" | User changes name |
| Encryption passphrase too weak | Strength indicator shows "Weak" in red, "Start Journaling" blocked with "Choose a stronger passphrase" | User improves passphrase |
| Sample entry creation fails | Onboarding completes without sample entry, no error shown | User creates their own first entry |
| Notification permission denied | Reminder toggle shown but with note "Notification permission required" | Link to device settings |
| Database not ready | Loading spinner: "Setting up MyJournal..." | Retry on timer (500ms intervals, max 10 retries) |

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a new user launches MyJournal for the first time,
   **When** the module initializes,
   **Then** the onboarding carousel starts automatically with Screen 1 (Welcome).

2. **Given** the user swipes through all 5 onboarding screens and taps "Set Up My Journal",
   **When** Step A loads,
   **Then** the journal name input is pre-filled with "Personal Journal" and the keyboard is visible.

3. **Given** the user names their journal "Daily Reflections" and taps "Next",
   **When** Step B loads,
   **Then** reminder and encryption toggles are off by default with "Start Journaling" button active.

4. **Given** the user enables a daily reminder at 8 PM and taps "Start Journaling",
   **When** setup completes,
   **Then** a journal named "Daily Reflections" is created, a daily notification is scheduled for 8 PM, a sample entry is created, and the home screen appears.

5. **Given** the user enables encryption and enters a passphrase scoring "Strong",
   **When** they tap "Start Journaling",
   **Then** encryption is enabled with the entered passphrase and all future entries are encrypted.

**Edge Cases:**

6. **Given** the user taps "Skip" on Screen 2,
   **When** onboarding is skipped,
   **Then** a default journal named "My Journal" is created and the home screen appears with no sample entry.

7. **Given** the user completes onboarding, then later deletes all data from settings,
   **When** they return to MyJournal,
   **Then** the onboarding flow is shown again (clean state).

8. **Given** the user taps "Import from Day One" during Step B,
   **When** the button is tapped,
   **Then** a toast shows "Day One import coming in a future update."

**Negative Tests:**

9. **Given** the user clears the journal name input in Step A,
   **When** the input is empty,
   **Then** the "Next" button is disabled (no error message, just disabled).

10. **Given** the user enables encryption with a 5-character passphrase,
    **When** the strength indicator shows "Weak",
    **Then** "Start Journaling" is disabled with hint "Choose a stronger passphrase (at least 8 characters)."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| shows onboarding for new user | is_completed = 0 (or missing) | onboarding flow starts |
| skips onboarding for returning user | is_completed = 1 | home screen shown |
| creates default journal on skip | user taps "Skip" | journal "My Journal" created |
| creates named journal on complete | name = "Daily Reflections" | journal created with that name |
| generates sample entry | onboarding completed (not skipped) | entry created with welcome content, tagged "welcome" |
| skips sample on skip | user tapped "Skip" | no sample entry created |
| passphrase strength: weak | "abc" (3 chars) | score = 0, label = "Weak" |
| passphrase strength: fair | "password1" (9 chars, lower + digit) | score = 3, label = "Fair" |
| passphrase strength: strong | "MyJournal2026!" (14 chars, all types) | score = 6, label = "Strong" |
| passphrase strength: very strong | "MyJournal2026!SecurePhrase" (26 chars) | score = 7, label = "Very Strong" |
| validates passphrase minimum | score < 3 | blocks encryption enable |
| resets onboarding on data delete | delete all data | is_completed = 0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full onboarding flow | 1. Launch first time, 2. Swipe 5 screens, 3. Name journal, 4. Enable reminder, 5. Start | Journal created, reminder scheduled, sample entry exists, home screen shown |
| Skip flow | 1. Launch, 2. Tap "Skip" | Default journal created, no sample entry, home screen shown |
| Encryption during onboarding | 1. Complete screens, 2. Enable encryption, 3. Enter strong passphrase, 4. Start | Encryption active, passphrase stored (via JR-008 key derivation) |
| Re-onboarding after data delete | 1. Complete onboarding, 2. Delete all data, 3. Return to module | Onboarding shown again |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user first day | 1. Install app, enable MyJournal module, 2. Complete onboarding (name: "My Life", reminder: 9 PM, encryption: on), 3. Read sample entry, 4. Create first real entry | Journal "My Life" exists with 2 entries (sample + first real), reminder scheduled for 9 PM, encryption active, onboarding completed |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Entry** entity. Each entry belongs to one **Journal** (notebook) and can have multiple **Tag** associations via the **EntryTag** join table. Entries support several specialized child record types depending on the entry's type: **GratitudeItem** records for gratitude entries, **ThoughtRecord** (with **ThoughtRecordEmotion** and **ThoughtRecordDistortion** children) for CBT entries, **GridCell** records for grid layout entries, **TherapyTopic** records for therapy prep entries, and **VisionBoardItem** records for vision board entries (via the **VisionBoard** bridge entity). **Attachment** records link photos and voice recordings to entries. The **Template** entity stores reusable entry structures including grid layouts. **Affirmation** and **AffirmationLog** track daily affirmation interactions. **PhilosophyQuote** stores the 365-day quote library. **BookProject** stores book generation configurations. **Setting** stores user preferences as key-value pairs. **OnboardingState** is a singleton tracking first-run completion. Full-text search is powered by the **jr_entries_fts** FTS5 virtual table.

### 4.2 Complete Entity Definitions

#### Entity: jr_journals

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| name | TEXT | Required, max 100 chars, unique | None | Journal name |
| description | TEXT | Nullable, max 500 chars | null | Optional description |
| color | TEXT | Nullable, hex color | null | Accent color for this journal |
| icon | TEXT | Nullable, max 10 chars | null | Emoji icon |
| sort_order | INTEGER | Min 0 | 0 | Display order in journal list |
| entry_count | INTEGER | Min 0 | 0 | Cached count of entries in this journal |
| default_template_id | TEXT | Nullable, references jr_templates.id | null | Default template for new entries |
| is_archived | INTEGER | 0 or 1 | 0 | Whether the journal is archived |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_entries

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| journal_id | TEXT | Required, references jr_journals.id | None | Parent journal |
| title | TEXT | Nullable, max 500 chars | null | Entry title (auto-derived from first line if blank) |
| content | TEXT | Required, max 50,000 chars | '' | Entry body in Markdown format |
| content_plain | TEXT | Auto-derived from content | '' | Plain text for search and word count |
| word_count | INTEGER | Computed, min 0 | 0 | Words in content_plain |
| char_count | INTEGER | Computed, min 0 | 0 | Characters in content |
| entry_type | TEXT | One of: 'standard', 'gratitude', 'thought_record', 'grid', 'vision_board', 'therapy_prep' | 'standard' | Entry type |
| is_favorite | INTEGER | 0 or 1 | 0 | Starred/favorited |
| is_encrypted | INTEGER | 0 or 1 | 0 | Content stored encrypted |
| mood_level | INTEGER | Nullable, range 1-5 | null | Mood rating (1=terrible, 5=great) |
| mood_emotion | TEXT | Nullable, max 50 chars | null | Specific emotion label |
| entry_date | TEXT | ISO date (YYYY-MM-DD), required | Current date | Calendar date for this entry |
| latitude | REAL | Nullable, range -90 to 90 | null | GPS latitude |
| longitude | REAL | Nullable, range -180 to 180 | null | GPS longitude |
| place_name | TEXT | Nullable, max 200 chars | null | Reverse-geocoded location name |
| timezone | TEXT | Nullable, IANA timezone ID | null | Device timezone at creation |
| weather_temp_c | REAL | Nullable | null | Temperature in Celsius |
| weather_description | TEXT | Nullable, max 100 chars | null | Weather description |
| weather_icon | TEXT | Nullable | null | Weather icon identifier |
| grid_rows | INTEGER | Nullable, range 1-4 | null | Grid row count (grid entries) |
| grid_cols | INTEGER | Nullable, range 1-4 | null | Grid column count (grid entries) |
| therapy_session_number | INTEGER | Nullable, min 1 | null | Session number (therapy_prep entries) |
| therapy_template_type | TEXT | Nullable, one of: 'pre_session', 'post_session', 'crisis_plan', 'progress_checkin' | null | Therapy template subtype |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_tags

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| name | TEXT | Required, max 50 chars, unique (case-insensitive) | None | Tag name |
| color | TEXT | Nullable, hex color | null | Tag color |
| usage_count | INTEGER | Min 0 | 0 | How many entries use this tag |
| is_system | INTEGER | 0 or 1 | 0 | System-generated tag (e.g., "gratitude", "therapy", "philosophy") |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

#### Entity: jr_entry_tags (Join Table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| entry_id | TEXT | Required, references jr_entries.id | None | Entry reference |
| tag_id | TEXT | Required, references jr_tags.id | None | Tag reference |
| PRIMARY KEY | - | (entry_id, tag_id) | - | Composite primary key |

#### Entity: jr_entry_attachments

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| entry_id | TEXT | Required, references jr_entries.id | None | Parent entry |
| file_path | TEXT | Required | None | Local file path |
| file_type | TEXT | Required, one of: 'image', 'audio' | None | Attachment type |
| file_size_bytes | INTEGER | Min 0 | 0 | File size in bytes |
| mime_type | TEXT | Required | None | MIME type (e.g., 'image/jpeg', 'audio/m4a') |
| duration_seconds | REAL | Nullable | null | Audio duration (audio only) |
| transcription | TEXT | Nullable | null | Voice transcription text (audio only) |
| width | INTEGER | Nullable | null | Image width in pixels (image only) |
| height | INTEGER | Nullable | null | Image height in pixels (image only) |
| sort_order | INTEGER | Min 0 | 0 | Display order within entry |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

#### Entity: jr_templates

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| name | TEXT | Required, max 100 chars | None | Template name |
| content | TEXT | Required, max 50,000 chars | None | Template content in Markdown |
| is_builtin | INTEGER | 0 or 1 | 0 | System-provided template |
| layout_type | TEXT | One of: 'standard', 'grid' | 'standard' | Template layout type |
| grid_config | TEXT | Nullable, JSON string | null | Grid configuration (rows, cols, cell prompts) |
| usage_count | INTEGER | Min 0 | 0 | Times used |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_gratitude_items

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| entry_id | TEXT | Required, references jr_entries.id | None | Parent entry |
| item_number | INTEGER | Required, range 1-5 | None | Position in the list |
| item_text | TEXT | Required, max 200 chars | None | Gratitude item |
| why_text | TEXT | Nullable, max 500 chars | null | Elaboration |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

#### Entity: jr_thought_records

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| entry_id | TEXT | Required, references jr_entries.id | None | Parent entry |
| status | TEXT | Required, one of: 'draft', 'complete' | 'draft' | Completion status |
| situation | TEXT | Nullable, max 1,000 chars | null | Step 1 |
| situation_date | TEXT | ISO datetime, nullable | null | When the situation occurred |
| automatic_thought | TEXT | Nullable, max 1,000 chars | null | Step 2 |
| thought_belief_before | INTEGER | Nullable, range 0-100 | null | Belief rating before (%) |
| rational_response | TEXT | Nullable, max 2,000 chars | null | Step 5 |
| evidence_for | TEXT | Nullable, max 1,000 chars | null | Evidence supporting the thought |
| evidence_against | TEXT | Nullable, max 1,000 chars | null | Evidence against the thought |
| thought_belief_after | INTEGER | Nullable, range 0-100 | null | Belief rating after (%) |
| outcome_note | TEXT | Nullable, max 500 chars | null | Outcome summary |
| current_step | INTEGER | Range 1-6 | 1 | Last completed step |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_thought_record_emotions

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| thought_record_id | TEXT | Required, references jr_thought_records.id | None | Parent record |
| emotion_name | TEXT | Required, max 50 chars | None | Emotion label |
| intensity_before | INTEGER | Range 0-100 | 0 | Intensity at Step 3 (%) |
| intensity_after | INTEGER | Nullable, range 0-100 | null | Re-rated intensity at Step 6 (%) |

#### Entity: jr_thought_record_distortions

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| thought_record_id | TEXT | Required, references jr_thought_records.id | None | Parent record |
| distortion_type | TEXT | Required, one of 15 allowed types | None | Cognitive distortion identifier |

Allowed distortion types: `all_or_nothing`, `overgeneralization`, `mental_filter`, `disqualifying_positive`, `mind_reading`, `fortune_telling`, `magnification`, `minimization`, `emotional_reasoning`, `should_statements`, `labeling`, `personalization`, `blame`, `always_being_right`, `fallacy_of_fairness`

#### Entity: jr_grid_cells

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| entry_id | TEXT | Required, references jr_entries.id | None | Parent entry |
| cell_row | INTEGER | Required, range 0-3 | None | Row position (0-indexed) |
| cell_col | INTEGER | Required, range 0-3 | None | Column position (0-indexed) |
| prompt | TEXT | Required, max 200 chars | None | Cell prompt text |
| content | TEXT | Nullable, max 1,000 chars | null | User response |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_therapy_topics

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| entry_id | TEXT | Required, references jr_entries.id | None | Parent therapy prep entry |
| section | TEXT | Required, one of 16 allowed values | None | Section identifier |
| content | TEXT | Required, max 1,000 chars | None | Topic/item text |
| sort_order | INTEGER | Required, min 0 | 0 | Position within section |
| is_completed | INTEGER | 0 or 1 | 0 | For action items |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

Allowed sections: `topics`, `wins`, `challenges`, `questions`, `takeaways`, `action_items`, `followup_questions`, `warning_signs`, `coping_strategies`, `support_contacts`, `safe_actions`, `original_goals`, `new_goals`, `patterns`, `working`, `not_working`

#### Entity: jr_affirmations

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| text | TEXT | Required, max 200 chars | None | Affirmation text |
| category | TEXT | Required, one of 8 categories | None | Category |
| is_builtin | INTEGER | 0 or 1 | 0 | System-provided |
| is_favorite | INTEGER | 0 or 1 | 0 | User favorited |
| is_dismissed | INTEGER | 0 or 1 | 0 | Permanently skipped |
| times_shown | INTEGER | Min 0 | 0 | Display count |
| times_affirmed | INTEGER | Min 0 | 0 | Affirm count |
| last_shown_date | TEXT | ISO date, nullable | null | Last displayed date |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

Allowed categories: `self_worth`, `resilience`, `growth`, `health`, `relationships`, `gratitude`, `productivity`, `peace`

#### Entity: jr_affirmation_logs

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| affirmation_id | TEXT | Required, references jr_affirmations.id | None | Which affirmation |
| log_date | TEXT | ISO date, required | Current date | Date of interaction |
| action | TEXT | Required, one of: 'shown', 'affirmed', 'wrote_entry', 'dismissed' | None | User action |
| entry_id | TEXT | Nullable, references jr_entries.id | null | Linked entry |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

#### Entity: jr_philosophy_quotes

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| day_number | INTEGER | Required, range 1-366, unique | None | Calendar day |
| quote_text | TEXT | Required, max 500 chars | None | Quote text |
| author | TEXT | Required, max 100 chars | None | Attribution |
| tradition | TEXT | Required, one of 5 traditions | None | Philosophical tradition |
| reflection_prompt | TEXT | Required, max 300 chars | None | Paired reflection question |
| is_favorite | INTEGER | 0 or 1 | 0 | User favorited |
| times_reflected | INTEGER | Min 0 | 0 | Reflection entry count |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |

Allowed traditions: `stoicism`, `buddhism`, `existentialism`, `pragmatism`, `general_wisdom`

#### Entity: jr_vision_boards

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| entry_id | TEXT | Required, references jr_entries.id | None | Parent entry |
| title | TEXT | Required, max 100 chars | None | Board title |
| orientation | TEXT | Required, one of: 'portrait', 'landscape' | 'portrait' | Canvas orientation |
| background_color | TEXT | Nullable, hex color | '#1A1A2E' | Canvas background |
| is_daily_vision | INTEGER | 0 or 1 | 0 | Show on app launch |
| item_count | INTEGER | Min 0 | 0 | Item count |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_vision_board_items

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| board_id | TEXT | Required, references jr_vision_boards.id | None | Parent board |
| item_type | TEXT | Required, one of: 'image', 'text', 'quote', 'goal' | None | Item type |
| content | TEXT | Nullable, max 500 chars | null | Text content |
| image_path | TEXT | Nullable | null | Local image path |
| position_x | REAL | Required, range 0-1 | 0.5 | Horizontal position (normalized) |
| position_y | REAL | Required, range 0-1 | 0.5 | Vertical position (normalized) |
| width | REAL | Required, range 0.05-1.0 | 0.3 | Width (normalized) |
| height | REAL | Required, range 0.05-1.0 | 0.3 | Height (normalized) |
| rotation_deg | REAL | Range -180 to 180 | 0 | Rotation degrees |
| z_index | INTEGER | Min 0 | 0 | Stacking order |
| background_color | TEXT | Nullable, hex color | null | Card background |
| font_size | INTEGER | Nullable, range 12-48 | 18 | Text font size |
| goal_target_date | TEXT | Nullable, ISO date | null | Goal target date |
| goal_progress | INTEGER | Nullable, range 0-100 | 0 | Goal progress % |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_book_projects

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto | Unique identifier |
| title | TEXT | Required, max 100 chars | None | Book title |
| subtitle | TEXT | Nullable, max 200 chars | null | Subtitle |
| author_name | TEXT | Required, max 100 chars | None | Author name |
| cover_design | TEXT | Required, one of: 'minimalist', 'photo', 'classic', 'modern', 'nature' | 'minimalist' | Cover template |
| cover_image_path | TEXT | Nullable | null | Cover photo path |
| page_size | TEXT | Required, one of: '6x9', '5.5x8.5', '8.5x11' | '6x9' | Book dimensions |
| body_font | TEXT | Required, one of: 'georgia', 'merriweather', 'open_sans', 'source_code_pro' | 'georgia' | Body font |
| entry_count | INTEGER | Min 1, max 500 | None | Entries included |
| page_count | INTEGER | Nullable, min 1 | null | Actual page count |
| pdf_path | TEXT | Nullable | null | Generated PDF path |
| status | TEXT | Required, one of: 'draft', 'generating', 'complete', 'failed' | 'draft' | Generation status |
| date_range_start | TEXT | ISO date | None | Start date filter |
| date_range_end | TEXT | ISO date | None | End date filter |
| filter_journal_ids | TEXT | Nullable, JSON array | null | Journal filter |
| filter_tag_ids | TEXT | Nullable, JSON array | null | Tag filter |
| filter_entry_types | TEXT | Nullable, JSON array | null | Entry type filter |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_settings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, setting key | None | Setting key name |
| value | TEXT | Nullable | None | Setting value (string-encoded) |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_onboarding_state

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, fixed 'onboarding' | 'onboarding' | Singleton |
| is_completed | INTEGER | 0 or 1 | 0 | Onboarding finished |
| completed_at | TEXT | Nullable, ISO datetime | null | Completion time |
| created_first_journal | INTEGER | 0 or 1 | 0 | First journal created |
| sample_entry_created | INTEGER | 0 or 1 | 0 | Sample entry generated |
| created_at | TEXT | ISO datetime, auto-set | Current timestamp | Record creation time |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Entity: jr_encryption_keys

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, fixed 'master' | 'master' | Singleton |
| salt | TEXT | Required, 256-bit hex-encoded | None | PBKDF2 salt (64 hex chars) |
| verification_hash | TEXT | Required | None | Hash of known plaintext encrypted with derived key, for passphrase verification |
| key_created_at | TEXT | ISO datetime | Current timestamp | When the key was first derived |
| updated_at | TEXT | ISO datetime, auto-set | Current timestamp | Last modification time |

#### Virtual Table: jr_entries_fts (FTS5)

```sql
CREATE VIRTUAL TABLE jr_entries_fts USING fts5(
  entry_id UNINDEXED,
  title,
  content_plain,
  tags,
  content=jr_entries,
  content_rowid=rowid,
  tokenize='porter unicode61'
);
```

This FTS5 virtual table enables full-text search across entry titles, plain text content, and tag names. It uses the Porter stemmer for English-language stemming and Unicode61 tokenizer for broad character support. The table is kept in sync with jr_entries via triggers on INSERT, UPDATE, and DELETE.

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| jr_journals -> jr_entries | one-to-many | A journal contains many entries |
| jr_journals -> jr_templates | many-to-one (optional) | A journal may have a default template |
| jr_entries -> jr_entry_tags | one-to-many | An entry can have many tag associations |
| jr_tags -> jr_entry_tags | one-to-many | A tag can be on many entries |
| jr_entries <-> jr_tags | many-to-many | Via jr_entry_tags join table |
| jr_entries -> jr_entry_attachments | one-to-many | An entry can have many attachments |
| jr_entries -> jr_gratitude_items | one-to-many | A gratitude entry has 1-5 gratitude items |
| jr_entries -> jr_thought_records | one-to-one | An entry has at most one thought record |
| jr_thought_records -> jr_thought_record_emotions | one-to-many | A thought record has multiple emotions |
| jr_thought_records -> jr_thought_record_distortions | one-to-many | A thought record has multiple distortions |
| jr_entries -> jr_grid_cells | one-to-many | A grid entry has multiple cells |
| jr_entries -> jr_therapy_topics | one-to-many | A therapy prep entry has multiple topics |
| jr_entries -> jr_vision_boards | one-to-one | A vision board entry has one board |
| jr_vision_boards -> jr_vision_board_items | one-to-many | A board has multiple items |
| jr_affirmations -> jr_affirmation_logs | one-to-many | An affirmation has multiple interaction logs |
| jr_affirmation_logs -> jr_entries | many-to-one (optional) | A log may link to an entry (wrote_entry action) |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| jr_entries | idx_entries_journal_id | journal_id | Filter entries by journal |
| jr_entries | idx_entries_entry_date | entry_date | Sort, calendar, streaks |
| jr_entries | idx_entries_created_at | created_at | Default sort order |
| jr_entries | idx_entries_favorite | is_favorite | Filter favorites |
| jr_entries | idx_entries_journal_date | journal_id, entry_date | Date-scoped queries within a journal |
| jr_entries | idx_entries_mood | mood_level | Mood analytics queries |
| jr_entries | idx_entries_type | entry_type | Filter by entry type |
| jr_entries | idx_entries_location | latitude, longitude | Location-based queries |
| jr_entries | idx_entries_therapy | therapy_session_number | Session history |
| jr_tags | idx_tags_name | name | Tag lookup by name |
| jr_entry_tags | idx_entry_tags_tag | tag_id | Find entries for a tag |
| jr_entry_attachments | idx_attachments_entry | entry_id | Attachments for an entry |
| jr_templates | idx_templates_builtin | is_builtin | Separate built-in from custom |
| jr_templates | idx_templates_usage | usage_count | Sort by most used |
| jr_gratitude_items | idx_gratitude_entry | entry_id | Items for an entry |
| jr_thought_records | idx_tr_entry | entry_id | Thought record for an entry |
| jr_thought_record_emotions | idx_tre_record | thought_record_id | Emotions for a record |
| jr_thought_record_distortions | idx_trd_record | thought_record_id | Distortions for a record |
| jr_thought_record_distortions | idx_trd_type | distortion_type | Frequency analysis |
| jr_grid_cells | idx_grid_entry | entry_id | Cells for an entry |
| jr_grid_cells | idx_grid_position | entry_id, cell_row, cell_col | Unique cell position (UNIQUE) |
| jr_therapy_topics | idx_therapy_entry | entry_id | Topics for a session |
| jr_therapy_topics | idx_therapy_order | entry_id, section, sort_order | Ordered topics |
| jr_affirmations | idx_affirm_dismissed | is_dismissed | Active affirmation pool |
| jr_affirmations | idx_affirm_favorite | is_favorite | Favorites filter |
| jr_affirmations | idx_affirm_category | category | Category grouping |
| jr_affirmations | idx_affirm_last_shown | last_shown_date | Daily selection |
| jr_affirmation_logs | idx_afflog_date | log_date, action | Streak and analytics |
| jr_affirmation_logs | idx_afflog_affirm | affirmation_id | History for an affirmation |
| jr_philosophy_quotes | idx_phil_day | day_number | Daily lookup (UNIQUE) |
| jr_philosophy_quotes | idx_phil_tradition | tradition | Tradition filter |
| jr_philosophy_quotes | idx_phil_favorite | is_favorite | Favorites filter |
| jr_vision_boards | idx_vb_daily | is_daily_vision | Daily vision lookup |
| jr_vision_board_items | idx_vbi_board | board_id | Items for a board |
| jr_vision_board_items | idx_vbi_zindex | board_id, z_index | Rendering order |
| jr_book_projects | idx_book_status | status | Find in-progress books |

### 4.5 Table Prefix

**MyLife hub table prefix:** `jr_`

All table names in the SQLite database are prefixed with `jr_` to avoid collisions with other modules in the MyLife hub. For example, the entries table is `jr_entries`, not `entries`. This prefix is applied to all tables including the FTS5 virtual table (`jr_entries_fts`) and the onboarding singleton (`jr_onboarding_state`).

### 4.6 Migration Strategy

- Tables are created on module enable. Schema version is tracked in the hub's `hub_module_migrations` table with module_id = 'journal'.
- Each migration is a sequential, numbered SQL file. Migrations run in order and are idempotent (use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN` with existence checks).
- The FTS5 virtual table and its sync triggers are created in the initial migration alongside the core tables.
- Seed data (10 built-in templates, 100 built-in affirmations, 365 philosophy quotes) is inserted during the initial migration using `INSERT OR IGNORE` to prevent duplicates on re-run.
- Data from a standalone MyJournal app (future) can be imported via the `@mylife/migration` package. The importer maps standalone table names to `jr_`-prefixed hub tables.
- Destructive migrations (column removal, table drops) are deferred to major versions only. Minor versions only add columns or tables.
- Encryption migration: when encryption is first enabled, a background task iterates all existing entries and encrypts their `content` and `content_plain` fields in place. A progress indicator is shown during this process. The `is_encrypted` flag is set per-entry as each is encrypted.

### 4.7 Encryption Architecture

**Algorithm:** AES-256-GCM (authenticated encryption)

**Key Derivation:**
- Algorithm: PBKDF2-HMAC-SHA256
- Iterations: 100,000
- Salt: 256-bit (32 bytes), randomly generated on first encryption setup, stored in `jr_encryption_keys.salt`
- Derived key length: 256 bits (32 bytes)

**Encryption Process (per entry):**
```
1. Generate a random 96-bit (12-byte) IV per encryption operation
2. Encrypt plaintext using AES-256-GCM with the derived key and IV
3. Concatenate: IV (12 bytes) || ciphertext || authentication tag (16 bytes)
4. Base64-encode the concatenated result
5. Store the Base64 string in the content field
6. Set is_encrypted = 1
```

**Decryption Process:**
```
1. Base64-decode the stored content
2. Extract: IV (first 12 bytes), authentication tag (last 16 bytes), ciphertext (middle)
3. Decrypt using AES-256-GCM with the derived key, IV, and tag
4. Verify authentication tag (GCM handles this automatically)
5. Return plaintext content
```

**Passphrase Verification:**
- On first encryption setup, encrypt a known verification string ("MYJOURNAL_VERIFY_v1") and store the ciphertext in `jr_encryption_keys.verification_hash`
- On passphrase entry (app unlock, passphrase change), derive the key and attempt to decrypt the verification ciphertext
- If decryption succeeds and matches the known string, the passphrase is correct
- If decryption fails (authentication tag mismatch), the passphrase is wrong

**Passphrase Change:**
```
1. Verify current passphrase (decrypt verification hash)
2. Derive new key from new passphrase with the existing salt
3. For each encrypted entry:
   a. Decrypt with old key
   b. Re-encrypt with new key
   c. Update entry
4. Update verification hash with new key
5. Progress indicator during re-encryption
```

**Security Properties:**
- Each entry uses a unique random IV, so identical plaintexts produce different ciphertexts
- GCM authentication tag prevents tampering (any modification to the ciphertext is detected)
- PBKDF2 with 100,000 iterations slows brute-force attacks on the passphrase
- The derived key is held in memory only while the app is unlocked and zeroed on lock
- The passphrase is never stored; only the salt and verification hash are persisted

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Home | House icon | Home / Today | Daily view with today's entries, affirmation card, philosophy card, streak indicator, On This Day |
| Journals | Book icon | Journal List | All journals with entry counts, quick access to create new entry in any journal |
| Search | Magnifying glass icon | Search | Full-text search across all entries, tags, and metadata with filters |
| Insights | Chart icon | Analytics Dashboard | Writing analytics, mood analytics, streak calendar, gratitude review |
| Settings | Gear icon | Settings | All preferences, export, data management, about |

### 5.2 Navigation Flow

```
[Tab 1: Home]
  ├── Daily Affirmation Card
  │     └── New Entry (from "Write About This")
  ├── Daily Philosophy Card
  │     └── New Entry (from "Reflect on This")
  ├── On This Day Section
  │     └── Entry Reading View
  │           └── Entry Editor
  ├── Today's Entries List
  │     └── Entry Reading View
  │           ├── Entry Editor
  │           ├── Thought Record Wizard
  │           └── Share / Export
  ├── Streak Indicator
  │     └── Calendar Heatmap (full screen)
  └── New Entry FAB
        ├── Template Selector Modal
        │     └── Entry Editor (with selected template)
        ├── Gratitude Entry
        ├── Grid Entry (from grid template)
        ├── Therapy Prep Entry
        └── Vision Board Canvas

[Tab 2: Journals]
  ├── Journal List
  │     ├── Create New Journal
  │     ├── Journal Detail (entry list for one journal)
  │     │     ├── Entry Reading View
  │     │     │     └── Entry Editor
  │     │     └── New Entry (in this journal)
  │     └── Edit Journal (name, color, icon, default template)
  ├── Templates Library
  │     ├── Template Editor (custom)
  │     └── Grid Layout Builder
  ├── Vision Board List
  │     └── Vision Board Canvas
  ├── Session Timeline (therapy)
  │     └── Therapy Prep Entry Reading View
  └── Affirmation Library
        └── Affirmation Detail

[Tab 3: Search]
  ├── Search Input + Filters
  │     ├── Filter by journal
  │     ├── Filter by tag
  │     ├── Filter by date range
  │     ├── Filter by entry type
  │     └── Filter by mood level
  └── Search Results List
        └── Entry Reading View
              └── Entry Editor

[Tab 4: Insights]
  ├── Writing Analytics
  │     ├── Overview Stats
  │     ├── Time Patterns
  │     ├── Weekly Trends
  │     ├── Journal Breakdown
  │     └── Daily Goal Progress
  ├── Mood Analytics
  │     ├── Mood Trend Line
  │     ├── Mood Distribution
  │     ├── Top Emotions
  │     ├── Tag-Mood Correlations
  │     ├── Time-Mood Correlations
  │     ├── CBT Summary
  │     └── Monthly Summary Card
  ├── Streak Calendar (Heatmap)
  │     ├── General Streak
  │     └── Gratitude Streak
  └── Gratitude Review
        ├── Gratitude Themes Word Cloud
        └── Gratitude Stats

[Tab 5: Settings]
  ├── General Settings
  ├── Daily Practice Settings
  ├── Privacy & Security Settings
  │     ├── Change Passphrase Flow
  │     └── Biometric Lock Configuration
  ├── Data Management
  │     ├── Export Wizard (PDF / Markdown / Text)
  │     ├── Book Builder (Printed Books)
  │     │     ├── Entry Selection
  │     │     ├── Customization
  │     │     ├── Preview
  │     │     └── Generation
  │     └── Delete All Data (double confirmation)
  └── About
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Home / Today | `/journal` | Daily view, affirmation, philosophy, On This Day, recent entries | Tab 1 tap, app launch |
| Entry Editor | `/journal/entry/:id/edit` or `/journal/entry/new` | Create or edit a journal entry | New Entry FAB, "Edit" on reading view, template use, affirmation/philosophy write |
| Entry Reading View | `/journal/entry/:id` | Read a formatted entry with metadata | Tap entry from any list, On This Day, search results |
| Journal List | `/journal/journals` | Browse and manage journals | Tab 2 tap |
| Journal Detail | `/journal/journals/:id` | View entries in a single journal | Tap journal from list |
| Create/Edit Journal | `/journal/journals/:id/edit` | Name, color, icon, default template | Long press journal, "+" in journal list |
| Search | `/journal/search` | Full-text search with filters | Tab 3 tap |
| Writing Analytics | `/journal/insights/writing` | Word counts, time patterns, trends, goals | Tab 4 tap, "Writing" section |
| Mood Analytics | `/journal/insights/mood` | Mood trends, correlations, CBT summary | Tab 4 tap, "Mood" section |
| Calendar Heatmap | `/journal/insights/calendar` | Streak calendar with heatmap | Tab 4 tap, streak indicator on Home |
| Gratitude Entry | `/journal/entry/new?type=gratitude` | Structured gratitude journaling | New Entry type selector |
| Gratitude Review | `/journal/insights/gratitude` | Gratitude themes and stats | Tab 4 tap, "Gratitude" section |
| Thought Record Wizard | `/journal/entry/:id/thought-record` | CBT 6-step wizard | "Start Thought Record" on entry |
| Grid Entry Editor | `/journal/entry/new?type=grid` | Grid/mandala layout entry | Grid template selection |
| Grid Layout Builder | `/journal/templates/grid/new` | Create custom grid layouts | Templates library |
| Template Library | `/journal/templates` | Browse and manage templates | Tab 2, Templates section |
| Template Editor | `/journal/templates/:id/edit` | Edit custom templates | Template library actions |
| Therapy Prep Entry | `/journal/entry/new?type=therapy_prep` | Structured therapy preparation | New Entry type selector |
| Session Timeline | `/journal/therapy/timeline` | Chronological therapy session history | Tab 2, Sessions section |
| Vision Board List | `/journal/vision-boards` | Browse vision boards | Tab 2, Vision Boards section |
| Vision Board Canvas | `/journal/vision-boards/:id` | Edit a vision board | Tap board from list |
| Book Builder | `/journal/books/new` | Create printed book from entries | Settings > Data Management |
| Affirmation Library | `/journal/affirmations` | Browse and manage affirmations | Tab 2, Affirmations section |
| Philosophy Library | `/journal/philosophy` | Browse philosophy quotes | Tradition badge tap, Tab 2 |
| Settings | `/journal/settings` | All preferences and configuration | Tab 5 tap |
| Export Wizard | `/journal/export` | Export entries as PDF/Markdown/Text | Settings > Data Management |
| Onboarding | `/journal/onboarding` | First-run setup | First launch, after data delete |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://journal` | Home Screen | None |
| `mylife://journal/entry/:id` | Entry Reading View | id: UUID of entry |
| `mylife://journal/entry/new` | New Entry Editor | Optional: type, journal_id, template_id |
| `mylife://journal/journals/:id` | Journal Detail | id: UUID of journal |
| `mylife://journal/search?q=:query` | Search with pre-filled query | q: search text |
| `mylife://journal/insights` | Analytics Dashboard | None |
| `mylife://journal/insights/mood` | Mood Analytics | None |
| `mylife://journal/settings` | Settings | None |
| `mylife://journal/onboarding` | Onboarding (for testing) | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Mood data sharing | Journal | Mood (future) | Journal mood_level and mood_emotion per entry are readable by the Mood module for unified mood dashboards | On entry save with mood tag |
| Journaling as habit | Journal | Habits | Journal reports whether an entry was created today (boolean signal) for habit tracking | On entry save, daily check |
| Streak data sharing | Journal | Habits | Journal current_streak and longest_streak values are readable by Habits for display | On streak recalculation |
| Health journaling | Journal | Health (future) | Entries tagged with health-related tags can surface in Health module insights | Tag-based query |
| Medication side effects | Journal | Meds (future) | Entries tagged with medication names can be cross-referenced with medication logs | Tag-based query |
| Book reading reflections | Journal | Books | Entries tagged with book titles or ISBNs can link to MyBooks library entries | Tag-based query, optional deep link |
| Workout reflections | Journal | Workouts | Entries tagged with workout types can link to MyWorkouts activity logs | Tag-based query |

**Integration Protocol:**
- All cross-module data sharing is read-only from the consumer's perspective. No module writes to another module's tables.
- Data sharing uses the hub's module registry event bus: modules publish events (e.g., `journal:entry_saved`) and other modules subscribe.
- If the target module is not enabled, events are silently dropped.
- Cross-module queries use the hub's shared database connection with the target module's table prefix.

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Journal entries (text) | Local SQLite (jr_entries) | Optional (AES-256-GCM, user-enabled) | No | Never leaves device |
| Entry metadata (mood, location, weather) | Local SQLite (jr_entries) | With entry (if encrypted) | No | Location from device GPS, weather from Open-Meteo API |
| Photo attachments | Local file system | Separate file encryption (same key) | No | Stored alongside database |
| Voice recordings | Local file system | Separate file encryption (same key) | No | Processed on-device for transcription |
| Thought records (CBT data) | Local SQLite (jr_thought_records) | With parent entry | No | Clinically sensitive material |
| Mood and emotion data | Local SQLite (jr_entries) | With entry (if encrypted) | No | Mental health data |
| Affirmation interaction logs | Local SQLite (jr_affirmation_logs) | No (non-sensitive metadata) | No | Usage analytics only |
| Philosophy quotes | Local SQLite (jr_philosophy_quotes) | No (public domain content) | No | Bundled with app |
| User settings/preferences | Local SQLite (jr_settings) | No (non-sensitive config) | No | App configuration |
| Encryption salt and verification hash | Local SQLite (jr_encryption_keys) | No (salt is not secret) | No | Required for key derivation |
| Vision board images | Local file system | Separate file encryption (same key) | No | User's personal images |
| Book project PDFs | Local file system | Not encrypted (exported content) | No | User-generated output |
| FTS5 search index | Local SQLite (jr_entries_fts) | No (derived from encrypted content, rebuilt on unlock) | No | Rebuilt from decrypted content on module unlock |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Weather fetch | Capture weather for entry metadata | Latitude and longitude only (no user identifiers) | Temperature, weather description, weather icon | Implicit (user enabled weather in settings) |

**All other module functionality operates entirely offline. No other network requests are made under any circumstances.**

The weather API (Open-Meteo) is free, requires no API key, does not track users, and receives only geographic coordinates. No journal content, mood data, personal information, or device identifiers are ever transmitted.

### 7.3 Data That Never Leaves the Device

- Journal entry text, titles, and all content
- Mood levels, emotions, and mood history
- CBT thought records (situations, thoughts, distortions, responses)
- Gratitude items and gratitude themes
- Photo and voice recording attachments
- Tag names and tag associations
- Location coordinates and place names (stored locally, not transmitted except lat/lon for weather)
- Therapy preparation notes and session history
- Vision board images, layouts, and goals
- Writing analytics and streak data
- Search queries and search history
- Encryption keys and passphrases
- Affirmation interaction history
- User preferences and settings

### 7.4 User Data Ownership

- **Export:** Users can export all entries in PDF, Markdown, or plain text format via the Export Wizard (JR-012). Exports include entry content, metadata, tags, and attachment references. Photo attachments can be exported as a companion folder alongside the text export.
- **Printed Books:** Users can generate print-ready PDFs of their entries (JR-025) for physical book printing.
- **Delete:** Users can delete all module data from Settings (JR-026). Deletion is irreversible and requires double confirmation (dialog + typing "DELETE"). All tables, files, and indexes are wiped.
- **Portability:** Export formats are documented, human-readable, and use standard file formats (PDF, Markdown, plain text). No proprietary formats. Users can open exports in any text editor, PDF viewer, or Markdown renderer.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Entry encryption | AES-256-GCM with PBKDF2-derived key (100,000 iterations, 256-bit salt, 96-bit IV per operation) | User-enabled in Settings or during onboarding. Free for all users. |
| Biometric lock | Optional biometric authentication (Face ID, Touch ID, fingerprint) to unlock the journal module | Requires encryption to be enabled first. Configurable lock timeout: immediately, 1, 5, 15, or 30 minutes. |
| Passphrase requirements | Minimum strength score of 3/7 (at least "Fair") | Strength calculated from length (8+ chars) and complexity (lowercase, uppercase, digits, special characters). |
| Key zeroing | Derived encryption key is zeroed from memory on module lock or app backgrounding (after lock timeout) | Prevents memory-dump attacks on locked devices. |
| Encryption verification | Known-plaintext verification hash stored for passphrase validation | Prevents silent data corruption from wrong passphrase. |
| Delete confirmation | Double confirmation for data deletion (dialog + text input "DELETE") | Prevents accidental data loss. |
| Auto-lock | Module locks after configurable timeout when app is backgrounded | Biometric or passphrase required to unlock. |
| No clipboard leakage | Entry content is not written to system clipboard unless user explicitly copies text | Prevents clipboard history exposure. |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Entry | A single journal entry containing text content (Markdown), optional mood tag, optional attachments, and metadata. The fundamental content unit of MyJournal. |
| Journal | A named notebook that organizes entries. Users can create multiple journals for different life areas (personal, work, travel). Also called a "notebook." |
| Tag | A user-defined or system-generated label applied to entries for categorization and filtering. Tags are module-wide (not journal-specific). |
| Streak | The count of consecutive calendar days on which the user created at least one entry. Uses a 1-day grace period (missing one day does not break the streak until the end of the following day). |
| Mood Level | A 1-5 integer rating representing the user's emotional state when writing an entry. 1 = terrible, 2 = bad, 3 = neutral, 4 = good, 5 = great. |
| Mood Emotion | A specific emotion label (e.g., "grateful", "anxious", "hopeful") that refines the numeric mood level. |
| Thought Record | A structured CBT (Cognitive Behavioral Therapy) exercise consisting of 6 steps: situation, automatic thought, emotion, cognitive distortion, rational response, and outcome. |
| Cognitive Distortion | One of 15 recognized patterns of biased thinking identified in Cognitive Behavioral Therapy (e.g., all-or-nothing thinking, catastrophizing, should statements). |
| FTS5 | SQLite's Full-Text Search extension, version 5. Used for fast text search across entry content with stemming support (the Porter stemmer). |
| Heatmap | A calendar-based visualization where each day is colored by intensity (e.g., number of entries or words written). Used in streak tracking and analytics. |
| Template | A reusable entry structure with pre-filled headings, sections, and placeholder text. Templates can be built-in (system-provided) or custom (user-created). |
| Grid Layout | An alternative entry format where the writing area is divided into a grid of cells, each with its own prompt. Inspired by Grid Diary. |
| Affirmation | A positive self-statement displayed daily for motivational practice. Can be built-in (from the 100 bundled affirmations) or custom (user-written). |
| Vision Board | A visual collage of images, text cards, quotes, and goal cards arranged on a free-form canvas for goal visualization. |
| Therapy Prep | A structured entry template designed for therapy session preparation, including auto-populated mood and thought record data. |
| Encryption at Rest | Data stored on the device in encrypted form using AES-256-GCM. Content is decrypted in memory only when the user unlocks the module with their passphrase or biometric authentication. |
| PBKDF2 | Password-Based Key Derivation Function 2. Used to derive the AES-256 encryption key from the user's passphrase. Configured with 100,000 iterations to resist brute-force attacks. |
| AES-256-GCM | Advanced Encryption Standard with 256-bit keys in Galois/Counter Mode. Provides both encryption (confidentiality) and authentication (integrity). Each encryption operation uses a unique 96-bit initialization vector (IV). |
| Grace Period | A 1-day buffer in streak calculation. If the user misses one day, the streak is not broken until the end of the following day, giving the user until midnight to journal and preserve their streak. |
| Content Plain | A derived plain-text version of an entry's Markdown content, with all Markdown syntax stripped. Used for word count calculation and full-text search indexing. |
| Word Count | The number of whitespace-delimited tokens in content_plain. Calculated on every content update and stored on the entry for fast retrieval. |
| Module | In the MyLife hub architecture, a self-contained feature unit (e.g., MyJournal, MyBooks, MyBudget) that can be independently enabled or disabled. Each module has its own table prefix, migrations, and navigation routes. |
| Daily Vision | A vision board configured to display as a full-screen overlay when the app launches. Only one vision board can be set as the daily vision at a time. |
| Session Number | An auto-incrementing integer assigned to each therapy prep entry, providing a chronological session count. Session numbers are never reused even if entries are deleted. |
| On This Day | A nostalgia feature that displays entries from the same calendar date in previous years. Helps users reflect on personal growth and revisit past memories. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (spec-myjournal agent) | Initial specification: Sections 1-2, JR-001 through JR-019 |
| 1.1 | 2026-03-07 | Claude (Opus 4.6) | Completed specification: JR-020 through JR-027, Sections 4-8 |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should FTS5 index be rebuilt on every unlock (for encrypted entries) or maintained separately? | If entries are encrypted, the FTS5 index contains plaintext tokens. Rebuilding on unlock is more secure but slower. | Rebuild on unlock for encrypted modules. Cache index in memory during session. | Pending |
| 2 | Should voice transcription use on-device models only, or allow optional cloud transcription for higher accuracy? | On-device transcription (e.g., Apple Speech, Android SpeechRecognizer) has lower accuracy than cloud services. Privacy vs. quality trade-off. | On-device only for initial release. Cloud opt-in may be added later with explicit user consent. | Pending |
| 3 | What print-on-demand partner should be integrated for direct book ordering (JR-025 v2)? | Blurb, Lulu, and Amazon KDP all have APIs. Need to evaluate pricing, quality, and API accessibility. | Deferred to v2. Initial release exports print-ready PDF only. | Pending |
| 4 | Should the philosophy quote library support user-contributed quotes or remain a curated, read-only set? | User contributions would grow the library but introduce moderation needs. Read-only is simpler. | Read-only for initial release. Custom quotes can be added as affirmations (JR-021). | Pending |
| 5 | How should the biometric lock interact with the MyLife hub's own app-level lock (if one exists)? | If the hub has biometric lock at the app level, having another lock at the module level creates UX friction. | Module lock is independent. If hub lock exists, module lock adds a second layer for sensitive content. Final UX depends on hub-level security design. | Pending |
