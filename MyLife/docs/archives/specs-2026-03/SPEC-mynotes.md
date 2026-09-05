# MyNotes - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-mynotes agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyNotes
- **Tagline:** Plain markdown notes, no lock-in
- **Module ID:** `notes`
- **Feature ID Prefix:** `NT`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Personal Note-Taker | Ages 18-40, takes notes on phone/laptop daily, comfortable with basic formatting | Capture thoughts quickly, organize with folders and tags, find notes fast |
| Knowledge Worker | Ages 25-50, writes meeting notes, project docs, research notes, values structure | Wiki-style linking between notes, backlinks for context discovery, templates for recurring note types |
| Developer/Technical Writer | Ages 20-45, writes code snippets, technical documentation, uses markdown fluently | Code blocks with syntax highlighting, markdown editing with live preview, export to markdown files |
| Privacy-Conscious Writer | Any age, keeps personal reflections, medical notes, financial notes, legal drafts | Full data ownership, zero cloud dependency, local-only storage, no telemetry |
| Student/Researcher | Ages 16-30, takes lecture notes, builds study references, organizes by course/topic | Folder hierarchy for courses, full-text search across all notes, daily notes for study logs |

### 1.3 Core Value Proposition

MyNotes is a privacy-first markdown note-taking app that stores all data locally in SQLite. Users write in markdown with live preview, organize notes with folders and tags, link notes together using wiki-style [[double brackets]], and visualize their knowledge graph. Unlike Notion (cloud-only, broad data usage rights) and Evernote (cloud-only, historically lax access controls), MyNotes never sends note content off-device. Unlike Bear (Apple-only), MyNotes works on iOS, Android, and web. MyNotes brings Obsidian's local-first privacy model to a polished cross-platform experience with a mobile-first design.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Notion | All-in-one workspace, databases, real-time collaboration, rich embeds | Cloud-only, broad data usage terms, $120/yr for personal use, requires account | Fully offline, zero data collection, no account required, free tier |
| Evernote | Powerful OCR search, web clipping, mature platform | Cloud-only, $99-250/yr, privacy concerns after Bending Spoons acquisition, declining product quality | Local-first, no subscription required for core features, transparent privacy model |
| Bear | Elegant markdown editor, nested tags, clean design | Apple ecosystem only (no Android, no web), $30/yr for sync | Cross-platform (iOS, Android, web), no ecosystem lock-in |
| Obsidian | Local-first plain-text markdown, 1600+ plugins, graph view, no telemetry | Desktop-first UX, mobile app is secondary, plugin ecosystem can be overwhelming, sync costs $50/yr | Mobile-first cross-platform UI, simpler opinionated feature set, integrated hub experience |
| Apple Notes | Pre-installed, fast, good handwriting support, free | Apple ecosystem only, limited markdown support, no backlinks, no graph view | Full markdown support, wiki linking, knowledge graph, cross-platform |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All note content, folders, tags, links, and metadata are stored locally on the device in SQLite
- Zero analytics, zero telemetry, zero tracking
- No account required for any functionality
- Users own their data with full export (Markdown files, JSON) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export
- No network requests are made under any circumstances for core functionality
- Image and file attachments are stored locally on the device file system
- Search is performed locally using FTS5 - no search queries are transmitted anywhere
- Version history and diffs are computed and stored entirely on-device
- The knowledge graph is rendered locally from link data already in the database

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| NT-001 | Markdown Editor with Live Preview | P0 | Core | None | Not Started |
| NT-002 | Notebook and Folder Hierarchy | P0 | Data Management | None | Not Started |
| NT-003 | Full-Text Search (FTS5) | P0 | Data Management | NT-001 | Not Started |
| NT-004 | Tag System | P0 | Data Management | NT-001 | Not Started |
| NT-005 | Note Pinning and Favorites | P0 | Core | NT-001 | Not Started |
| NT-006 | Wiki-Style [[Backlinks]] | P1 | Core | NT-001 | Not Started |
| NT-007 | Backlinks Panel | P1 | Core | NT-006 | Not Started |
| NT-008 | Note Templates | P1 | Core | NT-001, NT-002 | Not Started |
| NT-009 | Task Lists and Checklists | P1 | Core | NT-001 | Not Started |
| NT-010 | Code Blocks with Syntax Highlighting | P1 | Core | NT-001 | Not Started |
| NT-011 | Rich Embeds (Images, Files) | P1 | Core | NT-001 | Not Started |
| NT-012 | Note Export (Markdown, PDF, JSON) | P1 | Import/Export | NT-001 | Not Started |
| NT-013 | Note Import | P1 | Import/Export | NT-001, NT-002 | Not Started |
| NT-014 | Daily Notes | P2 | Core | NT-001, NT-008 | Not Started |
| NT-015 | Knowledge Graph View | P2 | Analytics | NT-006 | Not Started |
| NT-016 | Table of Contents from Headers | P2 | Core | NT-001 | Not Started |
| NT-017 | Table Support | P2 | Core | NT-001 | Not Started |
| NT-018 | Version History with Diffs | P2 | Data Management | NT-001 | Not Started |
| NT-019 | Quick Capture | P1 | Core | NT-001, NT-002 | Not Started |
| NT-020 | Note Sorting and Filtering | P1 | Data Management | NT-001, NT-002, NT-004 | Not Started |
| NT-021 | Settings and Preferences | P0 | Settings | None | Not Started |
| NT-022 | Onboarding and First-Run | P1 | Onboarding | NT-001, NT-002 | Not Started |
| NT-023 | Word and Character Count | P1 | Analytics | NT-001 | Not Started |
| NT-024 | Focus/Zen Mode | P2 | Core | NT-001 | Not Started |

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

### NT-001: Markdown Editor with Live Preview

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-001 |
| **Feature Name** | Markdown Editor with Live Preview |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a personal note-taker, I want to write notes in markdown and see a formatted preview in real time, so that I can focus on content while verifying my formatting looks correct.

**Secondary:**
> As a developer, I want a markdown editor that supports code fences, tables, and math blocks natively, so that I can write technical documentation without switching to a separate tool.

**Tertiary:**
> As a student, I want to toggle between a full-screen editor and a side-by-side editor/preview layout, so that I can choose the writing mode that best fits my screen size and preference.

#### 3.3 Detailed Description

The Markdown Editor with Live Preview is the foundational feature of MyNotes. It provides a split-pane or toggle-mode editing experience where users write standard CommonMark-compliant markdown in a text input area and see the rendered output update as they type. The editor parses the raw markdown text into an Abstract Syntax Tree (AST) on every keystroke (debounced to 150ms), transforms the AST into a rendered preview, and displays the result alongside or below the raw text.

The editor supports the full CommonMark specification plus the following extensions: strikethrough (~~text~~), task lists (- [x]), tables (pipe syntax), footnotes ([^ref]), and LaTeX math blocks (inline $...$ and display $$...$$). These extensions are parsed into distinct AST node types that the preview renderer handles independently.

On mobile devices, the default mode is a single-pane editor with a "Preview" toggle button in the toolbar that swaps between editing and rendered view. On desktop and tablet screens wider than 768px, the default mode is side-by-side with a vertical divider. Users can override the default by selecting their preferred mode in settings (NT-021): "Edit Only", "Preview Only", "Side-by-Side", or "Auto" (responsive based on screen width).

The editor includes a formatting toolbar that appears above the keyboard on mobile and at the top of the editor pane on desktop. The toolbar provides buttons for: bold, italic, strikethrough, heading (cycles H1-H6), unordered list, ordered list, task list, code inline, code block, link, image embed, horizontal rule, and table insertion. Each toolbar button inserts the appropriate markdown syntax at the cursor position, wrapping selected text when applicable. For example, selecting the word "hello" and tapping the bold button wraps it as **hello**.

Keyboard shortcuts are available for power users: Ctrl/Cmd+B for bold, Ctrl/Cmd+I for italic, Ctrl/Cmd+K for link, Ctrl/Cmd+Shift+K for code block, Ctrl/Cmd+1 through Ctrl/Cmd+6 for headings H1-H6, Ctrl/Cmd+Shift+7 for ordered list, Ctrl/Cmd+Shift+8 for unordered list, Ctrl/Cmd+Shift+9 for task list, and Ctrl/Cmd+E for inline code. All shortcuts are displayed in a discoverable shortcut reference accessible from the editor toolbar.

The editor supports undo/redo with a history depth of 100 states. Each state captures the full text content and cursor position. Undo/redo are triggered via Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z respectively, or via toolbar buttons on mobile.

Auto-save triggers 2 seconds after the user stops typing. A status indicator in the top bar shows "Saving..." during the write operation and "Saved" with a timestamp once complete. If the save fails (e.g., storage full), the indicator shows "Save failed" in a warning color and the note content remains in memory until the next successful save attempt.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Local persistent storage for saving note content
- A markdown parser capable of producing an AST from CommonMark + extensions
- A rendering engine that transforms AST nodes into formatted visual output

**Assumed Capabilities:**
- User can navigate to the note editor from the note list or create action
- Local database is initialized and writable
- On-screen keyboard is available on mobile devices

#### 3.5 User Interface Requirements

##### Screen: Note Editor (Mobile)

**Layout:**
- Top navigation bar displays: back arrow (left), note title (center, tappable to rename), and an overflow menu button (right, three-dot icon)
- Below the nav bar is the formatting toolbar: a horizontally scrollable row of icon buttons for bold, italic, strikethrough, heading, lists, code, link, image, table, and horizontal rule
- The main content area fills the remaining screen height and contains the markdown text input. The text input supports multiline editing with soft wrapping, monospaced font at 14pt, line height of 1.6, and horizontal padding of 16px
- At the bottom of the screen (above the keyboard when active) is a status bar showing: word count (left), character count (center), and save status indicator (right)
- A "Preview" toggle button in the top-right of the toolbar switches between edit mode and rendered preview mode. In preview mode, the text input is replaced by the rendered markdown output in a scrollable container

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Note | Note body is empty | Text input with placeholder text: "Start writing..." in muted color |
| Editing | User is typing | Monospaced text input with cursor, formatting toolbar visible, word count updating in real time |
| Preview Mode | User tapped Preview toggle | Rendered markdown fills the content area, toolbar shows "Edit" toggle to return, content is scrollable but not editable |
| Saving | Auto-save in progress | Status bar shows "Saving..." with a subtle spinner icon |
| Saved | Auto-save completed | Status bar shows "Saved at [HH:MM]" in muted text |
| Save Failed | Write to storage failed | Status bar shows "Save failed" in warning color with a retry icon |
| Error | Parser encounters malformed input | The preview pane displays the raw text for the malformed section rather than crashing; no error is shown to the user |

**Interactions:**
- Tap formatting button: inserts markdown syntax at cursor position (wraps selection if text is selected)
- Tap "Preview" toggle: swaps view from editor to rendered preview (and vice versa)
- Tap note title in nav bar: opens an inline rename field to change the note title
- Tap back arrow: saves note (if unsaved changes exist) and navigates back to the note list
- Tap overflow menu: opens action sheet with options "Share", "Export", "Pin/Unpin", "Move to Folder", "Add Tags", "Delete"
- Long press on formatted toolbar button: shows a tooltip label describing the action (e.g., "Bold (Ctrl+B)")

**Transitions/Animations:**
- Switching between Edit and Preview mode uses a horizontal slide transition, 250ms duration, ease-in-out timing
- Save status text fades in/out with 200ms fade transition
- Formatting toolbar slides up when the keyboard appears and slides down when it dismisses

##### Screen: Note Editor (Desktop/Web)

**Layout:**
- Top bar spans full width: back arrow (left), note title (center, tappable to rename), save status indicator (right of title), and overflow menu (far right)
- Below the top bar is the formatting toolbar: a fixed horizontal row of icon buttons, same set as mobile, plus keyboard shortcut hints visible next to each button (e.g., the bold button shows "B" with a small "Ctrl+B" label)
- The main content area is split into two equal-width vertical panes with a draggable divider between them:
  - Left pane: markdown text input (monospaced font, 14pt, line numbers in the gutter, line height 1.6)
  - Right pane: rendered markdown preview (prose-styled output with proportional font, proper heading sizes, styled lists, code block backgrounds, and table borders)
- The divider can be dragged left or right to resize panes. Double-clicking the divider resets to 50/50 split
- Bottom status bar spans full width: word count (left), character count (center-left), line and column number (center-right), save status (right)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Side-by-Side | Default mode for screens > 768px wide | Two panes visible with divider |
| Editor Only | User collapses preview pane or selects mode in settings | Full-width editor with line numbers |
| Preview Only | User collapses editor pane or selects mode in settings | Full-width rendered preview |
| Scroll Sync Active | User scrolls either pane | The opposite pane scrolls proportionally to maintain approximate position alignment |

**Interactions:**
- Type in editor pane: preview pane updates after 150ms debounce
- Scroll editor pane: preview pane scrolls proportionally (scroll sync)
- Drag divider: resizes pane widths, minimum 200px per pane
- Double-click divider: resets to 50/50 split
- Keyboard shortcut (Ctrl/Cmd+\\): toggles between side-by-side and editor-only mode
- Right-click in editor: context menu with Cut, Copy, Paste, Select All, plus "Format as..." submenu

**Transitions/Animations:**
- Pane resize follows the drag handle in real time with no delay
- Preview content updates with a 100ms fade-in when the debounced parse completes
- Scroll sync is smooth, not snapping

##### Modal: Keyboard Shortcut Reference

**Layout:**
- Modal overlay with a two-column table listing all available keyboard shortcuts
- Left column: shortcut description (e.g., "Bold", "Italic", "Insert Link")
- Right column: key combination (e.g., "Ctrl+B", "Ctrl+I", "Ctrl+K")
- Grouped by category: "Formatting", "Headings", "Lists", "Navigation", "Editor"
- Close button in top-right corner, also closeable by pressing Escape

**Interactions:**
- Opened via toolbar icon (keyboard icon) or Ctrl/Cmd+/ shortcut
- Tap outside modal or press Escape to close

#### 3.6 Data Requirements

##### Entity: Note

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier for the note |
| title | TEXT | Required, max 500 characters | "Untitled Note" | Display title of the note |
| body | TEXT | Optional, no max length | "" (empty string) | Raw markdown content of the note |
| body_plain | TEXT | Optional, no max length | "" (empty string) | Plaintext extraction of body for search indexing (stripped of markdown syntax) |
| folder_id | TEXT (UUID) | References Folder.id, nullable | null | Parent folder, null means root level |
| is_pinned | BOOLEAN | - | false | Whether the note is pinned to the top of its list |
| is_favorited | BOOLEAN | - | false | Whether the note is marked as a favorite |
| is_daily_note | BOOLEAN | - | false | Whether this note was auto-generated as a daily note |
| daily_date | TEXT | ISO date (YYYY-MM-DD), nullable | null | The calendar date for daily notes |
| word_count | INTEGER | Min: 0 | 0 | Cached word count of the note body |
| character_count | INTEGER | Min: 0 | 0 | Cached character count of the note body |
| template_id | TEXT (UUID) | References NoteTemplate.id, nullable | null | Template used to create this note, null if none |
| created_at | TEXT | ISO 8601 datetime, auto-set on creation | Current timestamp | When the note was first created |
| updated_at | TEXT | ISO 8601 datetime, auto-set on modification | Current timestamp | When the note was last modified |

**Relationships:**
- Note belongs to Folder (many-to-one via folder_id, nullable for root-level notes)
- Note has many NoteTag (one-to-many, join entity connecting notes and tags)
- Note has many NoteLink (one-to-many, representing outgoing wiki-style links)
- Note has many NoteVersion (one-to-many, version history snapshots)

**Indexes:**
- `folder_id` - Frequently queried when listing notes in a folder
- `is_pinned` - Queried for sorting pinned notes to the top
- `is_daily_note, daily_date` - Composite index for daily note lookups by date
- `updated_at` - Sorted listing by last modified
- `created_at` - Sorted listing by creation date

**Validation Rules:**
- `title`: Must not be empty string after trimming whitespace; if user clears the title, reset to "Untitled Note"
- `body`: No constraints; empty notes are allowed
- `word_count` and `character_count`: Recalculated on every save from the body content
- `daily_date`: Must be a valid ISO date string if is_daily_note is true; must be null if is_daily_note is false

**Example Data:**

```
{
  "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
  "title": "Project Kickoff Notes",
  "body": "# Project Kickoff\n\n## Attendees\n- Alice\n- Bob\n- Charlie\n\n## Action Items\n- [ ] Set up repo\n- [ ] Create design mockups\n- [x] Schedule follow-up meeting\n\n## Notes\nWe agreed on a **two-week sprint** cycle. See [[Sprint Planning Template]] for details.",
  "body_plain": "Project Kickoff Attendees Alice Bob Charlie Action Items Set up repo Create design mockups Schedule follow-up meeting Notes We agreed on a two-week sprint cycle. See Sprint Planning Template for details.",
  "folder_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "is_pinned": true,
  "is_favorited": false,
  "is_daily_note": false,
  "daily_date": null,
  "word_count": 38,
  "character_count": 245,
  "template_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "created_at": "2026-03-01T09:15:00Z",
  "updated_at": "2026-03-01T10:42:00Z"
}
```

#### 3.7 Business Logic Rules

##### Markdown AST Parsing

**Purpose:** Convert raw markdown text into a structured Abstract Syntax Tree for rendering and link extraction.

**Inputs:**
- raw_text: string - the full markdown content of the note

**Logic:**

```
1. Tokenize raw_text using a CommonMark-compliant lexer
2. Parse tokens into AST nodes with the following node types:
   - Document (root)
   - Heading (level 1-6)
   - Paragraph
   - Text, Emphasis, Strong, Strikethrough
   - Link (href, title), Image (src, alt)
   - CodeInline, CodeBlock (language, content)
   - List (ordered/unordered), ListItem, TaskListItem (checked: boolean)
   - Blockquote
   - ThematicBreak (horizontal rule)
   - Table, TableRow, TableCell (alignment)
   - Footnote (label, content)
   - MathInline, MathBlock (LaTeX content)
   - WikiLink (target title)
3. For each WikiLink node (pattern: [[target_title]]):
   a. Extract target_title from within double brackets
   b. Look up existing notes by exact title match (case-insensitive)
   c. If found, mark the WikiLink node as resolved with the target note's id
   d. If not found, mark the WikiLink node as unresolved
4. RETURN the complete AST
```

**Formulas:**
- `word_count = count of whitespace-separated tokens in body_plain (after stripping markdown syntax)`
- `character_count = length of body_plain string (excluding leading/trailing whitespace)`

**Edge Cases:**
- Empty input: Returns a Document node with no children; word_count = 0, character_count = 0
- Malformed markdown (e.g., unclosed bold `**text`): Parser treats the unclosed delimiter as literal text rather than erroring
- Extremely long notes (100,000+ characters): The parser operates on the full text; debounce prevents excessive re-parses during rapid typing
- Nested markdown (e.g., bold inside a link): AST correctly nests Strong inside Link
- Wiki links with special characters (e.g., `[[Note: Important!]]`): The target title is "Note: Important!" including the colon and exclamation mark

##### Auto-Save Debounce

**Purpose:** Persist note content to storage without interrupting the user's writing flow.

**Inputs:**
- note_id: string - the note being edited
- content: string - the current body text
- last_keystroke_time: timestamp - when the user last typed

**Logic:**

```
1. On each keystroke, reset the debounce timer to 2000ms
2. WHEN the timer fires (2000ms of inactivity):
   a. Set save_status to "saving"
   b. Update the note record: body = content, body_plain = strip_markdown(content), word_count = count_words(content), character_count = count_chars(content), updated_at = now()
   c. Update the FTS index for this note
   d. IF save succeeds:
      - Set save_status to "saved"
      - Display "Saved at [HH:MM]"
   e. IF save fails:
      - Set save_status to "failed"
      - Display "Save failed" in warning color
      - Retain content in memory
      - Retry on next debounce cycle
3. On navigating away from the editor, force an immediate save if there are unsaved changes
```

**Edge Cases:**
- User navigates away before debounce fires: Force immediate save before navigation completes
- Storage is full: Save fails gracefully, content remains in editor memory, user sees "Save failed" status
- Concurrent edits (same note opened in two tabs on web): Last-write-wins; the most recent save overwrites the previous one
- App crashes during save: Partial writes are rolled back by the storage transaction; note retains its pre-crash state

##### Scroll Sync (Side-by-Side Mode)

**Purpose:** Keep the editor and preview panes approximately aligned so the user sees the rendered output corresponding to what they are editing.

**Inputs:**
- source_pane: enum ("editor" | "preview") - which pane the user scrolled
- scroll_percentage: float (0.0 to 1.0) - the scroll position as a fraction of total scrollable height

**Logic:**

```
1. WHEN user scrolls the source_pane:
   a. Calculate scroll_percentage = scroll_top / (scroll_height - visible_height)
   b. Set target_pane scroll_top = scroll_percentage * (target_scroll_height - target_visible_height)
   c. Apply scroll to target_pane with smooth animation (100ms ease-out)
2. Disable scroll sync on the target_pane during the animation to prevent feedback loops
3. Re-enable scroll sync after 150ms
```

**Edge Cases:**
- Panes have significantly different content heights (e.g., collapsed code blocks): Percentage-based sync is approximate but not perfect; this is acceptable
- User scrolls both panes simultaneously: The last scrolled pane takes priority
- Content is too short to scroll: No sync action needed

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Auto-save fails (storage error) | Status bar shows "Save failed" in warning color | Content stays in memory; next debounce cycle retries automatically |
| Auto-save fails (storage full) | Status bar shows "Storage full - save failed" in warning color | User must free device storage; app retains content in memory until next successful save |
| Markdown parser encounters malformed syntax | Preview renders the malformed section as literal text | No action needed; user corrects the markdown manually |
| Note record not found when opening editor | Error screen: "This note could not be found. It may have been deleted." | Back button returns to note list |
| Extremely large note causes slow rendering | Preview pane shows a loading spinner for up to 3 seconds; if still not ready, shows "Preview unavailable for very large notes" | User can continue editing in editor-only mode |

**Validation Timing:**
- Title validation runs on blur (when the user finishes editing the title field)
- Auto-save validation (word count, character count recalculation) runs on each debounced save
- No form-level validation is needed because the editor has no required fields beyond title (which defaults to "Untitled Note")

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the note list screen,
   **When** the user taps the "New Note" button,
   **Then** a new note editor opens with an empty body, title set to "Untitled Note", and the cursor placed in the body text area ready for typing.

2. **Given** the user is in the markdown editor and types `# Hello World`,
   **When** the user switches to preview mode (or views the side-by-side preview),
   **Then** the preview displays "Hello World" rendered as a level-1 heading with appropriate font size and weight.

3. **Given** the user types `**bold** and _italic_` in the editor,
   **When** 150ms of inactivity passes (debounce completes),
   **Then** the preview displays "bold" in bold weight and "italic" in italic style.

4. **Given** the user stops typing for 2 seconds,
   **When** the auto-save triggers,
   **Then** the note is persisted to storage, the status bar updates to "Saved at [current time]", and the word count and character count reflect the current content.

5. **Given** the user selects the text "important" in the editor and taps the bold toolbar button,
   **When** the text is wrapped with ** delimiters,
   **Then** the editor shows `**important**` and the preview renders "important" in bold.

**Edge Cases:**

6. **Given** a note with 50,000 words,
   **When** the user opens the note in the editor,
   **Then** the editor loads and displays the content within 2 seconds, and the preview renders within 3 seconds.

7. **Given** the user types a malformed markdown table with mismatched columns,
   **When** the preview renders,
   **Then** the table renders with the available data rather than showing an error, and no content is lost.

8. **Given** the user is editing on a mobile device in portrait orientation,
   **When** the user rotates to landscape,
   **Then** the editor layout adjusts: if screen width exceeds 768px, the side-by-side layout activates (unless overridden in settings).

**Negative Tests:**

9. **Given** the note has unsaved changes and the user taps the back button,
   **When** the navigation begins,
   **Then** the auto-save triggers immediately before navigation completes, ensuring no content is lost.
   **And** the user is not interrupted with a save confirmation dialog (auto-save handles it silently).

10. **Given** the device storage is completely full,
    **When** the auto-save attempts to persist the note,
    **Then** the status bar shows "Storage full - save failed" in a warning color.
    **And** the note content remains fully intact in the editor memory.
    **And** subsequent save attempts continue on each debounce cycle until one succeeds.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| parses empty string to empty AST | body: "" | AST with Document root, zero children |
| parses heading level 1 | body: "# Title" | AST contains Heading node with level=1, text="Title" |
| parses heading levels 1-6 | body: "# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6" | AST contains 6 Heading nodes with correct levels |
| parses bold text | body: "**bold**" | AST contains Strong node wrapping Text "bold" |
| parses italic text | body: "_italic_" | AST contains Emphasis node wrapping Text "italic" |
| parses strikethrough | body: "~~deleted~~" | AST contains Strikethrough node wrapping Text "deleted" |
| parses wiki link | body: "See [[My Other Note]]" | AST contains WikiLink node with target="My Other Note" |
| parses task list | body: "- [x] Done\n- [ ] Pending" | AST contains two TaskListItem nodes, first with checked=true, second with checked=false |
| parses code block with language | body: "```js\nconsole.log('hi')\n```" | AST contains CodeBlock node with language="js" |
| parses inline math | body: "The formula $E = mc^2$ is famous" | AST contains MathInline node with content="E = mc^2" |
| parses display math | body: "$$\n\\int_0^1 x^2 dx\n$$" | AST contains MathBlock node with content="\\int_0^1 x^2 dx" |
| calculates word count correctly | body: "Hello world. This is a test." | word_count: 6 |
| calculates word count for empty note | body: "" | word_count: 0 |
| calculates word count ignoring markdown syntax | body: "**bold** and _italic_" | word_count: 3 (not 5) |
| strips markdown for body_plain | body: "# Heading\n\n**Bold** text" | body_plain: "Heading Bold text" |
| handles malformed bold gracefully | body: "**unclosed bold" | AST treats "**unclosed bold" as literal text, no error thrown |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create new note and auto-save | 1. Tap "New Note", 2. Type "Hello World", 3. Wait 2 seconds | Note record exists in storage with title "Untitled Note", body "Hello World", word_count 2 |
| Edit existing note and verify update | 1. Open existing note, 2. Append " updated", 3. Wait 2 seconds | Note's updated_at has changed, body ends with " updated", word_count is recalculated |
| Toolbar button inserts markdown | 1. Open editor, 2. Place cursor at position 0, 3. Tap bold button | Editor shows "****" with cursor between the asterisks |
| Toolbar button wraps selection | 1. Open editor with text "hello", 2. Select "hello", 3. Tap bold button | Editor shows "**hello**" |
| Side-by-side scroll sync | 1. Open long note in side-by-side mode, 2. Scroll editor to 50% | Preview pane scrolls to approximately 50% |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Write a complete markdown note | 1. Create new note, 2. Set title to "Meeting Notes", 3. Type markdown with heading, bullet list, bold text, and a task list, 4. Wait for auto-save | Note saved with correct title, body, word count. Preview shows formatted heading, styled bullets, bold text, and interactive checkboxes |
| Use keyboard shortcuts to format | 1. Open note, 2. Type "important", 3. Select the word, 4. Press Ctrl+B, 5. Deselect, 6. Press Enter, 7. Press Ctrl+Shift+8, 8. Type "item one" | Editor shows "**important**\n- item one". Preview shows bold "important" followed by a bullet list |

---

### NT-002: Notebook and Folder Hierarchy

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-002 |
| **Feature Name** | Notebook and Folder Hierarchy |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As an organized user, I want to arrange my notes into folders and subfolders, so that I can group related notes by project, topic, or category.

**Secondary:**
> As a student, I want to create a folder for each course with subfolders for each week or unit, so that my lecture notes and study materials are structured logically.

**Tertiary:**
> As a knowledge worker, I want to move notes between folders and rename folders, so that I can reorganize my note collection as my projects evolve.

#### 3.3 Detailed Description

Notebook and Folder Hierarchy provides a tree-structured organizational system for notes. Users create folders at the root level or nested inside other folders to any depth. Each folder can contain zero or more notes and zero or more subfolders. Notes not assigned to any folder appear in a virtual "All Notes" view and a separate "Unfiled" section.

The folder tree is displayed in a sidebar (desktop/web) or a navigable list (mobile). On mobile, tapping a folder navigates into it, showing its contents (subfolders first, then notes). A breadcrumb trail at the top shows the current folder path and allows tapping any ancestor to navigate up. On desktop, the folder tree is displayed as a collapsible tree view in the left sidebar, similar to a file explorer, with expand/collapse triangles next to folders that contain children.

Users create new folders via a "New Folder" action available in the folder list toolbar, in the context menu of an existing folder (to create a subfolder), or via the overflow menu when viewing folder contents. Folder names must be unique among siblings (two folders at the same level under the same parent cannot have the same name), but folders in different locations can share names.

Notes are assigned to a folder either at creation time (if created from within a folder view) or by using the "Move to Folder" action from the note's overflow menu. Dragging and dropping notes between folders is supported on desktop. A note belongs to exactly one folder (or no folder if unfiled). Moving a note from one folder to another updates its folder_id reference.

Folders can be reordered within their parent by drag-and-drop on desktop or a manual "Sort" mode on mobile (where arrows or drag handles appear). The sort order is stored as a position integer. Renaming a folder is done via a long-press context menu (mobile) or right-click context menu (desktop).

Deleting a folder presents a confirmation dialog that explains the consequences: all notes inside the folder (and all subfolders recursively) will be moved to "Unfiled" rather than deleted. No notes are ever deleted by a folder deletion. After confirmation, the folder and all its subfolders are removed from the database, and all contained notes have their folder_id set to null.

The system enforces a maximum nesting depth of 10 levels. Attempting to create a subfolder at depth 11 shows an informational message: "Maximum folder depth reached. Consider reorganizing your folder structure."

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is a foundational organizational feature)

**External Dependencies:**
- Local persistent storage for folder records
- File system or storage for the folder tree structure

**Assumed Capabilities:**
- User can navigate between screens via tab bar or sidebar
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Folder Browser (Mobile)

**Layout:**
- Top navigation bar displays: hamburger menu or back arrow (left), current folder name (center, "All Notes" for root), and "New" button (right) that opens action sheet with "New Note" and "New Folder"
- Below the nav bar is a breadcrumb trail showing the folder path (e.g., "All Notes > Work > Project Alpha"). Each breadcrumb segment is tappable to navigate to that level. If the breadcrumb is wider than the screen, it scrolls horizontally with the last segment visible
- Content area shows a flat list with two sections:
  - **Subfolders section:** Each row shows a folder icon, folder name (bold), and a note count badge (e.g., "12 notes"). Rows have a chevron indicator on the right. Tapping a subfolder row navigates into it
  - **Notes section:** Each row shows the note title, first line of body preview (truncated to 80 characters), updated_at date, and pin/favorite indicators. Tapping a note row opens the note editor (NT-001)
- If both sections are empty, the screen shows an empty state

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Folder | Folder has no subfolders and no notes | Centered empty-state illustration, message "This folder is empty", two buttons: "Create Note" and "Create Subfolder" |
| Root Level | Viewing top-level folder list | Breadcrumb shows "All Notes", list shows root-level folders and unfiled notes |
| Nested Folder | Viewing a subfolder | Breadcrumb shows full path, list shows subfolder's contents |
| Loading | Folder contents loading from storage | Skeleton rows matching the folder/note row layout |
| Error | Storage read failed | Inline error: "Could not load folder contents. Pull down to retry." |

**Interactions:**
- Tap folder row: navigates into the subfolder (push transition)
- Tap note row: opens note in editor
- Long press folder row: context menu with "Rename", "Move", "Delete"
- Long press note row: context menu with "Move to Folder", "Pin/Unpin", "Favorite/Unfavorite", "Delete"
- Swipe left on folder row: reveals "Delete" action (red)
- Swipe left on note row: reveals "Move" (blue) and "Delete" (red) actions
- Pull-to-refresh: reloads folder contents
- Tap breadcrumb segment: navigates to that folder level (pop transitions for each level skipped)

**Transitions/Animations:**
- Navigating into a subfolder uses a push-right transition (250ms)
- Navigating up via breadcrumb uses a pop-left transition (250ms)
- Deleting a folder row animates with fade + slide-left (200ms)

##### Screen: Folder Tree (Desktop Sidebar)

**Layout:**
- Left sidebar (width: 260px, resizable with drag handle, min 200px, max 400px) contains the folder tree
- Top of sidebar: "All Notes" entry (always visible, tapping shows all notes in the main content area)
- Below "All Notes": "Favorites" entry (shows all favorited notes)
- Below "Favorites": "Unfiled" entry (shows notes with no folder assignment)
- Below special entries: a horizontal divider, then the folder tree
- The folder tree uses indentation (20px per level) with expand/collapse triangle icons next to folders that have children. Expanded folders show their children (subfolders first, then notes) inline
- Folder names are truncated with ellipsis if they exceed the sidebar width
- At the bottom of the sidebar: "New Folder" button (full-width, subtle styling)
- Right-clicking a folder shows context menu: "New Subfolder", "Rename", "Move", "Delete"
- Right-clicking the empty area shows "New Folder"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No folders exist | "All Notes", "Favorites", "Unfiled" entries visible, no folder tree; "New Folder" button at bottom |
| Populated | Folders exist | Tree structure with expand/collapse controls |
| Dragging | User is dragging a note or folder | Drop target folders highlight with a border or background color change |
| Collapsed | User collapsed the sidebar | Sidebar shrinks to icon-only width (48px) showing only icons for All Notes, Favorites, Unfiled |

**Interactions:**
- Click folder: selects it and shows its contents in the main content area
- Double-click folder name: enters inline rename mode
- Click expand/collapse triangle: toggles folder's children visibility
- Drag folder: reorders within its parent or moves into another folder
- Drag note from main content area onto sidebar folder: moves note to that folder
- Right-click: context menu as described above

##### Modal: Move to Folder

**Layout:**
- Modal overlay with a folder tree browser
- Title: "Move to Folder"
- The tree shows all folders with expand/collapse controls, same as sidebar tree
- A "Root (Unfiled)" option at the top allows moving to no folder
- Currently selected folder is highlighted
- Footer: "Cancel" (left) and "Move Here" (right, disabled until a folder is selected)

**Interactions:**
- Tap/click a folder: selects it as the destination
- Tap "Move Here": updates the note's folder_id, closes modal, shows brief confirmation toast "Moved to [folder name]"
- Tap "Cancel": closes modal with no changes

##### Modal: New Folder / Rename Folder

**Layout:**
- Compact dialog with a single text input field
- Title: "New Folder" or "Rename Folder"
- Text input with placeholder "Folder name" (pre-populated with current name for rename)
- Inline validation message appears below the input if the name conflicts with a sibling folder
- Footer: "Cancel" (left) and "Create" or "Rename" (right, disabled if input is empty or conflicts)

**Interactions:**
- Tap "Create"/"Rename": validates name uniqueness among siblings, creates/updates folder record, closes dialog
- If name conflicts: inline error "A folder named '[name]' already exists here"
- Tap "Cancel": closes dialog

#### 3.6 Data Requirements

##### Entity: Folder

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT (UUID) | Primary key, auto-generated | Auto | Unique identifier for the folder |
| name | TEXT | Required, max 255 characters, unique among siblings | None | Display name of the folder |
| parent_id | TEXT (UUID) | References Folder.id, nullable | null | Parent folder id; null means root-level |
| position | INTEGER | Min: 0 | 0 | Sort order among siblings (lower = first) |
| depth | INTEGER | Min: 0, Max: 10 | 0 | Nesting depth (0 = root level) |
| note_count | INTEGER | Min: 0 | 0 | Cached count of notes directly in this folder (not recursive) |
| created_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | When the folder was created |
| updated_at | TEXT | ISO 8601 datetime, auto-set | Current timestamp | When the folder was last modified |

**Relationships:**
- Folder has many Notes (one-to-many via Note.folder_id)
- Folder has many child Folders (self-referencing one-to-many via parent_id)
- Folder belongs to parent Folder (self-referencing many-to-one via parent_id)

**Indexes:**
- `parent_id` - Queried when listing children of a folder
- `parent_id, position` - Composite index for ordered listing of children
- `parent_id, name` - Composite unique index to enforce sibling name uniqueness

**Validation Rules:**
- `name`: Must not be empty after trimming whitespace; max 255 characters
- `name`: Must be unique among siblings (same parent_id); case-insensitive comparison
- `depth`: Automatically computed as parent.depth + 1; must not exceed 10
- `parent_id`: If set, the referenced folder must exist; circular references are prohibited (a folder cannot be moved inside its own descendant)

**Example Data:**

```
{
  "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "name": "Work",
  "parent_id": null,
  "position": 0,
  "depth": 0,
  "note_count": 5,
  "created_at": "2026-01-10T08:00:00Z",
  "updated_at": "2026-03-01T14:30:00Z"
}

{
  "id": "a2b3c4d5-e6f7-8901-bcde-f12345678901",
  "name": "Project Alpha",
  "parent_id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "position": 0,
  "depth": 1,
  "note_count": 8,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-02-20T11:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Folder Depth Computation

**Purpose:** Enforce the maximum nesting depth of 10 levels and compute depth automatically when folders are created or moved.

**Inputs:**
- parent_id: string | null - the target parent folder (null for root)

**Logic:**

```
1. IF parent_id is null:
   a. Set depth = 0
   b. RETURN success
2. Fetch parent folder by parent_id
3. IF parent not found:
   a. RETURN error "Parent folder not found"
4. Set depth = parent.depth + 1
5. IF depth > 10:
   a. RETURN error "Maximum folder depth reached (10 levels)"
6. RETURN success with computed depth
```

**Edge Cases:**
- Moving a folder with children: all descendant depths must be recalculated recursively
- Moving a folder into its own descendant: must be rejected (circular reference check)
- Deleting an intermediate folder: children are not moved up; they are deleted along with the folder (but notes are preserved as unfiled)

##### Folder Deletion Cascade

**Purpose:** When a folder is deleted, remove the folder and all its subfolders while preserving all notes by moving them to unfiled status.

**Inputs:**
- folder_id: string - the folder to delete

**Logic:**

```
1. Collect all descendant folder IDs recursively (breadth-first traversal starting from folder_id)
2. Collect all note IDs where folder_id is in the set {folder_id, ...descendant_ids}
3. BEGIN transaction
4. UPDATE all collected notes: SET folder_id = null
5. DELETE all descendant folders (deepest first to avoid foreign key issues)
6. DELETE the target folder
7. COMMIT transaction
8. Recalculate note_count for all affected ancestor folders
```

**Edge Cases:**
- Folder has no notes or subfolders: only the folder record is deleted
- Folder has deeply nested subfolders (10 levels): all levels are removed in a single transaction
- Transaction failure mid-cascade: entire operation is rolled back, no data is modified

##### Sibling Name Uniqueness

**Purpose:** Prevent duplicate folder names at the same level under the same parent.

**Inputs:**
- name: string - the proposed folder name
- parent_id: string | null - the parent folder
- exclude_id: string | null - the folder being renamed (to exclude self from check)

**Logic:**

```
1. Query folders WHERE parent_id = input.parent_id AND LOWER(name) = LOWER(input.name)
2. IF exclude_id is not null, filter out the folder with that id
3. IF any results remain:
   a. RETURN error "A folder named '[name]' already exists here"
4. RETURN success
```

**Edge Cases:**
- Root-level check: parent_id is null, query uses IS NULL comparison
- Renaming to the same name with different case: blocked (case-insensitive check)
- Moving a folder to a location where a sibling has the same name: blocked with error message

##### Folder Note Count Cache

**Purpose:** Maintain an accurate count of notes directly inside each folder without expensive recursive queries.

**Inputs:**
- folder_id: string - the folder whose count changed

**Logic:**

```
1. Count notes WHERE folder_id = input.folder_id
2. UPDATE folder SET note_count = computed_count WHERE id = input.folder_id
3. Triggers: note creation, note deletion, note move (update both old and new folder counts)
```

**Edge Cases:**
- Folder has zero notes: note_count = 0 (not null)
- Note moved from folder A to folder B: decrement A's count, increment B's count
- Note moved to unfiled (folder_id = null): decrement the old folder's count only

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Create folder with duplicate sibling name | Inline validation: "A folder named '[name]' already exists here" | User changes the folder name |
| Attempt to create subfolder beyond depth 10 | Toast: "Maximum folder depth reached (10 levels)" | User reorganizes folder structure or creates folder at a shallower level |
| Delete folder fails (database error) | Toast: "Could not delete folder. Please try again." | User retries; if persistent, app suggests restarting |
| Move folder into its own descendant | Toast: "Cannot move a folder into one of its own subfolders" | User selects a different destination |
| Folder not found when navigating | Error screen: "This folder could not be found. It may have been deleted." | Back button returns to parent or root folder list |

**Validation Timing:**
- Folder name validation runs on text input change (live, as user types)
- Depth validation runs on folder creation or move attempt
- Circular reference validation runs on folder move attempt

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is on the root folder view,
   **When** the user taps "New Folder" and enters the name "Work",
   **Then** a new folder named "Work" appears in the folder list at the root level with a note count of 0.

2. **Given** a folder named "Work" exists at the root level,
   **When** the user long-presses it, selects "New Subfolder", and names it "Project Alpha",
   **Then** "Project Alpha" appears as a child of "Work", and navigating into "Work" shows "Project Alpha" as a subfolder.

3. **Given** a note exists in "Work > Project Alpha",
   **When** the user selects "Move to Folder" from the note's overflow menu and chooses "Personal",
   **Then** the note disappears from "Project Alpha" and appears in "Personal", and the note counts for both folders update.

4. **Given** the user is viewing the folder tree on desktop,
   **When** the user drags a note from the content area and drops it onto the "Archive" folder in the sidebar,
   **Then** the note moves to "Archive" and the sidebar shows the updated note count.

**Edge Cases:**

5. **Given** a folder "Courses" exists with 5 subfolders, each containing 10 notes,
   **When** the user deletes "Courses",
   **Then** a confirmation dialog warns that 5 subfolders will be removed and 50 notes will become unfiled. After confirmation, the 5 subfolders are deleted, all 50 notes appear in "Unfiled", and no notes are lost.

6. **Given** a folder is nested 10 levels deep,
   **When** the user attempts to create a subfolder inside it,
   **Then** the system shows "Maximum folder depth reached (10 levels)" and the folder is not created.

**Negative Tests:**

7. **Given** a folder named "Work" exists at the root level,
   **When** the user tries to create another root-level folder named "work" (lowercase),
   **Then** the system shows "A folder named 'work' already exists here".
   **And** the folder is not created.

8. **Given** folder "A" contains folder "B" which contains folder "C",
   **When** the user attempts to move folder "A" into folder "C",
   **Then** the system shows "Cannot move a folder into one of its own subfolders".
   **And** folder "A" remains in its original location.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes depth 0 for root folder | parent_id: null | depth: 0 |
| computes depth 1 for child of root | parent_id: root_folder.id (depth 0) | depth: 1 |
| rejects folder at depth 11 | parent at depth 10 | error: "Maximum folder depth reached" |
| detects sibling name conflict | name: "Work", parent_id: X, existing sibling named "Work" | error: "already exists here" |
| allows same name in different parents | name: "Notes", parent_id: A; existing "Notes" under parent B | success |
| name conflict is case-insensitive | name: "work", existing sibling "Work" | error: "already exists here" |
| detects circular reference | move folder A into child of A | error: "Cannot move into own descendant" |
| allows move to non-descendant | move folder A into unrelated folder D | success |
| cascades deletion to subfolders | delete folder with 3 nested subfolders | 4 folders deleted, all notes set to folder_id null |
| note count decrements on note move out | folder with note_count 5, move one note out | note_count: 4 |
| note count increments on note move in | folder with note_count 3, move one note in | note_count: 4 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create nested folder structure | 1. Create "Work", 2. Create subfolder "Project A" inside "Work", 3. Create subfolder "Tasks" inside "Project A" | Three folders exist with depths 0, 1, 2 respectively, correct parent_id chain |
| Move note between folders | 1. Create note in "Work", 2. Move note to "Personal" | Note's folder_id updates, "Work" note_count decrements, "Personal" note_count increments |
| Delete folder with contents | 1. Create folder with 3 notes, 2. Delete folder | Folder removed, 3 notes have folder_id = null |
| Rename folder | 1. Create folder "Olld Name", 2. Rename to "Correct Name" | Folder name updated, notes inside still reference the same folder_id |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Organize notes by project | 1. Create folders "Work" and "Personal", 2. Create subfolders "Project A" and "Project B" under "Work", 3. Create 3 notes in "Project A", 4. Move 1 note to "Project B", 5. Navigate breadcrumbs back to root | "Work" shows 2 subfolders, "Project A" has 2 notes, "Project B" has 1 note, breadcrumb navigation works correctly |
| Reorganize folder structure | 1. Create deep structure (3 levels), 2. Move a mid-level folder to root, 3. Verify all notes and subfolders moved with it | Folder and all descendants appear at new location with recalculated depths, all notes retain their content and associations |

---

### NT-003: Full-Text Search (FTS5)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-003 |
| **Feature Name** | Full-Text Search (FTS5) |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user with hundreds of notes, I want to search across all note titles and content instantly, so that I can find any note by remembering just a word or phrase from it.

**Secondary:**
> As a knowledge worker, I want search results ranked by relevance so that the most useful notes appear at the top, rather than having to scroll through a chronological list.

**Tertiary:**
> As a power user, I want to filter search results by folder, tag, or date range, so that I can narrow down results when my search term appears in many notes.

#### 3.3 Detailed Description

Full-Text Search uses a dedicated full-text search index to provide sub-second search across all note content, titles, and tags. The search index is maintained as a virtual table that stays synchronized with the notes table through triggers that fire on insert, update, and delete operations. The index tokenizes note content using a Unicode-aware tokenizer that supports word-level matching, prefix matching, and phrase matching.

Users access search through a persistent search bar at the top of the note list screen (mobile) or in the sidebar/toolbar (desktop). Typing in the search bar begins filtering immediately after 2 or more characters are entered. Results appear in a dedicated search results view that replaces the note list while a search is active.

Search results are ranked using the BM25 algorithm, which balances term frequency (how often the search term appears in a note) against inverse document frequency (how rare the term is across all notes). A note that contains a rare word many times ranks higher than a note that contains a common word once. The ranking formula is: `score = sum_over_terms(IDF(t) * (tf(t,d) * (k1 + 1)) / (tf(t,d) + k1 * (1 - b + b * (dl / avgdl))))` where k1 = 1.2 and b = 0.75 are the standard BM25 tuning parameters, tf(t,d) is the term frequency in document d, IDF(t) is the inverse document frequency, dl is the document length, and avgdl is the average document length.

Each search result row displays: the note title (with matching terms highlighted), a snippet of the note body containing the matched term with surrounding context (up to 100 characters on each side of the match, with matching terms highlighted), the folder path, tags (if any), and the last updated date. Tapping a result opens the note in the editor with the search term highlighted in the body using a find-in-page style overlay.

The search supports several query types:
- **Simple terms:** `meeting` matches notes containing the word "meeting" anywhere in title, body, or tags
- **Multi-word:** `project kickoff` matches notes containing both "project" and "kickoff" (AND logic by default)
- **Phrase:** `"project kickoff"` (in double quotes) matches the exact phrase
- **Prefix:** `proj*` matches words starting with "proj" (project, projection, etc.)
- **Exclusion:** `-archived` excludes notes containing "archived"
- **Field-specific:** `title:meeting` searches only in note titles

The search index covers three fields with configurable weights: title (weight 10), body_plain (weight 1), and tags (weight 5). Title matches are weighted heavily because users often remember the title or part of it, and tag matches are weighted moderately to surface well-tagged notes. These weights are applied as multipliers in the BM25 ranking.

Advanced filters can be combined with the text search: folder filter (limit results to a specific folder and optionally its subfolders), tag filter (limit to notes with a specific tag), date range filter (limit to notes created or modified within a range), and content type filter (notes with checklists, notes with code blocks, notes with images).

The search bar shows recent searches (last 10 unique queries) as suggestions when focused but empty. Clearing the search bar returns the user to the normal note list view. A "Clear search" button (X icon) is always visible in the search bar when text is present.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - Notes must exist with content to search

**External Dependencies:**
- Full-text search index maintained as a virtual table in local storage
- Sufficient storage space for the search index (approximately 50-100% of the size of the note content)

**Assumed Capabilities:**
- The database supports virtual table creation and full-text indexing
- Note content is stored in both raw markdown (body) and plain text (body_plain) forms

#### 3.5 User Interface Requirements

##### Screen: Search Results (Mobile)

**Layout:**
- Top navigation bar with a search text input that fills the full width (minus cancel button). The input is auto-focused when the search screen opens
- Below the search input: a horizontal scrollable row of filter chips: "All Folders" (dropdown), "All Tags" (dropdown), "Any Time" (dropdown for date range), and active filter chips that can be dismissed
- Below the filters: result count text (e.g., "12 results for 'project'")
- Main content area: a scrollable list of search result cards
- Each result card displays:
  - Note title (bold) with matching terms highlighted in accent color background
  - Snippet of body text (2-3 lines) with matching terms highlighted
  - Folder path in muted text (e.g., "Work > Project Alpha")
  - Tags as small pills (if the note has tags)
  - Last updated date in muted text (e.g., "Updated 2 days ago")
- If the search yields no results, an empty state is shown

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Initial | Search bar focused, no text entered | List of recent searches (last 10) with clock icon prefix; "Search your notes" hint text |
| Typing | 1 character entered | Hint text: "Type at least 2 characters" |
| Searching | 2+ characters entered, results loading | Skeleton result cards (3 placeholders) |
| Results Found | Query returned 1+ results | Scrollable list of result cards with highlighted matches |
| No Results | Query returned 0 results | Centered illustration, message "No notes matching '[query]'", suggestion: "Try different keywords or check your spelling" |
| Filtered | Active folder/tag/date filters applied | Filter chips are filled/colored, result count reflects filtered total |
| Error | Search index query failed | Inline error: "Search is temporarily unavailable. Please try again." |

**Interactions:**
- Type in search bar: results update live after 2+ characters (debounced 200ms)
- Tap result card: opens note in editor with search term highlighted using find-in-page overlay
- Tap filter chip: opens a dropdown or modal to select filter values
- Tap X on an active filter chip: removes that filter, results refresh
- Tap "Cancel" button (right of search bar): clears search, returns to note list
- Tap X icon in search bar: clears search text, shows recent searches
- Tap a recent search suggestion: populates the search bar with that query and runs the search

**Transitions/Animations:**
- Search results fade in (200ms) when query results arrive
- Filter chip activation/deactivation uses a color fill transition (150ms)
- Navigating to a search result uses a push-right transition (250ms)

##### Component: Search Bar (Desktop Sidebar/Toolbar)

**Layout:**
- Search input field at the top of the sidebar or in the top toolbar, with a magnifying glass icon prefix and an X clear button suffix (visible when text is present)
- Keyboard shortcut Ctrl/Cmd+F focuses the search bar from anywhere in the app
- Search results appear in the main content area (replacing the note list), using the same card format as mobile but with wider cards and additional metadata visible

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Inactive | Not focused, no text | Dimmed placeholder: "Search notes... (Ctrl+F)" |
| Focused | Focused, no text | Highlighted border, recent searches dropdown below |
| Active | Text entered, results showing | Filled border, results in main content area |

**Interactions:**
- Ctrl/Cmd+F: focuses the search bar
- Escape: clears and unfocuses the search bar, returns to normal note list
- Enter: selects the first search result (opens it in editor)
- Arrow keys: navigate through search results without leaving the search bar

#### 3.6 Data Requirements

##### Entity: SearchIndex (Virtual Table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| note_id | TEXT | References Note.id | None | The note this index entry belongs to |
| title | TEXT | Indexed for FTS | None | Note title, tokenized for search |
| body_plain | TEXT | Indexed for FTS | None | Plaintext note body (markdown stripped), tokenized for search |
| tags | TEXT | Indexed for FTS | None | Space-separated list of tag names associated with the note |

**Relationships:**
- SearchIndex has a 1:1 relationship with Note (keyed by note_id)

**Indexes:**
- The virtual table itself is the index; no additional indexes needed
- Column weights: title = 10, body_plain = 1, tags = 5

**Validation Rules:**
- `note_id`: Must reference an existing Note record
- `body_plain`: Generated by stripping markdown syntax from Note.body; not user-editable
- `tags`: Generated by concatenating tag names with spaces; not user-editable

##### Entity: RecentSearch

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | INTEGER | Primary key, auto-increment | Auto | Unique identifier |
| query | TEXT | Required, max 500 characters | None | The search query string |
| searched_at | TEXT | ISO 8601 datetime | Current timestamp | When the search was performed |

**Validation Rules:**
- Maximum 10 recent searches stored; oldest is deleted when the 11th is added
- Duplicate queries update the searched_at timestamp rather than creating a new record

**Example Data:**

```
SearchIndex row:
{
  "note_id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
  "title": "Project Kickoff Notes",
  "body_plain": "Project Kickoff Attendees Alice Bob Charlie Action Items Set up repo Create design mockups Schedule follow-up meeting Notes We agreed on a two-week sprint cycle See Sprint Planning Template for details",
  "tags": "work meetings project-alpha"
}

RecentSearch row:
{
  "id": 1,
  "query": "sprint planning",
  "searched_at": "2026-03-06T14:22:00Z"
}
```

#### 3.7 Business Logic Rules

##### BM25 Ranking Algorithm

**Purpose:** Rank search results by relevance so the most useful notes appear first.

**Inputs:**
- query_terms: string[] - the individual terms from the search query
- documents: SearchIndex[] - all indexed notes
- field_weights: { title: 10, body_plain: 1, tags: 5 }

**Logic:**

```
1. FOR each document d in the result set:
   a. Initialize score = 0
   b. FOR each term t in query_terms:
      c. FOR each field f in [title, body_plain, tags]:
         i.   tf = number of times t appears in d.f
         ii.  df = number of documents where t appears in field f
         iii. N = total number of documents
         iv.  IDF = ln((N - df + 0.5) / (df + 0.5) + 1)
         v.   dl = length of d.f in tokens
         vi.  avgdl = average length of field f across all documents
         vii. field_score = IDF * (tf * (1.2 + 1)) / (tf + 1.2 * (1 - 0.75 + 0.75 * (dl / avgdl)))
         viii. score += field_score * field_weights[f]
2. Sort documents by score descending
3. RETURN sorted list
```

**Formulas:**
- `IDF(term) = ln((N - df + 0.5) / (df + 0.5) + 1)` where N = total docs, df = docs containing term
- `BM25(term, doc, field) = IDF * (tf * 2.2) / (tf + 1.2 * (1 - 0.75 + 0.75 * dl/avgdl))`
- `final_score = sum over all terms and fields of BM25 * field_weight`

**Edge Cases:**
- Query has no matches: return empty result set (not an error)
- Single-character query: not searched (minimum 2 characters enforced at the UI layer)
- Very common term (appears in all documents): IDF approaches 0, so the term contributes minimally to ranking; this is the correct behavior (common words are less discriminating)
- Note with empty body: body_plain field contributes 0 to the score; title and tags still contribute

##### Search Index Synchronization

**Purpose:** Keep the full-text search index in sync with note content changes.

**Inputs:**
- event: "insert" | "update" | "delete"
- note: Note record (for insert/update)
- note_id: string (for delete)

**Logic:**

```
1. ON note INSERT:
   a. Generate body_plain by stripping markdown from note.body
   b. Collect tag names for this note (space-separated string)
   c. INSERT into SearchIndex: (note.id, note.title, body_plain, tags)

2. ON note UPDATE:
   a. Regenerate body_plain from updated note.body
   b. Recollect tag names
   c. DELETE from SearchIndex WHERE note_id = note.id
   d. INSERT into SearchIndex: (note.id, note.title, body_plain, tags)

3. ON note DELETE:
   a. DELETE from SearchIndex WHERE note_id = note.id

4. ON tag added/removed from note:
   a. Recollect tag names for the note
   b. UPDATE SearchIndex tags field for this note_id
```

**Edge Cases:**
- Note with no tags: tags field is empty string
- Note with no body: body_plain field is empty string
- Bulk import of many notes: index operations should be batched inside a single transaction for performance
- Index corruption: a "Rebuild Index" action in settings (NT-021) re-indexes all notes from scratch

##### Snippet Generation

**Purpose:** Generate a contextual snippet showing where the search term appears in the note body, with surrounding text for context.

**Inputs:**
- body_plain: string - the plaintext note content
- query_terms: string[] - the search terms to highlight
- context_chars: integer - number of characters to show on each side of the match (default: 100)

**Logic:**

```
1. FOR the first matching term found in body_plain:
   a. Find the position of the first occurrence
   b. Calculate start = max(0, position - context_chars)
   c. Calculate end = min(body_plain.length, position + term.length + context_chars)
   d. Extract substring from start to end
   e. If start > 0, prepend "..."
   f. If end < body_plain.length, append "..."
   g. Wrap each occurrence of query_terms within the snippet with highlight markers
2. IF no term is found in body_plain (match was in title or tags only):
   a. Return the first 200 characters of body_plain as the snippet
3. RETURN the snippet with highlight markers
```

**Edge Cases:**
- Match is at the very beginning of the body: no leading "..."
- Match is at the very end of the body: no trailing "..."
- Multiple matches in the body: snippet shows the first match (most prominent)
- Query term spans across a word boundary in body_plain: exact substring match, not word-boundary-aware

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Search index query fails | Inline error: "Search is temporarily unavailable. Please try again." | User taps retry; if persistent, user can rebuild index from settings |
| Search index out of sync with notes | User may see stale results (deleted notes appearing, new notes missing) | "Rebuild Search Index" button in settings (NT-021) re-indexes all notes |
| Very slow query (> 3 seconds) | Skeleton loading cards displayed; after 5 seconds, show "Search is taking longer than expected" with a cancel option | User can cancel and try a simpler query |
| Query with only special characters | No results shown, hint: "Try using words or phrases" | User modifies query |
| Storage insufficient for search index | Index operations fail silently; search returns incomplete results | User frees storage; index rebuilds automatically on next write |

**Validation Timing:**
- Minimum query length (2 characters) is validated on each keystroke; search does not execute until met
- Filter selections take effect immediately (no submit button)
- Search index sync happens within the same transaction as note CRUD operations

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** 50 notes exist with various content,
   **When** the user types "meeting" in the search bar,
   **Then** all notes containing "meeting" in their title, body, or tags appear in the results list, ranked by BM25 relevance, with "meeting" highlighted in the title and body snippets.

2. **Given** a note titled "Sprint Planning Template" contains the phrase "weekly sprint review",
   **When** the user searches for `"sprint review"` (quoted),
   **Then** the note appears in results because it contains the exact phrase "sprint review".

3. **Given** 100 notes exist and the user searches for "proj*",
   **When** the results load,
   **Then** all notes containing words starting with "proj" (project, projections, progress) appear in results.

4. **Given** the user searches for "budget -personal",
   **When** the results load,
   **Then** notes containing "budget" appear, but notes containing "personal" are excluded from results.

5. **Given** the user searches for "meeting" and then applies a folder filter for "Work",
   **When** the filter is applied,
   **Then** results narrow to only notes containing "meeting" that are inside the "Work" folder or its subfolders.

**Edge Cases:**

6. **Given** 1000 notes exist in the database,
   **When** the user performs a search,
   **Then** results appear within 500ms of the debounce completing.

7. **Given** a note's body contains markdown formatting like `**important**`,
   **When** the user searches for "important",
   **Then** the note is found because the search operates on body_plain (stripped of markdown), and the snippet displays "important" without the asterisks.

**Negative Tests:**

8. **Given** the user types a single character "a" in the search bar,
   **When** the character is entered,
   **Then** no search is performed and a hint "Type at least 2 characters" is displayed.
   **And** recent searches are still visible below the hint.

9. **Given** no notes match the search query "xyzzyspoon",
   **When** the search completes,
   **Then** the results area shows "No notes matching 'xyzzyspoon'" with a suggestion to try different keywords.
   **And** no error is thrown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| indexes note on creation | new note with title "Hello", body "world" | SearchIndex contains entry with title "Hello", body_plain "world" |
| updates index on note edit | update note body to "updated content" | SearchIndex entry's body_plain changes to "updated content" |
| removes index on note delete | delete note | SearchIndex no longer contains entry for that note_id |
| BM25 ranks rare term higher | search "xylophone" (appears in 1 of 100 notes) vs "the" (appears in 99) | Note with "xylophone" has higher score |
| BM25 weights title matches higher | search "meeting", note A has "meeting" in title, note B has "meeting" only in body | Note A ranks above note B |
| phrase search matches exact phrase | search "\"weekly review\"" in note with "weekly code review" | No match (phrase "weekly review" does not appear exactly) |
| prefix search matches word starts | search "proj*" in note with "project" | Match found |
| exclusion removes matching docs | search "budget -personal" in note with both words | Note excluded from results |
| generates snippet with context | body: "...some text about the meeting yesterday...", query: "meeting" | Snippet: "...text about the **meeting** yesterday..." with highlight markers |
| snippet handles match at body start | body: "meeting notes from today", query: "meeting" | Snippet: "**meeting** notes from today" (no leading "...") |
| returns empty for no matches | search "nonexistent" across 50 notes | Empty result set, no error |
| enforces minimum query length | query: "a" (1 character) | Search not executed, returns null |
| recent searches capped at 10 | 11 searches performed | Only last 10 stored; oldest removed |
| duplicate recent search updates timestamp | search "meeting" twice | Single entry with updated searched_at |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Search finds newly created note | 1. Create note titled "Alpha" with body "bravo charlie", 2. Search for "bravo" | Note appears in results with "bravo" highlighted |
| Search reflects note deletion | 1. Delete a note, 2. Search for terms from that note | Deleted note does not appear in results |
| Search with folder filter | 1. Create 5 notes (3 in "Work", 2 in "Personal"), 2. Search for common term, 3. Apply "Work" folder filter | Only 3 "Work" notes appear |
| Rebuild index from settings | 1. Manually corrupt search index, 2. Trigger rebuild from settings | All notes re-indexed, search returns correct results |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Find a specific note by content | 1. User has 200 notes, 2. Types "architecture decision" in search, 3. Taps the top result | Note opens in editor with "architecture" and "decision" highlighted in find-in-page overlay |
| Filter search by tag and date | 1. Search for "review", 2. Apply tag filter "work", 3. Apply date filter "Last 7 days" | Results show only notes containing "review" tagged "work" and modified in the last 7 days |

---

### NT-004: Tag System

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-004 |
| **Feature Name** | Tag System |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a personal note-taker, I want to attach tags to my notes, so that I can cross-cut my folder hierarchy and find related notes regardless of where they are stored.

**Secondary:**
> As a knowledge worker, I want to filter my note list by one or more tags, so that I can quickly narrow down to notes about a specific topic even if they span multiple folders.

**Tertiary:**
> As a student, I want to use nested tags (e.g., "course/math/calculus"), so that I can organize my tags into a hierarchy that mirrors my subject structure.

#### 3.3 Detailed Description

The Tag System provides a flexible labeling mechanism that complements the folder hierarchy (NT-002). While folders impose a strict one-parent tree structure, tags allow many-to-many relationships: a single note can have up to 50 tags, and a single tag can be applied to any number of notes. Tags are lightweight string labels that users create on the fly while tagging a note.

Tags support a nested hierarchy using a forward-slash separator. For example, "work/project-alpha" creates a parent tag "work" with a child tag "project-alpha". The nesting depth is limited to 5 levels. Tags are case-insensitive for matching purposes but preserve the case the user originally typed when displaying. For example, if the user creates "Work/Project-Alpha", it is stored with that casing, but a subsequent search or filter for "work/project-alpha" matches it.

Users add tags to a note through three methods. First, via the tag input field in the note editor's metadata panel (below the title, above the body). The tag input is an auto-complete text field that suggests existing tags as the user types, with a minimum of 2 characters before suggestions appear. Pressing Enter or tapping a suggestion adds the tag. Second, via the overflow menu action "Add Tags" on the note list's context menu. Third, by typing inline hashtag syntax (#tagname) within the note body, which the parser detects and offers to convert to a formal tag via a non-intrusive suggestion chip. Inline hashtags only become formal tags if the user confirms the suggestion chip; otherwise they remain as literal text.

The tag browser is accessible from the sidebar (desktop) or the filter bar on the note list (mobile). It displays all tags in a flat alphabetical list by default, with a toggle to view them as a nested tree grouped by their path hierarchy. Each tag shows a note count badge. Tapping a tag filters the note list to show only notes with that tag. Multiple tags can be selected for intersection filtering (notes must have all selected tags) or union filtering (notes must have at least one selected tag). The filter mode (intersection vs. union) is toggled by a button in the filter bar, defaulting to intersection.

Renaming a tag changes the tag name across all notes that use it. Deleting a tag removes it from all notes without deleting any notes. Merging two tags replaces all occurrences of the source tag with the destination tag. These bulk operations are available from the tag browser's context menu.

Tag colors are optional. Users can assign one of 12 preset colors to a tag for visual distinction. Tags without an assigned color use the default theme text color. The 12 preset colors are: red, orange, yellow, green, teal, blue, indigo, purple, pink, brown, gray, and slate.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - needed so that tags can be attached to notes and inline hashtags can be parsed

**External Dependencies:**
- Local persistent storage for tag records and tag-note associations

**Assumed Capabilities:**
- User can navigate between the note list, note editor, and tag browser
- Local database is initialized and writable

#### 3.5 User Interface Requirements

##### Screen: Tag Input (Note Editor Metadata Panel)

**Layout:**
- Located below the note title and above the note body in the editor
- Displays as a horizontal row of tag chips (pill-shaped, colored if a tag color is assigned, default theme color otherwise)
- Each tag chip shows the tag name and an "x" dismiss button
- At the end of the tag chip row is a "+" button that opens the auto-complete tag input
- The auto-complete dropdown appears below the input, showing up to 10 matching suggestions sorted by usage frequency (most-used first)
- If the entered text does not match any existing tag, the dropdown shows a "Create '[text]'" option at the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Tags | Note has zero tags | Single "Add tag" placeholder chip with "+" icon |
| Tags Present | Note has 1+ tags | Row of tag chips with "+" button at end, scrollable horizontally if more than 5 tags visible |
| Input Active | User tapped "+" or "Add tag" | Text input replaces the "+" button, auto-complete dropdown appears after 2 characters |
| Max Tags Reached | Note has 50 tags | "+" button is hidden, attempting to add shows toast: "Maximum of 50 tags per note" |

**Interactions:**
- Tap "+" or "Add tag": activates the auto-complete input
- Type in input: filters existing tags and shows suggestions after 2 characters
- Tap suggestion: adds that tag to the note, clears input, input remains active for adding more
- Tap "Create '[text]'": creates a new tag with that name and adds it to the note
- Press Enter: if text matches an existing tag, adds it; if no match, creates and adds a new tag
- Tap "x" on tag chip: removes the tag from this note (does not delete the tag globally)
- Long press tag chip: opens context menu with "Change Color", "Rename Tag", "Remove from Note"

**Transitions/Animations:**
- Tag chips animate in with a scale-up from 0.8 to 1.0, 150ms duration
- Tag chip removal uses a scale-down to 0.8 with fade-out, 150ms duration
- Auto-complete dropdown slides down from the input, 200ms ease-out

##### Screen: Tag Browser

**Layout:**
- Accessible from the sidebar (desktop) or a "Tags" tab/filter button (mobile)
- Top section has a search input for filtering tags by name
- Below the search is a toggle: "List" (flat alphabetical) and "Tree" (nested hierarchy)
- In List mode: each row shows tag color dot (if assigned), tag name, and note count badge. Rows are sorted alphabetically
- In Tree mode: tags are grouped by their path hierarchy. Parent tags are collapsible nodes. Child tags are indented under their parent. Each node shows the same color dot, name, and count
- Bottom toolbar has "Filter Mode" toggle showing current mode ("All tags" for intersection or "Any tag" for union) and a "Manage Tags" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No tags exist | Centered message: "No tags yet. Add tags to your notes to organize by topic." |
| Populated | Tags exist | Scrollable list or tree of tags |
| Search Active | User typed in search input | Filtered list showing only tags matching the query |
| No Search Results | Search query has no matching tags | "No tags matching '[query]'" message |

**Interactions:**
- Tap tag row: toggles selection for filtering the note list. Selected tags show a checkmark icon
- Long press tag row: context menu with "Rename", "Change Color", "Merge Into...", "Delete Tag"
- Tap "Manage Tags": navigates to tag management screen with bulk operations
- Tap filter mode toggle: switches between "All tags" (intersection) and "Any tag" (union)

**Transitions/Animations:**
- Tree expand/collapse uses a height animation, 200ms ease-in-out
- Tag selection checkmark fades in, 150ms

#### 3.6 Data Requirements

##### Entity: Tag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique tag identifier |
| name | string | Required, max 100 chars, trimmed | None | Display name of the tag (e.g., "Project-Alpha") |
| path | string | Required, max 500 chars, derived from name | Same as name | Full hierarchical path (e.g., "work/project-alpha"). For top-level tags, path equals name |
| parent_path | string | Nullable, max 500 chars | null | Path of the parent tag (e.g., "work" for child "work/project-alpha"). Null for root-level tags |
| color | string | Nullable, one of 12 preset values | null | Optional tag color: red, orange, yellow, green, teal, blue, indigo, purple, pink, brown, gray, slate |
| usage_count | integer | Min: 0 | 0 | Cached count of notes using this tag. Updated on tag add/remove |
| created_at | datetime | ISO 8601, auto-set on creation | Current timestamp | When the tag was first created |
| updated_at | datetime | ISO 8601, auto-set on modification | Current timestamp | When the tag was last modified |

##### Entity: NoteTag (Join Table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| note_id | string | Foreign key -> Note.id, required | None | The note this tag is applied to |
| tag_id | string | Foreign key -> Tag.id, required | None | The tag applied to this note |
| created_at | datetime | ISO 8601, auto-set on creation | Current timestamp | When this tag was added to this note |

**Relationships:**
- Note has many Tags through NoteTag (many-to-many)
- Tag has many Notes through NoteTag (many-to-many)
- Tag has many child Tags (self-referential via parent_path, one-to-many)

**Indexes:**
- (note_id, tag_id) - unique composite, prevents duplicate tag assignments
- tag_id - foreign key lookup for tag deletion cascade
- path - for hierarchical queries and uniqueness enforcement
- parent_path - for tree view queries fetching children of a parent
- usage_count DESC - for sorting by popularity in auto-complete

**Validation Rules:**
- name: must not be empty after trimming whitespace
- name: must not contain the characters: / (forward slash is the hierarchy separator and only valid in path), #, [, ], {, }
- path: must be unique across all tags (case-insensitive)
- A note cannot have the same tag applied more than once (enforced by unique composite index)
- Nesting depth: path split by "/" must have at most 5 segments

**Example Data:**

```
Tag:
{
  "id": "t1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "name": "Project-Alpha",
  "path": "work/project-alpha",
  "parent_path": "work",
  "color": "blue",
  "usage_count": 14,
  "created_at": "2026-02-10T08:00:00Z",
  "updated_at": "2026-03-01T14:22:00Z"
}

NoteTag:
{
  "note_id": "n1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "tag_id": "t1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "created_at": "2026-03-01T14:22:00Z"
}
```

#### 3.7 Business Logic Rules

##### Tag Name Normalization

**Purpose:** Ensure tags are matched case-insensitively while preserving user-entered casing for display.

**Inputs:**
- raw_name: string - the tag name as entered by the user

**Logic:**

```
1. Trim leading and trailing whitespace from raw_name
2. Collapse any consecutive whitespace characters into a single space
3. IF raw_name is empty after trimming, RETURN validation error "Tag name cannot be empty"
4. IF raw_name contains forbidden characters (/, #, [, ], {, }), RETURN validation error "Tag name cannot contain / # [ ] { }"
5. IF raw_name length exceeds 100 characters, RETURN validation error "Tag name must be 100 characters or fewer"
6. Compute normalized_name = lowercase(raw_name) for matching purposes
7. Check if a tag with this normalized path already exists (case-insensitive match)
8. IF exists, RETURN the existing tag (do not create a duplicate)
9. IF not exists, create new Tag with name = raw_name (original casing), path = lowercase(raw_name)
10. RETURN the tag record
```

**Edge Cases:**
- User enters "  Work  ": normalized to "Work" for display, "work" for matching
- User enters "work" when "Work" exists: returns the existing "Work" tag rather than creating a duplicate
- User enters "work/project alpha": treated as a nested tag with parent "work" and child "project alpha"

##### Nested Tag Path Resolution

**Purpose:** Create parent tags automatically when a nested tag is created.

**Inputs:**
- full_path: string - the complete tag path (e.g., "work/project-alpha/backend")

**Logic:**

```
1. Split full_path by "/" into segments
2. IF segments count exceeds 5, RETURN validation error "Maximum tag nesting depth is 5 levels"
3. FOR each prefix of segments (e.g., ["work"], ["work", "project-alpha"], ["work", "project-alpha", "backend"]):
   a. Join prefix segments with "/" to form path_prefix
   b. IF no tag exists with this path_prefix:
      - Create a new Tag with name = last segment of prefix, path = path_prefix, parent_path = parent prefix (or null for root)
4. RETURN the leaf tag (the full path tag)
```

**Edge Cases:**
- Creating "a/b/c" when "a" already exists: only creates "a/b" and "a/b/c"; leaves "a" unchanged
- Creating "a/b/c" when "a/b/c" already exists: returns the existing tag, no duplicates created
- Deleting a parent tag: children are promoted (their parent_path is set to the grandparent's path, or null if the parent was root-level)

##### Tag Merge

**Purpose:** Combine two tags into one, updating all note associations.

**Inputs:**
- source_tag_id: string - the tag to be merged away
- destination_tag_id: string - the tag that absorbs the source's notes

**Logic:**

```
1. Load source_tag and destination_tag by their IDs
2. IF source_tag_id == destination_tag_id, RETURN error "Cannot merge a tag into itself"
3. Find all NoteTag records where tag_id = source_tag_id
4. FOR each NoteTag record:
   a. IF a NoteTag already exists for (note_id, destination_tag_id), delete the source NoteTag
   b. ELSE update the NoteTag's tag_id to destination_tag_id
5. Recalculate destination_tag.usage_count = COUNT(NoteTag where tag_id = destination_tag_id)
6. Delete source_tag
7. RETURN success with merge summary: { notes_moved: N, duplicates_skipped: M }
```

**Edge Cases:**
- Source tag has notes that already have the destination tag: those NoteTag records are deleted (no duplicates)
- Source tag has zero notes: tag is simply deleted, no notes are affected
- Merging a parent tag: child tags are not affected (they become orphaned at their current level)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Tag name is empty | Inline validation: "Tag name cannot be empty" below the input | User enters a non-empty name |
| Tag name contains forbidden characters | Inline validation: "Tag name cannot contain / # [ ] { }" | User removes forbidden characters |
| Tag name exceeds 100 characters | Inline validation: "Tag name must be 100 characters or fewer" | User shortens the name |
| Maximum 50 tags on a note | Toast: "Maximum of 50 tags per note" | User removes an existing tag before adding a new one |
| Nesting depth exceeds 5 levels | Inline validation: "Maximum tag nesting depth is 5 levels" | User restructures the tag hierarchy |
| Database write fails during tag creation | Toast: "Could not create tag. Please try again." | User retries; tag input retains the entered text |
| Tag merge fails mid-operation | Toast: "Merge failed. Some notes may not have been updated." | Transaction rollback restores pre-merge state; user retries |
| Deleting a tag with 500+ notes | Confirmation dialog: "Remove tag '[name]' from 500 notes? The notes themselves will not be deleted." | User confirms or cancels |

**Validation Timing:**
- Tag name validation runs on each keystroke (real-time inline feedback)
- Duplicate check runs on Enter/submit (requires a storage query)
- Tag count validation runs on add attempt

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is editing a note with no tags,
   **When** the user taps the "Add tag" chip, types "meeting", and presses Enter,
   **Then** a tag chip labeled "meeting" appears in the note's tag row, the tag is created in storage with usage_count = 1, and the tag input remains active for adding more tags.

2. **Given** a tag named "work" already exists with usage_count of 5,
   **When** the user types "wo" in the tag input,
   **Then** the auto-complete dropdown shows "work (5)" as a suggestion within 100ms.

3. **Given** the user selects 2 tags ("work" and "urgent") in the tag browser with intersection mode active,
   **When** the note list updates,
   **Then** only notes that have both "work" and "urgent" tags are displayed.

4. **Given** the user creates a tag "course/math/calculus",
   **When** the tag is saved,
   **Then** three tags are created: "course" (root), "course/math" (child), and "course/math/calculus" (grandchild), each with correct parent_path values.

5. **Given** the user renames the tag "meeting" to "meetings",
   **When** the rename completes,
   **Then** all notes previously tagged "meeting" now show "meetings", and the old tag name no longer appears anywhere in the app.

**Edge Cases:**

6. **Given** the user has a note with 50 tags,
   **When** the user tries to add a 51st tag,
   **Then** a toast message "Maximum of 50 tags per note" is displayed and the tag is not added.

7. **Given** a tag "Work" exists and the user tries to create "work",
   **When** the tag is submitted,
   **Then** the existing "Work" tag is returned (no duplicate is created).

**Negative Tests:**

8. **Given** the user types only spaces in the tag input,
   **When** the user presses Enter,
   **Then** inline validation shows "Tag name cannot be empty" and no tag is created.
   **And** the input is not cleared.

9. **Given** the user attempts to merge tag "urgent" into itself,
   **When** the merge is submitted,
   **Then** an error message "Cannot merge a tag into itself" is displayed.
   **And** no data is modified.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| normalizes tag name whitespace | raw_name: "  hello  world  " | name: "hello world", path: "hello world" |
| preserves original casing for display | raw_name: "Project-Alpha" | name: "Project-Alpha", path: "project-alpha" |
| rejects empty tag name | raw_name: "   " | Validation error: "Tag name cannot be empty" |
| rejects forbidden characters | raw_name: "note#1" | Validation error: "Tag name cannot contain / # [ ] { }" |
| rejects name exceeding 100 chars | raw_name: (101-char string) | Validation error: "Tag name must be 100 characters or fewer" |
| deduplicates case-insensitively | existing: "Work", input: "work" | Returns existing "Work" tag, no new record |
| creates parent tags for nested path | input: "a/b/c" | Three tags created: "a" (parent null), "a/b" (parent "a"), "a/b/c" (parent "a/b") |
| rejects nesting depth > 5 | input: "a/b/c/d/e/f" (6 levels) | Validation error: "Maximum tag nesting depth is 5 levels" |
| merge moves notes to destination | source has notes [1,2,3], dest has notes [3,4] | Dest now has notes [1,2,3,4]; source is deleted |
| merge handles zero-note source | source has 0 notes | Source is deleted, dest unchanged |
| usage_count updates on tag add | tag with usage_count 5, add to new note | usage_count becomes 6 |
| usage_count updates on tag remove | tag with usage_count 5, remove from note | usage_count becomes 4 |
| intersection filter returns correct notes | notes: A(tag1,tag2), B(tag1), C(tag2); filter: [tag1,tag2] | Only note A returned |
| union filter returns correct notes | notes: A(tag1), B(tag2), C(tag3); filter: [tag1,tag2] | Notes A and B returned |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add tag to note and verify in tag browser | 1. Create note, 2. Add tag "important", 3. Open tag browser | "important" appears with count 1 |
| Remove tag from note and verify count | 1. Note has tag "work" (usage_count 3), 2. Remove tag from this note | Tag "work" usage_count is now 2 |
| Rename tag and verify all notes update | 1. Create 3 notes with tag "mtg", 2. Rename tag to "meeting" | All 3 notes show "meeting" instead of "mtg" |
| Merge tags and verify consolidation | 1. Tag "bug" on notes A,B; tag "defect" on notes B,C, 2. Merge "defect" into "bug" | "bug" on notes A,B,C; "defect" is deleted; no duplicate on note B |
| Delete tag and verify notes unchanged | 1. Tag "temp" on notes A,B, 2. Delete tag "temp" | Notes A and B still exist, tag "temp" gone from both |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Organize notes by topic with tags | 1. Create 5 notes, 2. Tag 3 notes "work", 2 notes "personal", 3. Open tag browser, 4. Tap "work" | Note list shows only the 3 "work" notes; tag browser shows "work (3)" and "personal (2)" |
| Build a nested tag hierarchy | 1. Create tag "school/math/algebra", 2. Create tag "school/math/geometry", 3. Open tag browser in tree view | Tree shows "school" > "math" > "algebra" and "geometry" as siblings under "math" |

---

### NT-005: Note Pinning and Favorites

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-005 |
| **Feature Name** | Note Pinning and Favorites |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a personal note-taker, I want to pin my most important notes to the top of the note list, so that I can access them instantly without scrolling or searching.

**Secondary:**
> As a knowledge worker, I want to favorite notes for long-term reference, so that I can maintain a curated collection of frequently revisited notes separate from my pinned notes.

#### 3.3 Detailed Description

Note Pinning and Favorites provides two complementary mechanisms for surfacing important notes. Pinning is a short-term, positional feature: pinned notes appear in a dedicated "Pinned" section at the top of the note list, above all unpinned notes, in every folder view and the "All Notes" view. Favoriting is a long-term, collection-based feature: favorited notes are accessible from a dedicated "Favorites" view in the sidebar or navigation.

A note can be pinned, favorited, both, or neither. The two states are fully independent. Pinning is designed for notes the user needs right now (e.g., today's meeting agenda, an active project plan). Favoriting is designed for notes the user references frequently over time (e.g., a style guide, a password cheat sheet, an API reference).

Pinned notes are displayed in a collapsible "Pinned" section at the top of the note list. Within the pinned section, notes are sorted by pinned_at timestamp (most recently pinned first). The pinned section has a subtle visual divider separating it from the main note list below. A maximum of 25 notes can be pinned at any given time. Attempting to pin a 26th note shows a toast: "Maximum of 25 pinned notes. Unpin a note to make room."

Favoriting a note adds it to the "Favorites" collection. The Favorites view is accessible from the sidebar (desktop) or a "Favorites" icon in the tab bar or navigation header (mobile). Within the Favorites view, notes are sorted by favorited_at timestamp (most recently favorited first) by default, with an option to sort alphabetically by title. There is no limit on the number of favorited notes.

Users toggle pin and favorite states through several entry points: the note list context menu (long press or right-click), the note editor overflow menu, swipe actions on the note list, and dedicated toggle buttons in the note editor toolbar. Pin is represented by a pushpin icon; favorite is represented by a star icon. Filled icons indicate active state; outlined icons indicate inactive state.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - notes must exist to be pinned or favorited

**External Dependencies:**
- Local persistent storage for pin and favorite state on note records

**Assumed Capabilities:**
- Note list is implemented and displays notes
- Note editor has an overflow menu

#### 3.5 User Interface Requirements

##### Screen: Note List (Pinned Section)

**Layout:**
- The note list is divided into two sections by a visual divider (1px line in muted color)
- **Pinned section** (top): header row displays "Pinned" label (left) and a collapse/expand chevron (right). Below the header, pinned notes are listed in the standard note list row format (title, preview, date, tags). Each row has a filled pushpin icon to the left of the title
- **Main section** (below divider): all unpinned notes, sorted by the user's current sort preference (NT-020)
- If no notes are pinned, the pinned section is hidden entirely (no empty state shown for the pinned section)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Pinned Notes | Zero notes are pinned | Pinned section is hidden; main section occupies full list |
| Pinned Notes Present | 1-25 notes are pinned | Pinned section visible with divider, collapsible |
| Pinned Section Collapsed | User tapped collapse chevron | Only the "Pinned (N)" header is visible; pinned notes are hidden |
| Max Pins Reached | 25 notes pinned | Pin action in context menus and swipe is disabled; toast on attempt |

**Interactions:**
- Tap collapse/expand chevron: toggles pinned section visibility
- Swipe right on unpinned note: reveals "Pin" action (pin icon, accent color)
- Swipe right on pinned note: reveals "Unpin" action (unpin icon, muted color)
- Long press note: context menu includes "Pin" or "Unpin" depending on current state
- Tap pinned note row: opens note in editor (same as any note)

**Transitions/Animations:**
- Pinning a note: the note slides up from its current position into the pinned section, 300ms ease-in-out
- Unpinning a note: the note slides down from the pinned section into its sorted position in the main list, 300ms ease-in-out
- Pinned section collapse/expand: height animation, 200ms ease-in-out

##### Screen: Favorites View

**Layout:**
- Navigation bar shows "Favorites" title and sort toggle (right): "Recent" (by favorited_at) or "A-Z" (alphabetical by title)
- Content area is a scrollable list of favorited notes in standard note list row format
- Each row has a filled star icon to the left of the title

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No notes are favorited | Centered illustration (star outline), message: "No favorites yet", subtitle: "Star notes you want to find quickly" |
| Populated | 1+ notes are favorited | Scrollable list of favorited notes |

**Interactions:**
- Tap note row: opens note in editor
- Swipe left on note row: reveals "Unfavorite" action (star outline icon)
- Long press: context menu with "Unfavorite", "Pin/Unpin", "Move to Folder", "Delete"
- Tap sort toggle: switches between "Recent" and "A-Z" ordering

#### 3.6 Data Requirements

##### Entity: Note (additional fields)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| is_pinned | boolean | - | false | Whether the note is pinned to the top of the list |
| pinned_at | datetime | Nullable, ISO 8601 | null | Timestamp when the note was pinned. Null if not pinned |
| is_favorited | boolean | - | false | Whether the note is in the favorites collection |
| favorited_at | datetime | Nullable, ISO 8601 | null | Timestamp when the note was favorited. Null if not favorited |

**Indexes:**
- (is_pinned, pinned_at DESC) - for quickly fetching pinned notes in order
- (is_favorited, favorited_at DESC) - for the favorites view sorted by recency

**Validation Rules:**
- If is_pinned is true, pinned_at must not be null
- If is_pinned is false, pinned_at must be null
- If is_favorited is true, favorited_at must not be null
- If is_favorited is false, favorited_at must be null
- Maximum pinned notes across the entire database: 25

**Example Data:**

```
{
  "id": "n1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "title": "API Reference Guide",
  "is_pinned": true,
  "pinned_at": "2026-03-05T09:00:00Z",
  "is_favorited": true,
  "favorited_at": "2026-02-20T14:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Pin Toggle

**Purpose:** Pin or unpin a note, enforcing the 25-note maximum.

**Inputs:**
- note_id: string - the note to pin or unpin
- current_state: boolean - the note's current is_pinned value

**Logic:**

```
1. IF current_state is false (note is unpinned, user wants to pin):
   a. Count all notes where is_pinned = true
   b. IF count >= 25, RETURN error "Maximum of 25 pinned notes. Unpin a note to make room."
   c. Set is_pinned = true, pinned_at = now()
   d. Persist to storage
2. IF current_state is true (note is pinned, user wants to unpin):
   a. Set is_pinned = false, pinned_at = null
   b. Persist to storage
3. RETURN updated note
```

**Edge Cases:**
- Pinning a note that is already pinned: no-op, return the note unchanged
- Unpinning a note that is already unpinned: no-op, return the note unchanged
- Deleting a pinned note: the note is deleted and the pinned count decreases accordingly

##### Favorite Toggle

**Purpose:** Add or remove a note from the favorites collection.

**Inputs:**
- note_id: string - the note to favorite or unfavorite
- current_state: boolean - the note's current is_favorited value

**Logic:**

```
1. IF current_state is false (not favorited, user wants to favorite):
   a. Set is_favorited = true, favorited_at = now()
   b. Persist to storage
2. IF current_state is true (favorited, user wants to unfavorite):
   a. Set is_favorited = false, favorited_at = null
   b. Persist to storage
3. RETURN updated note
```

**Edge Cases:**
- Favoriting an already-favorited note: no-op
- Unfavoriting an already-unfavorited note: no-op
- Deleting a favorited note: note is removed from the favorites view

##### Pinned Note Sort Order

**Purpose:** Determine the display order of pinned notes within the pinned section.

**Inputs:**
- pinned_notes: array of Note records where is_pinned = true

**Logic:**

```
1. Sort pinned_notes by pinned_at in descending order (most recently pinned first)
2. RETURN sorted array
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Pin fails (storage error) | Toast: "Could not pin note. Please try again." | Pin state remains unchanged; user retries |
| Favorite fails (storage error) | Toast: "Could not favorite note. Please try again." | Favorite state remains unchanged; user retries |
| Maximum pins reached (25) | Toast: "Maximum of 25 pinned notes. Unpin a note to make room." | User unpins an existing note, then retries pinning |
| Database returns inconsistent state (is_pinned true, pinned_at null) | System auto-corrects: sets pinned_at = now() if is_pinned is true | No user action needed; auto-repair is silent |

**Validation Timing:**
- Pin count validation runs at the moment of the pin attempt
- State consistency validation runs on note load

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 10 unpinned notes,
   **When** the user long-presses a note and taps "Pin",
   **Then** the note moves to the top of the list in a "Pinned" section with a filled pushpin icon, and the note list shows 1 pinned note above the remaining 9.

2. **Given** the user has 3 pinned notes,
   **When** the user unpins the middle note,
   **Then** the note slides down to its sorted position in the main list, the pinned section shows 2 notes, and the unpinned note's pushpin icon is removed.

3. **Given** the user taps the star icon on a note in the editor,
   **When** the favorite state toggles,
   **Then** the star icon fills in, and the note appears in the Favorites view sorted at the top (most recently favorited).

4. **Given** the Favorites view contains 20 notes,
   **When** the user toggles the sort to "A-Z",
   **Then** the notes reorder alphabetically by title.

**Edge Cases:**

5. **Given** 25 notes are already pinned,
   **When** the user tries to pin a 26th note,
   **Then** a toast "Maximum of 25 pinned notes. Unpin a note to make room." is displayed and the note remains unpinned.

6. **Given** a note is both pinned and favorited,
   **When** the user deletes the note,
   **Then** the note is removed from both the pinned section and the Favorites view.

**Negative Tests:**

7. **Given** a note is already pinned,
   **When** the user taps "Pin" again,
   **Then** nothing changes (idempotent no-op).
   **And** no error is shown.

8. **Given** the user is viewing the Favorites view with no favorited notes,
   **When** the screen loads,
   **Then** the empty state shows "No favorites yet" with the subtitle "Star notes you want to find quickly".
   **And** no error or loading spinner is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| pins a note successfully | note with is_pinned=false, 10 existing pins | is_pinned=true, pinned_at set to current time |
| unpins a note successfully | note with is_pinned=true | is_pinned=false, pinned_at=null |
| rejects pin when 25 already pinned | 25 pinned notes, attempt to pin 26th | Error: "Maximum of 25 pinned notes" |
| pin is idempotent | note with is_pinned=true, pin again | No change, no error |
| unpin is idempotent | note with is_pinned=false, unpin again | No change, no error |
| favorites a note | note with is_favorited=false | is_favorited=true, favorited_at set |
| unfavorites a note | note with is_favorited=true | is_favorited=false, favorited_at=null |
| pin and favorite are independent | pin a favorited note | is_pinned=true AND is_favorited=true (both true) |
| pinned notes sort by pinned_at DESC | 3 notes pinned at T1, T2, T3 | Order: T3, T2, T1 |
| deleting pinned note decreases count | 25 pinned, delete 1 | Count is 24, can now pin a new note |
| auto-corrects inconsistent state | is_pinned=true, pinned_at=null | pinned_at auto-set to now() |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Pin note and verify list layout | 1. Open note list with 5 notes, 2. Pin 2nd note | Pinned section appears at top with 1 note, main section has 4 notes |
| Unpin all and verify section hides | 1. Unpin the only pinned note | Pinned section disappears, all notes in main section |
| Favorite note and verify in Favorites view | 1. Favorite a note from the editor, 2. Navigate to Favorites | Note appears in Favorites view with correct title |
| Unfavorite and verify removal | 1. Unfavorite a note from Favorites view | Note disappears from Favorites; it remains in the main note list |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Quick access workflow | 1. Create 20 notes, 2. Pin 3 most important, 3. Favorite 5 for reference, 4. Navigate between note list and Favorites | Note list shows 3 pinned at top; Favorites view shows 5 starred notes. 2 notes appear in both (the ones that are pinned and favorited) |
| Max pins enforcement | 1. Pin 25 notes, 2. Try to pin 26th, 3. Unpin 1, 4. Pin the 26th | After step 2: toast error. After step 4: 25 pinned notes with the new one included |

---

### NT-006: Wiki-Style [[Backlinks]]

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-006 |
| **Feature Name** | Wiki-Style [[Backlinks]] |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a knowledge worker, I want to link one note to another using [[double bracket]] syntax, so that I can build a web of interconnected ideas and navigate between related notes effortlessly.

**Secondary:**
> As a student, I want to type [[Lecture 5]] in my study notes and have it automatically link to an existing note titled "Lecture 5", so that I can cross-reference my lecture notes and study materials.

**Tertiary:**
> As a writer, I want to create a link to a note that does not yet exist, so that I can plan my outline and create the linked notes later.

#### 3.3 Detailed Description

Wiki-Style [[Backlinks]] enables bidirectional linking between notes using the double-bracket syntax popularized by wiki systems and adopted by Obsidian and Notion. When a user types [[target note title]] in the editor, the system recognizes this pattern and creates a navigable link to the note with the matching title. If no note with that title exists, the link is rendered in a distinct style (dashed underline, muted color) and tapping it creates a new note with that title.

The linking mechanism works by regex extraction during the markdown AST parsing step (NT-001). The regex pattern `/\[\[([^\]]+)\]\]/g` extracts all wiki link targets from the note body. Each extracted target is matched against existing note titles using a case-insensitive exact match. The match result is stored in a NoteLink join table that tracks source_note_id, target_note_id, and the link text.

As the user types `[[` in the editor, a note suggestion popup appears. This popup shows up to 10 existing note titles matching the text the user has typed so far after the opening brackets, ranked by relevance (exact prefix match first, then substring match, then fuzzy match). The suggestions update as the user continues typing. Selecting a suggestion inserts the full `[[Note Title]]` syntax. If the user types a title that matches no existing note and closes with `]]`, the link is marked as "unresolved" and rendered with a dashed underline.

In the rendered preview, resolved links appear as clickable text in the app's accent color with a solid underline. Tapping a resolved link navigates to the target note in the editor. Unresolved links appear with a dashed underline in a muted color. Tapping an unresolved link creates a new note with the link text as its title and navigates to it. After creation, the link automatically becomes resolved.

The link graph is maintained incrementally. Each time a note is saved, the system re-extracts all [[wiki links]] from the body, diffs them against the existing NoteLink records for that source note, inserts new links, and removes stale links. This keeps the link graph accurate without requiring a full rebuild.

Renaming a note updates all incoming wiki links across the entire note corpus. When a note's title changes from "Old Title" to "New Title", the system finds all notes that contain [[Old Title]] and replaces them with [[New Title]]. This batch update runs within a single database transaction to ensure consistency.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - wiki links are a markdown extension parsed by the editor's AST parser

**External Dependencies:**
- Local persistent storage for the NoteLink join table

**Assumed Capabilities:**
- The markdown parser can be extended with custom node types (WikiLink)
- The editor supports inline suggestion popups (similar to auto-complete)

#### 3.5 User Interface Requirements

##### Component: Wiki Link Suggestion Popup

**Layout:**
- Appears inline in the editor, anchored to the cursor position, when the user types `[[`
- Width: 280px on desktop, full screen width minus 32px padding on mobile
- Maximum height: 320px (scrollable if more than 10 suggestions, though only 10 are shown)
- Each suggestion row shows: note title (primary text), folder path (secondary text, muted), and last updated date (right-aligned, muted)
- At the bottom of the popup: "Create '[typed text]'" option when no exact match exists

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Initial | User typed `[[` with no additional text | Shows 10 most recently updated notes as suggestions |
| Filtering | User typed `[[par` (partial text) | Shows notes whose titles start with or contain "par", ranked by relevance |
| No Match | User typed `[[xyz123` with no matching titles | Shows only the "Create 'xyz123'" option |
| Selection Made | User tapped a suggestion or pressed Enter | Popup closes, `[[Selected Title]]` is inserted at cursor |
| Dismissed | User pressed Escape or typed outside brackets | Popup closes, raw text remains |

**Interactions:**
- Type after `[[`: filters suggestions in real time
- Arrow up/down: navigates suggestion list
- Enter or tap suggestion: inserts the selected title and closes the popup
- Escape: closes popup, leaves raw text as typed
- Continue typing `]]` without selecting: creates an inline link with the typed text

**Transitions/Animations:**
- Popup fades in and slides up 4px from cursor, 150ms ease-out
- Popup fades out, 100ms

##### Component: Rendered Wiki Link (Preview)

**Layout:**
- Resolved link: inline text in accent color with solid underline (1px). Cursor changes to pointer on hover (desktop)
- Unresolved link: inline text in muted color with dashed underline (1px). A small "+" icon appears after the text on hover (desktop) or always visible (mobile) to indicate it will create a new note

**Interactions:**
- Tap/click resolved link: navigates to the target note (push transition)
- Tap/click unresolved link: creates a new note with the link text as its title, navigates to the new note, and the link becomes resolved
- Hover resolved link (desktop): tooltip showing target note's first line preview (truncated to 80 characters)
- Long press link (mobile): context menu with "Open Note", "Open in New Tab" (web only), "Copy Link Text"

#### 3.6 Data Requirements

##### Entity: NoteLink

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique link identifier |
| source_note_id | string | Foreign key -> Note.id, required | None | The note containing the [[link]] text |
| target_note_id | string | Foreign key -> Note.id, nullable | null | The note being linked to. Null if the link is unresolved (target does not exist yet) |
| link_text | string | Required, max 255 chars | None | The raw text inside the brackets (e.g., "My Other Note") |
| is_resolved | boolean | - | false | Whether the target note exists |
| created_at | datetime | ISO 8601, auto-set on creation | Current timestamp | When this link was first created |
| updated_at | datetime | ISO 8601, auto-set on modification | Current timestamp | When this link record was last updated |

**Relationships:**
- Note (source) has many NoteLinks as outgoing links (one-to-many)
- Note (target) has many NoteLinks as incoming links/backlinks (one-to-many)
- NoteLink belongs to one source Note and optionally one target Note

**Indexes:**
- source_note_id - for fetching all outgoing links from a note
- target_note_id - for fetching all incoming links (backlinks) to a note
- (source_note_id, link_text) - unique composite, prevents duplicate links from the same source with the same text
- link_text - for title rename batch updates
- is_resolved - for filtering unresolved links

**Validation Rules:**
- source_note_id must reference an existing note
- link_text must not be empty after trimming
- link_text must be 255 characters or fewer
- A source note cannot link to itself (source_note_id != target_note_id when target is resolved)
- Duplicate links from the same source with the same link_text are not allowed

**Example Data:**

```
{
  "id": "lk1a2b3c-d5e6-7890-abcd-ef1234567890",
  "source_note_id": "n-source-1234",
  "target_note_id": "n-target-5678",
  "link_text": "Project Alpha Plan",
  "is_resolved": true,
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Wiki Link Extraction

**Purpose:** Extract all [[wiki links]] from a note's body and maintain the NoteLink table.

**Inputs:**
- note_id: string - the note being saved
- body: string - the full markdown body of the note

**Logic:**

```
1. Apply regex /\[\[([^\]]+)\]\]/g to body
2. Collect all captured group 1 values into extracted_links (array of strings)
3. Deduplicate extracted_links (case-insensitive)
4. Load existing NoteLink records where source_note_id = note_id
5. Compute added_links = extracted_links NOT IN existing links (by link_text, case-insensitive)
6. Compute removed_links = existing links NOT IN extracted_links (by link_text, case-insensitive)
7. FOR each added_link:
   a. Find note by title (case-insensitive exact match)
   b. IF found AND found note's id != note_id:
      - Create NoteLink(source_note_id=note_id, target_note_id=found.id, link_text=added_link, is_resolved=true)
   c. ELSE IF found AND found.id == note_id:
      - Skip (self-link not allowed)
   d. ELSE:
      - Create NoteLink(source_note_id=note_id, target_note_id=null, link_text=added_link, is_resolved=false)
8. FOR each removed_link:
   a. Delete the NoteLink record
9. RETURN { added: added_links.length, removed: removed_links.length, unresolved: count of is_resolved=false }
```

**Formulas:**
- `outgoing_link_count = COUNT(NoteLink WHERE source_note_id = note_id)`
- `incoming_link_count = COUNT(NoteLink WHERE target_note_id = note_id AND is_resolved = true)` (this is the backlink count)

**Edge Cases:**
- Note body contains `[[]]` (empty brackets): ignored, no link extracted
- Note body contains `[[same note title]]` (self-link): skipped, no NoteLink created
- Note body contains `[[Note A]] and [[Note A]]` (duplicate): only one NoteLink created
- Note body contains nested brackets `[[note [with] brackets]]`: the regex captures "note [with" (stops at first `]`), which is likely not the user's intent. The parser should handle this gracefully as a partial match
- Note title changes after a link was created: the NoteLink's link_text retains the original text; the rename handler (below) updates all affected links

##### Wiki Link Title Rename Propagation

**Purpose:** When a note's title changes, update all wiki links across the corpus that reference the old title.

**Inputs:**
- note_id: string - the renamed note
- old_title: string - the previous title
- new_title: string - the new title

**Logic:**

```
1. Find all NoteLink records where link_text matches old_title (case-insensitive) AND target_note_id = note_id
2. FOR each matching NoteLink:
   a. Update link_text to new_title
   b. Load the source note's body
   c. Replace all occurrences of [[old_title]] with [[new_title]] in the body (case-insensitive match on the link text, preserve surrounding brackets)
   d. Save the updated body
3. Wrap all updates in a single database transaction
4. RETURN { links_updated: count }
```

**Edge Cases:**
- The old title appears as regular text (not inside brackets): only text within [[ ]] is replaced
- Multiple links to the same note from one source: all instances are updated
- Transaction fails mid-update: all changes are rolled back, no partial renames

##### Unresolved Link Resolution

**Purpose:** When a new note is created, check if any unresolved links match its title.

**Inputs:**
- new_note_id: string - the newly created note
- new_note_title: string - the title of the new note

**Logic:**

```
1. Find all NoteLink records where is_resolved = false AND link_text matches new_note_title (case-insensitive)
2. FOR each matching NoteLink:
   a. Set target_note_id = new_note_id
   b. Set is_resolved = true
   c. Update updated_at
3. RETURN { resolved_count: count of updated links }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Wiki link regex fails on malformed input | The [[ text is displayed as literal text in the preview | No action needed; user can correct the syntax |
| Target note not found for link text | Link renders as unresolved (dashed underline, muted color) | User taps to create the note, or corrects the link text |
| Self-link detected | The link text is rendered but is not clickable; no NoteLink is created | User changes the link to reference a different note |
| Title rename fails mid-transaction | Toast: "Could not update all links. Some links may reference the old title." | Transaction rollback restores pre-rename state; user retries the rename |
| Database write fails during link extraction | Links are not updated; auto-save retry handles it on next debounce | No explicit user action; auto-retry on next save |
| Link text exceeds 255 characters | The first 255 characters are used as the link_text; excess is ignored | User shortens the link text |

**Validation Timing:**
- Link extraction runs on every auto-save (debounced, 2 seconds after last keystroke)
- Title rename propagation runs immediately when the user confirms a title change
- Unresolved link resolution runs when a new note is created

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user is in the editor and types `[[`,
   **When** the double-bracket is detected,
   **Then** a suggestion popup appears showing up to 10 recently updated note titles.

2. **Given** the suggestion popup is showing and the user types "Proj",
   **When** the text is entered,
   **Then** the suggestions filter to show notes with titles starting with or containing "Proj" (e.g., "Project Alpha", "Project Beta").

3. **Given** the user selects "Project Alpha" from the suggestions,
   **When** the selection is made,
   **Then** `[[Project Alpha]]` is inserted in the editor, the popup closes, and the preview renders "Project Alpha" as a clickable link in accent color with a solid underline.

4. **Given** the user types `[[New Idea]]` and no note titled "New Idea" exists,
   **When** the auto-save processes the link,
   **Then** the link is rendered in the preview with a dashed underline in muted color, and a NoteLink record is created with is_resolved=false.

5. **Given** the user taps an unresolved link for "New Idea",
   **When** the tap is processed,
   **Then** a new note titled "New Idea" is created, the user navigates to it, and the NoteLink is updated to is_resolved=true with the new note's id.

6. **Given** a note titled "Old Name" has 3 incoming links from other notes,
   **When** the user renames the note to "New Name",
   **Then** all 3 source notes have their `[[Old Name]]` text replaced with `[[New Name]]`, and all NoteLink records have their link_text updated.

**Edge Cases:**

7. **Given** the user types `[[My Note]] and [[My Note]]` in the same note body,
   **When** the auto-save extracts links,
   **Then** only one NoteLink record is created (duplicates are deduplicated).

8. **Given** the user types `[[]]` (empty brackets),
   **When** the parser processes the text,
   **Then** no NoteLink is created and the empty brackets are rendered as literal text.

**Negative Tests:**

9. **Given** the user types `[[Current Note Title]]` referencing the note they are currently editing,
   **When** the auto-save extracts links,
   **Then** no NoteLink is created (self-links are prevented).
   **And** the text renders as non-clickable styled text in the preview.

10. **Given** the link text is 300 characters long,
    **When** the NoteLink is saved,
    **Then** only the first 255 characters are stored as link_text.
    **And** no error is shown to the user.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| extracts single wiki link | body: "See [[Project Alpha]]" | extracted: ["Project Alpha"] |
| extracts multiple wiki links | body: "[[A]] and [[B]] and [[C]]" | extracted: ["A", "B", "C"] |
| deduplicates wiki links case-insensitively | body: "[[Alpha]] and [[alpha]]" | extracted: ["Alpha"] (one entry) |
| ignores empty brackets | body: "See [[]]" | extracted: [] |
| ignores single brackets | body: "See [not a link]" | extracted: [] |
| handles nested brackets gracefully | body: "[[note [inner] text]]" | extracted: ["note [inner"] (stops at first ]) |
| resolves link to existing note | link_text: "Alpha", note "Alpha" exists | NoteLink with is_resolved=true, target_note_id set |
| marks link as unresolved when note missing | link_text: "Beta", no note "Beta" exists | NoteLink with is_resolved=false, target_note_id=null |
| skips self-link | source note title "Alpha", body "[[Alpha]]" | No NoteLink created |
| removes stale links on re-save | old body: "[[A]] [[B]]", new body: "[[A]] [[C]]" | NoteLink for B deleted, NoteLink for C created, NoteLink for A unchanged |
| renames link text across corpus | old_title: "X", new_title: "Y", 3 notes link to X | All 3 notes updated: [[X]] -> [[Y]] in body and NoteLink.link_text |
| resolves unresolved links on note creation | 2 unresolved NoteLinks with link_text "Z", new note "Z" created | Both NoteLinks updated: is_resolved=true, target_note_id set |
| truncates link text at 255 chars | link_text: (300 chars) | Stored link_text is 255 chars |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create link and navigate | 1. Create note A, 2. Create note B titled "Plan", 3. In note A type [[Plan]], 4. Save, 5. Tap "Plan" link in preview | Navigation opens note B in editor |
| Create unresolved link then resolve | 1. In note A type [[Future]], 2. Save, 3. Create note "Future" | NoteLink for [[Future]] changes to is_resolved=true |
| Rename note updates links | 1. Note B "Plan" linked from A, C, D, 2. Rename B to "Master Plan" | Notes A, C, D body updated: [[Plan]] -> [[Master Plan]] |
| Delete target note | 1. Note B linked from A, 2. Delete note B | NoteLink from A becomes is_resolved=false, target_note_id=null |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Build a knowledge web | 1. Create "Project Overview", 2. In body type [[Requirements]], [[Architecture]], [[Timeline]], 3. Tap each unresolved link to create the notes | 4 notes exist; "Project Overview" has 3 outgoing links; each of the 3 child notes has 1 incoming backlink |
| Rename with link propagation | 1. Create 5 notes, link 3 to "Old Note", 2. Rename "Old Note" to "New Note" | All 3 linking notes show [[New Note]] in their body; all NoteLink records updated |

---

### NT-007: Backlinks Panel

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-007 |
| **Feature Name** | Backlinks Panel |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a knowledge worker, I want to see all notes that link to the note I am currently viewing, so that I can discover related context and navigate my knowledge graph without searching.

**Secondary:**
> As a researcher, I want each backlink to show the surrounding context where the link appears, so that I can understand why the linking note referenced this one without opening it.

#### 3.3 Detailed Description

The Backlinks Panel displays all incoming links to the currently viewed note. It appears as a collapsible section below the note editor/preview and provides a list of notes that contain [[wiki links]] pointing to the current note. Each backlink entry shows the source note's title, the text surrounding the link (a contextual snippet), and the date the link was created. This feature is the complementary half of the wiki-style linking system (NT-006): while NT-006 enables creating forward links, the Backlinks Panel reveals the reverse connections.

The panel fetches data by querying the NoteLink table for all records where target_note_id matches the current note's id and is_resolved is true. For each backlink, the system loads the source note's body and extracts a context snippet centered on the [[link text]]. The snippet includes up to 60 characters before and 60 characters after the link, with the link text itself highlighted.

The backlinks panel has three display modes. "Inline" mode (default) shows backlinks as an embedded, collapsible section at the bottom of the note editor, below the note body. "Sidebar" mode (desktop only) shows backlinks in the right sidebar alongside the note editor, always visible without scrolling past the note body. "Hidden" mode completely hides the backlinks panel. The display mode is configurable in settings (NT-021).

Backlinks are sorted by the source note's updated_at date in descending order (most recently updated source note first). If a single source note contains multiple links to the current note, only one backlink entry appears for that source note but the snippet shows the first occurrence.

The panel also shows "Unlinked Mentions" - notes that contain the current note's title as plain text (not within [[ ]] brackets). Unlinked mentions appear in a separate collapsible section below the backlinks. Each unlinked mention shows the source note title and a context snippet. A "Link" button next to each unlinked mention converts the plain text to a [[wiki link]] in the source note with a single tap.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-006: Wiki-Style [[Backlinks]] - the NoteLink table must exist and be populated for backlinks to function

**External Dependencies:**
- Local persistent storage for querying the NoteLink table

**Assumed Capabilities:**
- The note editor layout supports an additional section below the body
- The desktop layout supports a right sidebar panel

#### 3.5 User Interface Requirements

##### Component: Backlinks Panel (Inline Mode)

**Layout:**
- Located below the note body and above the note's metadata footer
- Header row: "Backlinks (N)" label (left, where N is the count) and a collapse/expand chevron (right)
- When expanded, each backlink entry is a card-like row:
  - Source note title (bold, tappable)
  - Context snippet (regular weight, with the [[link text]] highlighted in accent color and bold)
  - Source note's updated_at date (muted, right-aligned)
- Below the backlinks list, a second collapsible section: "Unlinked Mentions (M)"
  - Each entry: source note title, context snippet (current note's title highlighted), and a "Link" button (right-aligned)
- If both sections have zero entries, the panel shows a single line: "No backlinks or mentions"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No backlinks and no unlinked mentions | Single line: "No backlinks or mentions" in muted text |
| Backlinks Only | 1+ backlinks, 0 unlinked mentions | Backlinks section with entries; unlinked mentions section hidden |
| Both Present | 1+ backlinks, 1+ unlinked mentions | Both sections visible and independently collapsible |
| Collapsed | User collapsed the panel | Only the "Backlinks (N)" header is visible |
| Loading | Backlink data is being fetched | Skeleton rows (3 placeholder lines) with subtle pulse animation |

**Interactions:**
- Tap collapse/expand chevron: toggles the panel content visibility
- Tap source note title: navigates to that note in the editor (push transition)
- Tap "Link" button on unlinked mention: converts the plain text to [[wiki link]] in the source note, moves the entry from "Unlinked Mentions" to "Backlinks"
- Long press backlink entry: context menu with "Open Note", "Copy Link", "Remove Link" (removes the [[link]] from the source note)

**Transitions/Animations:**
- Panel expand/collapse: height animation, 200ms ease-in-out
- Unlinked mention converting to backlink: the entry slides from the "Unlinked Mentions" section up into the "Backlinks" section, 300ms ease-in-out
- New backlinks appearing (real-time after another note links to this one): fade-in, 200ms

##### Component: Backlinks Panel (Sidebar Mode - Desktop)

**Layout:**
- Right sidebar, 300px width, separated from the editor by a 1px vertical divider
- Header: "Backlinks" title with a close button (X) and a mode toggle icon
- Content: same backlink and unlinked mention entries as inline mode, scrollable independently of the editor
- The sidebar does not scroll with the editor; it maintains its own scroll position

**Interactions:**
- Same as inline mode, plus:
- Drag the vertical divider to resize the sidebar (minimum 200px, maximum 500px)
- Click close button: hides the sidebar (switches to hidden mode for this session)
- Click mode toggle: cycles through Inline, Sidebar, Hidden

#### 3.6 Data Requirements

No new entities are required. The Backlinks Panel reads from the NoteLink entity defined in NT-006 and the Note entity defined in NT-001.

**Derived Data:**

| Computed Field | Formula | Description |
|---------------|---------|-------------|
| backlink_count | `COUNT(NoteLink WHERE target_note_id = current_note_id AND is_resolved = true)` | Number of notes linking to the current note |
| unlinked_mention_count | Count of notes whose body_plain contains the current note's title but do not have a NoteLink to it | Number of notes mentioning the current note's title as plain text |

**Context Snippet Extraction:**

For each backlink, the context snippet is extracted as follows:
- Find the first occurrence of `[[link_text]]` in the source note's body
- Extract 60 characters before the `[[` and 60 characters after the `]]`
- If the start offset is less than 60, pad with available text from the beginning
- If the end offset exceeds the body length, pad with available text to the end
- Add "..." at the start if characters were truncated, and "..." at the end if characters were truncated
- Total maximum snippet length: 60 + link_text.length + 60 + 6 ("..." prefix and suffix) characters

**Example:**

Source note body: "In our weekly review, the team discussed [[Project Alpha]] and decided to prioritize the backend work."

Context snippet: "...weekly review, the team discussed **[[Project Alpha]]** and decided to prioritize the back..."

**Unlinked Mention Detection Query:**

```
1. Get current_note_title
2. Search all notes using FTS5 or LIKE query for notes containing current_note_title in body_plain
3. Exclude the current note itself
4. Exclude notes that already have a NoteLink with target_note_id = current_note_id
5. For each remaining note, extract a context snippet centered on the title occurrence
6. RETURN list of unlinked mentions
```

#### 3.7 Business Logic Rules

##### Backlink Fetching

**Purpose:** Load all backlinks and unlinked mentions for the current note.

**Inputs:**
- note_id: string - the current note's id
- note_title: string - the current note's title

**Logic:**

```
1. Query NoteLink table:
   SELECT NoteLink.*, Note.title, Note.body, Note.updated_at
   FROM NoteLink
   JOIN Note ON Note.id = NoteLink.source_note_id
   WHERE NoteLink.target_note_id = note_id
     AND NoteLink.is_resolved = true
   ORDER BY Note.updated_at DESC
2. FOR each result:
   a. Extract context_snippet from source note body around the [[link_text]]
   b. Build backlink entry: { source_title, context_snippet, source_note_id, updated_at }
3. Query for unlinked mentions:
   a. Search all notes where body_plain LIKE '%' || note_title || '%' (case-insensitive)
   b. Exclude current note (id != note_id)
   c. Exclude notes already in the backlinks result set
   d. FOR each result, extract context_snippet centered on the title occurrence
4. RETURN { backlinks: [...], unlinked_mentions: [...] }
```

**Edge Cases:**
- Note has zero backlinks and zero unlinked mentions: return empty arrays
- Note title is very short (1-2 characters): unlinked mention search is skipped to avoid excessive false positives (minimum title length for unlinked mention detection is 3 characters)
- Note title is a common word (e.g., "Note", "Draft"): unlinked mentions may return many results; cap at 50 entries and show "and N more..." text
- Source note was deleted after the NoteLink was created: the NoteLink record exists but the JOIN fails; filter out orphaned links

##### Convert Unlinked Mention to Backlink

**Purpose:** Replace a plain-text mention with a [[wiki link]] in the source note.

**Inputs:**
- source_note_id: string - the note containing the plain text mention
- mention_text: string - the exact text to wrap in brackets (the current note's title)

**Logic:**

```
1. Load source note's body
2. Find the first occurrence of mention_text in the body (case-insensitive)
3. Replace that occurrence with [[mention_text]] (using the original casing from the body)
4. Save the updated body (triggers auto-save, which triggers wiki link extraction from NT-006)
5. The wiki link extraction will create the NoteLink record automatically
6. RETURN success
```

**Edge Cases:**
- The mention text appears multiple times: only the first occurrence is converted (user can convert others manually)
- The mention text is already inside brackets or markdown formatting: the conversion wraps it, which may produce `**[[Title]]**` - this is valid markdown and renders correctly
- The source note's body changed between loading the backlinks panel and tapping "Link": reload the body before replacing to avoid overwriting concurrent edits

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Backlink query fails (database error) | Panel shows: "Could not load backlinks" with a "Retry" button | User taps "Retry" to re-query |
| Unlinked mention query times out (>2 seconds) | Unlinked mentions section shows "Loading mentions..." for 2 seconds, then "Mentions unavailable" | User can collapse and re-expand to retry |
| Convert to link fails (source note save error) | Toast: "Could not create link. Please try again." | Source note body is not modified; user retries |
| Orphaned NoteLink (source note deleted) | The backlink entry is silently filtered out; not displayed | No user action needed; orphaned record is cleaned up on next link extraction |
| Note title too short for unlinked mention search (<3 chars) | Unlinked mentions section shows: "Title too short for mention detection" | No action needed; user can rename the note to a longer title |

**Validation Timing:**
- Backlink query runs when the note is opened in the editor (on mount)
- Unlinked mention query runs 500ms after the backlink query completes (deferred for performance)
- Convert-to-link validation runs on button tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** note "Architecture" is linked from notes "Overview", "Backend", and "Frontend" via [[Architecture]],
   **When** the user opens "Architecture" in the editor,
   **Then** the backlinks panel shows "Backlinks (3)" with entries for "Overview", "Backend", and "Frontend", each with a context snippet showing the surrounding text.

2. **Given** a note "API Guide" is mentioned by plain text in 2 other notes but not linked with [[ ]],
   **When** the user opens "API Guide",
   **Then** the unlinked mentions section shows "Unlinked Mentions (2)" with entries for the 2 notes and a "Link" button next to each.

3. **Given** the user taps "Link" on an unlinked mention entry,
   **When** the conversion completes,
   **Then** the entry moves from "Unlinked Mentions" to "Backlinks", the backlinks count increments by 1, and the source note's body now contains [[API Guide]] where the plain text was.

4. **Given** the user taps a backlink's source note title,
   **When** the navigation occurs,
   **Then** the source note opens in the editor with the cursor at the beginning.

5. **Given** the user is on desktop and has backlinks sidebar mode enabled in settings,
   **When** a note with 5 backlinks is opened,
   **Then** the right sidebar shows the 5 backlinks without scrolling the main editor.

**Edge Cases:**

6. **Given** a note has zero backlinks and zero unlinked mentions,
   **When** the note is opened,
   **Then** the backlinks panel shows "No backlinks or mentions" in muted text.

7. **Given** a note title is "To" (2 characters),
   **When** the backlinks panel loads,
   **Then** the unlinked mentions section shows "Title too short for mention detection" (minimum 3 characters required).

8. **Given** a note has 100 unlinked mentions,
   **When** the backlinks panel loads,
   **Then** the first 50 are displayed with "and 50 more..." text at the bottom.

**Negative Tests:**

9. **Given** the database is temporarily unavailable,
   **When** the backlinks panel attempts to load,
   **Then** the panel shows "Could not load backlinks" with a "Retry" button.
   **And** the note editor remains fully functional (the panel failure does not block editing).

10. **Given** a backlink's source note was deleted after the NoteLink was created,
    **When** the backlinks panel loads,
    **Then** the orphaned backlink is silently excluded from the list and the count reflects only valid backlinks.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| returns backlinks for a note with 3 incoming links | target_note_id with 3 NoteLink records | Array of 3 backlink entries with source titles and snippets |
| returns empty array for note with no backlinks | target_note_id with 0 NoteLink records | Empty array |
| extracts context snippet correctly | body: "...discussed [[Alpha]] and decided...", link_text: "Alpha" | snippet: "...discussed **[[Alpha]]** and decided..." |
| snippet handles link at body start | body: "[[Alpha]] is the main project", link_text: "Alpha" | snippet: "**[[Alpha]]** is the main project..." |
| snippet handles link at body end | body: "The main project is [[Alpha]]", link_text: "Alpha" | snippet: "...main project is **[[Alpha]]**" |
| snippet truncates at 60 chars each side | body: (200 char text with [[link]] in middle) | Snippet is max 60 + link.length + 60 + 6 chars |
| filters orphaned NoteLinks (deleted source) | NoteLink exists but source Note.id not found | Backlink excluded from results |
| sorts backlinks by source updated_at DESC | 3 backlinks with updated_at: T1, T3, T2 | Order: T3, T2, T1 |
| detects unlinked mentions | note title "Alpha", another note body contains "Alpha" but no [[Alpha]] | Unlinked mention detected |
| skips unlinked mentions for short titles (<3 chars) | note title "AI" (2 chars) | Unlinked mentions array is empty, skip message returned |
| caps unlinked mentions at 50 | 75 notes mention "Alpha" in plain text | Only 50 returned with overflow indicator |
| converts unlinked mention to backlink | source body "discussed Alpha plan", mention_text "Alpha" | Updated body: "discussed [[Alpha]] plan" |
| converts only first occurrence | source body "Alpha said Alpha is great", mention_text "Alpha" | Updated body: "[[Alpha]] said Alpha is great" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Open note and see backlinks load | 1. Create notes A, B, C; B and C link to A, 2. Open note A | Backlinks panel shows 2 entries for B and C |
| Convert mention to link | 1. Note B mentions "Alpha" as plain text, 2. Open note "Alpha", 3. Tap "Link" on B's unlinked mention | B's body updated with [[Alpha]], entry moves to backlinks section |
| Delete source note and verify backlinks update | 1. Note B links to A, 2. Delete note B, 3. Re-open note A | Backlinks panel shows 0 entries (orphaned link filtered) |
| Backlinks update after new link added | 1. Note A open with 2 backlinks, 2. In note D, add [[Note A title]], 3. Re-open note A | Backlinks panel shows 3 entries |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Discover related context through backlinks | 1. Create 10 notes about a project, 2. Link 4 of them to a "Summary" note, 3. Open "Summary" | Backlinks panel shows 4 entries with context snippets showing why each note references "Summary"; user taps one to navigate |
| Clean up unlinked mentions | 1. Open a note with 3 unlinked mentions, 2. Tap "Link" on 2 of them, 3. Leave 1 as plain text | Backlinks count increases by 2; unlinked mentions count decreases by 2; one unlinked mention remains |

---

### NT-008: Note Templates

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-008 |
| **Feature Name** | Note Templates |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a knowledge worker, I want to create notes from reusable templates (meeting notes, project plan, weekly review), so that I do not have to recreate the same structure from scratch every time.

**Secondary:**
> As a user who has built a useful note structure, I want to save any existing note as a template, so that I can reuse its format for future notes without duplicating content.

#### 3.3 Detailed Description

Note Templates provides a library of reusable markdown structures that users can apply when creating new notes. A template is a markdown body with optional placeholder variables (e.g., `{{date}}`, `{{title}}`) that are substituted when the template is applied. MyNotes ships with 8 built-in templates and users can create unlimited custom templates.

The template library is accessible from two entry points. First, when creating a new note, a "From Template" option appears in the new note action sheet alongside "Blank Note". Tapping it opens the template picker. Second, from the Settings screen (NT-021), a "Manage Templates" section allows browsing, editing, creating, and deleting custom templates.

Built-in templates cannot be deleted but can be hidden. Custom templates can be created from scratch (blank template editor) or by saving an existing note as a template (which copies the note's current body as the template content and strips any note-specific data like tags or folder assignment).

Templates support the following placeholder variables that are auto-replaced when the template is applied:

| Variable | Replaced With | Example |
|----------|--------------|---------|
| `{{date}}` | Current date in the user's locale format | "March 7, 2026" |
| `{{date_iso}}` | Current date in ISO 8601 format | "2026-03-07" |
| `{{time}}` | Current time in the user's locale format | "2:30 PM" |
| `{{datetime}}` | Current date and time | "March 7, 2026 2:30 PM" |
| `{{title}}` | The note's title (set at creation or from template name) | "Weekly Review" |
| `{{day_of_week}}` | Current day name | "Friday" |
| `{{week_number}}` | ISO week number | "10" |

Placeholder variables are case-insensitive. `{{Date}}` and `{{DATE}}` both resolve to the current date.

Built-in templates:

1. **Meeting Notes** - Title, date, attendees list, agenda, discussion points, action items checklist
2. **Weekly Review** - Week number, accomplishments, challenges, next week priorities, gratitude
3. **Project Plan** - Project title, objective, timeline, milestones checklist, risks, notes
4. **Decision Log** - Decision title, date, context, options considered, decision made, rationale
5. **Book Notes** - Book title, author, date read, key takeaways, favorite quotes, personal reflections
6. **Research Notes** - Topic, sources, key findings, questions, next steps
7. **Daily Standup** - Date, yesterday, today, blockers
8. **Cornell Notes** - Two-column layout (questions/cues on left, notes on right), summary at bottom

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - templates produce markdown content for the editor
- NT-002: Notebook and Folder Hierarchy - template-created notes are placed in the current folder context

**External Dependencies:**
- Local persistent storage for custom template records

**Assumed Capabilities:**
- The note creation flow supports multiple entry paths (blank, from template)
- The settings screen exists for template management

#### 3.5 User Interface Requirements

##### Screen: Template Picker

**Layout:**
- Modal screen presented when the user selects "From Template" during note creation
- Top navigation bar: "Choose Template" title (center) and "Cancel" button (right)
- Content area divided into two sections:
  - **Built-in Templates** section: 8 cards in a 2-column grid layout. Each card shows the template name (bold), a 2-line preview of the template body (muted text), and a category label chip
  - **My Templates** section (below built-in): custom templates in the same 2-column grid, sorted by last_used_at descending (most recently used first). If no custom templates exist, a placeholder card with "+" icon and "Create Template" text
- Each card has a subtle border and rounded corners (8px radius)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Built-in templates visible, user has custom templates | Both sections populated |
| No Custom Templates | User has not created any custom templates | Built-in section populated, "My Templates" section shows only the "Create Template" placeholder card |
| Search Active | User tapped search icon and typed a query | Templates filtered by name match, both sections filtered |

**Interactions:**
- Tap template card: applies the template (replaces note body with template content, substitutes variables), closes the picker, and opens the note editor
- Long press template card (custom only): context menu with "Edit Template", "Duplicate", "Delete"
- Tap "Create Template" placeholder: opens the template editor with a blank body
- Tap "Cancel": dismisses the picker without creating a note

**Transitions/Animations:**
- Picker slides up as a modal, 300ms ease-out
- Template cards have a subtle press scale effect (0.97), 100ms

##### Screen: Template Editor

**Layout:**
- Full-screen editor similar to the note editor (NT-001)
- Top navigation bar: "Edit Template" title (center), "Cancel" (left), "Save" (right)
- Template name input field (required, max 100 characters)
- Template category dropdown (optional): Meeting, Planning, Research, Personal, Other
- Body editor: markdown text area with the standard formatting toolbar. Placeholder variables (e.g., `{{date}}`) are highlighted in accent color as the user types
- A "Preview" toggle shows the template with variables replaced by sample values

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| New Template | Creating from scratch | Empty name field, empty body, "Save" disabled until name is filled |
| Editing | Modifying an existing custom template | Pre-populated name and body, "Save" enabled |
| Preview | User toggled preview mode | Body rendered with sample variable substitutions |

**Interactions:**
- Type in name field: enables "Save" when non-empty
- Type in body: standard markdown editing with toolbar
- Toggle preview: shows rendered template with sample data
- Tap "Save": persists the template and returns to the previous screen
- Tap "Cancel": confirmation dialog if unsaved changes exist, then dismisses

#### 3.6 Data Requirements

##### Entity: Template

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique template identifier |
| name | string | Required, max 100 chars, trimmed | None | Template display name |
| body | string | Required, max 100,000 chars | None | Markdown template content with optional {{variable}} placeholders |
| category | string | Nullable, one of: meeting, planning, research, personal, other | null | Optional grouping category |
| is_builtin | boolean | - | false | Whether this is a system-provided template (cannot be deleted) |
| is_hidden | boolean | - | false | Whether the user has hidden this template from the picker |
| use_count | integer | Min: 0 | 0 | How many times this template has been used to create a note |
| last_used_at | datetime | Nullable, ISO 8601 | null | When this template was last used |
| created_at | datetime | ISO 8601, auto-set on creation | Current timestamp | When the template was created |
| updated_at | datetime | ISO 8601, auto-set on modification | Current timestamp | When the template was last modified |

**Indexes:**
- is_builtin - for separating built-in from custom templates
- (is_hidden, is_builtin) - for the template picker query (show non-hidden templates, built-in first)
- last_used_at DESC - for sorting custom templates by recency

**Validation Rules:**
- name: must not be empty after trimming
- name: must be unique among all templates (case-insensitive)
- body: must not be empty after trimming
- Built-in templates: is_builtin=true, cannot be deleted, cannot have name or body modified
- Built-in templates can have is_hidden toggled

**Example Data:**

```
{
  "id": "tp-meeting-001",
  "name": "Meeting Notes",
  "body": "# {{title}}\n\n**Date:** {{date}}\n**Attendees:**\n- \n\n## Agenda\n1. \n\n## Discussion\n\n## Action Items\n- [ ] \n",
  "category": "meeting",
  "is_builtin": true,
  "is_hidden": false,
  "use_count": 12,
  "last_used_at": "2026-03-06T09:00:00Z",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Template Variable Substitution

**Purpose:** Replace placeholder variables in the template body with actual values when creating a note.

**Inputs:**
- template_body: string - the raw template markdown with {{variables}}
- note_title: string - the title of the new note being created

**Logic:**

```
1. Define variable_map:
   - "date" -> format current date in user locale (e.g., "March 7, 2026")
   - "date_iso" -> format current date as ISO 8601 (e.g., "2026-03-07")
   - "time" -> format current time in user locale (e.g., "2:30 PM")
   - "datetime" -> format current date and time in user locale
   - "title" -> note_title
   - "day_of_week" -> current day name (e.g., "Friday")
   - "week_number" -> ISO week number as string (e.g., "10")
2. Apply regex /\{\{(\w+)\}\}/gi to template_body
3. FOR each match:
   a. Extract variable_name from capture group 1
   b. Normalize variable_name to lowercase
   c. IF variable_name exists in variable_map, replace with the mapped value
   d. ELSE leave the {{variable_name}} text unchanged
4. RETURN the substituted body
```

**Edge Cases:**
- Unknown variable `{{custom}}`: left as literal text "{{custom}}" in the output
- Empty template body: returns empty string
- Template with no variables: body is used as-is
- Variable map value contains markdown syntax: inserted as-is (rendered by the markdown parser)

##### Save Note as Template

**Purpose:** Convert an existing note's body into a reusable template.

**Inputs:**
- note_id: string - the note to save as a template
- template_name: string - the name for the new template

**Logic:**

```
1. Load the note's body
2. IF a template with the same name already exists (case-insensitive), RETURN error "A template with this name already exists"
3. Create a new Template record:
   - name = template_name
   - body = note body (as-is, no modifications)
   - is_builtin = false
   - use_count = 0
4. RETURN the created template
```

**Edge Cases:**
- Note body is empty: template is created with an empty body (user may want to add content later)
- Note body exceeds 100,000 characters: truncated to 100,000 with a toast "Template body truncated to 100,000 characters"
- Note contains [[wiki links]]: links are preserved as literal text in the template (they will function when a note is created from the template)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Template name is empty | Inline validation: "Template name is required" | User enters a name |
| Template name already exists | Inline validation: "A template with this name already exists" | User chooses a different name |
| Template body is empty | Inline validation: "Template body cannot be empty" | User adds content |
| Failed to save template (storage error) | Toast: "Could not save template. Please try again." | User retries |
| Built-in template deletion attempted | Action is not available (delete option hidden for built-in templates) | No recovery needed |
| Template body exceeds 100,000 chars | Toast: "Template body truncated to 100,000 characters" | Body is auto-truncated |

**Validation Timing:**
- Name validation: on blur (when user leaves the name field)
- Name uniqueness check: on save attempt
- Body validation: on save attempt

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps "New Note" and selects "From Template",
   **When** the template picker opens,
   **Then** the picker displays 8 built-in templates in a grid and any custom templates below them.

2. **Given** the user selects the "Meeting Notes" template,
   **When** the template is applied,
   **Then** a new note is created with the template body, all {{date}} variables are replaced with today's date, and the editor opens with the content ready to edit.

3. **Given** the user opens a note with a useful structure and taps "Save as Template" from the overflow menu,
   **When** the user names the template "Sprint Retro" and saves,
   **Then** the template appears in the "My Templates" section of the template picker.

4. **Given** the user creates 5 notes from the "Weekly Review" template,
   **When** the user opens the template picker,
   **Then** the "Weekly Review" template shows use_count of 5, and it appears prominently in the built-in section.

**Edge Cases:**

5. **Given** a template contains `{{unknown_variable}}`,
   **When** the template is applied to create a note,
   **Then** the literal text "{{unknown_variable}}" appears in the note body (no substitution, no error).

6. **Given** the user tries to delete a built-in template,
   **When** the context menu is shown,
   **Then** "Delete" is not available; only "Hide" is offered.

**Negative Tests:**

7. **Given** a custom template named "Sprint Retro" already exists,
   **When** the user tries to create another template named "sprint retro",
   **Then** validation shows "A template with this name already exists".
   **And** the template is not created.

8. **Given** the template body is 150,000 characters,
   **When** the user saves the template,
   **Then** the body is truncated to 100,000 characters and a toast informs the user.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| substitutes date variable | body: "Today is {{date}}", current date: 2026-03-07 | "Today is March 7, 2026" (locale-dependent) |
| substitutes date_iso variable | body: "{{date_iso}}", current date: 2026-03-07 | "2026-03-07" |
| substitutes title variable | body: "# {{title}}", title: "My Note" | "# My Note" |
| substitutes day_of_week | body: "{{day_of_week}}", current day: Saturday | "Saturday" |
| substitutes week_number | body: "Week {{week_number}}", ISO week: 10 | "Week 10" |
| handles case-insensitive variables | body: "{{DATE}} and {{Date}}" | Both replaced with current date |
| preserves unknown variables | body: "{{custom}}" | "{{custom}}" (unchanged) |
| handles empty body | body: "" | "" |
| handles body with no variables | body: "Hello world" | "Hello world" |
| rejects empty template name | name: "  " | Validation error: "Template name is required" |
| rejects duplicate template name | existing: "Sprint", input: "sprint" | Validation error: "A template with this name already exists" |
| truncates body at 100,000 chars | body: (150,000 chars) | Stored body is 100,000 chars |
| prevents deletion of built-in templates | template with is_builtin=true | Deletion rejected |
| allows hiding built-in templates | template with is_builtin=true, set is_hidden=true | is_hidden=true, template excluded from picker |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create note from template | 1. Open template picker, 2. Select "Meeting Notes", 3. Verify note content | New note contains meeting notes structure with today's date substituted |
| Save note as template | 1. Create note with markdown content, 2. Tap "Save as Template", 3. Name it "Custom", 4. Open template picker | "Custom" appears in "My Templates" section |
| Edit custom template | 1. Open Manage Templates in settings, 2. Edit a custom template body, 3. Save, 4. Create note from updated template | Note contains the updated template body |
| Hide built-in template | 1. Open Manage Templates, 2. Hide "Cornell Notes", 3. Open template picker | "Cornell Notes" card is not visible in the picker |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Weekly review workflow | 1. Create note from "Weekly Review" template every Monday for 4 weeks, 2. Each note has unique date substituted, 3. Open template picker | 4 notes created with consecutive dates; "Weekly Review" use_count is 4; template shows as most recently used |
| Custom template lifecycle | 1. Write a note with a project status structure, 2. Save as template "Status Update", 3. Create 3 notes from it, 4. Edit the template to add a new section, 5. Create a 4th note | First 3 notes have original structure; 4th note has the updated structure with the new section |

---

### NT-009: Task Lists and Checklists

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-009 |
| **Feature Name** | Task Lists and Checklists |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a personal note-taker, I want to embed checklists in my notes using markdown checkbox syntax, so that I can track to-dos and action items directly in the note where I plan them.

**Secondary:**
> As a project manager, I want to see the completion percentage of checklists in a note, so that I can gauge progress at a glance from the note list without opening the note.

#### 3.3 Detailed Description

Task Lists and Checklists adds interactive checkbox support to the markdown editor. Users create task items using the standard markdown syntax `- [ ] unchecked item` and `- [x] checked item`. In the rendered preview, each task item displays as a tappable checkbox that toggles between checked and unchecked states. Toggling a checkbox in the preview updates the corresponding markdown source in the editor (changing `[ ]` to `[x]` or vice versa) and triggers an auto-save.

Task lists can be nested. A task item can contain sub-tasks by indenting them with 2 or 4 spaces. The nesting depth is limited to 6 levels. Nested tasks are indented visually in the preview to reflect the hierarchy. Parent tasks do not auto-check when all children are checked (each item is independently toggled).

The checklist progress indicator is computed from all task items in a note. The formula is: `checklist_progress = checked_items / total_items * 100`, expressed as a percentage rounded to the nearest integer. This progress value is stored on the Note record and displayed in the note list as a small progress bar beneath the note preview text. Notes with zero task items do not display a progress indicator.

Task items can be mixed with regular markdown content. A note can contain paragraphs, headings, and other formatting interspersed with task lists. The parser treats each `- [ ]` or `- [x]` line as a TaskListItem AST node, distinct from regular list items.

A dedicated "Tasks" view aggregates all incomplete tasks across all notes into a single list. Each entry shows the task text, the source note title (tappable to navigate to the note), and the task's creation context. This cross-note task view is accessible from the sidebar (desktop) or a "Tasks" button in the navigation (mobile). Tasks in the aggregated view can be checked off, which updates the source note's markdown accordingly.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - task lists are a markdown extension rendered by the editor's preview

**External Dependencies:**
- Local persistent storage for task item records and progress tracking

**Assumed Capabilities:**
- The markdown parser supports TaskListItem AST nodes (specified in NT-001)
- The preview renderer can handle interactive (tappable) elements

#### 3.5 User Interface Requirements

##### Component: Task List (Preview/Rendered)

**Layout:**
- Each task item is rendered as a row with: a tappable checkbox (left), task text (right of checkbox), and strikethrough styling on the text if checked
- Nested tasks are indented by 20px per nesting level
- Checkboxes are 20x20px with a 2px border in muted color (unchecked) or filled with accent color and a white checkmark (checked)
- Checked items have their text in muted color with strikethrough

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Unchecked | `- [ ] text` | Empty checkbox, normal text |
| Checked | `- [x] text` | Filled checkbox with checkmark, strikethrough muted text |
| Nested Unchecked | Indented `- [ ] text` | Indented empty checkbox |
| Nested Checked | Indented `- [x] text` | Indented filled checkbox with strikethrough |

**Interactions:**
- Tap checkbox: toggles checked/unchecked state, updates markdown source, triggers auto-save
- Long press task item (mobile): context menu with "Delete Task", "Move Up", "Move Down", "Indent", "Outdent"
- Tap task text in preview: no action (text is not editable in preview mode; user must switch to edit mode)

**Transitions/Animations:**
- Checkbox state change: checkmark scales in from 0 to 1, 150ms ease-out with a subtle bounce
- Strikethrough text: slides in from left to right across the text, 200ms ease-in

##### Component: Checklist Progress Bar (Note List)

**Layout:**
- Displayed below the note preview text in the note list row, only for notes with 1+ task items
- Thin horizontal bar (4px height, full width of the row minus padding)
- Filled portion in accent color representing the percentage complete
- Label to the right of the bar: "N/M" (e.g., "3/7") showing checked count over total count
- Width: percentage of the bar width corresponding to checklist_progress

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Tasks | Note has 0 task items | Progress bar not displayed |
| Partial | 1-99% complete | Partially filled bar with "N/M" label |
| Complete | 100% complete | Fully filled bar in green color, "M/M" label |
| All Unchecked | 0% complete | Empty bar (unfilled) with "0/M" label |

##### Screen: Tasks View (Cross-Note Aggregation)

**Layout:**
- Accessible from sidebar (desktop) or navigation (mobile)
- Top bar: "Tasks" title, filter options: "All", "Today's Notes", "This Week's Notes"
- Content area: scrollable list of incomplete task items grouped by source note
- Each group has a header showing the source note title (tappable) and the note's checklist progress
- Under each group header, the incomplete tasks from that note are listed with checkboxes
- At the bottom: summary line "N tasks remaining across M notes"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No incomplete tasks across all notes | Centered illustration, message: "All caught up! No open tasks." |
| Populated | 1+ incomplete tasks | Grouped list of tasks by source note |

**Interactions:**
- Tap checkbox: marks task complete in the source note, task animates out of the list
- Tap source note title: navigates to the note in the editor with cursor at the task's line
- Pull-to-refresh: reloads task list from all notes

#### 3.6 Data Requirements

##### Entity: Note (additional fields)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| task_total | integer | Min: 0 | 0 | Total number of task items (checked + unchecked) in the note |
| task_checked | integer | Min: 0 | 0 | Number of checked task items in the note |
| checklist_progress | integer | Min: 0, Max: 100 | 0 | Percentage of tasks completed, rounded to nearest integer. 0 if task_total is 0 |

##### Entity: TaskItem (denormalized for cross-note view)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique task identifier |
| note_id | string | Foreign key -> Note.id, required | None | The note containing this task |
| text | string | Required, max 1,000 chars | None | The task item text (markdown stripped) |
| is_checked | boolean | - | false | Whether the task is complete |
| line_number | integer | Min: 1 | None | Line number in the note body where this task appears |
| nesting_level | integer | Min: 0, Max: 5 | 0 | Indentation depth (0 = top level) |
| sort_order | integer | Min: 0 | 0 | Order of appearance in the note |
| created_at | datetime | ISO 8601, auto-set on creation | Current timestamp | When this task was first detected |
| updated_at | datetime | ISO 8601, auto-set on modification | Current timestamp | When this task was last updated |

**Relationships:**
- Note has many TaskItems (one-to-many)
- TaskItem belongs to one Note

**Indexes:**
- note_id - for fetching all tasks from a specific note
- (is_checked, note_id) - for the cross-note task view (filter incomplete, group by note)
- (note_id, sort_order) - for ordered display within a note

**Validation Rules:**
- task_checked must be <= task_total
- checklist_progress = ROUND(task_checked / task_total * 100) when task_total > 0, else 0
- line_number must correspond to an actual task item line in the note body
- nesting_level must be between 0 and 5

**Example Data:**

```
Note (partial):
{
  "id": "n-task-1234",
  "task_total": 7,
  "task_checked": 3,
  "checklist_progress": 43
}

TaskItem:
{
  "id": "ti-001",
  "note_id": "n-task-1234",
  "text": "Review API documentation",
  "is_checked": false,
  "line_number": 12,
  "nesting_level": 0,
  "sort_order": 0,
  "created_at": "2026-03-05T10:00:00Z",
  "updated_at": "2026-03-05T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Task Extraction and Sync

**Purpose:** Parse task items from the note body and keep the TaskItem table synchronized.

**Inputs:**
- note_id: string - the note being saved
- body: string - the full markdown body

**Logic:**

```
1. Scan body line by line
2. FOR each line matching regex /^(\s*)- \[([ xX])\] (.+)$/:
   a. Calculate nesting_level = leading_whitespace_count / 2 (integer division, cap at 5)
   b. Determine is_checked = (capture group 2 is "x" or "X")
   c. Extract text = capture group 3 (trimmed)
   d. Record line_number and sort_order (sequential from 0)
3. Compare extracted tasks with existing TaskItem records for this note_id:
   a. Match by (sort_order, text) to identify existing items
   b. Update changed items (is_checked, line_number, text)
   c. Insert new items
   d. Delete removed items
4. Update Note record:
   a. task_total = count of all extracted tasks
   b. task_checked = count of extracted tasks where is_checked = true
   c. checklist_progress = IF task_total > 0 THEN ROUND(task_checked / task_total * 100) ELSE 0
5. RETURN { task_total, task_checked, checklist_progress }
```

**Formulas:**
- `checklist_progress = ROUND(task_checked / task_total * 100)` when task_total > 0
- `checklist_progress = 0` when task_total = 0

**Edge Cases:**
- Note has zero task items: task_total = 0, task_checked = 0, checklist_progress = 0, progress bar hidden
- All tasks checked: checklist_progress = 100, progress bar fully filled in green
- Task text contains markdown formatting (e.g., `- [ ] **bold task**`): text field stores the plain text ("bold task"), rendering uses the full markdown
- Task indented more than 10 spaces: nesting_level capped at 5
- Checkbox toggled in preview: the body is updated immediately ([ ] -> [x] or vice versa), then auto-save runs the extraction

##### Checkbox Toggle from Preview

**Purpose:** Update the note body when a user taps a checkbox in the rendered preview.

**Inputs:**
- note_id: string - the note
- task_sort_order: integer - which task was toggled (positional index)
- new_state: boolean - true for checked, false for unchecked

**Logic:**

```
1. Load the note body
2. Find the N-th task item line (where N = task_sort_order, 0-indexed)
3. IF new_state is true:
   a. Replace "- [ ]" with "- [x]" on that line
4. IF new_state is false:
   a. Replace "- [x]" or "- [X]" with "- [ ]" on that line
5. Save the updated body (triggers auto-save flow)
6. Re-run task extraction to update counts
```

**Edge Cases:**
- Body changed between render and toggle (concurrent editing): re-scan for the task by matching text content rather than line number
- Task no longer exists (deleted between render and toggle): no-op, toast "Task not found"

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Task extraction fails (parser error) | Task counts show stale values; no progress bar update | Next auto-save retries extraction |
| Checkbox toggle fails (storage error) | Toast: "Could not update task. Please try again." | Checkbox reverts to previous state visually |
| Task not found during toggle | Toast: "Task not found. The note may have changed." | User refreshes the preview |
| Cross-note task view fails to load | Screen shows "Could not load tasks. Pull down to retry." | User pulls to refresh |
| Task text exceeds 1,000 chars | Truncated to 1,000 chars for TaskItem record; full text preserved in note body | No user action needed |

**Validation Timing:**
- Task extraction runs on every auto-save (debounced)
- Checkbox toggle validation is immediate
- Cross-note task view loads on screen mount

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user types `- [ ] Buy groceries` in the editor,
   **When** the preview renders,
   **Then** an interactive unchecked checkbox with the text "Buy groceries" is displayed.

2. **Given** the user taps the checkbox in the preview,
   **When** the state toggles,
   **Then** the checkbox fills with a checkmark, the text gets strikethrough styling, and the markdown source updates to `- [x] Buy groceries`.

3. **Given** a note has 7 task items with 3 checked,
   **When** the user views the note list,
   **Then** the note row shows a progress bar at 43% with label "3/7".

4. **Given** the user has 5 notes with a combined 20 incomplete tasks,
   **When** the user opens the Tasks view,
   **Then** the view shows 20 tasks grouped by source note with a summary "20 tasks remaining across 5 notes".

5. **Given** the user checks a task in the Tasks view,
   **When** the checkbox is toggled,
   **Then** the task animates out of the list, the summary updates to "19 tasks remaining", and the source note's markdown is updated.

**Edge Cases:**

6. **Given** a note has nested tasks (3 levels deep),
   **When** the preview renders,
   **Then** each level is indented by 20px, and each checkbox is independently toggleable.

7. **Given** a note has zero task items,
   **When** the note appears in the note list,
   **Then** no progress bar is displayed.

**Negative Tests:**

8. **Given** the task extraction encounters a malformed line `- [] no space`,
   **When** the parser processes it,
   **Then** the line is treated as a regular list item (not a task), and no TaskItem is created.
   **And** the note still renders correctly.

9. **Given** the user tries to toggle a checkbox but the database write fails,
   **When** the error occurs,
   **Then** the checkbox visually reverts to its previous state and a toast "Could not update task. Please try again." is shown.
   **And** the note body is not modified.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| extracts single task item | body: "- [ ] Task one" | 1 task: text="Task one", is_checked=false |
| extracts checked task | body: "- [x] Task done" | 1 task: text="Task done", is_checked=true |
| extracts uppercase X as checked | body: "- [X] Also done" | 1 task: is_checked=true |
| extracts multiple tasks | body: "- [ ] A\n- [x] B\n- [ ] C" | 3 tasks in order, B is checked |
| handles nested tasks | body: "- [ ] Parent\n  - [ ] Child\n    - [ ] Grandchild" | 3 tasks: levels 0, 1, 2 |
| caps nesting at level 5 | body with 7 levels of indentation | Deepest task has nesting_level=5 |
| ignores non-task list items | body: "- Regular item\n- [ ] Task item" | 1 task (only the checkbox item) |
| ignores malformed checkbox | body: "- [] No space" | 0 tasks (not a valid task item) |
| calculates progress 0% | task_total=5, task_checked=0 | checklist_progress=0 |
| calculates progress 43% | task_total=7, task_checked=3 | checklist_progress=43 |
| calculates progress 100% | task_total=4, task_checked=4 | checklist_progress=100 |
| calculates progress 0 for no tasks | task_total=0, task_checked=0 | checklist_progress=0 |
| toggles checkbox checked | body: "- [ ] Item", toggle sort_order 0 to checked | Updated body: "- [x] Item" |
| toggles checkbox unchecked | body: "- [x] Item", toggle sort_order 0 to unchecked | Updated body: "- [ ] Item" |
| truncates task text at 1,000 chars | task text: (1,200 chars) | TaskItem.text is 1,000 chars |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create tasks and verify counts | 1. Create note, 2. Type 5 task items (2 checked), 3. Wait for auto-save | Note record: task_total=5, task_checked=2, checklist_progress=40 |
| Toggle checkbox in preview | 1. Open note with tasks, 2. Tap unchecked checkbox in preview | Checkbox fills, source updates, task_checked increments, progress recalculates |
| Tasks view shows cross-note tasks | 1. Create 3 notes with tasks, 2. Open Tasks view | All incomplete tasks from all 3 notes appear grouped by source note |
| Check task in Tasks view | 1. Open Tasks view, 2. Check a task from note A | Task animates out, note A's markdown updated, summary count decrements |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Project tracking with checklists | 1. Create "Sprint Tasks" note, 2. Add 10 tasks, 3. Check off 4 over the day, 4. View note list | Note list shows progress bar at 40% (4/10); Tasks view shows 6 remaining |
| Nested task completion | 1. Create note with parent task and 3 sub-tasks, 2. Check all 3 sub-tasks, 3. Check parent task | All 4 checkboxes filled, progress at 100%, green progress bar in note list |

---

### NT-010: Code Blocks with Syntax Highlighting

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-010 |
| **Feature Name** | Code Blocks with Syntax Highlighting |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a developer, I want to include code snippets in my notes with proper syntax highlighting, so that code is readable and visually distinct from prose.

**Secondary:**
> As a technical writer, I want to copy code from a code block with one tap, so that I can quickly paste it into a terminal or code editor without manually selecting text.

#### 3.3 Detailed Description

Code Blocks with Syntax Highlighting enhances the markdown editor's code fence support with language-aware syntax coloring. When a user wraps code in triple backticks with an optional language identifier (e.g., ` ```javascript`), the rendered preview displays the code with syntax highlighting appropriate for that language. Inline code (single backticks) is rendered in a monospaced font with a subtle background color but without syntax highlighting.

The feature supports syntax highlighting for 20 languages at launch:

| Language | Identifier(s) |
|----------|---------------|
| JavaScript | `js`, `javascript` |
| TypeScript | `ts`, `typescript` |
| Python | `py`, `python` |
| Ruby | `rb`, `ruby` |
| Go | `go`, `golang` |
| Rust | `rs`, `rust` |
| Java | `java` |
| C | `c` |
| C++ | `cpp`, `c++` |
| C# | `cs`, `csharp` |
| Swift | `swift` |
| Kotlin | `kt`, `kotlin` |
| PHP | `php` |
| HTML | `html` |
| CSS | `css` |
| SQL | `sql` |
| Shell/Bash | `sh`, `bash`, `shell`, `zsh` |
| JSON | `json` |
| YAML | `yaml`, `yml` |
| Markdown | `md`, `markdown` |

Code blocks without a language identifier are rendered with no syntax highlighting (plain monospaced text with background).

The rendered code block includes a header bar showing the language name (if specified) on the left and a "Copy" button on the right. Tapping "Copy" copies the code block content (without the backtick fences and language identifier) to the system clipboard and shows a brief toast "Copied to clipboard". Line numbers are displayed in a gutter on the left side of the code block by default, with a toggle in settings (NT-021) to hide them.

Code blocks use a dark-on-dark color scheme (dark background with light-colored syntax tokens) regardless of the app's overall theme. This ensures maximum readability for code. The syntax color palette follows a standard token classification: keywords (purple), strings (green), numbers (orange), comments (gray), functions/methods (blue), types/classes (teal), operators (red), and plain text (white/light gray).

Long lines in code blocks scroll horizontally rather than wrapping. Vertical scrolling is enabled for code blocks taller than 400px (approximately 20 lines at default font size), with the overflow hidden and a subtle scroll indicator. The code block font size defaults to 13px on mobile and 14px on desktop, adjustable in settings (NT-021).

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - code fences are a standard markdown extension parsed by the editor

**External Dependencies:**
- A syntax highlighting tokenizer that can process 20 language grammars
- System clipboard API for the copy function

**Assumed Capabilities:**
- The markdown parser produces CodeBlock AST nodes with a language field (specified in NT-001)
- The preview renderer can display styled text within a code block container

#### 3.5 User Interface Requirements

##### Component: Code Block (Rendered Preview)

**Layout:**
- Container: full width of the preview area, rounded corners (8px), dark background (#1E1E2E)
- Header bar (28px height): language name label (left, muted light text, uppercase), "Copy" icon button (right, clipboard icon)
- Line number gutter: 40px width, right-aligned numbers in muted color (#6C7086), 1px right border in subtle dark color
- Code area: right of the gutter, horizontal scroll if lines exceed container width, vertical scroll if content exceeds 400px height
- Font: monospaced, 13px mobile / 14px desktop, line height 1.5

**Syntax Color Palette:**

| Token Type | Color (Hex) |
|-----------|-------------|
| Keyword | #CBA6F7 (purple) |
| String | #A6E3A1 (green) |
| Number | #FAB387 (orange) |
| Comment | #6C7086 (gray) |
| Function/Method | #89B4FA (blue) |
| Type/Class | #94E2D5 (teal) |
| Operator | #F38BA8 (red) |
| Plain Text | #CDD6F4 (light gray) |
| Background | #1E1E2E (dark) |
| Gutter Background | #181825 (darker) |

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| With Language | Language identifier specified | Header shows language name, syntax highlighting applied |
| No Language | No identifier after backticks | Header shows "plain text", no highlighting (monospaced white text) |
| Short Block | 1-20 lines | Full height, no vertical scroll |
| Tall Block | 21+ lines | 400px max height with vertical scroll, gradient fade at bottom edge |
| Copy Success | User tapped Copy | Button briefly shows checkmark icon for 2 seconds, toast "Copied to clipboard" |

**Interactions:**
- Tap "Copy" button: copies code content to clipboard, shows toast, button icon changes to checkmark for 2 seconds
- Horizontal scroll (gesture or scrollbar): scroll code content when lines exceed container width
- Vertical scroll: scroll when code exceeds 400px height
- Double-tap code area (mobile): selects the tapped word for copy (standard text selection behavior)
- Long press code area: standard text selection for partial copy

**Transitions/Animations:**
- Copy button: icon transitions from clipboard to checkmark, 150ms cross-fade
- Toast: fades in from bottom, stays 2 seconds, fades out, 200ms each

##### Component: Inline Code (Rendered Preview)

**Layout:**
- Inline text with monospaced font
- Background: subtle tinted color (semi-transparent version of the code block background)
- Padding: 2px horizontal, 1px vertical
- Border radius: 4px
- No syntax highlighting (always plain text)

#### 3.6 Data Requirements

No new database entities are required. Code blocks are part of the note body (stored as markdown text). The markdown AST parser produces CodeBlock nodes with:

| AST Field | Type | Description |
|-----------|------|-------------|
| language | string (nullable) | The language identifier from the fence (e.g., "javascript") |
| content | string | The raw code content (everything between the fences, excluding fence lines) |
| line_count | integer | Number of lines in the content |

**Language Identifier Normalization:**

| User Input | Normalized To |
|-----------|--------------|
| `js`, `javascript` | `javascript` |
| `ts`, `typescript` | `typescript` |
| `py`, `python` | `python` |
| `rb`, `ruby` | `ruby` |
| `go`, `golang` | `go` |
| `rs`, `rust` | `rust` |
| `cpp`, `c++` | `cpp` |
| `cs`, `csharp` | `csharp` |
| `kt`, `kotlin` | `kotlin` |
| `sh`, `bash`, `shell`, `zsh` | `bash` |
| `yaml`, `yml` | `yaml` |
| `md`, `markdown` | `markdown` |
| (unrecognized) | `plaintext` |

#### 3.7 Business Logic Rules

##### Language Detection from Identifier

**Purpose:** Map the user's language identifier to a recognized grammar for syntax highlighting.

**Inputs:**
- raw_identifier: string (nullable) - the text after the opening triple backticks

**Logic:**

```
1. IF raw_identifier is null or empty, RETURN "plaintext"
2. Trim and lowercase raw_identifier
3. Look up in the language alias map (see table above)
4. IF found, RETURN the normalized language name
5. IF not found, RETURN "plaintext"
```

**Edge Cases:**
- No identifier: renders as plaintext (monospaced, no highlighting)
- Unknown identifier (e.g., `elixir`): renders as plaintext with the unknown identifier shown in the header
- Identifier with trailing whitespace: trimmed before lookup

##### Syntax Tokenization

**Purpose:** Break code content into tokens for syntax coloring.

**Inputs:**
- code: string - the raw code content
- language: string - the normalized language name

**Logic:**

```
1. IF language is "plaintext", RETURN [{type: "plain", text: code}]
2. Load the grammar rules for the specified language
3. Apply regex-based tokenization:
   a. Match keywords, strings, numbers, comments, functions, types, operators
   b. Assign each match a token_type from the palette
   c. Non-matching text is assigned type "plain"
4. RETURN array of {type, text} tokens in order
```

**Edge Cases:**
- Empty code block: returns zero tokens
- Code with syntax errors: tokenizer is best-effort; unmatched regions are treated as "plain"
- Very long lines (>10,000 characters): tokenize normally but render with horizontal scroll
- Mixed content (e.g., HTML with embedded JavaScript): only the primary language grammar is applied; embedded languages are not highlighted

##### Code Copy

**Purpose:** Copy the code block content to the system clipboard.

**Inputs:**
- code_content: string - the raw code (without fence markers)

**Logic:**

```
1. Strip any leading and trailing blank lines from code_content
2. Copy the resulting string to the system clipboard
3. IF clipboard write succeeds, RETURN success
4. IF clipboard write fails, RETURN error
```

**Edge Cases:**
- Empty code block: copies an empty string (no error)
- Very large code block (>100,000 characters): copies the full content (no truncation)
- Clipboard access denied (permissions): shows error toast

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Unknown language identifier | Code block renders as plaintext; header shows the raw identifier text | No action needed; user can change the identifier |
| Syntax tokenizer fails for a language | Code renders as plaintext (monospaced, no coloring) | No action needed; the code is still readable |
| Clipboard write fails | Toast: "Could not copy to clipboard. Check app permissions." | User checks system clipboard permissions |
| Extremely large code block (>10,000 lines) | Code block renders with the first 500 lines visible; "Show all" button at the bottom loads the rest | User taps "Show all" to render remaining lines |

**Validation Timing:**
- Language identifier resolution runs during AST parsing (on each debounced preview update)
- Syntax tokenization runs during preview rendering
- Clipboard operation runs on button tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user types a JavaScript code block in the editor:
   ````
   ```javascript
   function hello() {
     return "world";
   }
   ```
   ````
   **When** the preview renders,
   **Then** the code block shows "JAVASCRIPT" in the header, line numbers 1-3 in the gutter, `function` highlighted in purple, `hello` in blue, `"world"` in green, and `return` in purple.

2. **Given** the user taps the "Copy" button on a code block,
   **When** the clipboard write completes,
   **Then** the clipboard contains the code content without backtick fences, the button icon changes to a checkmark for 2 seconds, and a toast "Copied to clipboard" appears.

3. **Given** a code block with 50 lines of Python,
   **When** the preview renders,
   **Then** the code block displays at 400px height with vertical scrolling enabled and a gradient fade at the bottom edge.

4. **Given** a code block with a line 200 characters wide,
   **When** the preview renders,
   **Then** the code line does not wrap; horizontal scrolling is enabled within the code block container.

**Edge Cases:**

5. **Given** a code block without a language identifier (` ``` ` with no language),
   **When** the preview renders,
   **Then** the header shows "PLAIN TEXT", no syntax highlighting is applied, and the code is displayed in monospaced white text.

6. **Given** a code block with identifier `elixir` (not in the supported list),
   **When** the preview renders,
   **Then** the header shows "ELIXIR" but the code has no syntax coloring (plaintext fallback).

**Negative Tests:**

7. **Given** the system clipboard is unavailable (permission denied),
   **When** the user taps "Copy",
   **Then** a toast "Could not copy to clipboard. Check app permissions." is displayed.
   **And** the button icon does not change to a checkmark.

8. **Given** a code block with 15,000 lines,
   **When** the preview renders,
   **Then** the first 500 lines are rendered with a "Show all" button, preventing the preview from becoming unresponsive.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| normalizes "js" to "javascript" | identifier: "js" | "javascript" |
| normalizes "typescript" to "typescript" | identifier: "TypeScript" | "typescript" |
| normalizes "bash" variants | identifiers: "sh", "bash", "shell", "zsh" | All normalize to "bash" |
| returns plaintext for null identifier | identifier: null | "plaintext" |
| returns plaintext for unknown identifier | identifier: "elixir" | "plaintext" |
| tokenizes JavaScript keywords | code: "const x = 1;", language: "javascript" | tokens: [{type:"keyword",text:"const"}, {type:"plain",text:" x "}, {type:"operator",text:"="}, {type:"plain",text:" "}, {type:"number",text:"1"}, {type:"operator",text:";"}] |
| tokenizes Python string | code: 'name = "hello"', language: "python" | String token has type "string", text '"hello"' |
| tokenizes comment | code: "// comment", language: "javascript" | Token with type "comment" |
| returns plain tokens for plaintext | code: "hello world", language: "plaintext" | [{type:"plain", text:"hello world"}] |
| handles empty code | code: "", language: "javascript" | Empty token array |
| counts lines correctly | code: "a\nb\nc" | line_count: 3 |
| strips fence markers before copy | full block including backticks | Code content without ``` lines |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Render JavaScript code block | 1. Type JS code fence in editor, 2. Switch to preview | Code block with syntax highlighting, header shows "JAVASCRIPT", copy button present |
| Copy code to clipboard | 1. Render code block, 2. Tap copy, 3. Paste elsewhere | Pasted content matches the code (no fences, no line numbers) |
| Render code block without language | 1. Type ``` with no identifier, 2. Enter code, 3. Close with ```, 4. Preview | Monospaced text, no highlighting, header shows "PLAIN TEXT" |
| Tall code block scrolls | 1. Create code block with 50 lines, 2. Preview | Block height capped at 400px, scroll enabled |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Developer note with multiple languages | 1. Create note with JS, Python, and SQL code blocks, 2. Preview | Three distinct code blocks, each with correct language label and syntax colors matching the language grammar |
| Copy and paste workflow | 1. Write a shell script in a code block, 2. Tap copy, 3. Open terminal (external), 4. Paste | Terminal receives the exact shell script content, executable as-is |

---

### NT-011: Rich Embeds (Images, Files)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-011 |
| **Feature Name** | Rich Embeds (Images, Files) |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a personal note-taker, I want to embed images in my notes, so that I can include photos, diagrams, screenshots, and visual references alongside my text.

**Secondary:**
> As a student, I want to attach files (PDFs, documents) to my notes, so that I can keep supplementary materials together with my study notes.

**Tertiary:**
> As a privacy-conscious user, I want all my images and files stored locally on my device, so that no attachments are uploaded to any external service.

#### 3.3 Detailed Description

Rich Embeds enables embedding images and attaching files to notes. Images are displayed inline within the note content, rendered at the position where the markdown image syntax appears. Files are displayed as downloadable attachment chips below the note body. All embedded content is stored locally on the device file system with no cloud uploads.

Images are embedded using the standard markdown image syntax: `![alt text](file_path)`. Users add images through three methods. First, the image button in the formatting toolbar opens a file/photo picker. Second, dragging and dropping an image file onto the editor (desktop). Third, pasting an image from the clipboard. When an image is added through any of these methods, the image file is copied to the app's local attachment directory (`attachments/<note_id>/`), and the markdown syntax is inserted at the cursor position with the local file path.

Supported image formats: JPEG, PNG, GIF (static and animated), WebP, SVG, and HEIC (iOS). Maximum single image file size: 20 MB. Images exceeding 20 MB are rejected with a message. Images are displayed in the preview at their native aspect ratio, scaled to fit the content width (maximum 100% of the preview area width). Tapping an image in the preview opens a full-screen image viewer with pinch-to-zoom and swipe-to-dismiss.

File attachments are added via the "Attach File" action in the editor overflow menu. Supported file types: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, CSV, ZIP, and any other file type up to 50 MB. Files are copied to the same local attachment directory as images. Attached files are displayed as chips in a dedicated "Attachments" section below the note body, showing the file name, file size, file type icon, and an "Open" button that launches the file in the system's default handler.

When a note is deleted, its attachment directory and all contained files are also deleted. When a note is exported (NT-012), attachments are included in the export package. The attachment directory path follows the pattern: `<app_data>/attachments/<note_id>/<filename>`.

Total storage used by all attachments is tracked and displayed in Settings (NT-021) as "Attachment Storage: X.X MB / GB". There is no global storage limit enforced by the app (limited only by device storage).

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - images use markdown syntax, editor supports inline rendering

**External Dependencies:**
- Device file system for storing attachments
- System photo/file picker for selecting images and files
- System file handler for opening attached files
- Camera access (optional, for taking photos to embed)

**Assumed Capabilities:**
- The app has file system read/write permissions
- The markdown parser produces Image AST nodes (specified in NT-001)
- The preview renderer can display images inline

#### 3.5 User Interface Requirements

##### Component: Inline Image (Preview)

**Layout:**
- Displayed at the position of the `![alt text](path)` syntax in the rendered preview
- Width: 100% of the content area (scaled down from native resolution to fit)
- Height: proportional to width based on native aspect ratio
- Alt text displayed below the image in muted italic text (if provided)
- Rounded corners (4px) on the image container
- A thin border (1px, muted color) around the image

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Image file is being read from disk | Gray placeholder rectangle at estimated dimensions with a centered loading spinner |
| Loaded | Image loaded successfully | Full image displayed at content width |
| Error | Image file not found or corrupted | Gray placeholder with broken-image icon, message: "Image not found" |
| Full-Screen | User tapped the image | Full-screen overlay with the image, dark background, pinch-to-zoom, swipe to dismiss |

**Interactions:**
- Tap image: opens full-screen viewer
- Long press image: context menu with "Save to Photos", "Copy Image", "Remove from Note", "View Full Size"
- Pinch-to-zoom (full-screen): zooms the image from 1x to 5x
- Swipe down (full-screen): dismisses the full-screen viewer
- Double-tap (full-screen): toggles between fit-to-screen and actual-size zoom

**Transitions/Animations:**
- Image load: fades in from 0 to 1 opacity, 200ms
- Full-screen open: image expands from its inline position to full screen, 300ms ease-out
- Full-screen dismiss: image shrinks back to inline position, 250ms ease-in

##### Component: File Attachment Chip

**Layout:**
- Displayed in the "Attachments" section below the note body (after all markdown content)
- Each chip is a horizontal row: file type icon (left, 24x24), file name (primary text, truncated with ellipsis at 40 characters), file size (secondary text, muted), and "Open" button (right)
- Chips are stacked vertically with 8px spacing
- Section header: "Attachments (N)" where N is the count

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Attachments | Note has zero file attachments | Attachment section is hidden |
| Attachments Present | 1+ files attached | Section with header and chip list |
| File Missing | Attachment record exists but file was deleted from disk | Chip shows warning icon, file name in muted color, "Missing" label instead of size |

**Interactions:**
- Tap "Open" button: opens the file in the system's default handler
- Long press chip: context menu with "Share", "Save to Files", "Remove Attachment"
- Tap "Remove Attachment": confirmation dialog, then deletes the file from the attachment directory and removes the record

##### Component: Image/File Picker (Mobile)

**Layout:**
- System photo/file picker (native platform picker)
- For images: shows "Photo Library", "Take Photo", and "Choose File" options
- For files: shows the system file picker filtered to supported file types

**Interactions:**
- Select image from photo library: image is copied to attachments directory, markdown syntax inserted
- Take photo: captured image saved to attachments directory, markdown syntax inserted
- Select file: file copied to attachments directory, attachment record created

#### 3.6 Data Requirements

##### Entity: Attachment

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique attachment identifier |
| note_id | string | Foreign key -> Note.id, required | None | The note this attachment belongs to |
| file_name | string | Required, max 255 chars | None | Original file name including extension |
| file_path | string | Required, max 1,000 chars | None | Relative path within the attachments directory |
| file_size | integer | Min: 1, required | None | File size in bytes |
| mime_type | string | Required, max 100 chars | None | MIME type (e.g., "image/jpeg", "application/pdf") |
| is_image | boolean | - | false | Whether this attachment is an inline image (vs. a file attachment) |
| width | integer | Nullable, min: 1 | null | Image width in pixels (null for non-image files) |
| height | integer | Nullable, min: 1 | null | Image height in pixels (null for non-image files) |
| created_at | datetime | ISO 8601, auto-set on creation | Current timestamp | When the attachment was added |

**Relationships:**
- Note has many Attachments (one-to-many)
- Attachment belongs to one Note

**Indexes:**
- note_id - for fetching all attachments for a note
- (note_id, is_image) - for separating inline images from file attachments
- mime_type - for filtering by file type

**Validation Rules:**
- file_name: must not be empty
- file_size: must be > 0
- For images: file_size must be <= 20,971,520 bytes (20 MB)
- For files: file_size must be <= 52,428,800 bytes (50 MB)
- mime_type: must be a recognized MIME type
- The physical file must exist at file_path when the attachment is created

**Example Data:**

```
{
  "id": "att-img-001",
  "note_id": "n-note-1234",
  "file_name": "architecture-diagram.png",
  "file_path": "attachments/n-note-1234/architecture-diagram.png",
  "file_size": 245760,
  "mime_type": "image/png",
  "is_image": true,
  "width": 1920,
  "height": 1080,
  "created_at": "2026-03-05T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Image Embed

**Purpose:** Add an image to a note by copying it to local storage and inserting markdown syntax.

**Inputs:**
- note_id: string - the target note
- source_file: File - the image file from picker, clipboard, or drag-and-drop
- cursor_position: integer - where to insert the markdown syntax in the editor

**Logic:**

```
1. Validate source_file:
   a. IF file_size > 20,971,520 bytes (20 MB), RETURN error "Image must be 20 MB or smaller"
   b. IF mime_type is not one of [image/jpeg, image/png, image/gif, image/webp, image/svg+xml, image/heic], RETURN error "Unsupported image format"
2. Generate unique file name: <uuid>.<original_extension>
3. Create attachment directory if not exists: <app_data>/attachments/<note_id>/
4. Copy source_file to <app_data>/attachments/<note_id>/<unique_file_name>
5. Read image dimensions (width, height) from file metadata
6. Create Attachment record in database
7. Insert markdown at cursor_position: ![<original_file_name>](<relative_file_path>)
8. Trigger auto-save
9. RETURN { attachment_id, markdown_syntax }
```

**Formulas:**
- `total_attachment_storage = SUM(Attachment.file_size) for all attachments across all notes`

**Edge Cases:**
- Image from clipboard has no file name: generate name as "clipboard-<timestamp>.<format>"
- Duplicate file name in the same note's directory: the UUID prefix ensures uniqueness
- HEIC format on non-iOS platform: convert to JPEG before storing
- SVG with embedded scripts: sanitize by stripping `<script>` tags before storing
- Device storage full: file copy fails, attachment not created, error message shown

##### File Attach

**Purpose:** Attach a non-image file to a note.

**Inputs:**
- note_id: string - the target note
- source_file: File - the file from the file picker

**Logic:**

```
1. Validate source_file:
   a. IF file_size > 52,428,800 bytes (50 MB), RETURN error "File must be 50 MB or smaller"
   b. IF file_size is 0, RETURN error "File appears to be empty"
2. Generate unique file name: <uuid>_<original_file_name>
3. Create attachment directory if not exists: <app_data>/attachments/<note_id>/
4. Copy source_file to directory
5. Create Attachment record with is_image = false
6. RETURN { attachment_id, file_name, file_size }
```

**Edge Cases:**
- File type is not in the common list but is a valid file: accept it (no type restriction beyond size)
- File name contains special characters: preserve the original name for display but use the UUID-prefixed name for storage

##### Attachment Cleanup on Note Delete

**Purpose:** Remove all attachment files when a note is deleted.

**Inputs:**
- note_id: string - the deleted note

**Logic:**

```
1. Delete all Attachment records where note_id matches
2. Delete the directory <app_data>/attachments/<note_id>/ and all its contents
3. IF directory deletion fails (permissions, locked file), log warning and continue
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Image exceeds 20 MB | Toast: "Image must be 20 MB or smaller" | User selects a smaller image or compresses it |
| File exceeds 50 MB | Toast: "File must be 50 MB or smaller" | User selects a smaller file |
| Unsupported image format (e.g., TIFF) | Toast: "Unsupported image format. Use JPEG, PNG, GIF, WebP, SVG, or HEIC." | User converts the image |
| Device storage full | Toast: "Not enough storage to save this file" | User frees device storage |
| Attachment file missing from disk | Image placeholder shows "Image not found"; file chip shows "Missing" label | User re-attaches the file or removes the broken reference |
| File picker cancelled | No action taken, editor state unchanged | No recovery needed |
| Clipboard paste with no image data | No action taken, standard text paste behavior | No recovery needed |
| SVG contains script tags | Scripts are silently stripped; image is stored as sanitized SVG | No user action needed |

**Validation Timing:**
- File size and type validation runs immediately when a file is selected
- File existence check runs when the note is opened and attachments are loaded
- Storage space check runs before file copy

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps the image button in the toolbar and selects a 5 MB JPEG from the photo library,
   **When** the image is processed,
   **Then** the image is copied to the local attachments directory, markdown `![photo.jpg](attachments/...)` is inserted at the cursor, and the preview shows the image inline.

2. **Given** the user drags a PNG file from the desktop onto the editor (web),
   **When** the file is dropped,
   **Then** the image is stored locally, markdown is inserted, and the preview displays the image at content width.

3. **Given** the user attaches a 2 MB PDF file from the overflow menu,
   **When** the file is attached,
   **Then** the "Attachments (1)" section appears below the note body with a chip showing the PDF icon, file name, "2.0 MB", and an "Open" button.

4. **Given** the user taps an inline image in the preview,
   **When** the full-screen viewer opens,
   **Then** the user can pinch to zoom up to 5x and swipe down to dismiss.

5. **Given** the user taps "Open" on a PDF attachment chip,
   **When** the system handler launches,
   **Then** the PDF opens in the device's default PDF viewer.

**Edge Cases:**

6. **Given** the user pastes an image from the clipboard,
   **When** the paste is processed,
   **Then** the image is saved with a generated name "clipboard-<timestamp>.png" and displayed inline.

7. **Given** an image file was manually deleted from the device file system,
   **When** the user opens the note containing that image,
   **Then** a gray placeholder with "Image not found" is displayed at the image's position.

**Negative Tests:**

8. **Given** the user selects a 25 MB image from the photo library,
   **When** the file size is validated,
   **Then** a toast "Image must be 20 MB or smaller" is displayed and the image is not added.
   **And** the editor state is unchanged.

9. **Given** the device has only 1 MB of free storage and the user tries to attach a 10 MB file,
   **When** the file copy is attempted,
   **Then** a toast "Not enough storage to save this file" is displayed.
   **And** no attachment record is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| accepts JPEG under 20 MB | 5 MB JPEG file | Attachment created successfully |
| accepts PNG under 20 MB | 2 MB PNG file | Attachment created successfully |
| rejects image over 20 MB | 25 MB JPEG file | Error: "Image must be 20 MB or smaller" |
| rejects unsupported image format | TIFF file | Error: "Unsupported image format" |
| accepts file under 50 MB | 30 MB PDF | Attachment created, is_image=false |
| rejects file over 50 MB | 60 MB ZIP | Error: "File must be 50 MB or smaller" |
| rejects empty file | 0-byte file | Error: "File appears to be empty" |
| generates unique file name | two files with same name | Different UUID prefixes, no collision |
| sanitizes SVG scripts | SVG with `<script>` tag | Script tag removed from stored file |
| generates clipboard filename | image from clipboard | Name: "clipboard-<timestamp>.png" |
| calculates total storage | 3 attachments: 1MB, 2MB, 3MB | total_attachment_storage = 6,291,456 bytes |
| reads image dimensions | 1920x1080 JPEG | width=1920, height=1080 |
| cleans up on note delete | note with 3 attachments | All 3 Attachment records deleted, directory removed |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Embed image and verify preview | 1. Add image via toolbar, 2. Switch to preview | Image displayed inline at content width with correct aspect ratio |
| Attach file and open | 1. Attach PDF, 2. Tap "Open" | System PDF viewer launches with the file |
| Delete note with attachments | 1. Create note with 2 images and 1 file, 2. Delete note | All 3 files removed from disk, all Attachment records deleted |
| Missing file handling | 1. Create note with image, 2. Manually delete image file from disk, 3. Open note | "Image not found" placeholder shown at the image position |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Visual project documentation | 1. Create note "Design Review", 2. Add 3 screenshots, 3. Add 1 PDF spec document, 4. Write markdown between images | Note displays prose interspersed with 3 inline images and has 1 file attachment chip. Total attachment storage reflects combined file sizes |
| Full-screen image workflow | 1. Embed high-res 4K image, 2. Tap image to open viewer, 3. Pinch to zoom to 3x, 4. Swipe down to dismiss | Image viewed at detail level, smoothly dismissed back to inline preview |

---

### NT-012: Note Export (Markdown, PDF, JSON)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-012 |
| **Feature Name** | Note Export (Markdown, PDF, JSON) |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious user, I want to export my notes as standard markdown files, so that I can move my data to any other markdown-compatible app with zero vendor lock-in.

**Secondary:**
> As a knowledge worker, I want to export a note as a formatted PDF, so that I can share it with colleagues who do not use a markdown editor.

**Tertiary:**
> As a power user, I want to bulk-export all my notes as a ZIP archive, so that I can create a full backup of my data that I control.

#### 3.3 Detailed Description

Note Export provides three export formats for individual notes and bulk export for all notes. This feature is central to the privacy-first promise: users own their data and can extract it at any time in standard, human-readable formats.

**Individual note export** is accessible from the note editor's overflow menu ("Export") and offers three format options:

1. **Markdown (.md):** Exports the note body as a plain-text `.md` file. The file name is derived from the note title (sanitized for file system compatibility). Front matter (YAML) is prepended with metadata: title, created_at, updated_at, tags, and folder path. Embedded image references are updated to relative paths pointing to an `images/` subdirectory exported alongside the markdown file.

2. **PDF (.pdf):** Renders the note's markdown as a formatted PDF document. The PDF uses the same rendering as the preview pane: headings, bold, italic, lists, code blocks (with syntax highlighting), images (embedded in the PDF), tables, and task lists. Page size: A4 (210mm x 297mm). Margins: 20mm on all sides. Header: note title (left), export date (right). Footer: page number centered.

3. **JSON (.json):** Exports the complete note record as a JSON object including all fields (title, body, body_plain, tags, folder path, created_at, updated_at, word_count, character_count, task counts, and all NoteLink data). This format is machine-readable and suitable for data migration or programmatic processing.

**Bulk export** is accessible from Settings (NT-021) under "Data > Export All Notes". It creates a ZIP archive containing:
- A folder per notebook, mirroring the folder hierarchy
- Each note as a `.md` file with YAML front matter
- An `images/` folder per note directory containing embedded images
- An `attachments/` folder per note directory containing non-image attachments
- A `metadata.json` file at the root with the full database export (all notes, tags, folders, links, templates as JSON)

The ZIP file name follows the pattern: `mynotes-export-YYYY-MM-DD.zip`. The export process runs in the background with a progress indicator showing "Exporting note N of M..."

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - note content must exist to export

**External Dependencies:**
- File system write access for saving exported files
- System share sheet for distributing exported files
- PDF rendering engine for markdown-to-PDF conversion

**Assumed Capabilities:**
- The app can create ZIP archives
- The system share sheet is available for sharing exported files
- The markdown-to-PDF pipeline can render all supported markdown extensions

#### 3.5 User Interface Requirements

##### Modal: Export Format Picker (Individual Note)

**Layout:**
- Bottom sheet with three option cards:
  - **Markdown** card: file icon, "Markdown (.md)", subtitle "Plain text with front matter"
  - **PDF** card: PDF icon, "PDF (.pdf)", subtitle "Formatted document ready to share"
  - **JSON** card: code icon, "JSON (.json)", subtitle "Machine-readable data export"
- Cancel button at the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | Sheet is open, no export in progress | Three option cards, all tappable |
| Exporting | User selected a format, export in progress | Selected card shows a spinner, other cards disabled, cancel button replaced with progress text |
| Complete | Export finished | System share sheet opens automatically with the exported file |
| Error | Export failed | Toast error message, sheet remains open for retry |

**Interactions:**
- Tap format card: begins export in the selected format
- Tap Cancel: dismisses the sheet
- System share sheet: user chooses where to save or share (AirDrop, Files, email, etc.)

##### Screen: Bulk Export Progress (Settings)

**Layout:**
- Replaces the "Export All Notes" button with a progress view during export
- Progress bar (full width) showing percentage complete
- Status text: "Exporting note N of M..."
- Cancel button below the progress bar

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Idle | No export in progress | "Export All Notes" button |
| In Progress | Bulk export running | Progress bar, status text, cancel button |
| Complete | Export finished | Share sheet opens with the ZIP file, button resets to idle |
| Cancelled | User tapped cancel | Toast: "Export cancelled", button resets to idle, partial export file deleted |

#### 3.6 Data Requirements

No new database entities are required. Exports read from existing Note, Tag, NoteTag, Folder, NoteLink, Template, and Attachment entities.

**Markdown Front Matter Schema:**

```yaml
---
title: "Note Title"
created: "2026-03-01T09:15:00Z"
updated: "2026-03-05T14:30:00Z"
tags: ["work", "project-alpha"]
folder: "Work/Project Alpha"
---
```

**JSON Export Schema (individual note):**

```json
{
  "version": "1.0",
  "exported_at": "2026-03-07T10:00:00Z",
  "note": {
    "id": "...",
    "title": "...",
    "body": "...",
    "body_plain": "...",
    "created_at": "...",
    "updated_at": "...",
    "word_count": 0,
    "character_count": 0,
    "task_total": 0,
    "task_checked": 0,
    "is_pinned": false,
    "is_favorited": false,
    "folder_path": "Work/Project Alpha",
    "tags": ["work", "project-alpha"],
    "outgoing_links": ["Note B", "Note C"],
    "incoming_links": ["Note A"]
  }
}
```

**Bulk Export ZIP Structure:**

```
mynotes-export-2026-03-07/
├── metadata.json
├── Work/
│   ├── Project Alpha/
│   │   ├── Meeting Notes.md
│   │   ├── images/
│   │   │   └── diagram.png
│   │   └── attachments/
│   │       └── spec.pdf
│   └── Standup.md
├── Personal/
│   └── Reading List.md
└── Unfiled/
    └── Quick Note.md
```

#### 3.7 Business Logic Rules

##### File Name Sanitization

**Purpose:** Convert a note title into a valid file system name.

**Inputs:**
- title: string - the note title

**Logic:**

```
1. Replace characters invalid in file names with underscores: / \ : * ? " < > |
2. Trim leading and trailing whitespace and dots
3. IF result is empty, use "Untitled Note"
4. IF result exceeds 200 characters, truncate to 200
5. RETURN sanitized_name
```

**Edge Cases:**
- Title is all special characters: becomes "Untitled Note"
- Title contains only dots: becomes "Untitled Note"
- Two notes in the same folder have the same sanitized name: append " (2)", " (3)" etc.

##### Markdown Export

**Purpose:** Export a note as a .md file with YAML front matter.

**Inputs:**
- note: Note record with all fields
- tags: array of tag names
- folder_path: string (folder hierarchy as a path)

**Logic:**

```
1. Build YAML front matter:
   - title: note.title
   - created: note.created_at (ISO 8601)
   - updated: note.updated_at (ISO 8601)
   - tags: [tag1, tag2, ...]
   - folder: folder_path or "Unfiled"
2. Concatenate "---\n" + front_matter + "---\n\n" + note.body
3. IF note has image attachments:
   a. Find all image references in body: ![...](...)
   b. Copy image files to an "images/" subdirectory alongside the .md file
   c. Replace file paths in the body to relative paths: "images/<filename>"
4. RETURN { file_content, image_files }
```

##### PDF Export

**Purpose:** Render a note as a formatted PDF.

**Inputs:**
- note: Note record
- rendered_html: string - HTML output from the markdown preview renderer

**Logic:**

```
1. Wrap rendered_html in a PDF template:
   a. Add page header: note.title (left), export date (right)
   b. Add page footer: page number (centered)
   c. Set page size: A4 (210mm x 297mm)
   d. Set margins: 20mm on all sides
   e. Set typography: body font 12pt, headings scaled (H1=24pt, H2=20pt, H3=16pt, H4=14pt, H5=12pt, H6=11pt)
   f. Embed images as base64 data URIs in the HTML
2. Convert the HTML to PDF using the platform's PDF rendering engine
3. RETURN { pdf_file }
```

**Edge Cases:**
- Note contains images: images are embedded in the PDF (not linked externally)
- Note is very long (100+ pages): PDF generates without limit but shows progress
- Code blocks in PDF: rendered with syntax highlighting colors and dark background

##### Bulk Export

**Purpose:** Export all notes as a ZIP archive.

**Inputs:**
- all_notes: array of Note records
- all_tags, all_folders, all_links, all_templates: supporting data

**Logic:**

```
1. Create a temporary directory for the export
2. Build metadata.json with all records serialized
3. FOR each note in all_notes:
   a. Determine the folder path (or "Unfiled" for notes with no folder)
   b. Create the directory structure mirroring the folder hierarchy
   c. Export the note as .md with front matter (using the Markdown Export logic)
   d. Copy images to an images/ subdirectory
   e. Copy file attachments to an attachments/ subdirectory
   f. Emit progress: "Exporting note N of M..."
4. Compress the temporary directory into a ZIP file
5. Clean up the temporary directory
6. RETURN { zip_file, total_notes, total_size }
```

**Edge Cases:**
- Notes with duplicate sanitized titles in the same folder: append " (2)", " (3)" suffix
- Export of 5,000+ notes: process in batches of 100, update progress after each batch
- Export interrupted (app backgrounded or cancelled): partial temp directory is cleaned up
- ZIP file exceeds 1 GB: no limit enforced; user is warned before starting if estimated size exceeds 500 MB

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Single note export fails (write error) | Toast: "Could not export note. Please try again." | User retries |
| PDF rendering fails | Toast: "Could not generate PDF. Try exporting as Markdown instead." | User selects Markdown format |
| Bulk export runs out of disk space | Progress stops, toast: "Not enough storage for export. Free up space and try again." | Temp files cleaned up; user frees storage |
| Bulk export cancelled by user | Toast: "Export cancelled", partial temp files cleaned up | User can restart export |
| Image file missing during export | Image placeholder text "[Image not found: filename.png]" inserted in the .md file | No user action; note is exported without the missing image |
| Note title produces invalid filename | Auto-sanitized to valid name; no user notification | No action needed |

**Validation Timing:**
- File system permissions validated before export starts
- Available disk space estimated before bulk export starts
- Individual file write errors caught per-note during bulk export

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens a note and taps Export > Markdown,
   **When** the export completes,
   **Then** the system share sheet opens with a .md file that contains YAML front matter (title, dates, tags, folder) followed by the note body.

2. **Given** the user exports a note as PDF,
   **When** the PDF is generated,
   **Then** the share sheet opens with a PDF containing the rendered note with formatted headings, bold/italic text, code blocks with highlighting, and any embedded images.

3. **Given** the user exports a note as JSON,
   **When** the export completes,
   **Then** the JSON file contains all note fields including title, body, tags, folder, word count, and link data.

4. **Given** the user taps "Export All Notes" in Settings with 200 notes,
   **When** the export runs,
   **Then** a progress bar shows "Exporting note N of 200...", and upon completion a share sheet opens with a ZIP file named `mynotes-export-2026-03-07.zip`.

5. **Given** the ZIP is extracted,
   **When** the contents are inspected,
   **Then** the directory structure mirrors the folder hierarchy, each note is a .md file with front matter, images are in `images/` subdirectories, and `metadata.json` is at the root.

**Edge Cases:**

6. **Given** two notes in the same folder have the title "Meeting Notes",
   **When** the bulk export runs,
   **Then** the files are named "Meeting Notes.md" and "Meeting Notes (2).md" - no overwriting occurs.

7. **Given** a note has an embedded image whose file was deleted from disk,
   **When** the note is exported as Markdown,
   **Then** the export completes with "[Image not found: filename.png]" in the body text.

**Negative Tests:**

8. **Given** the device has 10 MB free and the export would require 200 MB,
   **When** the bulk export is initiated,
   **Then** a warning is shown: "Estimated export size exceeds available storage. Free up space and try again."
   **And** the export does not start.

9. **Given** the PDF renderer crashes on a note with extremely complex nested tables,
   **When** the error is caught,
   **Then** a toast "Could not generate PDF. Try exporting as Markdown instead." is shown.
   **And** no corrupt PDF file is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| sanitizes slashes in title | title: "Work/Project" | "Work_Project" |
| sanitizes colons and asterisks | title: "Note: Important*" | "Note_ Important_" |
| handles empty title | title: "   " | "Untitled Note" |
| truncates at 200 chars | title: (250 chars) | 200-char string |
| deduplicates file names | two notes titled "Alpha" in same folder | "Alpha.md" and "Alpha (2).md" |
| builds YAML front matter | note with 3 tags, folder "Work" | Valid YAML with title, dates, tags array, folder field |
| markdown export includes images | note with 2 embedded images | .md body has relative image paths, 2 image files in images/ |
| JSON export includes all fields | note with tags, links, counts | JSON has version, exported_at, and complete note object |
| PDF sets correct page size | Any note | PDF page dimensions: 210mm x 297mm |
| PDF includes header and footer | note title "Alpha" | Header has "Alpha" (left) and date (right); footer has page number |
| bulk export mirrors folder structure | 3 folders: A, A/B, C | ZIP structure: A/, A/B/, C/ |
| bulk export handles unfiled notes | note with no folder | Placed in "Unfiled/" directory |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Export note as Markdown | 1. Create note with title, body, tags, folder, 2. Export as .md | Valid .md file with front matter, body content, and tags matching the note |
| Export note with images as Markdown | 1. Create note with 2 embedded images, 2. Export as .md | .md file with relative image paths and 2 image files in images/ subdirectory |
| Export note as PDF | 1. Create note with headings, code block, table, 2. Export as PDF | PDF renders all elements with correct formatting |
| Bulk export 50 notes | 1. Create 50 notes across 5 folders, 2. Export all | ZIP contains 5 folder directories, 50 .md files, and metadata.json |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full backup workflow | 1. Use MyNotes for 2 weeks (100 notes, 5 folders, 30 tags), 2. Export all notes, 3. Extract ZIP, 4. Verify contents | ZIP mirrors folder hierarchy; every note is a .md file with YAML front matter; all images and attachments present; metadata.json contains 100 note records |
| Share note as PDF | 1. Write a project summary note, 2. Export as PDF, 3. Share via email | Recipient receives a well-formatted PDF with the note's content |

---

### NT-013: Note Import

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-013 |
| **Feature Name** | Note Import |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user switching from Obsidian, I want to import my vault of markdown files, so that I can migrate to MyNotes without losing my notes or their folder structure.

**Secondary:**
> As a user switching from Bear, I want to import notes exported from Bear, so that my notes, tags, and formatting are preserved.

**Tertiary:**
> As a user who has MyNotes export files, I want to re-import them, so that I can restore from a backup or transfer notes between devices.

#### 3.3 Detailed Description

Note Import enables users to bring their existing notes into MyNotes from various sources. The import system handles three primary input formats: markdown files (.md), Bear export files (.bearnote or Bear's markdown export), and MyNotes' own JSON export format (produced by NT-012).

**Markdown file import** is the primary import path. Users select one or more .md files (or a folder of .md files) from the file picker. Each file becomes a new note. The file name (without extension) becomes the note title. If the markdown file has YAML front matter, the importer extracts metadata: title (overrides file name), tags, created date, and updated date. The markdown body (after front matter) becomes the note body. If the selected source is a directory, the directory structure is mirrored as folders in MyNotes.

**Obsidian vault import** follows the same markdown file path but additionally processes:
- `[[wiki links]]` - preserved as-is; MyNotes uses the same syntax (NT-006)
- `![[embedded notes]]` - converted to standard markdown image/link syntax
- Front matter tags and inline #tags - converted to MyNotes tags
- `.obsidian/` config directory - skipped entirely

**Bear export import** handles Bear's markdown export format:
- Bear uses `#tags/nested` inline syntax - these are extracted and converted to MyNotes tags
- Bear's attachment references are resolved if the attachment files are included alongside the markdown files
- Bear-specific extensions (e.g., `::highlight::`) are converted to standard markdown equivalents where possible, or stripped where no equivalent exists

**MyNotes JSON import** accepts the JSON format produced by NT-012's export. This is a full-fidelity restore: all fields, tags, folder structure, and links are recreated.

The import process runs with a preview step. Before committing, the user sees a summary: "N notes to import, M tags detected, L folders to create, K images/attachments to copy." The user confirms before the import begins. Duplicate detection is performed by title match (case-insensitive): if a note with the same title already exists, the user is offered three choices per duplicate: "Skip", "Replace", or "Keep Both" (which appends " (imported)" to the new note's title).

Import progress is shown with a progress bar: "Importing note N of M..." Large imports (500+ notes) are processed in batches of 50 to avoid blocking the UI thread.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - imported notes are opened in the editor
- NT-002: Notebook and Folder Hierarchy - imported folder structures are created

**External Dependencies:**
- File system read access for reading import source files
- System file/folder picker for selecting import sources

**Assumed Capabilities:**
- The app can read files from the device file system
- YAML front matter parsing is available
- The user has exported their data from the source app

#### 3.5 User Interface Requirements

##### Screen: Import Source Picker

**Layout:**
- Full screen with a top bar: "Import Notes" title, "Cancel" button (right)
- Three source option cards:
  - **Markdown Files** card: folder icon, "Markdown Files (.md)", subtitle: "Import from Obsidian, any markdown editor, or a folder of .md files"
  - **Bear Export** card: Bear icon, "Bear Export", subtitle: "Import Bear's markdown export (includes tags)"
  - **MyNotes Backup** card: restore icon, "MyNotes Backup (.json)", subtitle: "Restore from a previous MyNotes export"
- Each card is a full-width row with icon, title, and subtitle

**Interactions:**
- Tap source card: opens the system file/folder picker filtered for the appropriate file types
- Tap "Cancel": dismisses the screen

##### Screen: Import Preview

**Layout:**
- Shown after the user selects files/folder and before the import begins
- Summary section: "Ready to Import" heading, followed by stats:
  - "N notes" (with file icons)
  - "M tags detected"
  - "L folders to create"
  - "K images/attachments"
- Duplicate section (if any): "Duplicates Found (D)" heading, listing each duplicate with three radio options: Skip, Replace, Keep Both
- Bottom buttons: "Import" (primary, accent color) and "Cancel" (secondary)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Scanning | Files are being parsed | Loading spinner with "Scanning files..." |
| Preview Ready | Scanning complete, no duplicates | Summary stats and "Import" button |
| Duplicates Found | 1+ notes match existing titles | Summary stats plus duplicates list with resolution options |
| Importing | Import in progress | Progress bar: "Importing note N of M...", cancel button |
| Complete | Import finished | Success screen: "Imported N notes successfully" with "Done" button |
| Partial Failure | Some notes failed to import | Success screen with warning: "Imported N of M notes. K notes failed." with details expandable |

**Interactions:**
- Select duplicate resolution: radio button for each duplicate (Skip/Replace/Keep Both)
- Tap "Import": starts the import process
- Tap "Cancel": dismisses without importing
- Tap "Done": returns to the note list

#### 3.6 Data Requirements

No new entities are required. Import creates Note, Folder, Tag, NoteTag, NoteLink, and Attachment records using existing entity schemas.

**Import Source Detection:**

| Source | Detection Method |
|--------|-----------------|
| Markdown files | File extension `.md` or `.markdown` |
| Obsidian vault | Contains `.obsidian/` directory at root |
| Bear export | Files contain Bear-style `#tags` or have `.bearnote` extension |
| MyNotes JSON | File extension `.json` with `"version"` field in root object |

**YAML Front Matter Fields (recognized by importer):**

| Field | Maps To | Notes |
|-------|---------|-------|
| `title` | Note.title | Overrides filename-derived title |
| `tags` | Tag + NoteTag records | Array of strings |
| `created` or `date` | Note.created_at | ISO 8601 datetime |
| `updated` or `modified` | Note.updated_at | ISO 8601 datetime |
| `aliases` | Ignored | Obsidian-specific, not imported |
| `cssclass` | Ignored | Obsidian-specific, not imported |

#### 3.7 Business Logic Rules

##### Markdown File Import

**Purpose:** Convert a markdown file into a MyNotes note.

**Inputs:**
- file: File - the .md file to import
- target_folder_id: string (nullable) - the folder to place the note in

**Logic:**

```
1. Read the file contents as UTF-8 text
2. Parse YAML front matter (if present):
   a. Extract title, tags, created date, updated date
   b. Remove front matter from the body
3. Determine note title:
   a. IF front matter has "title", use it
   b. ELSE use file name without extension
4. Parse body as markdown to extract:
   a. word_count, character_count, body_plain
   b. wiki links -> create NoteLink records
   c. task items -> create TaskItem records and set task_total, task_checked, checklist_progress
5. Create Note record with all extracted data
6. IF front matter has "tags":
   a. FOR each tag string, find or create Tag record
   b. Create NoteTag associations
7. IF file was in a subdirectory of the import source:
   a. Mirror the directory path as Folder records
   b. Set note.folder_id to the leaf folder
8. Process embedded images:
   a. Find all ![...](path) references in the body
   b. IF the referenced file exists relative to the .md file, copy it to the attachments directory
   c. Update the image path in the body to the local attachment path
9. RETURN { note_id, tags_created, images_copied }
```

**Edge Cases:**
- File is empty: creates a note with empty body and title from filename
- Front matter is malformed YAML: skip front matter parsing, treat entire file as body
- File encoding is not UTF-8: attempt to detect encoding and convert; if detection fails, import as raw bytes with a warning
- Image reference points to non-existent file: leave the reference as-is, log a warning

##### Bear Tag Extraction

**Purpose:** Extract Bear-style inline tags and convert to MyNotes tags.

**Inputs:**
- body: string - the note body with Bear-style #tags

**Logic:**

```
1. Apply regex /#([a-zA-Z0-9_\/-]+)/g to body
2. FOR each match:
   a. Extract tag_path from capture group 1
   b. Replace "/" with "/" (Bear uses "/" for nested tags, same as MyNotes)
   c. Add to tags array (deduplicated)
3. Remove matched #tag syntax from the body (clean up)
4. RETURN { tags, cleaned_body }
```

**Edge Cases:**
- `#tag` at the start of a line: treated as a tag (not a heading, because headings require a space after #)
- `#tag` inside a code block: not extracted (code blocks are excluded from tag scanning)
- `#123` (numeric only): not treated as a tag (must contain at least one letter)

##### Duplicate Resolution

**Purpose:** Handle notes whose titles match existing notes.

**Inputs:**
- import_title: string - the title of the note being imported
- resolution: enum ("skip" | "replace" | "keep_both")

**Logic:**

```
1. Search for existing note with matching title (case-insensitive)
2. IF no match, proceed with normal import
3. IF match found:
   a. IF resolution == "skip": do not import this note, RETURN skipped
   b. IF resolution == "replace": delete existing note, import the new one with the same title
   c. IF resolution == "keep_both": append " (imported)" to the new note's title, import as new note
4. RETURN { action_taken }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| File is not valid UTF-8 | Warning in preview: "1 file has encoding issues and may import with errors" | Import continues; encoding issues result in garbled characters in the note body |
| YAML front matter is malformed | Front matter treated as part of the body; no metadata extracted | Note imports with body including the malformed YAML |
| Image referenced in body does not exist | Note imports successfully; image reference shows "[Image not found]" in preview | User can manually add the image later |
| Import cancelled mid-process | Toast: "Import cancelled. N of M notes were imported." | Partially imported notes are kept (not rolled back) |
| File picker returns zero files | Toast: "No markdown files found in the selected location." | User selects a different folder |
| JSON import file has wrong schema | Error: "This file is not a valid MyNotes export. Please check the file format." | User selects the correct file |
| Duplicate title conflicts | Preview screen shows duplicates with resolution options | User selects Skip, Replace, or Keep Both for each |

**Validation Timing:**
- File type validation: on file selection
- Front matter parsing: during scan phase (before preview)
- Duplicate detection: during scan phase (before preview)
- Note creation validation: during import phase

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user selects a folder containing 50 .md files,
   **When** the scan completes,
   **Then** the preview screen shows "50 notes, N tags detected, M folders to create" and an "Import" button.

2. **Given** the user imports 10 markdown files with YAML front matter containing tags,
   **When** the import completes,
   **Then** 10 notes are created, all tags from front matter are created as MyNotes tags, and notes are tagged accordingly.

3. **Given** the user imports an Obsidian vault with 200 notes organized in 15 folders,
   **When** the import completes,
   **Then** 200 notes are created, 15 folders are created mirroring the vault structure, and all [[wiki links]] are preserved as NoteLink records.

4. **Given** 3 imported note titles match existing notes and the user selects "Keep Both" for all,
   **When** the import completes,
   **Then** the 3 notes are imported with " (imported)" appended to their titles.

5. **Given** the user selects a MyNotes JSON export file,
   **When** the import completes,
   **Then** all notes, tags, folders, and link data are restored exactly as they were in the export.

**Edge Cases:**

6. **Given** a markdown file has no front matter and is named "meeting-notes.md",
   **When** the file is imported,
   **Then** the note title is "meeting-notes" (filename without extension).

7. **Given** a Bear export contains `#work/project-alpha` inline tags,
   **When** the import processes the file,
   **Then** the tag "work/project-alpha" is created as a nested tag and the `#work/project-alpha` syntax is removed from the note body.

**Negative Tests:**

8. **Given** the user selects a .json file that is not a MyNotes export,
   **When** schema validation fails,
   **Then** the error "This file is not a valid MyNotes export. Please check the file format." is displayed.
   **And** no notes are imported.

9. **Given** the user cancels the import after 20 of 100 notes are imported,
   **When** the cancellation is processed,
   **Then** a toast shows "Import cancelled. 20 of 100 notes were imported." and the 20 imported notes remain in the database.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| extracts title from YAML front matter | front matter: "title: My Note" | title: "My Note" |
| derives title from filename | file: "meeting-notes.md", no front matter | title: "meeting-notes" |
| extracts tags from YAML front matter | front matter: "tags: [work, urgent]" | tags: ["work", "urgent"] |
| parses created date from front matter | front matter: "created: 2026-03-01T09:00:00Z" | created_at: 2026-03-01T09:00:00Z |
| handles malformed YAML | front matter: "title: [invalid" | Front matter treated as body, title from filename |
| strips Bear inline tags | body: "Hello #work #personal" | tags: ["work", "personal"], cleaned_body: "Hello" |
| handles Bear nested tags | body: "Note #project/backend" | tags: ["project/backend"] |
| skips numeric-only hashtags | body: "Issue #123" | tags: [], body unchanged |
| skips hashtags in code blocks | body: "```\n#comment\n```" | tags: [], body unchanged |
| duplicate resolution skip | existing: "Alpha", import: "Alpha", resolution: skip | Note not imported |
| duplicate resolution replace | existing: "Alpha", import: "Alpha", resolution: replace | Old note deleted, new note created with title "Alpha" |
| duplicate resolution keep_both | existing: "Alpha", import: "Alpha", resolution: keep_both | New note created with title "Alpha (imported)" |
| detects Obsidian vault | directory contains .obsidian/ | source_type: "obsidian" |
| detects MyNotes JSON | file has "version" field | source_type: "mynotes_json" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Import folder of markdown files | 1. Select folder with 20 .md files in 3 subdirectories, 2. Preview shows 20 notes and 3 folders, 3. Import | 20 notes created in 3 folders |
| Import Obsidian vault with wiki links | 1. Select Obsidian vault, 2. Import | Notes created with wiki links preserved as NoteLinks |
| Import with duplicates | 1. Have 5 existing notes, 2. Import 10 notes where 3 titles match, 3. Select "Keep Both" for all | 10 notes imported (3 with " (imported)" suffix) |
| Import MyNotes JSON backup | 1. Export all notes as JSON, 2. Delete all notes, 3. Import the JSON file | All notes restored with original metadata |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Migrate from Obsidian | 1. Export Obsidian vault (200 notes, 30 folders, 500 wiki links), 2. Import into MyNotes, 3. Browse notes | 200 notes in 30 folders, wiki links functional, tags preserved |
| Backup and restore | 1. Use MyNotes for a week, 2. Export all as JSON, 3. Reinstall app, 4. Import JSON | All notes, tags, folders, and links restored exactly |

---

### NT-014: Daily Notes

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-014 |
| **Feature Name** | Daily Notes |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a student, I want a "Today's Note" that auto-creates a dated note each day, so that I can quickly capture daily logs, class notes, and observations without manually creating and naming a note.

**Secondary:**
> As a knowledge worker, I want to customize the daily note template, so that my daily notes have a consistent structure (standup format, gratitude prompts, or planning sections).

#### 3.3 Detailed Description

Daily Notes provides an auto-created note for each day. When the user taps the "Daily Note" action (accessible from the dashboard or a dedicated button in the navigation), the system checks if a note exists for today's date. If it exists, that note opens in the editor. If it does not exist, a new note is created using the configured daily note template (defaulting to the built-in "Daily Standup" template from NT-008) and immediately opens in the editor.

Daily notes are titled with the date in a configurable format. The default format is "YYYY-MM-DD - Day" (e.g., "2026-03-07 - Friday"). Alternative formats available in settings: "Month DD, YYYY" (e.g., "March 7, 2026"), "DD/MM/YYYY", and a custom format string. The title format is set in Settings (NT-021).

Daily notes are stored in a dedicated "Daily Notes" folder that is auto-created on first use. This folder appears in the folder browser (NT-002) but is also accessible via the direct "Daily Note" entry point. Users can change the target folder in settings.

The daily notes calendar is a month-view calendar widget that shows which days have daily notes. Days with notes are marked with a dot indicator. Tapping a day navigates to that day's note (or creates one if it does not exist). The calendar is accessible from the "Daily Notes" folder header or a dedicated section in the sidebar.

Navigation between daily notes is supported via "Previous Day" and "Next Day" buttons in the note editor when viewing a daily note. These buttons navigate to the adjacent daily note, creating one if it does not exist for the target date. Forward navigation is limited to today's date (cannot create future daily notes).

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - daily notes are edited in the markdown editor
- NT-008: Note Templates - daily notes use a template for initial content

**External Dependencies:**
- System date/time for determining today's date
- Local persistent storage

**Assumed Capabilities:**
- The template system can substitute date-related variables
- The folder system supports auto-creating designated folders

#### 3.5 User Interface Requirements

##### Component: Daily Note Button

**Layout:**
- Primary entry point: a "Today" button in the sidebar (desktop) or navigation header (mobile)
- Icon: calendar icon with today's date number
- Label: "Today" (or "Daily Note" in compact mode)

**Interactions:**
- Tap: opens today's daily note (creating it if needed)
- Long press: opens the daily notes calendar view

##### Component: Daily Notes Calendar

**Layout:**
- Month-view calendar grid showing 6 weeks (to accommodate all month layouts)
- Header: month/year label with left/right arrows for month navigation
- Each day cell shows the day number. Days with existing daily notes have a small accent-colored dot below the number
- Today's cell has an outlined circle around the number
- Future dates are dimmed

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Current month displayed | Calendar with dot indicators for existing daily notes |
| Past Month | User navigated to a previous month | Same layout, dots for days that have notes |
| Future Month | User navigated to a future month | All dates dimmed, no dots, no interaction |

**Interactions:**
- Tap day cell (past or today): opens that day's daily note (creates if needed)
- Tap day cell (future): no action (future notes not allowed)
- Left/right arrows: navigate between months
- Swipe left/right on calendar: navigate between months

##### Component: Day Navigation Arrows (Editor)

**Layout:**
- When editing a daily note, two arrow buttons appear in the editor toolbar: "<" (previous day) and ">" (next day)
- The ">" button is disabled when viewing today's note (no future navigation)

**Interactions:**
- Tap "<": navigates to the previous day's note (creates if absent)
- Tap ">": navigates to the next day's note (creates if absent, disabled for today)

#### 3.6 Data Requirements

##### Entity: Note (additional fields for daily notes)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| is_daily_note | boolean | - | false | Whether this note is a daily note |
| daily_date | string | Nullable, format YYYY-MM-DD | null | The date this daily note represents. Null for non-daily notes |

**Indexes:**
- (is_daily_note, daily_date) - unique composite for looking up daily notes by date

**Validation Rules:**
- daily_date must be unique across all notes where is_daily_note = true (only one daily note per date)
- daily_date must be today or in the past (no future daily notes)
- If is_daily_note is true, daily_date must not be null

**Example Data:**

```
{
  "id": "n-daily-2026-03-07",
  "title": "2026-03-07 - Friday",
  "is_daily_note": true,
  "daily_date": "2026-03-07",
  "folder_id": "f-daily-notes",
  "body": "# 2026-03-07 - Friday\n\n**Date:** March 7, 2026\n\n## Yesterday\n\n## Today\n\n## Blockers\n"
}
```

#### 3.7 Business Logic Rules

##### Open or Create Daily Note

**Purpose:** Navigate to today's daily note, creating it if it does not exist.

**Inputs:**
- target_date: string (YYYY-MM-DD) - the date to open (defaults to today)

**Logic:**

```
1. IF target_date is in the future, RETURN error "Cannot create daily notes for future dates"
2. Query for existing note where is_daily_note = true AND daily_date = target_date
3. IF found, RETURN the existing note (open in editor)
4. IF not found:
   a. Load the user's configured daily note template (from settings, default: "Daily Standup")
   b. Build the title using the configured date format:
      - Default: "YYYY-MM-DD - DayName" (e.g., "2026-03-07 - Friday")
   c. Apply template variable substitution (NT-008) with the target_date
   d. Look up or create the "Daily Notes" folder
   e. Create a new Note with:
      - title = formatted title
      - body = substituted template
      - is_daily_note = true
      - daily_date = target_date
      - folder_id = daily notes folder id
   f. RETURN the new note (open in editor)
```

**Edge Cases:**
- User's device timezone changes: daily_date is based on the device's local date at the time of creation
- Template is deleted: falls back to a minimal default body: "# [formatted date]\n\n"
- Daily Notes folder is deleted by user: auto-recreated on next daily note creation

##### Calendar Dot Indicators

**Purpose:** Determine which days in a given month have daily notes.

**Inputs:**
- year: integer
- month: integer (1-12)

**Logic:**

```
1. Query: SELECT daily_date FROM Note WHERE is_daily_note = true AND daily_date BETWEEN 'YYYY-MM-01' AND 'YYYY-MM-31'
2. RETURN array of date strings that have notes
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Daily note creation fails (storage error) | Toast: "Could not create daily note. Please try again." | User retries |
| Daily Notes folder was deleted | Folder auto-recreated silently | No user action needed |
| Template not found | Daily note created with minimal body (date heading only) | User can customize the note after creation |
| Future date requested | Button disabled (no tap handler); if triggered programmatically, error logged silently | No user action needed |
| Duplicate daily note for same date (race condition) | Second creation attempt returns the existing note | No user action needed |

**Validation Timing:**
- Date validation (not future): on button tap
- Duplicate check: before creation attempt
- Folder existence check: during creation

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** no daily note exists for today,
   **When** the user taps the "Today" button,
   **Then** a new note is created with the title "2026-03-07 - Friday", populated with the daily note template, placed in the "Daily Notes" folder, and opened in the editor.

2. **Given** a daily note already exists for today,
   **When** the user taps the "Today" button,
   **Then** the existing note opens in the editor without creating a duplicate.

3. **Given** the user is viewing today's daily note,
   **When** the user taps the "<" (previous day) button,
   **Then** the editor navigates to yesterday's daily note (creating it if it does not exist).

4. **Given** the daily notes calendar is open on March 2026 and daily notes exist for March 1, 3, 5, and 7,
   **When** the calendar renders,
   **Then** dots appear under days 1, 3, 5, and 7, and today (March 7) has an outlined circle.

5. **Given** the user configured the daily note title format to "Month DD, YYYY",
   **When** a new daily note is created,
   **Then** the title is "March 7, 2026" instead of the default format.

**Edge Cases:**

6. **Given** the user is viewing today's daily note,
   **When** the ">" (next day) button is examined,
   **Then** the button is disabled and non-interactive.

7. **Given** the user deleted the "Daily Notes" folder,
   **When** the user taps "Today",
   **Then** the folder is auto-recreated, the daily note is placed in it, and no error is shown.

**Negative Tests:**

8. **Given** the user navigates the calendar to a future month,
   **When** the user taps a future date cell,
   **Then** nothing happens (no note is created, no navigation occurs).

9. **Given** two concurrent requests to create today's daily note (e.g., rapid double-tap),
   **When** both requests are processed,
   **Then** only one note is created; the second request returns the note from the first.
   **And** no duplicate exists in the database.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates daily note for today | target_date: today | New note with is_daily_note=true, daily_date=today |
| returns existing daily note | target_date: today (already exists) | Existing note returned, no new note created |
| rejects future date | target_date: tomorrow | Error: "Cannot create daily notes for future dates" |
| formats title default | date: 2026-03-07 | "2026-03-07 - Friday" |
| formats title Month DD, YYYY | date: 2026-03-07, format: "Month DD, YYYY" | "March 7, 2026" |
| formats title DD/MM/YYYY | date: 2026-03-07, format: "DD/MM/YYYY" | "07/03/2026" |
| applies template variables | template with {{date}}, {{day_of_week}} | Variables substituted with target date values |
| falls back to minimal body if template missing | template_id not found | Body: "# 2026-03-07 - Friday\n\n" |
| calendar dots for March 2026 | 4 daily notes in March | Array of 4 date strings |
| calendar dots for empty month | 0 daily notes in January | Empty array |
| auto-creates Daily Notes folder | folder does not exist | Folder created with name "Daily Notes" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| First daily note creates folder | 1. No "Daily Notes" folder exists, 2. Tap "Today" | Folder created, daily note created inside it |
| Navigate between daily notes | 1. Create today's note, 2. Tap "<" 3 times | 3 past daily notes created; editor shows the note 3 days ago |
| Calendar shows correct dots | 1. Create daily notes for 5 specific dates, 2. Open calendar | 5 dots appear on the correct dates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Daily journaling workflow | 1. Tap "Today" every day for 7 days, 2. Write content each day, 3. Open calendar | 7 daily notes exist, calendar shows 7 dots, each note has unique content from that day |
| Custom template for daily notes | 1. Configure "Weekly Review" as daily note template, 2. Tap "Today" | Daily note created with Weekly Review structure and today's date substituted |

---

### NT-015: Knowledge Graph View

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-015 |
| **Feature Name** | Knowledge Graph View |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a knowledge worker, I want to see a visual map of how my notes are connected through wiki links, so that I can discover clusters of related ideas and identify isolated notes.

**Secondary:**
> As a researcher, I want to interact with the graph by tapping nodes to preview notes and dragging nodes to rearrange the layout, so that I can explore my knowledge base spatially.

#### 3.3 Detailed Description

Knowledge Graph View renders a visual, interactive graph of all notes and their [[wiki link]] connections. Each note is represented as a node (circle) and each link between two notes is represented as an edge (line). The graph layout is computed using the Fruchterman-Reingold force-directed algorithm, which positions connected nodes close together and pushes unconnected nodes apart, naturally forming clusters of related content.

The graph is rendered on a 2D canvas that fills the screen. Users can pan (drag the background), zoom (pinch or scroll wheel, range 0.1x to 5.0x), and interact with individual nodes. The graph supports up to 2,000 nodes before a performance warning is shown. For note collections exceeding 2,000 notes, a filter mode is engaged where users select a root note and the graph shows only notes within N hops (default 3, configurable 1-6).

Node appearance encodes metadata:
- **Size:** proportional to the number of incoming links (backlinks). Minimum radius: 6px. Maximum radius: 30px. Formula: `radius = 6 + min(incoming_link_count * 2, 24)`
- **Color:** based on the note's folder, with each folder assigned a distinct color from a 12-color palette. Unfiled notes use a neutral gray
- **Label:** the note title, displayed below the node when zoomed in enough that the label would be at least 8px font size. Labels are hidden at lower zoom levels to avoid clutter
- **Orphan indicator:** notes with zero incoming and zero outgoing links are rendered with a dashed border

Edge appearance:
- **Thickness:** 1px for single-direction links, 2px for bidirectional links (note A links to B and B links to A)
- **Color:** semi-transparent version of the source node's color
- **Direction:** a small arrowhead at the target end indicates link direction

The graph is animated on initial load: nodes start at random positions and settle into the force-directed layout over 100 iterations (approximately 2 seconds of animation). After settling, the graph is static until the user drags a node, which triggers a localized re-simulation.

Interactive features:
- **Tap node:** opens a preview card at the bottom of the screen showing the note title, first 100 characters of the body, tag chips, and backlink count. The card has an "Open" button to navigate to the note
- **Double-tap node:** navigates directly to the note in the editor
- **Drag node:** moves the node and re-simulates forces for adjacent nodes (spring-like behavior)
- **Long press node:** context menu with "Open Note", "Focus (show only connected)", "Pin Position" (locks the node's position)
- **Tap background:** dismisses any preview card and deselects nodes
- **Search in graph:** a search bar at the top filters and highlights matching nodes. Non-matching nodes fade to 20% opacity

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-006: Wiki-Style [[Backlinks]] - the NoteLink table provides the edge data for the graph

**External Dependencies:**
- 2D canvas rendering (Canvas API on web, custom drawing on mobile)

**Assumed Capabilities:**
- The app can render a 2D canvas with custom shapes and gestures
- The NoteLink table is populated from wiki link extraction

#### 3.5 User Interface Requirements

##### Screen: Knowledge Graph

**Layout:**
- Full screen canvas with the graph rendered on it
- Top bar: "Knowledge Graph" title (left), search icon (right), close/back button (left)
- Search bar (hidden by default, slides down when search icon is tapped): text input for filtering nodes
- Bottom preview card (hidden by default, slides up when a node is tapped): note title, body preview, tags, backlink count, "Open" button
- Bottom-left: zoom controls (+ and - buttons) and a minimap toggle
- Bottom-right: legend showing folder colors and node size meaning

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Graph data being fetched and layout being computed | Centered spinner: "Building graph..." |
| Empty | No notes with links exist | Centered message: "No connections yet. Link notes with [[double brackets]] to build your graph." |
| Settled | Initial animation complete | Static graph with all nodes positioned |
| Searching | User typed in search bar | Matching nodes at full opacity; non-matching at 20% opacity. Matching node count shown |
| Node Selected | User tapped a node | Preview card visible at bottom, selected node highlighted with a glow effect |
| Focused | User selected "Focus" on a node | Only connected nodes visible, breadcrumb "Focused on: [Note Title]" with "Show All" button |
| Performance Warning | >2,000 notes | Banner: "Large graph (N notes). Use search or focus mode for better performance." |

**Interactions:**
- Pan: drag on canvas background
- Zoom: pinch (mobile) or scroll wheel (desktop), range 0.1x to 5.0x
- Tap node: shows preview card
- Double-tap node: opens note in editor
- Drag node: repositions node, adjacent nodes adjust via force simulation
- Long press node: context menu
- Tap search icon: toggles search bar
- Type in search: highlights matching nodes
- Tap "Show All" (focus mode): returns to full graph

**Transitions/Animations:**
- Initial layout: 2 seconds of force-directed settling animation
- Node selection: selected node glows with a pulsing accent-color ring, 500ms loop
- Preview card: slides up from bottom, 250ms ease-out
- Focus mode: non-connected nodes fade to 0% and edges dissolve, 300ms
- Search highlighting: non-matching nodes fade to 20%, 200ms

#### 3.6 Data Requirements

No new entities are required. The graph reads from Note and NoteLink entities.

**Graph Data Structure (computed at load time):**

| Field | Type | Description |
|-------|------|-------------|
| nodes | array | One entry per note: { id, title, folder_id, folder_color, incoming_count, outgoing_count, x, y, radius, is_orphan } |
| edges | array | One entry per NoteLink: { source_id, target_id, is_bidirectional } |

**Node Size Formula:**
- `radius = 6 + min(incoming_link_count * 2, 24)` pixels
- Minimum: 6px (notes with 0 incoming links)
- Maximum: 30px (notes with 12+ incoming links)

**Folder Color Palette (12 colors):**

| Index | Color (Hex) | Assigned To |
|-------|-------------|-------------|
| 0 | #F38BA8 (red) | 1st folder |
| 1 | #FAB387 (orange) | 2nd folder |
| 2 | #F9E2AF (yellow) | 3rd folder |
| 3 | #A6E3A1 (green) | 4th folder |
| 4 | #94E2D5 (teal) | 5th folder |
| 5 | #89B4FA (blue) | 6th folder |
| 6 | #B4BEFE (indigo) | 7th folder |
| 7 | #CBA6F7 (purple) | 8th folder |
| 8 | #F5C2E7 (pink) | 9th folder |
| 9 | #EBA0AC (brown) | 10th folder |
| 10 | #9399B2 (gray) | 11th folder |
| 11 | #7F849C (slate) | 12th folder |
| - | #585B70 (neutral) | Unfiled notes |

Folders are assigned colors by creation order. If more than 12 folders exist, colors cycle.

#### 3.7 Business Logic Rules

##### Fruchterman-Reingold Force-Directed Layout

**Purpose:** Position nodes so that linked notes are near each other and unlinked notes are spread apart.

**Inputs:**
- nodes: array of { id, x, y } (initial positions random within the canvas)
- edges: array of { source_id, target_id }
- canvas_width: number (pixels)
- canvas_height: number (pixels)
- iterations: integer (default 100)

**Logic:**

```
1. Calculate optimal spacing: k = sqrt((canvas_width * canvas_height) / node_count)
2. Set initial temperature: t = canvas_width / 10
3. FOR i = 1 to iterations:
   a. Calculate repulsive forces (all node pairs):
      FOR each pair of nodes (u, v):
        delta = position(u) - position(v)
        distance = max(|delta|, 0.01)  // prevent division by zero
        F_repulsive = k^2 / distance
        displacement(u) += (delta / distance) * F_repulsive
        displacement(v) -= (delta / distance) * F_repulsive
   b. Calculate attractive forces (edge-connected pairs only):
      FOR each edge (u, v):
        delta = position(u) - position(v)
        distance = max(|delta|, 0.01)
        F_attractive = distance^2 / k
        displacement(u) -= (delta / distance) * F_attractive
        displacement(v) += (delta / distance) * F_attractive
   c. Apply displacements with temperature limiting:
      FOR each node:
        displacement_magnitude = |displacement(node)|
        position(node) += displacement(node) / displacement_magnitude * min(displacement_magnitude, t)
        // Clamp to canvas bounds with padding
        position(node).x = clamp(position(node).x, padding, canvas_width - padding)
        position(node).y = clamp(position(node).y, padding, canvas_height - padding)
   d. Cool the system: t = t * (1 - i / iterations)  // linear cooling
4. RETURN nodes with final positions
```

**Formulas:**
- `F_repulsive = -k^2 / d` (repels all node pairs, stronger when close)
- `F_attractive = d^2 / k` (attracts connected nodes, stronger when far)
- `k = sqrt(canvas_area / node_count)` (optimal spacing constant)
- `temperature` decreases linearly from `canvas_width / 10` to 0 over all iterations

**Edge Cases:**
- Zero nodes: empty graph, no computation
- One node: placed at canvas center, no forces
- Disconnected subgraphs: repulsive forces push them apart; each subgraph clusters internally
- Very dense graph (>1,000 edges): limit iterations to 50 for performance; accept a less-optimal layout
- Two nodes at the exact same position: the 0.01 minimum distance prevents division by zero

##### Graph Search and Highlight

**Purpose:** Filter the graph to highlight nodes matching a search query.

**Inputs:**
- query: string - the search text
- nodes: array of graph nodes

**Logic:**

```
1. IF query is empty, reset all nodes to full opacity, RETURN
2. FOR each node:
   a. IF node.title contains query (case-insensitive substring):
      - Set node.opacity = 1.0 (full)
      - Set node.highlighted = true
   b. ELSE:
      - Set node.opacity = 0.2 (faded)
      - Set node.highlighted = false
3. Count matching nodes
4. RETURN { matching_count }
```

##### Focus Mode

**Purpose:** Show only the selected node and its connected neighbors within N hops.

**Inputs:**
- center_node_id: string - the node to focus on
- max_hops: integer (default 3, range 1-6)
- edges: array of edges

**Logic:**

```
1. Initialize visited = { center_node_id }
2. Initialize frontier = { center_node_id }
3. FOR hop = 1 to max_hops:
   a. next_frontier = {}
   b. FOR each node in frontier:
      - Find all edges where node is source or target
      - Add the other node to next_frontier if not already in visited
   c. Add all next_frontier nodes to visited
   d. frontier = next_frontier
4. FOR each node:
   a. IF node.id in visited: set visible = true
   b. ELSE: set visible = false
5. Filter edges to only those where both source and target are visible
6. Re-run layout with only visible nodes and edges
7. RETURN { visible_node_count, visible_edge_count }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Graph data load fails | Screen shows "Could not load graph data" with "Retry" button | User taps "Retry" |
| Layout computation times out (>5 seconds) | Layout stops at current iteration, graph displayed with partial positioning | User can drag nodes to improve positions manually |
| Canvas rendering fails (WebGL/Canvas not available) | Fallback message: "Graph view is not supported on this device" | User uses the backlinks panel (NT-007) for navigation instead |
| >2,000 notes | Banner: "Large graph (N notes). Use search or focus mode for better performance." | User activates focus mode or search to reduce visible nodes |
| Node has no edges (orphan) | Node rendered with dashed border, positioned at graph periphery | User can link the note to others via the editor |
| Focus mode center node has no connections | Graph shows only the single center node | User can "Show All" to return to the full graph |

**Validation Timing:**
- Node count check: on graph load
- Layout timeout: monitored during force simulation
- Canvas capability check: on screen mount

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 50 notes with 80 wiki links between them,
   **When** the Knowledge Graph is opened,
   **Then** a graph with 50 nodes and 80 edges renders, nodes settle into position over 2 seconds, and clusters of linked notes are visually apparent.

2. **Given** the user taps a node on the graph,
   **When** the tap is registered,
   **Then** a preview card slides up showing the note title, first 100 characters, tags, and backlink count, with an "Open" button.

3. **Given** the user double-taps a node,
   **When** the double-tap is registered,
   **Then** the graph closes and the note opens in the editor.

4. **Given** the user types "project" in the graph search bar,
   **When** the search processes,
   **Then** nodes with "project" in their title are at full opacity, all others fade to 20%, and the count shows "N notes match."

5. **Given** the user selects "Focus" on a note with 8 connected notes (within 3 hops),
   **When** focus mode activates,
   **Then** only 9 nodes (center + 8 connected) and their edges are visible, all other nodes fade out.

6. **Given** a note "API Design" has 12 incoming links,
   **When** the graph renders,
   **Then** its node radius is 30px (6 + min(12 * 2, 24) = 30), the maximum size.

**Edge Cases:**

7. **Given** the user has 5 notes with zero links between any of them,
   **When** the graph renders,
   **Then** 5 orphan nodes are displayed with dashed borders, spread across the canvas by repulsive forces only.

8. **Given** the user has 2,500 notes,
   **When** the graph loads,
   **Then** a banner "Large graph (2,500 notes). Use search or focus mode for better performance." is displayed.

**Negative Tests:**

9. **Given** no notes have any wiki links,
   **When** the graph is opened,
   **Then** the message "No connections yet. Link notes with [[double brackets]] to build your graph." is displayed.

10. **Given** the canvas rendering engine is unavailable,
    **When** the graph screen opens,
    **Then** the message "Graph view is not supported on this device" is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates node radius 0 links | incoming_count: 0 | radius: 6 |
| calculates node radius 5 links | incoming_count: 5 | radius: 16 (6 + 10) |
| calculates node radius max | incoming_count: 20 | radius: 30 (6 + 24, capped) |
| assigns folder colors by creation order | 3 folders created in order | Colors: red, orange, yellow |
| assigns neutral for unfiled notes | note with no folder | Color: #585B70 |
| cycles colors for >12 folders | 13 folders | 13th folder gets color index 0 (red) |
| computes k for 100 nodes, 800x600 canvas | node_count: 100, area: 480,000 | k = sqrt(480000/100) = 69.28 |
| repulsive force at distance 10 | k=69, d=10 | F = 69^2 / 10 = 476.1 |
| attractive force at distance 50 | k=69, d=50 | F = 50^2 / 69 = 36.23 |
| search highlights matching nodes | query: "alpha", nodes: ["Alpha Plan", "Beta Plan"] | "Alpha Plan" highlighted, "Beta Plan" faded |
| focus mode 1 hop | center with 3 direct links | 4 nodes visible |
| focus mode 3 hops | center linked to A, A linked to B, B linked to C | 4 nodes visible (center, A, B, C) |
| detects orphan nodes | node with 0 incoming and 0 outgoing | is_orphan: true |
| detects bidirectional edge | A->B and B->A edges | is_bidirectional: true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Graph renders with linked notes | 1. Create 10 notes with 15 wiki links, 2. Open graph | Graph shows 10 nodes and 15 edges, clusters visible |
| Tap node to preview | 1. Open graph, 2. Tap a node | Preview card appears with note details |
| Search filters graph | 1. Open graph with 50 nodes, 2. Search "meeting" | Matching nodes highlighted, others faded |
| Focus mode isolates subgraph | 1. Open graph, 2. Long press node, 3. Select "Focus" | Only connected nodes visible |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Explore knowledge base visually | 1. Build 100 notes with cross-links over weeks, 2. Open knowledge graph, 3. Identify clusters, 4. Tap a cluster node, 5. Navigate to the note | Graph reveals project clusters; user discovers forgotten connections between notes |
| Find isolated notes | 1. Open graph, 2. Look for dashed-border orphan nodes, 3. Double-tap an orphan | User opens the orphan note and adds wiki links to connect it to the graph |

---

### NT-016: Table of Contents from Headers

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-016 |
| **Feature Name** | Table of Contents from Headers |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a knowledge worker, I want an auto-generated table of contents based on the headings in my note, so that I can navigate long documents quickly without scrolling.

**Secondary:**
> As a technical writer, I want the table of contents to update in real time as I add or remove headings, so that the outline always reflects the current structure of my note.

#### 3.3 Detailed Description

Table of Contents (TOC) automatically generates an outline from all markdown headings (H1 through H6) in a note. The TOC is displayed as a collapsible sidebar panel (desktop) or a slide-out sheet (mobile) showing the heading hierarchy as a navigable tree. Tapping a heading in the TOC scrolls the editor or preview to that heading's position.

The TOC is built by scanning the note's AST (produced by the markdown parser in NT-001) for all Heading nodes. Each heading is listed at its corresponding nesting level: H1 at the top level, H2 indented once, H3 indented twice, and so on. The TOC updates on every debounced parse cycle (150ms after the last keystroke), so it reflects the current state of the note's headings in near-real time.

The TOC panel is visible only for notes with 2 or more headings. Notes with 0 or 1 heading do not show the TOC toggle button. The panel is toggled via a "TOC" icon button in the editor toolbar. On desktop, the TOC appears as a right sidebar (240px width) that coexists with the editor. On mobile, the TOC appears as a bottom sheet that slides up, showing the heading tree.

Each entry in the TOC shows the heading text (truncated to 60 characters with ellipsis) and the heading level indicator (H1-H6 badge or indentation). The currently visible heading (the heading closest to the top of the viewport) is highlighted in the TOC to show the user's reading position.

A minimap-style scroll indicator is optionally shown alongside the TOC: a thin vertical bar on the right that represents the full note length, with markers for each heading position. This provides a spatial overview of how headings are distributed through the note.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - the AST parser provides Heading nodes

**External Dependencies:**
- None

**Assumed Capabilities:**
- The markdown AST includes Heading nodes with level and text fields
- The editor/preview supports programmatic scroll-to-position

#### 3.5 User Interface Requirements

##### Component: TOC Panel (Desktop Sidebar)

**Layout:**
- Right sidebar, 240px width, separated from editor by 1px vertical divider
- Header: "Contents" title with a close button (X)
- Scrollable tree of heading entries:
  - H1: no indent, bold text
  - H2: 16px indent, regular weight
  - H3: 32px indent, regular weight, smaller font
  - H4-H6: 48px indent, muted text, smaller font
- Each entry is a single line, truncated with ellipsis at 60 characters
- Active heading (closest to viewport top) has accent-color text and a left border indicator (3px accent-color bar)
- Optional minimap bar on the right edge (8px width)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Hidden | Note has <2 headings or user closed the panel | TOC button hidden or panel closed |
| Visible | Note has 2+ headings and panel is open | Sidebar with heading tree |
| Active Tracking | User is scrolling the note | Active heading highlight updates in real time |

**Interactions:**
- Tap heading entry: smooth-scrolls the editor/preview to that heading
- Tap close button: hides the TOC panel
- Tap TOC button in toolbar: toggles the panel open/closed

**Transitions/Animations:**
- Panel open: slides in from right, 200ms ease-out
- Panel close: slides out to right, 200ms ease-in
- Active heading highlight: smooth transition between entries, 150ms

##### Component: TOC Sheet (Mobile)

**Layout:**
- Bottom sheet, slides up to 60% of screen height
- Same heading tree structure as the desktop sidebar
- Drag handle at top for sheet dismissal
- Sheet dismisses automatically after a heading is tapped (to maximize editing space)

**Interactions:**
- Tap heading: scrolls to heading, dismisses the sheet
- Drag down: dismisses the sheet
- Tap backdrop: dismisses the sheet

#### 3.6 Data Requirements

No new database entities are required. The TOC is computed from the in-memory AST on each parse cycle.

**TOC Entry (computed, not persisted):**

| Field | Type | Description |
|-------|------|-------------|
| heading_text | string | The text content of the heading (max 60 chars for display) |
| level | integer (1-6) | The heading level (H1=1, H2=2, etc.) |
| line_number | integer | The line in the source body where the heading appears |
| scroll_offset | number | The vertical scroll position of this heading in the rendered preview |

#### 3.7 Business Logic Rules

##### TOC Extraction

**Purpose:** Build the table of contents from the note's AST.

**Inputs:**
- ast: AST - the parsed markdown Abstract Syntax Tree
- body: string - the raw markdown text (for line number lookup)

**Logic:**

```
1. Walk the AST depth-first
2. FOR each Heading node:
   a. Extract heading_text = text content of the heading
   b. Extract level = heading level (1-6)
   c. Compute line_number from the heading's source position in the AST
   d. Append { heading_text, level, line_number } to toc_entries
3. IF toc_entries.length < 2, RETURN null (TOC not shown)
4. RETURN toc_entries
```

**Edge Cases:**
- Note has zero headings: TOC is null, toggle button hidden
- Note has one heading: TOC is null (minimum 2 required)
- Heading text contains markdown formatting (e.g., `# **Bold Title**`): the plain text "Bold Title" is extracted
- Heading with only whitespace: entry is skipped
- Very long heading text: truncated to 60 characters with "..." suffix

##### Active Heading Tracking

**Purpose:** Highlight the heading closest to the current viewport position.

**Inputs:**
- toc_entries: array of TOC entries with scroll offsets
- current_scroll_position: number - the viewport's scroll top

**Logic:**

```
1. Find the last toc_entry whose scroll_offset is <= current_scroll_position + 20px (20px tolerance)
2. IF found, set that entry as active
3. IF current_scroll_position is above all headings, set the first entry as active
4. RETURN active_entry_index
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| AST parsing fails | TOC shows stale entries from last successful parse | Next parse cycle updates the TOC |
| Scroll-to-heading fails | No scroll occurs; entry remains tappable | User can manually scroll to find the heading |
| Heading deleted while TOC is open | TOC updates on next parse cycle; deleted entry removed | No user action needed |

**Validation Timing:**
- TOC extraction runs on every debounced parse (150ms)
- Active heading tracking runs on every scroll event (throttled to 16ms / 60fps)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** a note with headings H1, H2, H2, H3, H2,
   **When** the TOC is opened,
   **Then** the TOC shows 5 entries with proper indentation: H1 flush left, H2s indented once, H3 indented twice.

2. **Given** the user taps an H2 entry in the TOC,
   **When** the tap is processed,
   **Then** the editor/preview smooth-scrolls to that H2 heading position.

3. **Given** the user is scrolling through a long note,
   **When** the viewport passes a heading boundary,
   **Then** the active heading in the TOC updates to reflect the currently visible section.

4. **Given** the user adds a new heading "## New Section" in the editor,
   **When** the debounced parse completes,
   **Then** the TOC updates to include the new heading at the correct position and level.

**Edge Cases:**

5. **Given** a note with only 1 heading,
   **When** the user looks for the TOC toggle,
   **Then** the TOC button is hidden (minimum 2 headings required).

6. **Given** a heading text is 100 characters long,
   **When** the TOC renders,
   **Then** the entry text is truncated to 60 characters with "..." appended.

**Negative Tests:**

7. **Given** a note with zero headings,
   **When** the user checks the editor toolbar,
   **Then** the TOC button is not visible.
   **And** no TOC panel can be opened.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| extracts H1 heading | body: "# Title" | 1 entry: text="Title", level=1 |
| extracts mixed headings | body: "# H1\n## H2\n### H3" | 3 entries with levels 1, 2, 3 |
| returns null for <2 headings | body: "# Only One" | null |
| truncates long heading text | heading: (100 chars) | Text truncated to 60 chars + "..." |
| strips markdown from heading text | body: "# **Bold** Title" | text: "Bold Title" |
| skips empty headings | body: "# \n## Real Heading" | 1 entry: "Real Heading" (empty heading skipped) |
| active heading at scroll 0 | toc_entries: [{offset:0}, {offset:500}], scroll: 0 | active_index: 0 |
| active heading mid-scroll | toc_entries: [{offset:0}, {offset:500}, {offset:1000}], scroll: 600 | active_index: 1 |
| active heading at bottom | scroll > last heading offset | active_index: last entry |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Open TOC and navigate | 1. Open note with 5 headings, 2. Open TOC, 3. Tap 3rd heading | Editor scrolls to the 3rd heading position |
| TOC updates on edit | 1. Open TOC, 2. Add a new heading in editor | TOC updates within 200ms to include the new heading |
| Active heading tracking | 1. Open TOC, 2. Scroll the note through 3 headings | Active highlight moves from 1st to 2nd to 3rd heading |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Navigate a long document | 1. Create note with 20 headings across 5,000 words, 2. Open TOC, 3. Tap heading #15 | Editor scrolls to heading 15; TOC shows heading 15 as active |

---

### NT-017: Table Support

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-017 |
| **Feature Name** | Table Support |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a knowledge worker, I want to create and edit tables in my notes, so that I can organize structured data like comparison charts, schedules, and reference tables.

**Secondary:**
> As a user who does not want to write markdown table syntax by hand, I want a visual table editor that generates the correct pipe syntax, so that I can create tables without memorizing the formatting rules.

#### 3.3 Detailed Description

Table Support adds full markdown table creation, editing, and rendering. Tables are written in standard pipe syntax (the most common markdown table format) and rendered as formatted HTML-style tables in the preview. A visual table editor overlay allows users to create and modify tables without directly writing the pipe and dash syntax.

Markdown table syntax:

```
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |
```

The table toolbar button in the editor opens a table creation dialog where the user specifies the initial dimensions: rows (1-100) and columns (1-20). The dialog generates the pipe syntax skeleton and inserts it at the cursor position. Default dimensions: 3 rows x 3 columns.

Column alignment is supported via the standard markdown syntax:
- `:---` left-aligned (default)
- `:---:` center-aligned
- `---:` right-aligned

The visual table editor is an overlay that appears when the user taps a rendered table in the preview (mobile) or hovers over a rendered table and clicks an "Edit" icon (desktop). The visual editor displays the table as an editable grid where users can:
- Tap a cell to edit its content inline
- Add or remove rows and columns via + and - buttons on the edges
- Drag column borders to resize (adjusting the column width proportions)
- Change column alignment via a dropdown on the header cell (left, center, right)
- Sort rows by any column (ascending or descending) via a header click

All changes in the visual editor are synchronized back to the markdown source in real time. Maximum table dimensions: 100 rows x 20 columns.

Tables scroll horizontally in the preview when they exceed the content width. A subtle scroll indicator (horizontal scrollbar) appears at the bottom of wide tables. On mobile, a "pinch to see full table" hint appears for tables wider than the viewport.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - tables are a markdown extension rendered by the preview

**External Dependencies:**
- None

**Assumed Capabilities:**
- The markdown parser produces Table, TableRow, and TableCell AST nodes (specified in NT-001)
- The preview renderer can display HTML-style tables

#### 3.5 User Interface Requirements

##### Component: Rendered Table (Preview)

**Layout:**
- Full-width container with horizontal scroll when content exceeds width
- Header row: bold text, bottom border (2px accent color), background slightly tinted
- Body rows: alternating row colors (even rows slightly tinted, odd rows default background)
- Cell padding: 8px horizontal, 6px vertical
- Column alignment reflected in text-align CSS
- Border: 1px solid muted color between all cells

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Normal | Table rendered from markdown | Formatted table with header row and body rows |
| Wide Table | Table exceeds content width | Horizontal scroll enabled, scroll indicator visible |
| Empty Table | Table has header but no body rows | Header row only, subtle "empty table" text in first row |
| Edit Mode | User tapped table or hovered + clicked Edit | Visual editor overlay with editable cells, + buttons on edges |

**Interactions:**
- Tap table (mobile) or hover + click Edit (desktop): opens the visual table editor
- Horizontal scroll: swipe/drag on the table to scroll wide tables
- Tap header cell in visual editor: opens alignment dropdown (left, center, right)
- Tap + button (right edge): adds a new column
- Tap + button (bottom edge): adds a new row
- Tap - button on a row/column: removes that row/column (with confirmation if it has content)

**Transitions/Animations:**
- Visual editor overlay fades in, 200ms
- Row/column add: slides in, 200ms ease-out
- Row/column remove: slides out, 200ms ease-in

##### Modal: Table Creation Dialog

**Layout:**
- Small dialog (centered on desktop, bottom sheet on mobile)
- Two numeric steppers: "Rows" (1-100, default 3) and "Columns" (1-20, default 3)
- "Insert Table" button (primary) and "Cancel" button (secondary)

**Interactions:**
- Adjust stepper: changes row or column count
- Tap "Insert Table": generates pipe syntax and inserts at cursor, closes dialog
- Tap "Cancel": dismisses dialog

#### 3.6 Data Requirements

No new database entities are required. Tables are part of the note body as markdown text.

**Table Dimensions Limits:**

| Dimension | Minimum | Maximum | Default |
|-----------|---------|---------|---------|
| Rows (body) | 1 | 100 | 3 |
| Columns | 1 | 20 | 3 |
| Cell content length | 0 chars | 1,000 chars | Empty |

#### 3.7 Business Logic Rules

##### Table Markdown Generation

**Purpose:** Generate pipe-syntax table markdown from dimensions.

**Inputs:**
- rows: integer (1-100)
- columns: integer (1-20)

**Logic:**

```
1. Build header row: "| " + "Header N | " repeated for each column
2. Build separator row: "|" + "----------|" repeated for each column
3. Build body rows: "| " + "          | " repeated for each column, repeated for each row
4. Join with newlines
5. RETURN table_markdown
```

**Edge Cases:**
- 1 row, 1 column: smallest valid table
- 100 rows, 20 columns: largest valid table; total pipe syntax may be very long
- Column names default to "Header 1", "Header 2", etc.

##### Visual Table Edit to Markdown Sync

**Purpose:** Convert a visual table editor state back to markdown pipe syntax.

**Inputs:**
- table_data: 2D array of cell strings
- alignments: array of column alignments ("left" | "center" | "right")
- original_line_range: { start_line, end_line } in the markdown body

**Logic:**

```
1. Build header row from table_data[0] (first row is always the header)
2. Build separator row based on alignments:
   - "left" -> ":------"
   - "center" -> ":------:"
   - "right" -> "------:"
3. Build body rows from table_data[1..n]
4. Join all rows with "\n"
5. Replace lines original_line_range.start to original_line_range.end in the note body with the new table markdown
6. Trigger auto-save
```

**Edge Cases:**
- Cell contains pipe character `|`: escape as `\|`
- Cell contains newline: replace with space (markdown tables do not support multi-line cells)
- Cell is empty: rendered as an empty cell (just spaces between pipes)

##### Table Sort

**Purpose:** Sort table body rows by a column's values.

**Inputs:**
- table_data: 2D array of cell strings
- sort_column: integer (0-indexed column)
- sort_direction: "asc" | "desc"

**Logic:**

```
1. Separate header row (table_data[0]) from body rows (table_data[1..n])
2. Sort body rows by the value in sort_column:
   a. IF all values in the column parse as numbers, sort numerically
   b. ELSE sort alphabetically (case-insensitive)
3. IF sort_direction is "desc", reverse the sorted rows
4. Recombine header + sorted body rows
5. RETURN sorted table_data
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Table syntax is malformed (mismatched columns) | Preview renders available data; missing cells are empty | User corrects the markdown manually or via visual editor |
| Row/column count exceeds maximum (100 rows or 20 cols) | Stepper prevents going beyond limits; toast if attempted programmatically | No action needed |
| Cell content contains pipe character | Pipe auto-escaped as `\|` in the markdown source | No action needed |
| Visual editor sync fails | Toast: "Could not update table. Changes may be lost." | User retries or edits the markdown directly |

**Validation Timing:**
- Dimension validation: on stepper change and insert
- Cell content validation: on cell blur (pipe escaping) and on visual editor sync
- Table parsing: during AST parse on each debounced update

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps the table toolbar button and sets dimensions to 4 rows x 3 columns,
   **When** the user taps "Insert Table",
   **Then** a 4x3 pipe-syntax table skeleton is inserted at the cursor with header row "Header 1 | Header 2 | Header 3".

2. **Given** a note contains a valid markdown table,
   **When** the preview renders,
   **Then** the table displays with a styled header row (bold, tinted background), alternating body row colors, and cell padding.

3. **Given** the user taps a rendered table to open the visual editor,
   **When** the overlay opens,
   **Then** all cell contents are editable, + buttons appear on the right and bottom edges, and column alignment dropdowns are on header cells.

4. **Given** the user adds a new column via the + button in the visual editor,
   **When** the column is added,
   **Then** the new column appears in the visual editor, the markdown source is updated with the new column, and the preview reflects the change.

5. **Given** the user clicks a column header to sort by that column,
   **When** the sort is applied,
   **Then** body rows reorder accordingly (numerically or alphabetically), the markdown source updates, and a sort indicator (arrow) appears on the header.

**Edge Cases:**

6. **Given** a table with 15 columns that exceeds the content width,
   **When** the preview renders,
   **Then** the table scrolls horizontally with a scroll indicator at the bottom.

7. **Given** a cell contains a pipe character (e.g., "a|b"),
   **When** the visual editor syncs to markdown,
   **Then** the pipe is escaped as "a\|b" in the markdown source.

**Negative Tests:**

8. **Given** the user tries to create a table with 0 rows,
   **When** the stepper is at minimum (1),
   **Then** the stepper does not allow going below 1 row.

9. **Given** a malformed table with mismatched column counts between rows,
   **When** the preview renders,
   **Then** the table renders with the available data, short rows padded with empty cells.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates 3x3 table | rows: 3, cols: 3 | Valid pipe syntax with header, separator, 3 body rows |
| generates 1x1 table | rows: 1, cols: 1 | Valid pipe syntax with 1 header, separator, 1 body row |
| left alignment separator | alignment: "left" | ":------" |
| center alignment separator | alignment: "center" | ":------:" |
| right alignment separator | alignment: "right" | "------:" |
| escapes pipe in cell | cell: "a|b" | Output: "a\|b" |
| replaces newline in cell | cell: "line1\nline2" | Output: "line1 line2" |
| sorts numerically | column values: ["10", "2", "1", "20"], asc | Order: "1", "2", "10", "20" |
| sorts alphabetically | column values: ["banana", "apple", "cherry"], asc | Order: "apple", "banana", "cherry" |
| sorts descending | values: [1, 2, 3], desc | Order: 3, 2, 1 |
| preserves header on sort | table with header "Name" and 3 body rows | Header stays in position 0 |
| handles empty cells | cell: "" | Renders as empty cell between pipes |
| renders mismatched columns | row 1: 3 cols, row 2: 2 cols | Row 2 padded with 1 empty cell |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Insert table and preview | 1. Tap table button, 2. Set 3x2, 3. Insert, 4. Preview | Table renders with 3 rows, 2 columns, header row styled |
| Visual editor edits sync | 1. Open visual editor, 2. Change cell content, 3. Close editor | Markdown source updated with new cell content |
| Add column via visual editor | 1. Open visual editor, 2. Tap + on right edge | New column added in editor and markdown source |
| Sort table by column | 1. Open visual editor, 2. Click header to sort ascending | Rows reorder, markdown source updated |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Create comparison table | 1. Insert 5x4 table, 2. Fill in comparison data via visual editor, 3. Set alignment (name left, price right, rating center), 4. Sort by price | Formatted comparison table with correct alignment and sorted rows |

---

### NT-018: Version History with Diffs

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-018 |
| **Feature Name** | Version History with Diffs |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a writer, I want to browse previous versions of a note and see what changed between versions, so that I can recover accidentally deleted content or understand how a note evolved.

**Secondary:**
> As a knowledge worker, I want to restore a previous version of a note if I made unwanted changes, so that I can undo major edits that auto-save captured before I realized my mistake.

#### 3.3 Detailed Description

Version History tracks snapshots of a note's content over time and provides a diff viewer to compare any two versions. Each version is a point-in-time snapshot of the note's title and body, created automatically at significant save points. Users browse the version timeline, view diffs between versions, and restore any previous version.

Version snapshots are created under these conditions:
- On the first save of a newly created note (version 1)
- When the note is opened after being closed for at least 1 hour (captures the "start of editing session" state)
- When the user explicitly requests a snapshot via "Save Version" in the overflow menu
- Immediately before a bulk operation (e.g., template application, import overwrite)

Automatic snapshots are not created on every auto-save (which happens every 2 seconds). This prevents excessive storage consumption. A note can have a maximum of 200 versions. When the limit is reached, the oldest versions are merged: versions older than 90 days are thinned to keep only 1 per day, and versions older than 365 days are thinned to 1 per week.

The version history screen shows a chronological list of versions (newest first) with:
- Version number (sequential from 1)
- Timestamp (date and time)
- Type badge: "Auto" (session start), "Manual" (user-requested), "Initial" (first version)
- Size change indicator: "+N" or "-N" words compared to the previous version
- A brief diff summary: "Added 3 paragraphs, removed 1" (computed lazily when the entry is scrolled into view)

The diff viewer shows a side-by-side or unified diff between two selected versions. Added lines are highlighted in green, removed lines in red, and unchanged lines in the default color. The diff is computed using the Myers diff algorithm, which finds the minimum edit distance between two texts. The diff operates at the line level (not character level) for readability, with intra-line changes highlighted within modified lines.

Restoring a version copies the selected version's body back to the current note, creating a new version snapshot before the restore (so the user can undo the restore if needed). The restored content triggers auto-save and all dependent updates (FTS index, task extraction, link extraction).

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - version history tracks note content managed by the editor

**External Dependencies:**
- Local persistent storage for version snapshot records

**Assumed Capabilities:**
- The auto-save system provides hooks for version snapshot creation
- Storage is sufficient for multiple full-text snapshots per note

#### 3.5 User Interface Requirements

##### Screen: Version History

**Layout:**
- Full screen, accessed from the note editor overflow menu: "Version History"
- Top bar: "Version History" title, "Done" button (right), note title (subtitle)
- Content: scrollable list of version entries, newest first
- Each entry is a card showing:
  - Version number and timestamp (e.g., "v12 - March 7, 2026 at 2:30 PM")
  - Type badge ("Auto", "Manual", "Initial")
  - Word count change: "+47 words" (green) or "-12 words" (red) or "no change" (muted)
  - Diff summary (lazy-loaded): e.g., "Changed 3 lines, added 1 paragraph"
- Bottom toolbar: "Compare" button (disabled until 2 versions are selected) and "Restore" button (disabled until 1 version is selected)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Note has only 1 version (initial) | Single entry with "Initial" badge; compare and restore buttons disabled |
| Populated | Note has 2+ versions | List of versions with selectable entries |
| Selection Mode | User tapped a version | Tapped version is highlighted, "Restore" enabled. User can tap a second version to enable "Compare" |
| Comparing | User tapped "Compare" | Diff viewer opens showing the two selected versions |
| Restoring | User tapped "Restore" | Confirmation dialog, then content is replaced |

**Interactions:**
- Tap version entry (first tap): selects it (highlighted border), enables "Restore"
- Tap version entry (second tap on different entry): selects both, enables "Compare"
- Tap "Compare": opens the diff viewer with the two selected versions
- Tap "Restore": confirmation dialog: "Restore to version N? A snapshot of the current content will be saved first." with "Restore" and "Cancel" buttons
- Tap "Done": returns to the editor

##### Screen: Diff Viewer

**Layout:**
- Full screen, accessed from the Version History screen
- Top bar: "v[A] vs v[B]" title, "Done" button
- Toggle: "Side-by-Side" and "Unified" view modes
- Content: scrollable diff view
  - **Side-by-side:** left pane shows version A, right pane shows version B, with added/removed/modified lines highlighted
  - **Unified:** single pane with `+` prefix for added lines (green background), `-` prefix for removed lines (red background), and no prefix for unchanged lines
- Line numbers shown in the gutter for both views
- Intra-line changes (specific words that changed within a modified line) are highlighted with a darker shade of the add/remove color

**Interactions:**
- Toggle view mode: switches between side-by-side and unified
- Scroll: synchronized scrolling in side-by-side mode
- Tap "Done": returns to version history

#### 3.6 Data Requirements

##### Entity: NoteVersion

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique version identifier |
| note_id | string | Foreign key -> Note.id, required | None | The note this version belongs to |
| version_number | integer | Min: 1, sequential per note | Auto-increment | Sequential version number |
| title | string | Required, max 500 chars | None | The note title at the time of the snapshot |
| body | string | Required | None | The full note body at the time of the snapshot |
| word_count | integer | Min: 0 | 0 | Word count of the body at snapshot time |
| snapshot_type | string | One of: "initial", "auto", "manual", "pre_restore" | None | How this version was created |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | When this snapshot was created |

**Relationships:**
- Note has many NoteVersions (one-to-many)
- NoteVersion belongs to one Note

**Indexes:**
- (note_id, version_number DESC) - for fetching versions in reverse chronological order
- (note_id, created_at) - for age-based thinning queries

**Validation Rules:**
- version_number must be unique per note_id
- version_number must be sequential (no gaps when creating; gaps allowed after thinning)
- Maximum 200 versions per note (oldest thinned when exceeded)
- body must not be empty (except for edge case of newly created empty note)

**Example Data:**

```
{
  "id": "ver-001",
  "note_id": "n-note-1234",
  "version_number": 12,
  "title": "Architecture Notes",
  "body": "# Architecture\n\n## Overview\n...",
  "word_count": 347,
  "snapshot_type": "auto",
  "created_at": "2026-03-07T14:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Version Snapshot Creation

**Purpose:** Create a point-in-time snapshot of a note's content.

**Inputs:**
- note: Note record (current state)
- snapshot_type: string ("initial" | "auto" | "manual" | "pre_restore")

**Logic:**

```
1. Count existing versions for this note
2. IF count >= 200:
   a. Run thinning algorithm (see below)
3. Get next version_number = max(existing version_numbers for this note) + 1
4. Create NoteVersion record:
   - note_id = note.id
   - version_number = next version_number
   - title = note.title
   - body = note.body
   - word_count = note.word_count
   - snapshot_type = snapshot_type
5. RETURN version record
```

**Edge Cases:**
- Note body has not changed since the last version: snapshot is still created (user explicitly requested it or it is a session-start auto-snapshot)
- Note is empty: version created with empty body and word_count = 0
- Concurrent snapshot requests: serialized by database transaction

##### Version Thinning

**Purpose:** Reduce the number of stored versions when the 200-version limit is approached.

**Inputs:**
- note_id: string
- current_version_count: integer

**Logic:**

```
1. Load all versions for note_id ordered by created_at ASC
2. Identify versions older than 365 days
   a. Group by ISO week
   b. Within each week, keep the last version, delete the rest
3. Identify versions between 90 and 365 days old
   a. Group by date (YYYY-MM-DD)
   b. Within each date, keep the last version, delete the rest
4. Versions less than 90 days old: keep all
5. Never delete versions with snapshot_type "manual" (user-created snapshots are preserved)
6. RETURN { deleted_count }
```

**Edge Cases:**
- All 200 versions are less than 90 days old: no thinning occurs; the 201st version is created and the hard limit is 200+1 temporarily (thinning runs on next snapshot creation)
- Only manual versions remain after thinning: no further thinning possible; hard limit allows up to 200 manual versions

##### Myers Diff Algorithm

**Purpose:** Compute the minimum edit script between two versions of text.

**Inputs:**
- text_a: string - the older version's body
- text_b: string - the newer version's body

**Logic:**

```
1. Split text_a and text_b into lines
2. Apply the Myers diff algorithm:
   a. Build the edit graph for the two line arrays
   b. Find the shortest edit script (SES) using the O(ND) algorithm where N = len(a) + len(b) and D = edit distance
   c. Trace back through the edit graph to produce the edit operations
3. Classify each line as:
   - "unchanged": present in both versions at the same position
   - "added": present only in text_b (green highlighting)
   - "removed": present only in text_a (red highlighting)
   - "modified": line exists in both but content changed (compute intra-line diff)
4. For "modified" lines:
   a. Run a character-level diff between the two line variants
   b. Highlight changed segments within the line
5. Compute summary stats:
   - lines_added = count of "added" lines
   - lines_removed = count of "removed" lines
   - lines_modified = count of "modified" lines
   - word_delta = word_count_b - word_count_a
6. RETURN { diff_entries, summary }
```

**Formulas:**
- `word_delta = version_b.word_count - version_a.word_count`
- `edit_distance = lines_added + lines_removed + lines_modified`

**Edge Cases:**
- Identical versions: diff has zero entries, summary shows "no changes"
- One version is empty: all lines in the other version are "added" or "removed"
- Very large diff (1,000+ line changes): diff still computed but rendered with virtual scrolling for performance

##### Version Restore

**Purpose:** Replace the current note content with a previous version's content.

**Inputs:**
- note_id: string
- restore_version_id: string - the version to restore

**Logic:**

```
1. Create a "pre_restore" snapshot of the current note content
2. Load the restore version
3. Update the note:
   - body = restore_version.body
   - title = restore_version.title (only if the user confirmed title restore in the dialog)
   - Recalculate: word_count, character_count, body_plain
4. Trigger dependent updates:
   - FTS index rebuild for this note
   - Wiki link re-extraction
   - Task item re-extraction
5. Trigger auto-save
6. RETURN { restored_to_version: restore_version.version_number }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Version history load fails | Screen shows "Could not load version history" with "Retry" | User taps "Retry" |
| Diff computation times out (>5 seconds) | Diff viewer shows "Diff too large to display" | User can still restore the version without viewing the diff |
| Restore fails (storage error) | Toast: "Could not restore version. Please try again." | Pre-restore snapshot is rolled back; note remains at current version |
| Storage full, cannot create snapshot | Toast: "Not enough storage to save version history" | Version not created; note content still saves normally |
| Thinning deletes important auto-versions | Manual versions are never thinned; users should use "Save Version" for important checkpoints | User creates manual snapshots for critical states |

**Validation Timing:**
- Version snapshot creation: on session start, manual save, and pre-restore
- Thinning check: when version count reaches 200 on snapshot creation
- Diff computation: on demand when user opens the diff viewer

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens a note that was last edited yesterday,
   **When** the note is loaded,
   **Then** an automatic version snapshot is created (snapshot_type "auto") capturing the start-of-session state.

2. **Given** the user taps "Save Version" from the editor overflow menu,
   **When** the snapshot is saved,
   **Then** a new version with snapshot_type "manual" is created, and a toast "Version saved" confirms.

3. **Given** the user opens Version History and selects versions v5 and v8,
   **When** the user taps "Compare",
   **Then** the diff viewer shows changes between v5 and v8 with added lines in green and removed lines in red.

4. **Given** the user selects v5 in the version history and taps "Restore",
   **When** the confirmation dialog is accepted,
   **Then** the note's body is replaced with v5's content, a "pre_restore" snapshot is created, and all dependent indexes are rebuilt.

5. **Given** the diff viewer is in unified mode,
   **When** modified lines are displayed,
   **Then** the specific words that changed within those lines are highlighted with a darker shade.

**Edge Cases:**

6. **Given** a note has 200 versions and the user creates a new one,
   **When** the 201st version is saved,
   **Then** the thinning algorithm removes old versions (preserving manual ones) to bring the count back to or below 200.

7. **Given** the user restores a version and realizes it was wrong,
   **When** the user opens version history again,
   **Then** the "pre_restore" snapshot is available, allowing the user to restore back to the content before the restore.

**Negative Tests:**

8. **Given** the storage is full,
   **When** a version snapshot is attempted,
   **Then** a toast "Not enough storage to save version history" is shown.
   **And** the note's current content is not affected.

9. **Given** two versions are identical (no changes between sessions),
   **When** the user compares them,
   **Then** the diff viewer shows "No changes between these versions."

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates initial version | new note, first save | NoteVersion with version_number=1, snapshot_type="initial" |
| increments version number | existing versions: 1, 2, 3 | New version: version_number=4 |
| creates auto snapshot | note opened after >1 hour | NoteVersion with snapshot_type="auto" |
| creates manual snapshot | user triggers "Save Version" | NoteVersion with snapshot_type="manual" |
| thinning removes old auto versions | 200 versions, 50 older than 365 days | Versions thinned to 1 per week for the old group |
| thinning preserves manual versions | 200 versions, 10 manual in the old range | All 10 manual versions preserved |
| Myers diff identical texts | text_a = text_b | Empty diff, summary: "no changes" |
| Myers diff added lines | text_a: "a\nb", text_b: "a\nb\nc" | 1 "added" line: "c" |
| Myers diff removed lines | text_a: "a\nb\nc", text_b: "a\nc" | 1 "removed" line: "b" |
| Myers diff modified lines | text_a: "hello world", text_b: "hello there" | 1 "modified" line with intra-line diff on "world" -> "there" |
| word delta calculation | v_a word_count: 100, v_b word_count: 120 | word_delta: +20 |
| restore creates pre_restore snapshot | restore to v5 | New version with snapshot_type="pre_restore" created before v5 content is applied |
| restore triggers index rebuild | restore to v5 | FTS index, wiki links, task items all updated |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Version created on session start | 1. Edit note, close app, wait 2 hours, re-open note | Auto snapshot created when note is opened |
| Compare two versions | 1. Edit note 3 times with manual snapshots, 2. Open history, 3. Select v1 and v3, 4. Compare | Diff shows all changes from v1 to v3 |
| Restore previous version | 1. Note has 5 versions, 2. Restore to v2 | Note content matches v2, pre_restore snapshot exists as v6 |
| Thinning on 200-version limit | 1. Create note, 2. Trigger 200 manual versions, 3. Create 201st | Thinning reduces count, new version created |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Recover accidentally deleted content | 1. Write 500-word note, 2. Save version manually, 3. Accidentally select-all and delete, 4. Auto-save saves empty note, 5. Open version history, 6. Restore the manual version | Note content restored to the 500-word version; pre-restore snapshot captures the empty state in case needed |
| Review note evolution | 1. Edit note across 5 sessions over a week, 2. Open version history, 3. Compare v1 and latest | Diff shows the cumulative changes with clear add/remove highlighting |

---

### NT-019: Quick Capture

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-019 |
| **Feature Name** | Quick Capture |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a personal note-taker, I want to capture a thought in under 3 seconds without navigating through folders or choosing options, so that I never lose an idea because the app was too slow to open.

**Secondary:**
> As a mobile user, I want a persistent quick-capture shortcut (widget or share sheet extension), so that I can create a note from anywhere on my phone without opening the full app first.

#### 3.3 Detailed Description

Quick Capture provides the fastest possible path from "I have a thought" to "it is saved." The feature is a lightweight input modal that appears instantly, accepts text (and optionally an image from clipboard), saves the note, and dismisses. No folder selection, no tag selection, no formatting. Just type and save.

The Quick Capture modal is triggered from three entry points:
1. **In-app button:** A floating action button (FAB) on the note list screen (bottom-right corner) that, when tapped, opens the quick capture modal instead of the standard "New Note" flow. Long-pressing the FAB opens the standard new note options (blank, from template, daily note).
2. **Widget (mobile):** A home screen widget showing a single text input. Typing in the widget and pressing "Save" creates a new note. The widget is a 2x1 or 4x1 grid size.
3. **Share sheet extension (mobile):** When the user shares text or a URL from another app to MyNotes, the quick capture modal opens pre-filled with the shared content.

The modal is minimal: a full-width text input (multiline, auto-expanding up to 60% of screen height), a "Save" button, and a "Cancel" button. No title field is shown; the title is auto-generated from the first line of the captured text (truncated to 100 characters). If the captured text is a URL, the title is set to "Link: [URL domain]".

Saved quick captures are placed in a configurable "Quick Capture" folder (default: "Inbox"). The folder is auto-created on first use. Quick captures can also be configured in settings to be placed in the current folder or as unfiled notes.

Quick captures are marked with a `is_quick_capture = true` flag so the user can later review, organize, and flesh out their captured notes. A "Quick Captures" filter in the note list shows all notes created via quick capture that have not been moved out of the Inbox folder.

The capture-to-save time target is under 3 seconds for text-only captures (from FAB tap to note saved). The text input auto-focuses on modal open so the user can start typing immediately.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - quick captures create notes edited by the editor
- NT-002: Notebook and Folder Hierarchy - quick captures are placed in a designated folder

**External Dependencies:**
- System share sheet integration for receiving shared content
- Home screen widget API for the widget entry point

**Assumed Capabilities:**
- The app can register as a share sheet target for text and URL content types
- The app can create a home screen widget

#### 3.5 User Interface Requirements

##### Component: Quick Capture Modal

**Layout:**
- Modal overlay with a semi-transparent dark backdrop
- Content card (centered, 90% of screen width, max 600px on desktop):
  - Text input: multiline, auto-expanding, placeholder "Quick note...", auto-focused on open
  - Bottom row: "Cancel" button (left, muted text) and "Save" button (right, accent color, primary)
- No title field, no folder picker, no tag selector, no formatting toolbar

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | Modal just opened | Text input with placeholder, "Save" button disabled |
| Text Entered | User typed something | "Save" button enabled (accent color) |
| Saving | User tapped "Save" | "Save" button shows spinner, input disabled |
| Saved | Note created successfully | Modal dismisses with a brief toast "Note saved" |
| Pre-filled | Opened from share sheet with content | Text input pre-filled with shared content, "Save" enabled |

**Interactions:**
- Type in text input: content captured, "Save" enabled after first character
- Tap "Save": creates note, dismisses modal, shows toast
- Tap "Cancel": dismisses modal without saving (confirmation dialog if text was entered)
- Tap backdrop: same as "Cancel"
- Swipe down on modal: same as "Cancel"

**Transitions/Animations:**
- Modal appears: backdrop fades in 150ms, card slides up from bottom 200ms ease-out
- Modal dismisses: card slides down 200ms ease-in, backdrop fades out 150ms
- Toast: fades in from bottom, 200ms, stays 2 seconds, fades out

##### Component: Quick Capture Widget (Mobile)

**Layout:**
- 2x1 grid size: single-line text input with "Save" button (right)
- 4x1 grid size: multiline text input (2 lines visible) with "Save" button (right)
- App icon and "MyNotes" label at the top of the widget

**Interactions:**
- Tap text input: opens the full quick capture modal in the app (widget input is too constrained for multiline editing)
- Tap "Save" (after typing): saves note directly from widget, text input clears, brief checkmark confirmation

#### 3.6 Data Requirements

##### Entity: Note (additional fields)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| is_quick_capture | boolean | - | false | Whether this note was created via Quick Capture |
| source | string | Nullable, one of: "app", "widget", "share_sheet" | null | How the quick capture was initiated |

**Indexes:**
- (is_quick_capture, folder_id) - for the "Quick Captures" filter (quick captures still in Inbox)

**Validation Rules:**
- Quick captures must have a non-empty body (at least 1 character after trimming)
- Title is auto-generated; user does not provide it during capture

**Example Data:**

```
{
  "id": "n-qc-001",
  "title": "Remember to review the API docs",
  "body": "Remember to review the API docs before the meeting tomorrow. Focus on the authentication flow.",
  "is_quick_capture": true,
  "source": "app",
  "folder_id": "f-inbox",
  "created_at": "2026-03-07T09:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Quick Capture Title Generation

**Purpose:** Auto-generate a title from the captured text.

**Inputs:**
- body: string - the captured text

**Logic:**

```
1. Split body by newlines
2. Take the first line
3. Strip any markdown syntax (headings #, bold **, etc.)
4. Trim whitespace
5. IF length > 100 characters, truncate to 100 and append "..."
6. IF the first line is a URL (starts with http:// or https://):
   a. Extract the domain from the URL
   b. Set title = "Link: [domain]"
7. IF the first line is empty (body starts with a newline):
   a. Set title = "Quick Note"
8. RETURN title
```

**Edge Cases:**
- Body is a single word: title is that word
- Body starts with a heading (`# Title`): title is "Title" (heading syntax stripped)
- Body is only whitespace: validation should have rejected this; if it reaches here, title = "Quick Note"

##### Quick Capture Save

**Purpose:** Create a note from quick capture input with minimal processing.

**Inputs:**
- body: string - the captured text
- source: string - "app", "widget", or "share_sheet"

**Logic:**

```
1. Validate body: must be non-empty after trimming
2. Generate title using Quick Capture Title Generation
3. Look up or create the Inbox folder (configurable in settings)
4. Create Note record:
   - title = generated title
   - body = body
   - body_plain = strip_markdown(body)
   - word_count = count_words(body)
   - character_count = count_chars(body)
   - is_quick_capture = true
   - source = source
   - folder_id = inbox folder id
5. Update FTS index
6. Extract any wiki links from body
7. Extract any task items from body
8. RETURN { note_id, title }
```

**Edge Cases:**
- Body contains [[wiki links]]: they are extracted and NoteLink records created
- Body contains task items: they are extracted and counts set
- Inbox folder was deleted: auto-recreated silently

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Empty text submitted | "Save" button remains disabled; no action | User enters text |
| Save fails (storage error) | Toast: "Could not save note. Please try again." | Text input retains content; user taps "Save" again |
| Inbox folder missing | Folder auto-recreated silently | No user action needed |
| Share sheet receives unsupported content type | Toast: "Cannot capture this content type." | User copies text manually and uses in-app capture |
| Widget save fails | Widget shows error icon briefly, text retained | User retries or opens the app |

**Validation Timing:**
- Body emptiness check: continuous (Save button enable/disable)
- Save operation: on "Save" tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user taps the FAB on the note list,
   **When** the quick capture modal opens,
   **Then** the text input is focused and the keyboard appears, ready for typing, within 500ms.

2. **Given** the user types "Buy milk and eggs" and taps "Save",
   **When** the note is saved,
   **Then** a note titled "Buy milk and eggs" is created in the Inbox folder, the modal dismisses, and a "Note saved" toast appears. Total time from FAB tap to saved toast is under 3 seconds.

3. **Given** the user shares a URL from a browser to MyNotes via the share sheet,
   **When** the quick capture modal opens,
   **Then** the text input is pre-filled with the URL, the title will be "Link: [domain]", and the user can add notes before saving.

4. **Given** the user types 5 lines of text starting with "# Project Ideas",
   **When** the note is saved,
   **Then** the auto-generated title is "Project Ideas" (heading syntax stripped).

**Edge Cases:**

5. **Given** the user's Inbox folder was deleted,
   **When** a quick capture is saved,
   **Then** the Inbox folder is auto-recreated and the note is placed in it.

6. **Given** the user types a 200-character first line,
   **When** the title is generated,
   **Then** the title is the first 100 characters followed by "...".

**Negative Tests:**

7. **Given** the quick capture text input is empty,
   **When** the user looks at the "Save" button,
   **Then** the button is disabled and non-interactive.

8. **Given** the user taps "Cancel" after typing 3 words,
   **When** the cancel is processed,
   **Then** a confirmation dialog "Discard note?" with "Discard" and "Keep Editing" buttons is shown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates title from first line | body: "Hello world\nmore text" | title: "Hello world" |
| strips heading syntax from title | body: "# My Title\nContent" | title: "My Title" |
| truncates title at 100 chars | body: (150-char first line) | title: (100 chars) + "..." |
| generates URL title | body: "https://example.com/path" | title: "Link: example.com" |
| generates default title for empty first line | body: "\nContent starts here" | title: "Quick Note" |
| rejects empty body | body: "   " | Validation error |
| rejects whitespace-only body | body: "\n\n\n" | Validation error |
| sets is_quick_capture flag | any valid body | Note.is_quick_capture = true |
| sets correct source | source: "share_sheet" | Note.source = "share_sheet" |
| creates inbox folder if missing | no folder named "Inbox" exists | Folder created, note placed in it |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Quick capture from FAB | 1. Tap FAB, 2. Type "Meeting at 3pm", 3. Tap Save | Note "Meeting at 3pm" created in Inbox folder; toast shown |
| Quick capture from share sheet | 1. Share text from browser, 2. Modal opens pre-filled, 3. Add comment, 4. Save | Note created with shared text + comment; source = "share_sheet" |
| Quick capture with wiki link | 1. Type "Discuss [[Project Alpha]]", 2. Save | Note created, NoteLink to "Project Alpha" extracted |
| Cancel with confirmation | 1. Open capture, 2. Type text, 3. Tap Cancel | Confirmation dialog appears; "Discard" removes text, "Keep Editing" returns to input |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Rapid thought capture | 1. User is on home screen, 2. Taps widget, 3. Types "idea for blog post", 4. Saves | Note created in Inbox in under 3 seconds total; appears in note list with quick capture indicator |
| Review and organize captures | 1. Capture 10 notes over a day, 2. Open "Quick Captures" filter in note list, 3. Move 5 to "Work" folder | 5 notes in "Work" folder, 5 remaining in Inbox; the moved notes no longer show in Quick Captures filter |

---

### NT-020: Note Sorting and Filtering

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-020 |
| **Feature Name** | Note Sorting and Filtering |
| **Priority** | P1 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a user with 500+ notes, I want to sort my note list by different criteria (date modified, date created, title, word count), so that I can find notes based on different access patterns.

**Secondary:**
> As a knowledge worker, I want to filter my note list by multiple criteria simultaneously (folder, tags, date range, has tasks), so that I can narrow down to exactly the notes I need.

#### 3.3 Detailed Description

Note Sorting and Filtering provides a comprehensive set of controls for organizing the note list display. The feature adds a sort/filter toolbar to the note list screen that persists the user's sort and filter preferences across sessions.

**Sort options** (single sort at a time, with secondary tiebreaker):

| Sort Option | Primary | Tiebreaker | Direction |
|-------------|---------|------------|-----------|
| Last Modified | updated_at | created_at | Desc (newest first) |
| Date Created | created_at | title | Desc (newest first) |
| Title (A-Z) | title | updated_at | Asc (alphabetical) |
| Title (Z-A) | title | updated_at | Desc (reverse alpha) |
| Word Count | word_count | updated_at | Desc (longest first) |
| Word Count (Ascending) | word_count | updated_at | Asc (shortest first) |

The default sort is "Last Modified" (descending). The selected sort persists in local settings and is applied globally across all folder views. Pinned notes (NT-005) always appear above sorted notes regardless of sort order.

**Filter options** (multiple filters can be combined with AND logic):

| Filter | Type | Options |
|--------|------|---------|
| Folder | Select | Any folder from the hierarchy, or "All Folders", or "Unfiled" |
| Tags | Multi-select | Any combination of tags (intersection or union, per NT-004) |
| Date Range | Preset or custom | Today, Last 7 Days, Last 30 Days, Last 90 Days, This Year, Custom Range |
| Has Tasks | Toggle | Show only notes with 1+ task items |
| Has Incomplete Tasks | Toggle | Show only notes with unchecked task items |
| Has Images | Toggle | Show only notes with embedded images |
| Has Backlinks | Toggle | Show only notes with incoming wiki links |
| Quick Capture | Toggle | Show only notes created via Quick Capture |
| Word Count Range | Range slider | Minimum and maximum word count (0 to 100,000) |

Active filters are displayed as removable chips below the sort/filter toolbar. Each chip shows the filter name and value (e.g., "Tag: work", "Modified: Last 7 Days"). Tapping the "x" on a chip removes that filter. A "Clear All" button appears when any filter is active.

The result count is displayed at the top of the note list: "Showing N of M notes" (where M is total notes and N is the filtered count). When filters reduce the list to zero notes, an empty state shows "No notes match your filters" with a "Clear Filters" button.

**Saved filter presets:** Users can save a combination of sort and filter settings as a named preset. Presets are accessible from a dropdown in the sort/filter toolbar. Examples: "Work Tasks" (folder: Work, has incomplete tasks: true), "Recent Long Notes" (date: Last 7 Days, word count: >500). Users can create up to 20 presets.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - notes must exist to sort and filter
- NT-002: Notebook and Folder Hierarchy - folder filter depends on the folder system
- NT-004: Tag System - tag filter depends on the tag system

**External Dependencies:**
- Local persistent storage for sort/filter preferences and saved presets

**Assumed Capabilities:**
- The note list query supports dynamic ORDER BY and WHERE clauses
- The UI framework supports toolbar, chip, and dropdown components

#### 3.5 User Interface Requirements

##### Component: Sort/Filter Toolbar

**Layout:**
- Fixed bar above the note list, below the navigation bar
- Left section: sort button showing current sort (e.g., "Modified" with down-arrow icon). Tapping opens sort options dropdown
- Center section: filter button ("Filters" with a badge showing active filter count). Tapping opens filter sheet
- Right section: preset dropdown (bookmark icon). Tapping shows saved presets
- Below the toolbar: a horizontal row of filter chips for active filters (scrollable if >3 chips). Each chip has text + "x" dismiss button. A "Clear All" link appears at the end

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | No filters active, default sort | Sort shows "Modified", filter badge shows 0, no chips |
| Filters Active | 1+ filters applied | Filter badge shows count, chips visible below toolbar |
| No Results | Filters reduce list to 0 | Note list shows "No notes match your filters" with "Clear Filters" button |
| Preset Selected | User chose a saved preset | All sort/filter settings apply, preset name shown in dropdown |

**Interactions:**
- Tap sort button: opens dropdown with 6 sort options. Selected option has a checkmark
- Tap filter button: opens filter sheet (bottom sheet on mobile, dropdown panel on desktop)
- Tap filter chip "x": removes that specific filter
- Tap "Clear All": removes all active filters
- Tap preset button: dropdown of saved presets + "Save Current as Preset" option
- Tap "Save Current as Preset": name input dialog, then preset saved

##### Sheet: Filter Options

**Layout:**
- Bottom sheet (mobile) or dropdown panel (desktop)
- Sections:
  - **Folder:** dropdown selector with all folders + "All Folders" + "Unfiled"
  - **Tags:** multi-select tag picker (reuses tag browser from NT-004, compact mode)
  - **Date Range:** preset buttons (Today, 7d, 30d, 90d, Year) + "Custom" button that opens a date range picker
  - **Content Toggles:** row of toggle switches for "Has Tasks", "Has Incomplete Tasks", "Has Images", "Has Backlinks", "Quick Captures"
  - **Word Count:** range slider with two handles (min and max), labels showing current range
- Bottom buttons: "Apply" (primary) and "Reset" (secondary)

**Interactions:**
- Adjust any filter option: changes are previewed in the result count at the top ("N notes match")
- Tap "Apply": applies all filter selections, closes the sheet, updates the note list
- Tap "Reset": resets all filters to defaults (no filters)

#### 3.6 Data Requirements

##### Entity: FilterPreset

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique preset identifier |
| name | string | Required, max 50 chars, trimmed | None | User-given name for the preset |
| sort_field | string | One of: updated_at, created_at, title, word_count | "updated_at" | Sort column |
| sort_direction | string | One of: "asc", "desc" | "desc" | Sort direction |
| filters | JSON | Valid JSON object | {} | Serialized filter state (folder_id, tag_ids, date_range, toggles, word_count_range) |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | When the preset was created |

**Indexes:**
- name - for uniqueness check

**Validation Rules:**
- name: must not be empty after trimming
- name: must be unique across presets (case-insensitive)
- Maximum 20 presets per user
- filters JSON must conform to the expected schema

**Example Data:**

```
{
  "id": "fp-001",
  "name": "Work Tasks",
  "sort_field": "updated_at",
  "sort_direction": "desc",
  "filters": {
    "folder_id": "f-work",
    "tag_ids": [],
    "date_range": null,
    "has_tasks": false,
    "has_incomplete_tasks": true,
    "has_images": false,
    "has_backlinks": false,
    "is_quick_capture": false,
    "word_count_min": null,
    "word_count_max": null
  },
  "created_at": "2026-03-05T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Note List Query Builder

**Purpose:** Construct a database query from the active sort and filter settings.

**Inputs:**
- sort_field: string
- sort_direction: string
- filters: object with all filter fields

**Logic:**

```
1. Start with base query: SELECT * FROM Note
2. Apply WHERE clauses for each active filter:
   a. IF filters.folder_id is set:
      - Add WHERE folder_id = filters.folder_id
      - Special case "unfiled": WHERE folder_id IS NULL
   b. IF filters.tag_ids is non-empty:
      - Join NoteTag table
      - IF intersection mode: WHERE note_id IN (SELECT note_id FROM NoteTag WHERE tag_id IN [...] GROUP BY note_id HAVING COUNT(DISTINCT tag_id) = tag_count)
      - IF union mode: WHERE note_id IN (SELECT note_id FROM NoteTag WHERE tag_id IN [...])
   c. IF filters.date_range is set:
      - Calculate start_date based on preset (today, today-7, today-30, today-90, year-start) or custom
      - Add WHERE updated_at >= start_date
      - IF custom range has end_date: AND updated_at <= end_date
   d. IF filters.has_tasks is true: AND task_total > 0
   e. IF filters.has_incomplete_tasks is true: AND task_total > task_checked
   f. IF filters.has_images is true: AND id IN (SELECT note_id FROM Attachment WHERE is_image = true)
   g. IF filters.has_backlinks is true: AND id IN (SELECT target_note_id FROM NoteLink WHERE is_resolved = true)
   h. IF filters.is_quick_capture is true: AND is_quick_capture = true
   i. IF filters.word_count_min is set: AND word_count >= filters.word_count_min
   j. IF filters.word_count_max is set: AND word_count <= filters.word_count_max
3. Apply ORDER BY:
   - Pinned notes first: ORDER BY is_pinned DESC, pinned_at DESC
   - Then by sort_field in sort_direction
   - Then by tiebreaker (see sort options table)
4. RETURN query
```

**Edge Cases:**
- No filters active: returns all notes sorted by the selected sort
- All filters active simultaneously: AND logic combines all conditions
- Filter combination returns zero results: valid, displays empty state
- Sort by title: uses case-insensitive collation

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Query execution fails | Toast: "Could not load notes. Please try again." | User retries; filter state preserved |
| Preset save fails | Toast: "Could not save preset. Please try again." | User retries |
| Preset name already exists | Inline validation: "A preset with this name already exists" | User chooses a different name |
| Maximum 20 presets reached | Toast: "Maximum of 20 filter presets. Delete one to create a new one." | User deletes an existing preset |
| Filter references deleted folder or tag | Filter chip shows "[Deleted]" label; results exclude that filter | User removes the stale filter chip |

**Validation Timing:**
- Sort and filter changes are applied immediately (live preview of count)
- Preset name validation: on save attempt
- Stale filter check: on note list load

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 200 notes and taps the sort button,
   **When** the user selects "Title (A-Z)",
   **Then** the note list reorders alphabetically by title, with pinned notes remaining at the top.

2. **Given** the user applies a "Last 7 Days" date filter,
   **When** the filter is applied,
   **Then** the note list shows only notes with updated_at within the last 7 days, a "Modified: Last 7 Days" chip appears, and the count shows "Showing N of 200 notes".

3. **Given** the user applies tag filter "work" AND "Has Incomplete Tasks" toggle,
   **When** both filters are active,
   **Then** the note list shows only notes tagged "work" that have unchecked task items.

4. **Given** the user saves the current filter configuration as "Work Tasks",
   **When** the preset is saved,
   **Then** "Work Tasks" appears in the preset dropdown and can be applied with one tap.

5. **Given** the user selects the "Work Tasks" preset from the dropdown,
   **When** the preset is loaded,
   **Then** all saved sort and filter settings are applied immediately.

**Edge Cases:**

6. **Given** the user applies filters that match zero notes,
   **When** the note list updates,
   **Then** the list shows "No notes match your filters" with a "Clear Filters" button.

7. **Given** a filter references a tag that was deleted,
   **When** the note list loads,
   **Then** the filter chip shows "[Deleted]" and the filter is effectively ignored.

**Negative Tests:**

8. **Given** the user has 20 saved presets,
   **When** the user tries to save a 21st,
   **Then** a toast "Maximum of 20 filter presets. Delete one to create a new one." is displayed.
   **And** no preset is saved.

9. **Given** the user applies a word count filter of min 500, max 100,
   **When** the range is validated,
   **Then** the maximum auto-adjusts to 500 (minimum cannot exceed maximum).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| sorts by updated_at desc | 3 notes with different dates | Order: most recent first |
| sorts by title asc | notes: "Beta", "Alpha", "Gamma" | Order: Alpha, Beta, Gamma |
| sorts by word_count desc | notes: 100, 500, 200 words | Order: 500, 200, 100 |
| pinned notes always first | 2 pinned, 3 unpinned, sort by title | Pinned first (sorted), then unpinned (sorted) |
| filters by folder_id | 5 notes, 3 in folder A | Returns 3 notes |
| filters by unfiled | 5 notes, 2 unfiled | Returns 2 notes |
| filters by date range 7 days | 10 notes, 3 updated in last 7 days | Returns 3 notes |
| filters by has_tasks | 10 notes, 4 with tasks | Returns 4 notes |
| filters by has_incomplete_tasks | 10 notes, 2 with unchecked tasks | Returns 2 notes |
| combines AND filters | folder "work" (5 notes) + has_tasks (3 of those 5) | Returns 3 notes |
| empty result set | filters match zero notes | Empty array, no error |
| word count range filter | min 100, max 500 | Returns notes with 100 <= word_count <= 500 |
| preset saves correctly | name: "My Filter", sort + 3 filters | FilterPreset record created with serialized filters |
| preset name uniqueness | existing: "Alpha", new: "alpha" | Validation error |
| rejects >20 presets | 20 existing presets | Error: "Maximum of 20 filter presets" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Sort by title and verify order | 1. Create notes "C", "A", "B", 2. Select "Title (A-Z)" sort | List shows A, B, C |
| Apply multiple filters | 1. Create 10 notes with various tags and dates, 2. Filter by tag + date range | Only matching notes shown; count accurate |
| Save and load preset | 1. Set sort and 2 filters, 2. Save as "My Preset", 3. Clear all, 4. Load "My Preset" | Sort and filters restored exactly |
| Remove individual filter chip | 1. Apply 3 filters (3 chips), 2. Tap "x" on middle chip | Middle filter removed, other 2 still active, list updates |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Find long notes with open tasks | 1. User has 300 notes, 2. Apply: word count > 500, has incomplete tasks, sort by word count desc | List shows the longest notes with open tasks at the top; user finds the one they are looking for |

---

### NT-021: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-021 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user, I want to customize MyNotes' behavior and appearance to suit my workflow, so that the app adapts to how I work rather than forcing me to adapt to it.

**Secondary:**
> As a power user, I want to access data management tools (rebuild search index, clear cache, delete all data) from settings, so that I can maintain and troubleshoot the app without external tools.

#### 3.3 Detailed Description

Settings and Preferences is the centralized configuration screen for MyNotes. It provides controls for editor behavior, appearance, data management, and account-level actions. All settings are stored locally and persist across app sessions.

The settings screen is organized into the following sections:

**1. Editor**
- Default editor mode: "Edit Only", "Preview Only", "Side-by-Side", "Auto" (responsive)
- Font size: slider from 12px to 24px (default 14px, step 1px)
- Font family: "System Default", "Monospace" (default), "Serif", "Sans-Serif"
- Line height: slider from 1.2 to 2.0 (default 1.6, step 0.1)
- Auto-save delay: slider from 1 to 10 seconds (default 2)
- Show line numbers in code blocks: toggle (default on)
- Code block font size: slider from 10px to 20px (default 13px mobile, 14px desktop)
- Spell check: toggle (default on)

**2. Notes**
- Default folder for new notes: dropdown (All Folders, or specific folder)
- Quick Capture folder: dropdown (default "Inbox")
- Daily note template: dropdown (list of available templates)
- Daily note title format: dropdown (YYYY-MM-DD - Day, Month DD YYYY, DD/MM/YYYY, Custom)
- Wiki link suggestions: toggle (default on) - show suggestion popup when typing [[
- Backlinks panel mode: "Inline", "Sidebar" (desktop only), "Hidden"
- Table of Contents: toggle (default on) - show TOC for notes with 2+ headings

**3. Appearance**
- Theme: "Dark" (default), "Light", "System" (follows OS setting)
- Accent color: color picker from 8 preset options
- Note list preview lines: stepper 1-3 (default 2)
- Show word count in note list: toggle (default off)
- Show checklist progress in note list: toggle (default on)

**4. Data**
- Export All Notes: button (triggers bulk export, NT-012)
- Import Notes: button (opens import flow, NT-013)
- Rebuild Search Index: button with explanation text "Rebuilds the full-text search index for all notes. May take a few seconds for large collections."
- Clear Version History: button with confirmation dialog "Delete all version snapshots? Current note content is not affected."
- Attachment Storage: read-only display showing total attachment size (e.g., "Attachment Storage: 145.2 MB")
- Delete All Data: button (destructive, red) with two-step confirmation "This permanently deletes all notes, folders, tags, templates, and attachments. This cannot be undone."

**5. About**
- App version and build number
- Module version
- Open Source Licenses: link to licenses screen
- Privacy Policy: link (in-app text)
- "Made with care for privacy" tagline

Each setting change takes effect immediately (no "Save" button). Settings that affect rendering (font size, theme, editor mode) apply a smooth transition when changed.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (settings is a foundational screen, though it references features from NT-001 through NT-019)

**External Dependencies:**
- Local persistent storage for settings values

**Assumed Capabilities:**
- The app supports theming (dark/light mode switching)
- Platform-specific font rendering for font family options

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Scrollable vertical list organized into sections with section headers
- Each section header is bold text with a subtle top border separator
- Each setting row shows: setting label (left), current value or control (right)
- Controls include: dropdowns, toggles, sliders, steppers, and buttons
- Destructive buttons (Delete All Data) are in red text

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | Settings loaded from storage | All controls reflect saved values |
| Modified | User changed a setting | Change takes effect immediately; no unsaved indicator |
| Rebuilding Index | "Rebuild Search Index" tapped | Spinner next to the button, text "Rebuilding..." |
| Deleting Data | "Delete All Data" confirmed | Progress spinner, "Deleting..." text, all other controls disabled |

**Interactions:**
- Toggle switch: taps to toggle on/off, changes apply immediately
- Slider: drag to adjust value, live preview (e.g., font size changes in real time)
- Dropdown: tap to open options list, select an option
- Button (non-destructive): tap to execute action
- Button (destructive): tap shows confirmation dialog (two-step for Delete All Data)
- Tap section header: no action (purely decorative)

**Transitions/Animations:**
- Theme change: 300ms cross-fade between dark and light themes
- Font size change: text size animates to new value, 200ms
- Toggle: standard iOS/Android toggle animation

#### 3.6 Data Requirements

##### Entity: UserSettings

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, always "settings" (singleton) | "settings" | Single settings record |
| editor_mode | string | One of: "edit_only", "preview_only", "side_by_side", "auto" | "auto" | Default editor layout mode |
| font_size | integer | Min: 12, Max: 24 | 14 | Editor body font size in pixels |
| font_family | string | One of: "system", "monospace", "serif", "sans-serif" | "monospace" | Editor font family |
| line_height | float | Min: 1.2, Max: 2.0, step: 0.1 | 1.6 | Editor line height multiplier |
| auto_save_delay | integer | Min: 1, Max: 10 | 2 | Auto-save debounce in seconds |
| show_code_line_numbers | boolean | - | true | Show line numbers in code blocks |
| code_font_size | integer | Min: 10, Max: 20 | 13 | Code block font size (mobile default) |
| spell_check | boolean | - | true | Enable spell checking |
| default_folder_id | string | Nullable, references Folder.id | null | Default folder for new notes (null = All Folders) |
| quick_capture_folder_id | string | Nullable, references Folder.id | null | Folder for quick captures (null = auto-created "Inbox") |
| daily_template_id | string | Nullable, references Template.id | null | Template for daily notes (null = built-in "Daily Standup") |
| daily_title_format | string | One of: "YYYY-MM-DD - Day", "Month DD, YYYY", "DD/MM/YYYY", "custom" | "YYYY-MM-DD - Day" | Daily note title format |
| daily_title_custom | string | Nullable, max 100 chars | null | Custom format string (when daily_title_format = "custom") |
| wiki_link_suggestions | boolean | - | true | Show popup on [[ typing |
| backlinks_panel_mode | string | One of: "inline", "sidebar", "hidden" | "inline" | Backlinks panel display mode |
| show_toc | boolean | - | true | Show table of contents for notes with 2+ headings |
| theme | string | One of: "dark", "light", "system" | "dark" | App theme |
| accent_color | string | One of 8 preset hex values | "#89B4FA" (blue) | Accent color |
| note_list_preview_lines | integer | Min: 1, Max: 3 | 2 | Number of preview text lines in note list rows |
| show_word_count_in_list | boolean | - | false | Show word count in note list rows |
| show_checklist_progress | boolean | - | true | Show checklist progress bar in note list rows |
| updated_at | datetime | ISO 8601, auto-set | Current timestamp | Last settings modification time |

**Accent Color Presets:**

| Name | Hex |
|------|-----|
| Blue (default) | #89B4FA |
| Teal | #94E2D5 |
| Green | #A6E3A1 |
| Yellow | #F9E2AF |
| Orange | #FAB387 |
| Red | #F38BA8 |
| Purple | #CBA6F7 |
| Pink | #F5C2E7 |

**Validation Rules:**
- Only one UserSettings record exists (singleton)
- All fields have safe defaults so the app functions even if the record is missing or corrupted
- If a referenced folder_id or template_id no longer exists, the setting falls back to the default behavior

**Example Data:**

```
{
  "id": "settings",
  "editor_mode": "auto",
  "font_size": 16,
  "font_family": "monospace",
  "line_height": 1.6,
  "auto_save_delay": 2,
  "show_code_line_numbers": true,
  "code_font_size": 14,
  "spell_check": true,
  "default_folder_id": null,
  "quick_capture_folder_id": "f-inbox",
  "daily_template_id": null,
  "daily_title_format": "YYYY-MM-DD - Day",
  "wiki_link_suggestions": true,
  "backlinks_panel_mode": "inline",
  "show_toc": true,
  "theme": "dark",
  "accent_color": "#89B4FA",
  "note_list_preview_lines": 2,
  "show_word_count_in_list": false,
  "show_checklist_progress": true,
  "updated_at": "2026-03-07T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Settings Initialization

**Purpose:** Ensure the settings record exists with valid defaults on app launch.

**Inputs:**
- None

**Logic:**

```
1. Query for UserSettings record with id = "settings"
2. IF not found:
   a. Create a new UserSettings record with all default values
3. IF found:
   a. Validate each field against its constraints
   b. IF any field is invalid or missing, reset it to its default value
   c. IF referenced folder_id does not exist, set to null
   d. IF referenced template_id does not exist, set to null
4. RETURN the validated settings record
```

##### Settings Change Application

**Purpose:** Apply a settings change immediately and persist it.

**Inputs:**
- field: string - the setting being changed
- value: any - the new value

**Logic:**

```
1. Validate value against the field's constraints
2. IF invalid, RETURN validation error
3. Update the UserSettings record: set field = value, updated_at = now()
4. Notify all active screens of the change (settings are reactive)
5. RETURN success
```

**Edge Cases:**
- Changing theme: triggers a full app re-render with the new theme
- Changing font_size: the editor re-renders text at the new size
- Changing auto_save_delay: the debounce timer adjusts immediately for the currently open editor
- Changing default_folder_id to a folder that is deleted later: falls back to null (All Folders)

##### Delete All Data

**Purpose:** Permanently erase all user data from the module.

**Inputs:**
- confirmation: boolean - user has confirmed twice

**Logic:**

```
1. IF confirmation is false, RETURN (do nothing)
2. Delete all records from: Note, Folder, Tag, NoteTag, NoteLink, Template (non-builtin), Attachment, NoteVersion, TaskItem, FilterPreset
3. Delete all attachment files from the file system
4. Reset FTS5 search index (drop and recreate)
5. Reset UserSettings to default values (preserve the record)
6. Recreate built-in templates
7. RETURN { tables_cleared: N, files_deleted: M, storage_freed: bytes }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Settings record missing | Settings initialized with defaults on app launch | No user action needed |
| Settings field has invalid value | Field reset to default; no notification to user | No action needed |
| Rebuild search index fails | Toast: "Could not rebuild search index. Please try again." | User retries |
| Delete all data fails mid-operation | Toast: "Could not delete all data. Some data may remain." | User retries; partial deletions are acceptable since the goal is full deletion |
| Theme change causes rendering glitch | Brief flash during cross-fade (acceptable) | No action needed |
| Referenced folder/template deleted | Setting falls back to default behavior | No explicit notification; setting shows "Default" |

**Validation Timing:**
- Setting values validated on change (immediate)
- Referenced entity existence checked on settings load
- Delete All Data confirmation required twice before execution

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens Settings and changes the font size from 14px to 18px,
   **When** the slider is released,
   **Then** the editor font size updates immediately (next time a note is opened), the settings record persists the new value.

2. **Given** the user changes the theme from "Dark" to "Light",
   **When** the theme toggles,
   **Then** the entire app transitions to the light theme with a 300ms cross-fade.

3. **Given** the user taps "Rebuild Search Index" with 500 notes,
   **When** the rebuild runs,
   **Then** a spinner shows for up to 5 seconds, then a toast "Search index rebuilt" confirms.

4. **Given** the user taps "Delete All Data" and confirms twice,
   **When** the deletion completes,
   **Then** all notes, folders, tags, templates (except built-in), attachments, and versions are deleted. The app returns to the empty state with default settings.

5. **Given** the user sets "Backlinks panel mode" to "Sidebar",
   **When** a note with backlinks is opened on desktop,
   **Then** backlinks appear in the right sidebar instead of inline below the note.

**Edge Cases:**

6. **Given** the settings record is somehow deleted or corrupted,
   **When** the app launches,
   **Then** a new settings record is created with all default values and the app functions normally.

7. **Given** the user set a default folder that is later deleted,
   **When** the user creates a new note,
   **Then** the default folder falls back to "All Folders" (no error shown).

**Negative Tests:**

8. **Given** the user drags the font size slider below 12px,
   **When** the slider reaches the minimum,
   **Then** the value stays at 12px (cannot go lower).

9. **Given** the user taps "Delete All Data" and taps "Cancel" on the first confirmation,
   **When** the dialog closes,
   **Then** no data is deleted.
   **And** the settings screen remains unchanged.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| initializes settings with defaults | no existing record | Record created with all default values |
| validates font_size range | value: 25 (exceeds max 24) | Rejects, returns validation error |
| validates font_size minimum | value: 10 (below min 12) | Rejects, returns validation error |
| validates editor_mode enum | value: "split" (invalid) | Rejects, returns validation error |
| accepts valid theme | value: "light" | Accepts, updates record |
| resets invalid field to default | font_size: -1 in stored record | Resets to 14 |
| falls back when folder deleted | default_folder_id references non-existent folder | Resets to null |
| delete all data clears all tables | 50 notes, 20 tags, 5 folders | All records deleted, 0 remaining |
| delete all data preserves built-in templates | 8 built-in + 3 custom templates | 3 custom deleted, 8 built-in remain |
| delete all data resets settings | theme was "light" | theme reset to "dark" (default) |
| delete all data frees file storage | 100 MB of attachments | All attachment files deleted |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Change theme and verify | 1. Open settings, 2. Change theme to "Light", 3. Navigate to note list | Note list renders in light theme |
| Change font size and verify in editor | 1. Set font_size to 18, 2. Open a note | Editor text is 18px |
| Rebuild search index | 1. Create 100 notes, 2. Rebuild index | Search still works correctly for all 100 notes |
| Delete all data and verify clean state | 1. Create 50 notes with tags, 2. Delete all data, 3. Open note list | Empty state shown, 0 notes, default settings |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Customize workspace | 1. Open settings, 2. Set theme to light, font size 16, serif font, line height 1.8, 3. Open a note | Note editor uses serif font at 16px with 1.8 line height in light theme |
| Full data wipe | 1. Use app for a week (200 notes), 2. Export all (backup), 3. Delete all data | App is empty; backup ZIP exists with all data |

---

### NT-022: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-022 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a new user opening MyNotes for the first time, I want a brief introduction that shows me the key features (markdown editor, folders, tags, wiki links), so that I can start using the app productively within 2 minutes.

**Secondary:**
> As a user who has existing notes in another app, I want the onboarding to offer an import option, so that I can migrate my data immediately rather than starting from scratch.

#### 3.3 Detailed Description

Onboarding and First-Run provides a 4-screen welcome flow that appears the first time the user opens the MyNotes module. The flow introduces the core concepts, offers quick setup options, and creates sample content to give the user something to explore immediately.

**Screen 1: Welcome**
- Title: "Welcome to MyNotes"
- Subtitle: "Plain markdown notes, no lock-in"
- Three bullet points: "Private and offline", "Markdown with live preview", "Wiki links and backlinks"
- "Get Started" button

**Screen 2: Choose Your Setup**
- Title: "How do you want to start?"
- Three options:
  - "Start Fresh" - creates a sample note and sample folder
  - "Import Notes" - opens the import flow (NT-013)
  - "Explore Empty" - opens the app with no data
- Default selection: "Start Fresh"

**Screen 3: Feature Highlights (interactive)**
- Title: "Key Features"
- Horizontal page carousel with 4 feature cards:
  - Card 1: "Markdown Editor" - shows a mini editor mock-up with formatted text
  - Card 2: "Folders and Tags" - shows folder tree and tag chips
  - Card 3: "[[Wiki Links]]" - shows how to link notes with [[ ]]
  - Card 4: "Full-Text Search" - shows search bar with results
- Dots indicator for carousel position
- "Skip" button (top-right) and "Next" / "Done" button (bottom)

**Screen 4: Quick Settings (optional)**
- Title: "Make it yours"
- Three quick settings with toggles/dropdowns:
  - Theme: Dark / Light / System
  - Editor mode: Edit Only / Side-by-Side / Auto
  - Daily notes: Enable / Disable
- "Finish" button

The onboarding flow is shown only once. A `has_completed_onboarding` flag is stored in settings. Users can replay the onboarding from Settings > About > "Show Onboarding Again".

If the user selects "Start Fresh", the following sample content is created:
- Folder: "Getting Started"
- Note 1: "Welcome to MyNotes" (in "Getting Started" folder) - covers basic markdown syntax with examples
- Note 2: "Linking Notes Together" (in "Getting Started" folder) - demonstrates [[wiki links]] with a link to Note 1
- Tags: "tutorial", "getting-started"

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - sample notes are opened in the editor
- NT-002: Notebook and Folder Hierarchy - sample folder is created

**External Dependencies:**
- None

**Assumed Capabilities:**
- The app can detect first-run state
- The settings system supports the onboarding flag

#### 3.5 User Interface Requirements

##### Screen: Onboarding Flow (4 Screens)

**Layout:**
- Full-screen modal over the main app
- Each screen has a centered content card with title, body, and action buttons
- Page indicator dots at the bottom show progress through the 4 screens
- Swipe left/right to navigate between screens
- Screen 3 (feature highlights) has a nested horizontal carousel within the screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Screen 1 | First screen | Welcome message with "Get Started" button |
| Screen 2 | Setup choice | Three radio-style option cards |
| Screen 3 | Feature tour | Interactive feature carousel |
| Screen 4 | Quick settings | Three setting controls and "Finish" button |
| Complete | User tapped "Finish" | Onboarding dismisses, app shows the note list (with sample content if "Start Fresh" was chosen) |
| Skipped | User tapped "Skip" on any screen | Onboarding dismisses immediately, no sample content created |

**Interactions:**
- Swipe left/right: navigate between onboarding screens
- Tap "Get Started" (screen 1): advances to screen 2
- Tap setup option (screen 2): selects the option, advances to screen 3 (or opens import flow)
- Tap carousel card dot or swipe (screen 3): navigates feature highlights
- Tap "Skip" (any screen): dismisses onboarding, creates no sample content
- Tap "Finish" (screen 4): applies quick settings, creates sample content (if "Start Fresh"), dismisses onboarding

**Transitions/Animations:**
- Screen transitions: horizontal slide, 300ms ease-in-out
- Feature carousel: horizontal page-snap scroll
- Screen 4 "Finish": onboarding fades out, 300ms

#### 3.6 Data Requirements

##### Entity: UserSettings (additional field)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| has_completed_onboarding | boolean | - | false | Whether the user has completed or skipped the onboarding flow |

**Validation Rules:**
- Onboarding is shown only when has_completed_onboarding = false
- After completion or skip, has_completed_onboarding is set to true

#### 3.7 Business Logic Rules

##### Sample Content Creation

**Purpose:** Create starter content when the user selects "Start Fresh."

**Inputs:**
- None (content is predefined)

**Logic:**

```
1. Create folder "Getting Started"
2. Create tag "tutorial"
3. Create tag "getting-started"
4. Create note "Welcome to MyNotes":
   - folder: "Getting Started"
   - tags: ["tutorial", "getting-started"]
   - body: Predefined markdown covering: headings, bold, italic, lists, code blocks, task lists, and a [[Linking Notes Together]] wiki link
5. Create note "Linking Notes Together":
   - folder: "Getting Started"
   - tags: ["tutorial"]
   - body: Predefined markdown explaining wiki links with a [[Welcome to MyNotes]] backlink
6. Extract wiki links and create NoteLink records for both notes
7. Update FTS index for both notes
8. Set has_completed_onboarding = true
9. RETURN { notes_created: 2, folder_created: 1, tags_created: 2 }
```

**Edge Cases:**
- Folder "Getting Started" already exists (e.g., import happened before onboarding): use the existing folder
- Note title "Welcome to MyNotes" already exists (import): append " (sample)" to the title
- User skips onboarding then re-runs from settings: "Start Fresh" creates sample content again (idempotent check on titles prevents duplicates)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Sample content creation fails | Onboarding completes but toast: "Could not create sample notes." | App opens with empty state; user creates notes manually |
| Import selected but import fails | Returns to onboarding screen 2 with import error shown | User can select "Start Fresh" or "Explore Empty" instead |
| Quick settings save fails | Settings not persisted; defaults apply | User can configure settings later from the Settings screen |
| Onboarding flag fails to persist | Onboarding may show again on next launch | User completes it again (no harm) |

**Validation Timing:**
- Onboarding check: on app launch (checks has_completed_onboarding)
- Sample content creation: after user taps "Finish" with "Start Fresh" selected

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user opens MyNotes for the first time,
   **When** the app launches,
   **Then** the onboarding flow appears starting with the Welcome screen.

2. **Given** the user selects "Start Fresh" and completes the onboarding,
   **When** the onboarding dismisses,
   **Then** the note list shows 2 sample notes in a "Getting Started" folder, tagged with "tutorial" and "getting-started", with wiki links between them.

3. **Given** the user selects "Import Notes" on screen 2,
   **When** the import flow opens,
   **Then** the user is directed to the import screen (NT-013) and can import their existing notes.

4. **Given** the user completes onboarding,
   **When** the app is opened again,
   **Then** the onboarding does not appear (has_completed_onboarding = true).

5. **Given** the user taps "Show Onboarding Again" in Settings > About,
   **When** the onboarding flow opens,
   **Then** the full 4-screen flow is shown again.

**Edge Cases:**

6. **Given** the user taps "Skip" on screen 1,
   **When** the onboarding dismisses,
   **Then** no sample content is created, and the app shows the empty state.

7. **Given** the user selects "Explore Empty",
   **When** the onboarding completes,
   **Then** no sample content is created, and the app shows an empty note list with the standard empty state message.

**Negative Tests:**

8. **Given** the onboarding is in progress and the app crashes,
   **When** the app restarts,
   **Then** the onboarding appears again from the beginning (has_completed_onboarding was not set).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| shows onboarding on first launch | has_completed_onboarding: false | Onboarding flow is shown |
| skips onboarding on subsequent launch | has_completed_onboarding: true | Onboarding not shown |
| creates sample folder | "Start Fresh" selected | Folder "Getting Started" exists |
| creates 2 sample notes | "Start Fresh" selected | 2 notes exist with predefined content |
| creates wiki links between samples | "Start Fresh" selected | NoteLink between "Welcome" and "Linking Notes" exists |
| creates sample tags | "Start Fresh" selected | Tags "tutorial" and "getting-started" exist |
| handles existing folder name | "Getting Started" folder already exists | Uses existing folder |
| handles existing note title | "Welcome to MyNotes" already exists | Creates "Welcome to MyNotes (sample)" |
| skip sets flag | user taps "Skip" | has_completed_onboarding = true |
| explore empty creates nothing | user selects "Explore Empty" | 0 notes, 0 folders, 0 tags created |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete onboarding with Start Fresh | 1. Launch first time, 2. Get Started, 3. Start Fresh, 4. Next through features, 5. Set theme, 6. Finish | 2 sample notes, 1 folder, 2 tags, wiki links, theme applied |
| Skip onboarding | 1. Launch first time, 2. Tap Skip | No sample content, empty app, onboarding flag set |
| Replay onboarding from settings | 1. Complete onboarding, 2. Open Settings > About > Show Onboarding | Full onboarding flow appears again |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user first experience | 1. Install app, 2. Open MyNotes module, 3. Complete onboarding with "Start Fresh", 4. Open sample note, 5. Tap the [[wiki link]] | User navigated from "Welcome to MyNotes" to "Linking Notes Together" via wiki link; both notes render correctly with markdown formatting |

---

### NT-023: Word and Character Count

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-023 |
| **Feature Name** | Word and Character Count |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a writer, I want to see the word and character count of my note in real time as I type, so that I can track my writing progress and stay within length limits.

**Secondary:**
> As a student with a word count requirement for an essay, I want to know exactly how many words I have written, so that I can meet the minimum or maximum word count for an assignment.

#### 3.3 Detailed Description

Word and Character Count displays real-time metrics about the current note's content. The counts are computed from the note's plain text (after stripping all markdown syntax) and update on every debounced parse cycle (150ms after the last keystroke).

**Metrics displayed:**

| Metric | Formula | Description |
|--------|---------|-------------|
| Word Count | `split body_plain on whitespace, count non-empty tokens` | Total words in the note (markdown stripped) |
| Character Count | `length of body_plain (trimmed)` | Total characters (excluding markdown syntax) |
| Character Count (with spaces) | `length of body_plain (trimmed, spaces included)` | Total characters including spaces |
| Reading Time | `word_count / 200` (rounded up to nearest minute) | Estimated minutes to read at 200 words per minute |
| Speaking Time | `word_count / 130` (rounded up to nearest minute) | Estimated minutes to speak at 130 words per minute |

The primary display is in the editor status bar at the bottom of the screen: "X words | Y characters | Z min read". The status bar is always visible when the editor is open. Tapping the status bar expands it into a detailed panel showing all 5 metrics.

The detailed panel also shows:
- Paragraph count (blocks of text separated by blank lines)
- Sentence count (estimated by counting `.`, `!`, `?` at the end of sentences)
- Average words per sentence (word_count / sentence_count)
- Selection count: when text is selected, shows the word and character count of the selected text only

On the note list (if enabled in settings, NT-021), each note row can display a word count badge to the right of the date.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - word/character counts require the note body and the body_plain field

**External Dependencies:**
- None

**Assumed Capabilities:**
- The markdown parser produces body_plain (plain text with markdown stripped)
- The editor status bar supports dynamic content

#### 3.5 User Interface Requirements

##### Component: Status Bar Counts

**Layout:**
- Fixed at the bottom of the note editor, above the keyboard when active
- Height: 28px
- Content: "X words | Y characters | Z min read" in muted text, centered
- Tapping the bar expands it to the detailed panel

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Normal | Note has content, no selection | "X words | Y chars | Z min read" |
| Empty Note | Note has no content | "0 words | 0 chars" |
| Text Selected | User has selected a portion of text | "X of Y words selected | Z of W chars selected" |
| Expanded | User tapped the status bar | Detailed panel with all 5+ metrics |

**Interactions:**
- Tap status bar: expands to detailed panel
- Tap outside detailed panel: collapses back to compact status bar
- Swipe down on detailed panel: collapses

**Transitions/Animations:**
- Expand: height animates from 28px to ~160px, 200ms ease-out
- Collapse: height animates back to 28px, 200ms ease-in
- Count updates: numbers cross-fade, 100ms

##### Component: Detailed Count Panel

**Layout:**
- Expanded view replacing the status bar, ~160px height
- Grid of 3 columns x 3 rows:
  - Row 1: Words (large number), Characters (large number), Characters (with spaces)
  - Row 2: Paragraphs, Sentences, Avg Words/Sentence
  - Row 3: Reading Time, Speaking Time, (empty or selection count)
- Each cell: metric name (small muted label above) and value (large bold number below)
- Close button (X) at top-right

#### 3.6 Data Requirements

No new database entities are required. Word count and character count are already stored on the Note entity (defined in NT-001). Additional metrics (reading time, speaking time, paragraph count, sentence count) are computed in real time and not persisted.

**Formulas:**

| Metric | Formula | Notes |
|--------|---------|-------|
| word_count | `body_plain.split(/\s+/).filter(token => token.length > 0).length` | Splits on any whitespace, filters empty tokens |
| character_count | `body_plain.trim().replace(/\s/g, '').length` | Characters excluding spaces and markdown |
| character_count_with_spaces | `body_plain.trim().length` | Characters including spaces, excluding markdown |
| paragraph_count | `body_plain.split(/\n\s*\n/).filter(p => p.trim().length > 0).length` | Blocks separated by blank lines |
| sentence_count | `body_plain.split(/[.!?]+\s/).length` | Approximate, splits on sentence terminators |
| avg_words_per_sentence | `word_count / max(sentence_count, 1)` | Rounded to 1 decimal place; min denominator 1 |
| reading_time_minutes | `Math.ceil(word_count / 200)` | 200 wpm average reading speed |
| speaking_time_minutes | `Math.ceil(word_count / 130)` | 130 wpm average speaking speed |

#### 3.7 Business Logic Rules

##### Count Computation

**Purpose:** Calculate all writing metrics from the note's plain text.

**Inputs:**
- body_plain: string - note body with markdown stripped

**Logic:**

```
1. Trim body_plain
2. IF body_plain is empty, RETURN all zeros
3. Compute word_count:
   a. Split on whitespace regex /\s+/
   b. Filter out empty strings
   c. Count remaining tokens
4. Compute character_count (no spaces):
   a. Remove all whitespace characters
   b. Count remaining characters
5. Compute character_count_with_spaces:
   a. Count all characters in trimmed body_plain
6. Compute paragraph_count:
   a. Split on double newlines /\n\s*\n/
   b. Filter out empty paragraphs
   c. Count remaining
7. Compute sentence_count:
   a. Split on /[.!?]+\s/ or end-of-string after [.!?]
   b. Filter out empty segments
   c. Count remaining
8. Compute avg_words_per_sentence:
   a. word_count / max(sentence_count, 1)
   b. Round to 1 decimal place
9. Compute reading_time_minutes: ceil(word_count / 200)
10. Compute speaking_time_minutes: ceil(word_count / 130)
11. RETURN all metrics
```

**Edge Cases:**
- Empty note: all metrics are 0; reading/speaking time are 0 minutes
- Single word: word_count=1, paragraph_count=1, sentence_count=1, avg=1.0, reading_time=1, speaking_time=1
- Note with only code blocks: code content is included in body_plain counts (user's code words are counted)
- Note with only headings (no body prose): heading text is counted
- Selection count: recompute metrics only on the selected substring of body_plain

##### Selection Count

**Purpose:** Compute metrics for the selected text portion only.

**Inputs:**
- selection_text: string - the selected portion of the raw body
- body_plain: string - the full body plain text

**Logic:**

```
1. Strip markdown from selection_text to get selection_plain
2. Compute word_count_selection and character_count_selection using the same formulas
3. RETURN { word_count_selection, character_count_selection }
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Count computation fails | Status bar shows stale values from last successful computation | Next debounce cycle retries |
| body_plain is null or undefined | All counts display 0 | No action needed |
| Extremely large note (100,000+ words) | Computation may take >50ms; status bar updates slightly delayed | No action needed; counts are non-blocking |

**Validation Timing:**
- Count computation runs on every debounced parse (150ms)
- Selection count runs on each selection change event (throttled to 100ms)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user types "Hello world" in a new note,
   **When** the parse debounce completes,
   **Then** the status bar shows "2 words | 10 characters | 1 min read".

2. **Given** the user types a 1,000-word essay,
   **When** the status bar is checked,
   **Then** word count shows 1,000, reading time shows 5 min, speaking time shows 8 min.

3. **Given** the user selects a paragraph of 50 words in a 500-word note,
   **When** the selection is active,
   **Then** the status bar shows "50 of 500 words selected | 280 of 2,800 chars selected".

4. **Given** the user taps the status bar,
   **When** the detailed panel expands,
   **Then** all 8 metrics are displayed in a grid: words, characters, characters with spaces, paragraphs, sentences, average words per sentence, reading time, speaking time.

**Edge Cases:**

5. **Given** an empty note,
   **When** the status bar renders,
   **Then** it shows "0 words | 0 chars".

6. **Given** a note with 50,000 words,
   **When** the counts are computed,
   **Then** all metrics display correctly: reading time = 250 min, speaking time = 385 min.

**Negative Tests:**

7. **Given** the body_plain is null due to a parser error,
   **When** the count is computed,
   **Then** all metrics display 0 and no error is thrown.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| counts words in simple text | "hello world" | word_count: 2 |
| counts words with extra whitespace | "  hello   world  " | word_count: 2 |
| counts zero words for empty string | "" | word_count: 0 |
| counts characters without spaces | "hello world" | character_count: 10 |
| counts characters with spaces | "hello world" | character_count_with_spaces: 11 |
| counts paragraphs | "para1\n\npara2\n\npara3" | paragraph_count: 3 |
| counts sentences | "Hello. World! How?" | sentence_count: 3 |
| single sentence no terminator | "hello world" | sentence_count: 1 |
| avg words per sentence | 9 words, 3 sentences | avg: 3.0 |
| handles zero sentences | empty string | avg: 0 (denominator guarded) |
| reading time 200 wpm | word_count: 400 | reading_time: 2 min |
| reading time rounds up | word_count: 201 | reading_time: 2 min (ceil) |
| reading time 0 for empty | word_count: 0 | reading_time: 0 min |
| speaking time 130 wpm | word_count: 260 | speaking_time: 2 min |
| selection count | selected: "hello world" (2 words), total: 10 words | "2 of 10 words selected" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Type and see counts update | 1. Open empty note, 2. Type "Hello world" | Status bar shows "2 words | 10 chars | 1 min read" |
| Select text and see selection count | 1. Open 100-word note, 2. Select 20 words | Status bar shows "20 of 100 words selected" |
| Expand detailed panel | 1. Open 500-word note, 2. Tap status bar | Panel shows 8 metrics with correct values |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Track essay progress | 1. Start writing an essay with a 2,000-word target, 2. Check status bar periodically, 3. Reach 2,000 words | Status bar shows "2,000 words | X chars | 10 min read"; user confirms target met |

---

### NT-024: Focus/Zen Mode

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | NT-024 |
| **Feature Name** | Focus/Zen Mode |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a writer who gets distracted by UI clutter, I want a distraction-free mode that hides everything except my note content, so that I can focus entirely on writing.

**Secondary:**
> As a user who writes at night, I want a zen mode with a reduced-brightness background and warm color temperature, so that I can write comfortably without eye strain.

#### 3.3 Detailed Description

Focus/Zen Mode strips the editor interface down to its minimal form: just the note body and a cursor. All surrounding UI elements (sidebar, folder tree, note list, toolbar, status bar, tab bar, navigation header) are hidden behind a single toggle. The goal is to remove every visual distraction so the user can concentrate on the content they are writing.

**Activation methods:**

| Method | Platform | Gesture |
|--------|----------|---------|
| Keyboard shortcut | All | Ctrl/Cmd + Shift + F |
| Toolbar button | All | Tap the expand/fullscreen icon in the editor toolbar |
| Menu option | All | Note menu > "Enter Focus Mode" |
| Three-finger double-tap | Mobile | Three-finger double-tap on the editor area |

**What is hidden in Focus Mode:**

| Element | Normal Mode | Focus Mode |
|---------|-------------|------------|
| Navigation header / title bar | Visible | Hidden |
| Sidebar (web) / Tab bar (mobile) | Visible | Hidden |
| Note list panel (web) | Visible | Hidden |
| Editor toolbar (formatting buttons) | Visible | Hidden (appears on text selection) |
| Status bar (word count) | Visible | Hidden |
| Folder breadcrumb | Visible | Hidden |
| Backlinks panel | Visible (if open) | Hidden |
| Table of contents panel | Visible (if open) | Hidden |

**What remains visible in Focus Mode:**

- The note title (editable, minimal styling)
- The note body (full editor area, expanded to fill the screen)
- A subtle semi-transparent "Exit Focus Mode" button in the top-right corner (fades to 10% opacity after 3 seconds of no mouse movement or touch)
- The keyboard (mobile, when active)

**Visual treatment:** The editor content is centered with a maximum width of 720px (on screens wider than 720px). On narrower screens, the content uses standard margins (16px). The background color shifts to a slightly warmer tone (configurable in NT-021 Settings). Line spacing increases by 20% compared to normal mode for improved readability. The font size can optionally increase by 2px in Focus Mode (configurable).

**Typewriter scrolling (optional):** When enabled (via NT-021 Settings), the active line stays vertically centered on the screen as the user types. The content scrolls to keep the cursor at approximately 40% from the top of the viewport. This prevents the cursor from reaching the bottom of the screen and causing jarring scroll jumps.

**Session timer (optional):** A small, semi-transparent timer can be shown in the top-left corner displaying how long the user has been in Focus Mode (format: "12:34"). The timer starts when Focus Mode is entered and resets when exited. It can be toggled on or off in NT-021 Settings. The timer fades to 10% opacity with the exit button.

**Auto-save behavior:** Auto-save continues normally in Focus Mode (2-second debounce, as defined in NT-001). The user does not need to manually save.

#### 3.4 Prerequisites

**Feature Dependencies:**
- NT-001: Markdown Editor with Live Preview - the editor is the core interface being modified
- NT-021: Settings and Preferences - Focus Mode settings (typewriter scrolling, session timer, font size boost, background warmth) are stored as user preferences

**External Dependencies:**
- None

**Assumed Capabilities:**
- The editor can dynamically show/hide surrounding UI elements
- The editor content area can expand to fill the full viewport
- The platform supports fullscreen or immersive mode (hiding system status bar on mobile)

#### 3.5 User Interface Requirements

##### Screen: Focus Mode Editor

**Layout:**
- Full-viewport editor with no surrounding chrome
- Note title at the top, left-aligned, large font (1.5x body), no underline or border
- Note body below the title, filling all remaining vertical space
- Content centered horizontally with max-width 720px on wide screens
- Increased line spacing (1.8 line-height vs 1.5 in normal mode)
- Background color: slightly warmer variant of the current theme background
- "Exit Focus Mode" button: top-right corner, icon-only (X or compress icon), semi-transparent

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active writing | User is typing or has moved cursor within 3 seconds | Exit button at 60% opacity, session timer at 60% opacity (if enabled) |
| Idle | No input for 3+ seconds | Exit button fades to 10% opacity, session timer fades to 10% opacity |
| Text selected | User selects text | Floating toolbar appears above selection with formatting options (bold, italic, heading, link, code); toolbar dismisses when selection clears |
| Typewriter active | Typewriter scrolling enabled in settings | Active line stays at 40% from top of viewport; content scrolls smoothly (200ms ease) |

**Interactions:**
- Tap "Exit Focus Mode" button: returns to normal editor view with all UI restored
- Press Escape (keyboard): exits Focus Mode
- Press Ctrl/Cmd + Shift + F: toggles Focus Mode off
- Swipe down with two fingers (mobile): exits Focus Mode
- Tap anywhere in the editor: resets the 3-second idle timer (exit button returns to 60% opacity)

**Transitions/Animations:**
- Enter Focus Mode: all chrome elements fade out simultaneously (300ms ease-out), editor content expands to fill viewport (300ms ease-out, synchronized)
- Exit Focus Mode: editor content shrinks back, chrome fades in (300ms ease-in)
- Exit button opacity: transitions between 60% and 10% over 500ms ease
- Typewriter scroll: content scrolls to re-center the active line over 200ms ease

##### Component: Floating Toolbar (Focus Mode only)

**Layout:**
- Appears above the text selection, horizontally centered
- Contains formatting buttons: Bold, Italic, Heading (H1/H2/H3 dropdown), Link, Code, Strikethrough
- Rounded rectangle with subtle shadow, semi-transparent background
- Dismisses when selection is cleared or user taps elsewhere

**Interactions:**
- Tap a formatting button: applies formatting to the selected text, toolbar remains visible
- Tap outside: toolbar dismisses
- Clear selection: toolbar dismisses

#### 3.6 Data Requirements

No new database entities are required. Focus Mode is a UI-only feature. The following settings are stored via the Settings entity (defined in NT-021):

| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| focus_mode_typewriter | boolean | false | Whether typewriter scrolling is enabled in Focus Mode |
| focus_mode_timer | boolean | false | Whether the session timer is displayed in Focus Mode |
| focus_mode_font_boost | integer | 0 | Additional font size in px added in Focus Mode (0, 2, or 4) |
| focus_mode_line_spacing | float | 1.8 | Line-height multiplier in Focus Mode (range: 1.5 to 2.5, step 0.1) |
| focus_mode_background_warmth | integer | 0 | Background warmth shift in degrees Kelvin (0 = no change, 10 = subtle warm, 20 = warm, 30 = very warm) |

These settings are read when Focus Mode is entered and applied to the editor display. They are not persisted per-note; they apply globally to all Focus Mode sessions.

#### 3.7 Business Logic Rules

##### Enter Focus Mode

**Purpose:** Transition the editor to distraction-free mode.

**Inputs:**
- current_note: Note - the note currently open in the editor
- settings: FocusModeSettings - user's Focus Mode preferences

**Logic:**

```
1. IF current_note is null, ABORT (no note open, nothing to focus)
2. Save current scroll position and cursor position
3. Hide all chrome elements (header, sidebar, tab bar, toolbar, status bar, breadcrumb)
4. IF backlinks panel is open, hide it and set restore_backlinks = true
5. IF table of contents panel is open, hide it and set restore_toc = true
6. Expand editor content area to fill full viewport
7. Apply max-width 720px centering
8. Apply focus_mode_font_boost to font size
9. Apply focus_mode_line_spacing to line-height
10. Apply focus_mode_background_warmth to background color
11. IF focus_mode_typewriter is true, ENABLE typewriter scrolling
12. IF focus_mode_timer is true, START session timer (display "0:00")
13. Start idle timer (3 seconds) for exit button opacity
14. SET is_focus_mode = true
15. Restore cursor position
```

**Edge Cases:**
- Note is empty: Focus Mode still activates (user can start writing)
- Note is read-only (e.g., a template preview): Focus Mode is disabled, toolbar button is grayed out
- User rotates device while in Focus Mode: layout re-centers, max-width re-applied
- Keyboard appears/disappears (mobile): editor area resizes, typewriter scroll position recalculated

##### Exit Focus Mode

**Purpose:** Restore the full editor interface.

**Inputs:**
- restore_backlinks: boolean - whether backlinks panel was open before
- restore_toc: boolean - whether table of contents panel was open before

**Logic:**

```
1. Save current scroll position and cursor position
2. IF session timer is running, STOP timer
3. Remove focus-mode visual adjustments (font boost, line spacing, background warmth)
4. Shrink editor content area to normal dimensions
5. Show all chrome elements (header, sidebar, tab bar, toolbar, status bar, breadcrumb)
6. IF restore_backlinks is true, re-open backlinks panel
7. IF restore_toc is true, re-open table of contents panel
8. SET is_focus_mode = false
9. Restore cursor position and scroll position as closely as possible
```

##### Typewriter Scrolling

**Purpose:** Keep the active line vertically centered while typing.

**Inputs:**
- cursor_line: integer - the line number where the cursor is
- viewport_height: integer - the visible editor height in pixels
- line_height: integer - computed height per line in pixels

**Logic:**

```
1. Compute target_y = viewport_height * 0.4
2. Compute cursor_y = cursor_line * line_height
3. Compute scroll_offset = cursor_y - target_y
4. IF scroll_offset < 0, SET scroll_offset = 0 (don't scroll above content start)
5. Animate scroll to scroll_offset over 200ms ease
```

**Edge Cases:**
- Note is shorter than the viewport: no scrolling needed, cursor stays at natural position
- User scrolls manually: typewriter scrolling re-engages on the next keystroke
- User clicks to a different line: typewriter scrolls to re-center on the clicked line

##### Idle Timer

**Purpose:** Fade the exit button and session timer to near-invisible after 3 seconds of inactivity.

**Logic:**

```
1. On any input event (keystroke, mouse move, touch), reset idle_timer to 3 seconds
2. Set exit_button_opacity = 0.6
3. Set timer_opacity = 0.6
4. WHEN idle_timer expires:
   a. Animate exit_button_opacity to 0.1 over 500ms
   b. Animate timer_opacity to 0.1 over 500ms
5. On next input event, return to step 1
```

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Cannot hide system UI (platform restriction) | Focus Mode activates with app-level chrome hidden but system status bar may remain | No action needed; mode is still functional |
| Settings fail to load | Focus Mode activates with all defaults (no typewriter, no timer, no font boost) | Settings are retried on next Focus Mode entry |
| Auto-save fails during Focus Mode | Same behavior as normal mode: subtle error indicator, retry on next debounce | User does not need to exit Focus Mode |
| Screen rotation during Focus Mode | Layout re-centers, no content loss | Automatic |

**Validation Timing:**
- Focus Mode availability is checked when the editor opens (button is enabled/disabled)
- Settings are read once on Focus Mode entry (not polled during the session)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has a note open in the editor,
   **When** they press Ctrl/Cmd + Shift + F,
   **Then** all chrome elements fade out over 300ms, the editor expands to fill the viewport, and "Exit Focus Mode" button appears in the top-right corner.

2. **Given** Focus Mode is active and typewriter scrolling is enabled,
   **When** the user types at the bottom of the visible area,
   **Then** the content scrolls so the cursor line stays at approximately 40% from the top of the viewport.

3. **Given** Focus Mode is active and the session timer is enabled,
   **When** 5 minutes have passed since entering Focus Mode,
   **Then** the timer displays "5:00" in the top-left corner.

4. **Given** Focus Mode is active and the user stops interacting for 3 seconds,
   **When** the idle timer expires,
   **Then** the exit button and session timer fade to 10% opacity over 500ms.

5. **Given** Focus Mode is active,
   **When** the user selects a word and the floating toolbar appears,
   **Then** tapping "Bold" wraps the selected text in bold syntax, and the toolbar remains visible.

**Edge Cases:**

6. **Given** Focus Mode is active on a mobile device,
   **When** the user rotates from portrait to landscape,
   **Then** the editor re-centers with max-width 720px (if landscape width exceeds 720px) and the cursor position is preserved.

7. **Given** the user enters Focus Mode with the backlinks panel open,
   **When** they exit Focus Mode,
   **Then** the backlinks panel is restored to its previously open state.

8. **Given** the user has set focus_mode_font_boost to 4 in settings,
   **When** they enter Focus Mode,
   **Then** the editor font size is 4px larger than in normal mode.

**Negative Tests:**

9. **Given** no note is open in the editor,
   **When** the user presses Ctrl/Cmd + Shift + F,
   **Then** nothing happens (Focus Mode does not activate on an empty editor state).

10. **Given** a template preview is open (read-only),
    **When** the user attempts to enter Focus Mode,
    **Then** the toolbar button is disabled and the keyboard shortcut has no effect.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| computes typewriter scroll offset | cursor_line: 50, viewport_height: 800, line_height: 24 | scroll_offset: 50*24 - 800*0.4 = 880 |
| clamps scroll offset to zero | cursor_line: 2, viewport_height: 800, line_height: 24 | scroll_offset: 0 (2*24 - 320 = -272, clamped to 0) |
| applies font boost | base_font_size: 16, focus_mode_font_boost: 4 | display_font_size: 20 |
| applies line spacing | focus_mode_line_spacing: 1.8 | line-height: 1.8 |
| applies default settings when settings null | settings: null | typewriter: false, timer: false, font_boost: 0, line_spacing: 1.8, warmth: 0 |
| validates font boost range | focus_mode_font_boost: 6 | clamped to 4 (max allowed) |
| validates line spacing range | focus_mode_line_spacing: 3.0 | clamped to 2.5 (max allowed) |
| formats session timer | elapsed_seconds: 754 | "12:34" |
| formats session timer under 1 min | elapsed_seconds: 45 | "0:45" |
| formats session timer over 1 hour | elapsed_seconds: 3661 | "61:01" |
| idle timer triggers after 3s | last_input: 3001ms ago | is_idle: true |
| idle timer resets on input | last_input: 0ms ago, was_idle: true | is_idle: false |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Enter and exit Focus Mode | 1. Open a note, 2. Press Cmd+Shift+F, 3. Verify chrome hidden, 4. Press Escape | Chrome hides on enter, editor fills viewport; chrome restores on exit, editor returns to normal size |
| Typewriter scrolling | 1. Enable typewriter in settings, 2. Open a 200-line note, 3. Enter Focus Mode, 4. Move cursor to line 100 | Editor scrolls so line 100 is at 40% from top |
| Floating toolbar in Focus Mode | 1. Enter Focus Mode, 2. Select a word, 3. Tap Bold in floating toolbar | Selected word is wrapped in bold markdown, toolbar remains visible |
| Session timer accuracy | 1. Enable timer in settings, 2. Enter Focus Mode, 3. Wait 60 seconds | Timer displays "1:00" |
| Settings apply on entry | 1. Set font_boost to 2, line_spacing to 2.0, warmth to 20, 2. Enter Focus Mode | Font is 2px larger, line-height is 2.0, background has warm tint |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Deep writing session | 1. Open a note, 2. Enter Focus Mode with typewriter and timer enabled, 3. Write 500 words over 15 minutes, 4. Exit Focus Mode | Note contains 500 new words (auto-saved); timer showed ~15:00 at exit; all chrome restored; word count in status bar reflects new content |
| Distraction-free mobile writing | 1. Open note on mobile, 2. Three-finger double-tap to enter Focus Mode, 3. Write a paragraph, 4. Swipe down with two fingers to exit | Note saved, Focus Mode exited cleanly, tab bar and header restored |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the **Note** entity, which stores the user's markdown content along with metadata (title, word count, pin status, timestamps). Notes are organized into a **Folder** hierarchy (a self-referencing tree via parent_id). Notes can be tagged with **Tags** through a many-to-many join table **NoteTag**. Wiki-style links between notes are tracked in **NoteLink** (source -> target). **Templates** are special notes used as starting points for new notes. **TaskItems** track individual checkbox items within a note's body. **Attachments** record files and images embedded in notes. **NoteVersions** store historical snapshots for version history with diffs. **SavedViews** persist user-configured sort/filter combinations. **Settings** store user preferences as key-value pairs. **RecentSearches** cache the user's recent search queries.

The full-text search capability uses a virtual table (**nt_search_index**) that mirrors note content for fast FTS5 querying. This virtual table is not a traditional entity but a search-optimized projection of Note data.

### 4.2 Complete Entity Definitions

#### Entity: Note

Introduced in NT-001. Extended by NT-005 (pinning), NT-009 (task counts), NT-014 (daily note flag), NT-019 (quick capture flag).

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| title | string | Required, max 255 chars, trimmed | Untitled | Note title (auto-derived from first line if not set explicitly) |
| body | string | Required (may be empty string) | "" | Raw markdown content |
| body_plain | string | Computed, not user-editable | "" | Plain text with markdown stripped (for search and word count) |
| folder_id | string | Foreign key -> Folder.id, nullable | null | Folder this note belongs to (null = Inbox/root) |
| is_pinned | boolean | - | false | Whether this note is pinned to the top of lists (NT-005) |
| is_favorited | boolean | - | false | Whether this note is marked as a favorite (NT-005) |
| is_daily_note | boolean | - | false | Whether this note was auto-created as a daily note (NT-014) |
| daily_note_date | string | ISO 8601 date (YYYY-MM-DD), nullable | null | The calendar date for daily notes (NT-014) |
| is_quick_capture | boolean | - | false | Whether this note was created via quick capture (NT-019) |
| source | string | One of: "editor", "template", "import", "quick_capture", "share_sheet", "daily_auto" | "editor" | How this note was created (NT-019) |
| word_count | integer | Min: 0, computed on save | 0 | Word count of body_plain |
| character_count | integer | Min: 0, computed on save | 0 | Character count of body_plain (no spaces) |
| task_total | integer | Min: 0, computed on save | 0 | Total number of task items in the note (NT-009) |
| task_completed | integer | Min: 0, computed on save | 0 | Number of completed task items (NT-009) |
| created_at | datetime | ISO 8601, auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | ISO 8601, auto-set on modification | Current timestamp | Last content modification time |

**Relationships:**
- Note belongs to Folder (many-to-one via folder_id)
- Note has many Tags through NoteTag (many-to-many)
- Note has many NoteLinks as source (one-to-many via NoteLink.source_note_id)
- Note has many NoteLinks as target (one-to-many via NoteLink.target_note_id)
- Note has many TaskItems (one-to-many via TaskItem.note_id)
- Note has many Attachments (one-to-many via Attachment.note_id)
- Note has many NoteVersions (one-to-many via NoteVersion.note_id)

**Indexes:**
- folder_id - filter notes by folder
- (is_pinned DESC, updated_at DESC) - composite index for default note list sorting (pinned first, then by last modified)
- (is_daily_note, daily_note_date) - composite index for daily note lookup
- created_at - sort by creation date
- word_count - sort by word count
- title - sort alphabetically

**Validation Rules:**
- title: must not be empty string after trimming whitespace; max 255 characters
- body: required but may be empty string (new note state)
- folder_id: if not null, must reference an existing Folder.id
- daily_note_date: if is_daily_note is true, daily_note_date must not be null; format YYYY-MM-DD
- task_completed must be <= task_total

**Example Data:**

```
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Project Alpha Design Notes",
  "body": "# Project Alpha\n\nCore requirements:\n- [ ] Authentication flow\n- [x] Database schema\n\nSee [[Meeting Notes 2026-03-01]] for context.",
  "body_plain": "Project Alpha\n\nCore requirements:\nAuthentication flow\nDatabase schema\n\nSee Meeting Notes 2026-03-01 for context.",
  "folder_id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "is_pinned": true,
  "is_favorited": false,
  "is_daily_note": false,
  "daily_note_date": null,
  "is_quick_capture": false,
  "source": "editor",
  "word_count": 18,
  "character_count": 109,
  "task_total": 2,
  "task_completed": 1,
  "created_at": "2026-03-01T10:30:00Z",
  "updated_at": "2026-03-06T14:22:00Z"
}
```

---

#### Entity: Folder

Introduced in NT-002.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| name | string | Required, max 100 chars, trimmed | None | Folder display name |
| parent_id | string | Foreign key -> Folder.id, nullable | null | Parent folder (null = root-level folder) |
| sort_order | integer | Min: 0 | 0 | Position within sibling folders (lower = earlier) |
| icon | string | Optional, max 10 chars (emoji) | null | Optional emoji icon for the folder |
| color | string | Optional, hex color code (e.g., "#FF5733") | null | Optional accent color for the folder |
| is_collapsed | boolean | - | false | Whether the folder is collapsed in the sidebar tree |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | datetime | ISO 8601, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Folder has many Notes (one-to-many via Note.folder_id)
- Folder has many child Folders (self-referencing one-to-many via parent_id)
- Folder belongs to parent Folder (many-to-one via parent_id)

**Indexes:**
- parent_id - list children of a folder
- (parent_id, sort_order) - composite for ordered sibling listing
- name - search/filter by folder name

**Validation Rules:**
- name: must not be empty after trimming; max 100 characters; unique among siblings (same parent_id)
- parent_id: if not null, must reference an existing Folder.id
- Circular reference prevention: a folder cannot be its own ancestor (max depth: 10 levels)
- sort_order: must be >= 0

**Example Data:**

```
{
  "id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "name": "Work",
  "parent_id": null,
  "sort_order": 0,
  "icon": "💼",
  "color": "#4A90D9",
  "is_collapsed": false,
  "created_at": "2026-01-15T08:00:00Z",
  "updated_at": "2026-01-15T08:00:00Z"
}
```

---

#### Entity: Tag

Introduced in NT-004.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| name | string | Required, max 100 chars, trimmed, case-insensitive unique | None | Tag display name (e.g., "project-alpha") |
| color | string | Optional, hex color code | null | Optional color for visual distinction |
| parent_tag_id | string | Foreign key -> Tag.id, nullable | null | Parent tag for nested tag hierarchy (e.g., "work" > "meetings") |
| usage_count | integer | Min: 0, computed | 0 | Number of notes using this tag (cached, updated on tag/untag) |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |

**Relationships:**
- Tag has many Notes through NoteTag (many-to-many)
- Tag has many child Tags (self-referencing one-to-many via parent_tag_id)
- Tag belongs to parent Tag (many-to-one via parent_tag_id)

**Indexes:**
- name (UNIQUE, case-insensitive) - prevent duplicate tags
- parent_tag_id - list child tags
- usage_count DESC - sort by popularity

**Validation Rules:**
- name: must not be empty after trimming; max 100 characters; unique (case-insensitive)
- name: must not contain spaces (use hyphens or underscores); must match `/^[a-zA-Z0-9_-]+$/`
- parent_tag_id: if not null, must reference an existing Tag.id; max nesting depth: 5

**Example Data:**

```
{
  "id": "t1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "name": "project-alpha",
  "color": "#E74C3C",
  "parent_tag_id": "t0000-work-tag-id",
  "usage_count": 12,
  "created_at": "2026-02-10T09:00:00Z"
}
```

---

#### Entity: NoteTag (Join Table)

Introduced in NT-004.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| note_id | string | Foreign key -> Note.id, part of composite PK | None | The tagged note |
| tag_id | string | Foreign key -> Tag.id, part of composite PK | None | The applied tag |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | When the tag was applied to the note |

**Relationships:**
- NoteTag belongs to Note (many-to-one via note_id)
- NoteTag belongs to Tag (many-to-one via tag_id)

**Indexes:**
- (note_id, tag_id) - composite primary key, ensures unique pair
- tag_id - reverse lookup: find all notes with a given tag

**Validation Rules:**
- note_id: must reference an existing Note.id
- tag_id: must reference an existing Tag.id
- The pair (note_id, tag_id) must be unique

---

#### Entity: NoteLink

Introduced in NT-006.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| source_note_id | string | Foreign key -> Note.id, required | None | The note containing the [[link]] |
| target_note_id | string | Foreign key -> Note.id, nullable | null | The note being linked to (null if target note does not exist yet) |
| target_title | string | Required, max 255 chars | None | The raw text inside the [[brackets]] (used to resolve or create the target) |
| link_context | string | Optional, max 500 chars | null | The surrounding sentence or paragraph where the link appears (for backlink preview) |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | When the link was first detected |
| updated_at | datetime | ISO 8601, auto-set | Current timestamp | When the link was last re-confirmed during parsing |

**Relationships:**
- NoteLink belongs to source Note (many-to-one via source_note_id)
- NoteLink belongs to target Note (many-to-one via target_note_id, nullable)

**Indexes:**
- source_note_id - find all outgoing links from a note
- target_note_id - find all incoming links (backlinks) to a note
- target_title - resolve links by title when target_note_id is null
- (source_note_id, target_title) - composite unique constraint: one link per target title per source note

**Validation Rules:**
- source_note_id: must reference an existing Note.id
- target_note_id: if not null, must reference an existing Note.id
- target_title: must not be empty after trimming
- source_note_id must not equal target_note_id (no self-links)

**Example Data:**

```
{
  "id": "l1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "source_note_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "target_note_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "target_title": "Meeting Notes 2026-03-01",
  "link_context": "See [[Meeting Notes 2026-03-01]] for context on the database schema decision.",
  "created_at": "2026-03-01T10:30:00Z",
  "updated_at": "2026-03-06T14:22:00Z"
}
```

---

#### Entity: Template

Introduced in NT-008.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| name | string | Required, max 100 chars, trimmed, unique | None | Template display name (e.g., "Meeting Notes") |
| description | string | Optional, max 255 chars | null | Brief description shown in the template picker |
| body | string | Required | "" | Markdown template content (may contain placeholder tokens like {{date}}, {{title}}) |
| category | string | One of: "general", "meeting", "project", "daily", "custom" | "custom" | Template category for grouping |
| icon | string | Optional, max 10 chars (emoji) | null | Optional emoji icon |
| is_builtin | boolean | - | false | Whether this is a system-provided template (cannot be deleted by user) |
| usage_count | integer | Min: 0 | 0 | Number of times this template has been used to create notes |
| sort_order | integer | Min: 0 | 0 | Display order within category |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | datetime | ISO 8601, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Template has no direct foreign key relationships. Notes created from templates reference the template's name in Note.source = "template".

**Indexes:**
- name (UNIQUE) - prevent duplicate template names
- category - filter by category
- (category, sort_order) - ordered listing within a category
- usage_count DESC - sort by popularity

**Validation Rules:**
- name: must not be empty after trimming; max 100 characters; unique
- body: required but may be empty string
- is_builtin templates cannot be deleted (only hidden)

**Example Data:**

```
{
  "id": "tp1a2b3c-d5e6-7890-abcd-ef1234567890",
  "name": "Meeting Notes",
  "description": "Standard meeting notes with attendees, agenda, and action items",
  "body": "# {{title}}\n\n**Date:** {{date}}\n**Attendees:**\n\n## Agenda\n\n1. \n\n## Discussion\n\n\n## Action Items\n\n- [ ] \n",
  "category": "meeting",
  "icon": "📋",
  "is_builtin": true,
  "usage_count": 15,
  "sort_order": 0,
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-01T00:00:00Z"
}
```

---

#### Entity: TaskItem

Introduced in NT-009.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| note_id | string | Foreign key -> Note.id, required | None | The note containing this task |
| text | string | Required, max 1000 chars | None | The task description text (markdown stripped) |
| is_completed | boolean | - | false | Whether the checkbox is checked |
| sort_order | integer | Min: 0 | 0 | Order of appearance within the note (0-based) |
| line_number | integer | Min: 0 | 0 | The line number in the note body where this task appears |
| completed_at | datetime | ISO 8601, nullable | null | When the task was checked off |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | When the task was first parsed from the note |

**Relationships:**
- TaskItem belongs to Note (many-to-one via note_id)

**Indexes:**
- note_id - list all tasks in a note
- (note_id, sort_order) - ordered task listing
- (is_completed, note_id) - filter incomplete tasks across notes

**Validation Rules:**
- note_id: must reference an existing Note.id
- text: must not be empty after trimming
- completed_at: must be null if is_completed is false; must not be null if is_completed is true

**Example Data:**

```
{
  "id": "tk1a2b3c-d5e6-7890-abcd-ef1234567890",
  "note_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "text": "Authentication flow",
  "is_completed": false,
  "sort_order": 0,
  "line_number": 4,
  "completed_at": null,
  "created_at": "2026-03-01T10:30:00Z"
}
```

---

#### Entity: Attachment

Introduced in NT-011.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| note_id | string | Foreign key -> Note.id, required | None | The note this file is attached to |
| filename | string | Required, max 255 chars | None | Original filename (e.g., "screenshot.png") |
| mime_type | string | Required, max 100 chars | None | MIME type (e.g., "image/png", "application/pdf") |
| file_size | integer | Min: 0 | 0 | File size in bytes |
| file_path | string | Required, max 1000 chars | None | Relative path to the file on the local file system |
| thumbnail_path | string | Optional, max 1000 chars | null | Relative path to a generated thumbnail (for images and PDFs) |
| width | integer | Min: 0, nullable | null | Image width in pixels (null for non-image files) |
| height | integer | Min: 0, nullable | null | Image height in pixels (null for non-image files) |
| checksum | string | Optional, max 64 chars (SHA-256) | null | File integrity checksum |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | When the file was attached |

**Relationships:**
- Attachment belongs to Note (many-to-one via note_id)

**Indexes:**
- note_id - list all attachments for a note
- mime_type - filter by file type
- file_size DESC - find largest attachments

**Validation Rules:**
- note_id: must reference an existing Note.id
- filename: must not be empty after trimming
- mime_type: must be a valid MIME type string
- file_size: must be > 0 and <= 52,428,800 (50 MB max per file)
- file_path: must point to an existing file on disk (validated on attachment creation)
- Allowed MIME types: image/png, image/jpeg, image/gif, image/webp, image/svg+xml, application/pdf, text/plain, text/csv, text/markdown, application/json, application/zip

**Example Data:**

```
{
  "id": "at1a2b3c-d5e6-7890-abcd-ef1234567890",
  "note_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "filename": "architecture-diagram.png",
  "mime_type": "image/png",
  "file_size": 245760,
  "file_path": "attachments/a1b2c3d4/architecture-diagram.png",
  "thumbnail_path": "attachments/a1b2c3d4/thumb_architecture-diagram.png",
  "width": 1200,
  "height": 800,
  "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "created_at": "2026-03-01T10:35:00Z"
}
```

---

#### Entity: NoteVersion

Introduced in NT-018.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| note_id | string | Foreign key -> Note.id, required | None | The note this version belongs to |
| version_number | integer | Min: 1, auto-incremented per note | Auto | Sequential version number within the note |
| title | string | Required, max 255 chars | None | Note title at this version |
| body | string | Required | None | Full markdown body at this version |
| word_count | integer | Min: 0 | 0 | Word count at this version |
| change_summary | string | Optional, max 500 chars | null | Auto-generated summary of changes (e.g., "+42 words, 3 paragraphs modified") |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | When this version was saved |

**Relationships:**
- NoteVersion belongs to Note (many-to-one via note_id)

**Indexes:**
- note_id - list all versions of a note
- (note_id, version_number DESC) - ordered version history
- (note_id, created_at DESC) - versions by date

**Validation Rules:**
- note_id: must reference an existing Note.id
- version_number: must be the next sequential integer for this note_id (no gaps)
- title: must not be empty after trimming
- body: required (captures the full state)
- Maximum 100 versions per note; when limit is reached, the oldest non-initial version is deleted (version 1 is always preserved)

**Example Data:**

```
{
  "id": "v1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "note_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "version_number": 3,
  "title": "Project Alpha Design Notes",
  "body": "# Project Alpha\n\nCore requirements:\n- [ ] Authentication flow\n- [x] Database schema\n- [x] API endpoints\n\nSee [[Meeting Notes 2026-03-01]] for context.",
  "word_count": 22,
  "change_summary": "+4 words, 1 task item added",
  "created_at": "2026-03-06T14:22:00Z"
}
```

---

#### Entity: SavedView

Introduced in NT-020.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| name | string | Required, max 100 chars, trimmed, unique | None | View display name (e.g., "Work Tasks This Week") |
| sort_field | string | One of: "updated_at", "created_at", "title", "word_count" | "updated_at" | Which field to sort by |
| sort_direction | string | One of: "asc", "desc" | "desc" | Sort direction |
| filter_folder_id | string | Foreign key -> Folder.id, nullable | null | Restrict to a specific folder (null = all folders) |
| filter_tags | string | JSON array of tag IDs, nullable | null | Filter to notes with all of these tags |
| filter_has_tasks | boolean | Nullable | null | Filter to notes containing task items (null = no filter) |
| filter_is_pinned | boolean | Nullable | null | Filter to pinned notes only (null = no filter) |
| filter_date_range_start | datetime | ISO 8601, nullable | null | Only show notes modified after this date |
| filter_date_range_end | datetime | ISO 8601, nullable | null | Only show notes modified before this date |
| icon | string | Optional, max 10 chars (emoji) | null | Optional emoji icon for the view |
| sort_order | integer | Min: 0 | 0 | Display order in the saved views list |
| created_at | datetime | ISO 8601, auto-set | Current timestamp | Record creation time |
| updated_at | datetime | ISO 8601, auto-set | Current timestamp | Last modification time |

**Relationships:**
- SavedView references Folder optionally (via filter_folder_id)
- SavedView references Tags via filter_tags (stored as JSON, not a foreign key relationship)

**Indexes:**
- sort_order - ordered listing
- name (UNIQUE) - prevent duplicate view names

**Validation Rules:**
- name: must not be empty after trimming; max 100 characters; unique
- sort_field: must be one of the allowed values
- sort_direction: must be "asc" or "desc"
- filter_folder_id: if not null, must reference an existing Folder.id
- filter_tags: if not null, must be a valid JSON array of strings; each string must reference an existing Tag.id
- filter_date_range_start must be before filter_date_range_end (if both are set)

**Example Data:**

```
{
  "id": "sv1a2b3c-d5e6-7890-abcd-ef1234567890",
  "name": "Work Tasks This Week",
  "sort_field": "updated_at",
  "sort_direction": "desc",
  "filter_folder_id": "f1a2b3c4-d5e6-7890-abcd-ef1234567890",
  "filter_tags": "[\"t1a2b3c4-d5e6-7890-abcd-ef1234567890\"]",
  "filter_has_tasks": true,
  "filter_is_pinned": null,
  "filter_date_range_start": "2026-03-03T00:00:00Z",
  "filter_date_range_end": "2026-03-09T23:59:59Z",
  "icon": "🎯",
  "sort_order": 0,
  "created_at": "2026-03-05T09:00:00Z",
  "updated_at": "2026-03-05T09:00:00Z"
}
```

---

#### Entity: Setting

Introduced in NT-021.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| key | string | Primary key, max 100 chars | None | Setting identifier (e.g., "editor_font_size", "theme") |
| value | string | Required, max 10000 chars | None | Setting value stored as a string (parsed by the consumer) |
| type | string | One of: "string", "integer", "float", "boolean", "json" | "string" | Data type hint for parsing the value |
| updated_at | datetime | ISO 8601, auto-set | Current timestamp | Last modification time |

**Relationships:**
- Setting has no foreign key relationships. It is a standalone key-value store.

**Indexes:**
- key (PRIMARY KEY) - direct lookup by setting name

**Validation Rules:**
- key: must not be empty; must match `/^[a-z][a-z0-9_]*$/` (lowercase, underscore-separated)
- value: must not be null (use empty string for "unset")
- type: must be one of the allowed values
- When type is "integer", value must parse to a valid integer
- When type is "boolean", value must be "true" or "false"
- When type is "json", value must be valid JSON

**Default Settings:**

| Key | Type | Default Value | Description |
|-----|------|---------------|-------------|
| editor_font_size | integer | "16" | Editor font size in pixels (12-24) |
| editor_font_family | string | "system" | Font family: "system", "serif", "sans-serif", "monospace" |
| editor_line_spacing | float | "1.5" | Line-height multiplier (1.0-2.5) |
| theme | string | "dark" | Color theme: "dark", "light", "system" |
| default_sort_field | string | "updated_at" | Default note list sort field |
| default_sort_direction | string | "desc" | Default sort direction |
| show_word_count_in_list | boolean | "false" | Show word count badge on note list rows |
| auto_save_delay_ms | integer | "2000" | Auto-save debounce delay in milliseconds (500-10000) |
| daily_note_template_id | string | "" | Template ID to use for daily notes (empty = default) |
| daily_note_auto_create | boolean | "false" | Auto-create daily note on app open |
| quick_capture_default_folder | string | "" | Default folder ID for quick captures (empty = Inbox) |
| version_save_interval_minutes | integer | "30" | How often to save a version snapshot (10-1440) |
| max_versions_per_note | integer | "100" | Max stored versions per note (10-500) |
| focus_mode_typewriter | boolean | "false" | Typewriter scrolling in Focus Mode |
| focus_mode_timer | boolean | "false" | Session timer in Focus Mode |
| focus_mode_font_boost | integer | "0" | Font size boost in Focus Mode (0, 2, or 4) |
| focus_mode_line_spacing | float | "1.8" | Line-height in Focus Mode (1.5-2.5) |
| focus_mode_background_warmth | integer | "0" | Background warmth in Focus Mode (0-30) |
| search_include_body | boolean | "true" | Include note body in search results |
| search_include_tags | boolean | "true" | Include tags in search |
| export_default_format | string | "markdown" | Default export format: "markdown", "pdf", "json" |
| import_duplicate_strategy | string | "skip" | How to handle import duplicates: "skip", "overwrite", "create_copy" |
| graph_physics_enabled | boolean | "true" | Enable physics simulation in graph view |
| onboarding_completed | boolean | "false" | Whether the user has completed the onboarding flow |
| note_list_density | string | "comfortable" | Note list row density: "compact", "comfortable", "spacious" |

**Example Data:**

```
{
  "key": "editor_font_size",
  "value": "18",
  "type": "integer",
  "updated_at": "2026-03-05T10:00:00Z"
}
```

---

#### Entity: RecentSearch

Introduced in NT-003.

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, UUID v4, auto-generated | Auto | Unique identifier |
| query | string | Required, max 255 chars, trimmed | None | The search query text |
| result_count | integer | Min: 0 | 0 | Number of results returned for this query |
| searched_at | datetime | ISO 8601, auto-set | Current timestamp | When the search was performed |

**Relationships:**
- RecentSearch has no foreign key relationships.

**Indexes:**
- searched_at DESC - most recent searches first
- query - deduplicate and find previous searches

**Validation Rules:**
- query: must not be empty after trimming; max 255 characters
- Maximum 50 recent searches stored; oldest is deleted when the limit is exceeded

**Example Data:**

```
{
  "id": "rs1a2b3c-d5e6-7890-abcd-ef1234567890",
  "query": "project alpha authentication",
  "result_count": 3,
  "searched_at": "2026-03-06T15:30:00Z"
}
```

---

#### Virtual Table: SearchIndex (FTS5)

Introduced in NT-003.

This is not a regular entity but a full-text search virtual table that mirrors data from Note, Tag, and Folder for fast text search.

| Column | Source | Description |
|--------|--------|-------------|
| rowid | Note.id | Maps to the Note entity |
| title | Note.title | Searchable note title |
| body | Note.body_plain | Searchable plain-text content (markdown stripped) |
| tags | GROUP_CONCAT(Tag.name) | Space-separated tag names for the note |
| folder_name | Folder.name | Name of the note's folder |

**Tokenizer:** unicode61 (supports international characters)
**Ranking:** BM25 with column weights: title (10.0), body (1.0), tags (5.0), folder_name (2.0)

**Synchronization:**
- INSERT into SearchIndex when a Note is created
- UPDATE in SearchIndex when a Note's title, body, or tags change
- DELETE from SearchIndex when a Note is deleted
- Rebuilding: on app start, verify row count matches Note count; rebuild if mismatch detected

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| Note -> Folder | many-to-one | A note belongs to one folder (or none for Inbox) |
| Folder -> Folder | self-referencing one-to-many | Folders form a tree hierarchy via parent_id (max depth 10) |
| Note <-> Tag | many-to-many | A note can have multiple tags; a tag can be on multiple notes; joined via NoteTag |
| Note -> NoteLink (as source) | one-to-many | A note can link to many other notes via [[wiki links]] |
| Note -> NoteLink (as target) | one-to-many | A note can be the target of many backlinks |
| Note -> TaskItem | one-to-many | A note can contain many task/checkbox items |
| Note -> Attachment | one-to-many | A note can have many file/image attachments |
| Note -> NoteVersion | one-to-many | A note has many historical versions (max 100) |
| SavedView -> Folder | many-to-one (optional) | A saved view can optionally filter to one folder |

### 4.4 Indexes

| Entity | Index | Fields | Reason |
|--------|-------|--------|--------|
| Note | idx_note_folder | folder_id | Filter notes by folder |
| Note | idx_note_sort_default | (is_pinned DESC, updated_at DESC) | Default note list order: pinned first, then most recently modified |
| Note | idx_note_daily | (is_daily_note, daily_note_date) | Fast daily note lookup by date |
| Note | idx_note_created | created_at | Sort by creation date |
| Note | idx_note_word_count | word_count | Sort by word count |
| Note | idx_note_title | title | Alphabetical sorting |
| Folder | idx_folder_parent | parent_id | List child folders |
| Folder | idx_folder_order | (parent_id, sort_order) | Ordered sibling listing |
| Tag | idx_tag_name | name (UNIQUE, CI) | Prevent duplicates, fast lookup |
| Tag | idx_tag_parent | parent_tag_id | List child tags |
| Tag | idx_tag_usage | usage_count DESC | Sort by popularity |
| NoteTag | pk_notetag | (note_id, tag_id) | Composite PK |
| NoteTag | idx_notetag_tag | tag_id | Reverse lookup by tag |
| NoteLink | idx_notelink_source | source_note_id | Outgoing links from a note |
| NoteLink | idx_notelink_target | target_note_id | Incoming backlinks to a note |
| NoteLink | idx_notelink_title | target_title | Resolve unlinked references |
| NoteLink | idx_notelink_unique | (source_note_id, target_title) UNIQUE | One link per target title per source |
| Template | idx_template_name | name (UNIQUE) | Prevent duplicates |
| Template | idx_template_category | (category, sort_order) | Ordered listing by category |
| TaskItem | idx_task_note | note_id | List tasks in a note |
| TaskItem | idx_task_order | (note_id, sort_order) | Ordered task listing |
| TaskItem | idx_task_incomplete | (is_completed, note_id) | Filter incomplete tasks |
| Attachment | idx_attach_note | note_id | List attachments for a note |
| NoteVersion | idx_version_note | note_id | List versions of a note |
| NoteVersion | idx_version_order | (note_id, version_number DESC) | Ordered version history |
| SavedView | idx_view_order | sort_order | Ordered view listing |
| RecentSearch | idx_search_recent | searched_at DESC | Most recent searches first |

### 4.5 Table Prefix

**MyLife hub table prefix:** `nt_`

All table names in the SQLite database are prefixed to avoid collisions with other modules in the MyLife hub. The mapping:

| Logical Name | Hub Table Name |
|-------------|---------------|
| Note | nt_notes |
| Folder | nt_folders |
| Tag | nt_tags |
| NoteTag | nt_note_tags |
| NoteLink | nt_note_links |
| Template | nt_templates |
| TaskItem | nt_task_items |
| Attachment | nt_attachments |
| NoteVersion | nt_note_versions |
| SavedView | nt_saved_views |
| Setting | nt_settings |
| RecentSearch | nt_recent_searches |
| SearchIndex (FTS5) | nt_search_index |

### 4.6 Migration Strategy

- **Module enable:** All 12 tables (plus the FTS5 virtual table) are created when the user enables the MyNotes module. The schema version is tracked in the hub's `hub_module_migrations` table.
- **Built-in templates:** On first enable, 5 built-in templates (Meeting Notes, Project Plan, Weekly Review, Daily Log, Reading Notes) are seeded into the `nt_templates` table with `is_builtin = true`.
- **Default settings:** On first enable, all default settings from the Setting entity's default table are inserted into `nt_settings`.
- **FTS5 index:** The `nt_search_index` virtual table is created with `CREATE VIRTUAL TABLE nt_search_index USING fts5(...)`. Triggers or application-level hooks keep it synchronized with `nt_notes`.
- **Schema upgrades:** Additive migrations only (new columns, new tables, new indexes). Column removal and type changes are deferred to major versions with explicit migration steps.
- **Standalone import:** Users migrating from the standalone MyNotes app can use the data importer (NT-013) to bring in their notes, folders, tags, and attachments. The importer reads the standalone SQLite file and maps data into the hub-prefixed tables.
- **Data preservation on disable:** When the user disables MyNotes, all `nt_*` tables are preserved. Data is not deleted. Re-enabling the module restores access to all existing data.
- **Full delete:** Users can permanently delete all MyNotes data from Settings > MyNotes > Delete All Data. This drops all `nt_*` tables and recreates them empty on the next enable.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Notes | Document/page icon | Note List | Scrollable list of all notes with sort/filter controls; default view sorted by pinned first, then last modified |
| Search | Magnifying glass icon | Search | Full-text search across all notes, titles, tags, and folder names with FTS5 |
| Graph | Network/nodes icon | Knowledge Graph | Interactive force-directed graph of note connections via wiki links |
| Templates | Grid/squares icon | Template Gallery | Browse, create, and manage note templates organized by category |
| Settings | Gear icon | Settings | User preferences, data management, about, and module configuration |

### 5.2 Navigation Flow

```
[Tab 1: Notes]
  ├── Note List (default view)
  │     ├── Note Editor (tap a note)
  │     │     ├── Backlinks Panel (toggle from toolbar)
  │     │     ├── Table of Contents Panel (toggle from toolbar)
  │     │     ├── Version History (from note menu)
  │     │     │     └── Version Diff View (tap a version)
  │     │     ├── Focus/Zen Mode (from toolbar or keyboard shortcut)
  │     │     ├── Attachment Picker (from toolbar embed button)
  │     │     └── Export Dialog (from note menu)
  │     ├── New Note (FAB or toolbar button)
  │     │     └── Template Picker (optional, select a template)
  │     ├── Folder Sidebar / Drawer (swipe or hamburger menu)
  │     │     ├── Folder List (tree view)
  │     │     ├── Create Folder Dialog
  │     │     ├── Edit Folder Dialog
  │     │     └── Saved Views List
  │     └── Sort/Filter Bar (inline controls above the note list)
  │           └── Saved View Creator (save current sort/filter)
  │
  [Tab 2: Search]
  ├── Search Input + Recent Searches
  └── Search Results List
        └── Note Editor (tap a result)
  │
  [Tab 3: Graph]
  ├── Knowledge Graph (full-screen interactive)
  │     ├── Node Detail Popup (tap a node)
  │     │     └── Note Editor (tap "Open Note")
  │     ├── Filter Controls (filter by folder, tag, link count)
  │     └── Graph Settings (physics, labels, colors)
  │
  [Tab 4: Templates]
  ├── Template Gallery (categorized grid/list)
  │     ├── Template Preview (tap a template)
  │     │     ├── Use Template (creates new note)
  │     │     └── Edit Template (for custom templates)
  │     └── Create Template (FAB)
  │
  [Tab 5: Settings]
  ├── Editor Settings (font, spacing, theme, auto-save)
  ├── Focus Mode Settings (typewriter, timer, font boost, warmth)
  ├── Search Settings (include body, include tags)
  ├── Note List Settings (density, word count badge)
  ├── Daily Notes Settings (template, auto-create)
  ├── Import (from markdown, JSON, Obsidian, Bear, Evernote)
  ├── Export (bulk export all notes)
  ├── Version History Settings (interval, max versions)
  ├── Graph Settings (physics, default filters)
  ├── Data Management (storage usage, delete all data)
  └── About (version, licenses)
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Note List | `/notes` | Browse, sort, filter, and manage all notes | Tab 1 (default), back navigation from editor |
| Note Editor | `/notes/:id` | Create, edit, and read a note with live markdown preview | Tap note in list, tap search result, tap graph node, tap "Use Template", tap wiki link, deep link |
| New Note | `/notes/new` | Create a new blank note or from template | FAB on Note List, quick capture, daily note auto-create |
| Folder Sidebar | `/notes?folder=:id` | Browse folder tree, navigate to folder contents | Hamburger menu or swipe-right on Note List |
| Search | `/search` | Full-text search with recent queries | Tab 2 |
| Search Results | `/search?q=:query` | Display search results ranked by BM25 | Typing in search input |
| Knowledge Graph | `/graph` | Interactive visualization of note connections | Tab 3 |
| Template Gallery | `/templates` | Browse and manage note templates | Tab 4 |
| Template Preview | `/templates/:id` | Preview a template's content before using it | Tap template in gallery |
| Template Editor | `/templates/:id/edit` | Edit a custom template | "Edit" button on template preview |
| Version History | `/notes/:id/versions` | Browse historical versions of a note | Note menu > "Version History" |
| Version Diff | `/notes/:id/versions/:v1/:v2` | Side-by-side or inline diff between two versions | Tap a version in history list |
| Focus Mode | `/notes/:id/focus` | Distraction-free full-screen editor | Toolbar button, keyboard shortcut, three-finger double-tap |
| Settings | `/settings` | Configure all MyNotes preferences | Tab 5 |
| Import | `/settings/import` | Import notes from external sources | Settings > Import |
| Export | `/settings/export` | Bulk export all notes | Settings > Export |
| Data Management | `/settings/data` | View storage usage, delete all data | Settings > Data Management |
| Onboarding | `/onboarding` | First-run welcome flow with sample notes | Auto-shown on first module enable |
| Quick Capture | `/capture` | Minimal note input for fast thought capture | FAB long-press, widget, share sheet |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://notes` | Note List | None |
| `mylife://notes/:id` | Note Editor | id: UUID of the note |
| `mylife://notes/new` | New Note | None |
| `mylife://notes/new?template=:id` | New Note from Template | template: UUID of the template |
| `mylife://notes/new?daily=true` | Daily Note | Creates or opens today's daily note |
| `mylife://notes/search?q=:query` | Search Results | q: URL-encoded search query |
| `mylife://notes/graph` | Knowledge Graph | None |
| `mylife://notes/graph?focus=:id` | Graph focused on a note | focus: UUID of the note to center on |
| `mylife://notes/capture` | Quick Capture | None |
| `mylife://notes/capture?text=:text` | Quick Capture with prefilled text | text: URL-encoded text to prepopulate |
| `mylife://notes/settings` | Settings | None |
| `mylife://notes/import` | Import | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Reading notes linked to books | MyBooks | MyNotes | MyBooks creates a note in MyNotes with title "Notes: [Book Title]" and tags ["book-notes", book-slug] | User taps "Create Reading Notes" on a book detail screen in MyBooks |
| Recipe notes with structured formatting | MyRecipes | MyNotes | MyRecipes creates a note from the "Recipe Notes" template, pre-filling the recipe name and a link back to the recipe | User taps "Add Cooking Notes" on a recipe detail screen |
| Flashcard creation from note content | MyNotes | MyFlash | User selects text in a note, taps "Create Flashcard" in the context menu; selected text is sent to MyFlash as a new card's answer field, with the note title as context | User action: select text > context menu > "Create Flashcard" |
| Journal vs Notes differentiation | MyJournal | MyNotes | No direct data flow. MyJournal handles freeform date-based reflections; MyNotes handles structured/linked knowledge notes. Both appear in the hub but are distinct modules. | N/A - conceptual boundary |
| Medical appointment notes | MyMeds | MyNotes | MyMeds creates a note from the "Medical Appointment" template with date and medication context pre-filled | User taps "Add Appointment Notes" from a medication detail screen |
| Habit project notes | MyHabits | MyNotes | MyHabits creates a note linked to a specific habit, tagged with "habit-notes" and the habit name | User taps "Add Notes" on a habit detail screen |
| Daily note includes habit summary | MyHabits | MyNotes | If both modules are enabled, the daily note template can include a "Today's Habits" section populated with habit completion status from MyHabits | Daily note auto-creation pulls data from MyHabits if available |
| Daily note includes reading progress | MyBooks | MyNotes | If both modules are enabled, the daily note template can include a "Reading Today" section with the currently-reading book and pages logged | Daily note auto-creation pulls data from MyBooks if available |

**Integration Protocol:**

Cross-module integrations follow a loose coupling pattern. MyNotes does not import code from other modules directly. Instead:

1. The module registry exposes an `onIntegrationRequest(source, action, payload)` event handler.
2. Source modules dispatch integration requests (e.g., `{ action: "create_note", payload: { title, body, tags, template_id } }`).
3. MyNotes handles the request by creating a note with the provided payload.
4. If MyNotes is disabled, the integration request is silently dropped (no error).
5. If the target template does not exist, the note is created without a template (plain note with the provided body).

This ensures modules remain independently enable/disable-able with no hard dependencies.

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Note content (title, body, metadata) | Local SQLite (`nt_notes`) | At rest (OS-level encryption) | No | Never leaves device |
| Folder hierarchy | Local SQLite (`nt_folders`) | At rest (OS-level) | No | Never leaves device |
| Tags and tag assignments | Local SQLite (`nt_tags`, `nt_note_tags`) | At rest (OS-level) | No | Never leaves device |
| Wiki links and backlinks | Local SQLite (`nt_note_links`) | At rest (OS-level) | No | Never leaves device |
| Templates | Local SQLite (`nt_templates`) | At rest (OS-level) | No | Built-in templates are read-only; custom templates are user-created |
| Task items | Local SQLite (`nt_task_items`) | At rest (OS-level) | No | Extracted from note markdown |
| File attachments | Local file system (app sandbox) | At rest (OS-level) | No | Stored in app-private directory; referenced by relative path |
| Version history | Local SQLite (`nt_note_versions`) | At rest (OS-level) | No | Full note snapshots stored locally |
| Search index | Local SQLite FTS5 virtual table | At rest (OS-level) | No | Mirrors note content for fast search |
| User preferences | Local SQLite (`nt_settings`) | At rest (OS-level) | No | Key-value pairs, no sensitive data |
| Recent searches | Local SQLite (`nt_recent_searches`) | At rest (OS-level) | No | User's search history stored locally |
| Saved views | Local SQLite (`nt_saved_views`) | At rest (OS-level) | No | Filter/sort configurations |

### 7.2 Network Activity

This module operates entirely offline. No network requests are made under any circumstances.

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| None | N/A | N/A | N/A | N/A |

MyNotes has zero network dependencies. All features - including search, graph view, version history, import, and export - operate entirely on locally stored data. There is no telemetry, no analytics, no crash reporting, no API calls, no CDN requests, and no cloud sync.

### 7.3 Data That Never Leaves the Device

- Note content (titles, body text, markdown formatting)
- Folder structure and organization
- Tag assignments and tag hierarchy
- Wiki links and backlink relationships
- Task/checklist completion state
- File attachments (images, PDFs, documents)
- Version history and diffs
- Search queries and search history
- User preferences and settings
- Template content (both built-in and custom)
- Knowledge graph structure and metadata
- Word counts, character counts, and writing statistics
- Quick capture content
- Daily note content and dates
- Saved view configurations
- Onboarding completion state

### 7.4 User Data Ownership

- **Export:** Users can export all their data in Markdown (individual files per note with frontmatter), JSON (structured export of all entities), or PDF (individual notes rendered as formatted documents). Bulk export creates a ZIP archive containing all notes, folders (as directories), attachments, and a metadata JSON manifest.
- **Delete:** Users can delete all MyNotes data from Settings > Data Management > Delete All Data. This permanently removes all `nt_*` tables and all attachment files. The action requires a confirmation dialog with a typed confirmation ("DELETE") to prevent accidental data loss. This action is irreversible.
- **Portability:** Export formats are documented and human-readable. Markdown exports are compatible with Obsidian, Bear, and any text editor. JSON exports include a schema version for forward compatibility. The import feature (NT-013) supports round-trip: data exported from MyNotes can be re-imported into a fresh installation.
- **No vendor lock-in:** Notes are stored as plain markdown text. Even without using the export feature, advanced users could access the SQLite database directly and extract their data.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| OS-level encryption | Required | SQLite database and attachment files are protected by the OS file system encryption (iOS Data Protection, Android file-based encryption) |
| App sandbox | Required | All data stored within the app's private sandbox directory; inaccessible to other apps |
| No clipboard sniffing | Required | MyNotes never reads the clipboard unless the user explicitly pastes (Ctrl/Cmd+V or long-press > Paste) |
| No background data access | Required | MyNotes does not access or process data when the app is in the background (except for quick capture widget, which only writes) |
| Attachment validation | Required | Uploaded files are validated for MIME type and size (max 50 MB). Executable file types are rejected. |
| Export data integrity | Required | Exported ZIP archives include a SHA-256 checksum manifest for verifying file integrity |
| No third-party SDKs | Required | MyNotes includes no third-party analytics, advertising, or tracking SDKs |
| Memory-safe content rendering | Required | Markdown rendering sanitizes HTML to prevent script injection in note content (no raw HTML execution) |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Backlink | A reference from note B back to note A, created when note B contains a [[wiki link]] to note A. Backlinks are displayed in the Backlinks Panel on note A. |
| BM25 | Best Matching 25, a probabilistic ranking function used by FTS5 to score search results by relevance. Higher scores indicate better matches. |
| Body | The main markdown content of a note, excluding the title. Stored in the `body` field. |
| Body Plain | The plain-text version of a note's body with all markdown syntax stripped. Used for word counts, search indexing, and character counts. |
| Daily Note | A note automatically created (or manually created) for a specific calendar date, using a configured template. Identified by `is_daily_note = true` and `daily_note_date`. |
| Focus Mode | A distraction-free editing mode that hides all UI chrome (sidebar, toolbar, status bar, tabs) and expands the editor to fill the full viewport. Also called Zen Mode. |
| Folder | A hierarchical organizational container for notes. Folders can be nested up to 10 levels deep via parent_id. |
| FTS5 | Full-Text Search version 5, a SQLite extension that provides fast text search with tokenization, ranking, and snippet extraction. |
| Hub | The MyLife application shell that hosts multiple modules. MyNotes runs as a module within the hub. |
| Inbox | The default location for notes that have not been assigned to any folder. Inbox notes have `folder_id = null`. |
| Knowledge Graph | An interactive force-directed visualization of note connections based on wiki links. Nodes represent notes; edges represent [[links]] between them. |
| Markdown | A lightweight markup language for formatting text. MyNotes supports CommonMark plus extensions for strikethrough, task lists, tables, footnotes, and LaTeX math. |
| Module | A self-contained feature package within the MyLife hub. MyNotes is one module. Modules can be enabled/disabled independently. |
| ModuleDefinition | The TypeScript contract that every MyLife module must implement, defining its ID, name, icon, storage type, migrations, and navigation structure. |
| Note | The primary entity in MyNotes. A note consists of a title, markdown body, metadata (timestamps, word count, pin status), and relationships to folders, tags, links, tasks, attachments, and versions. |
| NoteLink | A record tracking a [[wiki link]] from one note (source) to another note (target). Used to build the backlinks panel and knowledge graph. |
| Quick Capture | A minimal-UI flow for rapidly creating notes with a single text input and save button. Designed for fast thought capture without navigating the full editor. |
| Saved View | A user-defined combination of sort field, sort direction, and filter criteria that can be saved and recalled for quick access to a specific note listing. |
| Table Prefix | A short string (e.g., `nt_`) prepended to all table names in the SQLite database to prevent collisions between different modules in the MyLife hub. |
| Tag | A label applied to notes for cross-cutting organization. Tags support nesting (parent/child hierarchy) and are independent of the folder structure. |
| Template | A reusable note body with placeholder tokens (e.g., `{{date}}`, `{{title}}`) that is used as the starting content when creating a new note. |
| Typewriter Scrolling | A Focus Mode option that keeps the active cursor line vertically centered (at ~40% from the top) as the user types, preventing the cursor from reaching the bottom of the screen. |
| Version | A historical snapshot of a note's content at a point in time, stored in NoteVersion. Used for version history and diff comparison. |
| Wiki Link | A double-bracket reference (`[[Note Title]]`) embedded in a note's body that creates a navigable link to another note. If the target note does not exist, tapping the link offers to create it. |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-07 | Claude (spec-mynotes agent) | Initial specification - 24 features, full data architecture, screen map, cross-module integration, privacy requirements, glossary |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should MyNotes support real-time collaboration (shared notes)? | Competitors like Notion offer real-time co-editing. However, this conflicts with the offline-first, privacy-first model. | Deferred. Real-time collaboration requires a server component and account system, which contradicts the core privacy positioning. May revisit in v3+ if user demand warrants it. | 2026-03-07 |
| 2 | Should the graph view support clustering by folder or tag? | Obsidian's graph view supports color-coding by folder. This could help users identify knowledge clusters. | Planned for graph v1.1. Initial graph (NT-015) supports basic node coloring by folder. Tag-based clustering is a future enhancement. | 2026-03-07 |
| 3 | Should MyNotes support handwriting input (Apple Pencil, stylus)? | Apple Notes and GoodNotes support handwriting. However, handwriting recognition and rendering is a significant engineering effort. | Deferred indefinitely. Handwriting is outside the scope of a markdown-focused note app. Users who need handwriting should use a dedicated handwriting app. | 2026-03-07 |
| 4 | What is the maximum note size before performance degrades? | Very long notes (100,000+ words) may cause editor lag during parsing. | Set a soft limit warning at 50,000 words. The editor should remain functional up to 100,000 words. Notes beyond 100,000 words show a warning suggesting the user split the note. | 2026-03-07 |
| 5 | Should attachments be embedded inline or referenced by link? | Inline embedding provides a richer editing experience but increases rendering complexity. | Both. Images are rendered inline in the live preview. Other file types (PDF, ZIP) are shown as download links with file type icon and size. | 2026-03-07 |
