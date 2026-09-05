# Feature Spec: Checklists

## Metadata
- **Module:** notes
- **Priority Score:** 40 / 50 (S-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented, body stores markdown)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Checklists are the single most-used markdown feature after basic formatting. Notion, Apple Notes, Evernote, and Obsidian all support interactive checklists where users tap a checkbox to toggle completion. MyNotes already has `countChecklistItems` in its markdown engine that parses `- [ ]` and `- [x]` syntax, but the editor and preview have no interactive toggle -- users must manually edit the raw markdown. Adding interactive checklists transforms MyNotes from a text editor into a productivity tool, covering to-do lists, shopping lists, packing lists, and project tracking. This is table stakes for competing with any modern note-taking app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Notion | Yes | Free tier | Interactive checkboxes, drag-to-reorder, indent nesting, /todo command. Database views for task management. |
| Apple Notes | Yes | Free | Tap-to-toggle checklists, auto-sort checked to bottom, drag-to-reorder. |
| Evernote | Yes | Free tier | Interactive checkboxes in rich text editor, no markdown syntax. |
| Obsidian | Yes | Free | Markdown `- [ ]` syntax with click-to-toggle in preview mode. Plugins extend with dates, priorities. |

### Target User
Anyone who uses notes for task tracking, shopping lists, packing lists, project checklists, or meeting action items. This is the broadest user segment -- virtually every note-taking user creates checklists. Primary migration target: Apple Notes users (free) and Notion free-tier users who want privacy-first task lists without cloud sync.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/engine/checklist.ts            -- NEW: checklist toggle logic
modules/notes/src/engine/__tests__/checklist.test.ts -- Tests
apps/mobile/app/(notes)/components/ChecklistItem.tsx -- Interactive checkbox component
apps/web/app/notes/components/ChecklistItem.tsx      -- Web checkbox component
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab -> Note Editor
            └── Markdown preview / editor
                 └── Checklist items ← YOU ARE HERE (interactive checkboxes)
```

### Data Model

No new tables or columns needed. Checklists are stored as standard markdown in the `body` column of `nt_notes`:

```markdown
- [ ] Unchecked item
- [x] Checked item
```

The existing `countChecklistItems` function in `engine/markdown.ts` already parses this syntax. The toggle operation modifies the `body` text in-place by swapping `[ ]` with `[x]` (or vice versa) at the specific line.

### Dependencies
- **Internal:** `@mylife/db`, notes CRUD (`updateNote`), `engine/markdown.ts` (`countChecklistItems`)
- **External:** none
- **Cross-Module:** Checklist completion stats could feed into `crossModule.getSearchableContent()` for productivity dashboards. The journal module's therapy templates use a similar checklist pattern for action items.

## Functional Requirements

### User Stories
1. As a personal note-taker, I want to tap checkboxes to toggle items complete so that I can track my to-do list without editing markdown manually.
2. As a user creating a shopping list, I want checked items to optionally sort to the bottom so that I can focus on what I still need.
3. As a project manager, I want to see a progress indicator (e.g., "3/7 done") for notes with checklists so that I know completion status at a glance.

### Behavior Specification

1. User creates or opens a note containing checklist markdown (`- [ ]` or `- [x]`).
2. In the editor, checklist lines render with an interactive checkbox to the left of the text.
3. User taps/clicks a checkbox:
   a. If unchecked (`- [ ]`): toggles to `- [x]`, checkbox fills with accent color, text gets strikethrough style.
   b. If checked (`- [x]`): toggles back to `- [ ]`, checkbox empties, strikethrough removed.
4. The `body` column is updated in-place at the specific line. Auto-save triggers normally.
5. In preview mode, checkboxes are also interactive (same toggle behavior).
6. The formatting toolbar includes a "Checklist" button that inserts `- [ ] ` at the cursor position.
7. Pressing Enter at the end of a checklist line auto-continues with `- [ ] ` on the next line.
8. Pressing Enter on an empty checklist line (`- [ ] ` with no text) removes the checklist prefix and exits checklist mode.
9. Tab on a checklist line indents it (creating a nested checklist). Shift+Tab outdents.
10. Note list view shows a small progress badge: "3/7" or a mini progress bar for notes containing checklists.

### Edge Cases

- **No checklists in note:** No checkbox UI shown. Progress badge not shown in list view.
- **Mixed content:** Checklists interspersed with paragraphs, headings, code blocks. Only checklist lines get interactive checkboxes.
- **Nested checklists:** `  - [ ]` (indented) renders as a nested checkbox. Toggle works at any nesting level.
- **Very long checklist (500+ items):** Virtualize the list for performance. Toggle should remain instant.
- **Rapid toggling:** Each toggle is an individual body update. Debounce auto-save normally (2s).
- **Concurrent editing (web, two tabs):** Last-write-wins. Same as existing note editing.
- **Checklist in code block:** `- [ ]` inside a fenced code block must NOT render as a checkbox. It must render as literal text.
- **Partial markdown:** `- [` without closing `]` is not a checklist item. Render as plain text.
- **Auto-sort checked to bottom:** Optional setting (default off). When enabled, checked items sort to the bottom of their contiguous checklist group after a 500ms delay.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Checklist lines (`- [ ]`, `- [x]`) render with interactive checkboxes in both editor and preview modes.
- [ ] **AC-2:** Tapping a checkbox toggles its state and updates the note body.
- [ ] **AC-3:** Checked items show filled checkbox with accent color and strikethrough text.
- [ ] **AC-4:** Formatting toolbar includes a "Checklist" button that inserts `- [ ] ` at cursor.
- [ ] **AC-5:** Enter at end of checklist line auto-continues with `- [ ] `.
- [ ] **AC-6:** Enter on empty checklist line exits checklist mode.
- [ ] **AC-7:** Tab/Shift+Tab indents/outdents checklist items.
- [ ] **AC-8:** Note list view shows progress badge for notes with checklists.
- [ ] **AC-9:** Nested checklists render with proper indentation and interactive checkboxes.
- [ ] **AC-10:** Optional "sort checked to bottom" setting available in Notes settings.

### Technical Criteria
- [ ] **TC-1:** `toggleChecklistItem(body, lineIndex)` returns updated body with toggled checkbox at the specified line.
- [ ] **TC-2:** Toggle modifies only the target line in the body string. No other lines are affected.
- [ ] **TC-3:** `countChecklistItems` (existing) correctly counts after toggle.
- [ ] **TC-4:** Checklist syntax inside fenced code blocks is not rendered as interactive checkboxes.
- [ ] **TC-5:** Auto-continue inserts `- [ ] ` only when cursor is at end of a checklist line.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Toggling a checkbox must NOT modify any other line in the note body.
- [ ] **NC-2:** Checklist syntax inside code blocks must NOT render as interactive checkboxes.
- [ ] **NC-3:** Checklist progress badge must NOT appear for notes without checklist items.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Checkbox unchecked: 20px square, `rgba(255,255,255,0.10)` border, transparent fill
- Checkbox checked: 20px square, `#64748B` (accent) fill, white checkmark icon
- Checked text: strikethrough, `rgba(240,240,245,0.45)` color
- Unchecked text: `#F0F0F5` (text token)
- Checklist toolbar button: square-check icon in `#64748B`
- Progress badge in list view: "3/7" text in `#64748B`, 12px, right-aligned
- Nesting indent: 24px per level
- Module accent: `#64748B`

### Web (Next.js)

- Route: existing note editor at `/notes/[id]`
- Same checkbox styling via CSS
- Keyboard shortcuts: Ctrl+Shift+9 for checklist (matches Notion convention)
- Progress badge in note list sidebar

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Checklists | Normal note content, no checkboxes | Note has no `- [ ]` or `- [x]` lines |
| Unchecked | Empty checkbox + normal text | `- [ ]` line |
| Checked | Filled checkbox + strikethrough text | `- [x]` line |
| Mixed | Some checked, some unchecked | Multiple checklist items |
| Progress Badge | "3/7" badge on note card | Note contains checklist items |
| Nested | Indented checkboxes at multiple levels | Indented checklist lines |

## Test Requirements

### Unit Tests
- [ ] `toggleChecklistItem`: unchecked line -> returns body with `[x]` at that line
- [ ] `toggleChecklistItem`: checked line -> returns body with `[ ]` at that line
- [ ] `toggleChecklistItem`: non-checklist line -> returns body unchanged
- [ ] `toggleChecklistItem`: line index out of bounds -> returns body unchanged
- [ ] `toggleChecklistItem`: nested checklist item -> toggles correctly
- [ ] `toggleChecklistItem`: multiple checklists in body -> only target line changes
- [ ] `autoSortChecked`: checked items move to bottom of contiguous group
- [ ] `autoSortChecked`: nested items stay nested under their parent
- [ ] `insertChecklist`: inserts `- [ ] ` at cursor position
- [ ] `countChecklistItems` (existing): correctly counts after toggle
- [ ] `isChecklistLine`: identifies `- [ ]` and `- [x]` patterns, rejects code block content

### Integration Tests
- [ ] Full flow: create note with checklist -> toggle item -> save -> re-open -> toggle state persisted
- [ ] Progress flow: create note with 5 items -> check 3 -> list view shows "3/5"

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Notes tab
3. Create a new note
4. Type `- [ ] Buy groceries` and press Enter
5. Verify: auto-continues with `- [ ] ` on next line -- corresponds to AC-5
6. Type `Milk` and press Enter, then `Eggs`
7. Verify: 3 checklist items visible with empty checkboxes -- corresponds to AC-1
8. Tap the checkbox next to "Buy groceries"
9. Verify: checkbox fills with accent color, text gets strikethrough -- corresponds to AC-2, AC-3
10. Press Enter on an empty checklist line
11. Verify: checklist mode exits, plain text cursor -- corresponds to AC-6
12. Tap the formatting toolbar checklist button
13. Verify: `- [ ] ` inserted at cursor -- corresponds to AC-4
14. Tab on a checklist item
15. Verify: item indents -- corresponds to AC-7
16. Go back to note list
17. Verify: progress badge shows "1/3" -- corresponds to AC-8
18. Open the app on web
19. Navigate to Notes
20. Verify: same checklist functionality with keyboard shortcuts

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to note editor, create checklist, verify toggle and progress badge

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Checklist markdown (`- [ ]`, `- [x]`) is stored in note body and counted by `countChecklistItems`, but there is no interactive toggle. Checkboxes do not render in preview. Users must manually edit the raw markdown text to check/uncheck items.

### After This Work
Checklist lines render interactive checkboxes in both editor and preview. Toggling updates the body in-place. Formatting toolbar has a checklist button. Enter auto-continues checklists. Tab/Shift+Tab nests/unnests. Note list shows progress badges.

### Files Changed
- `modules/notes/src/engine/checklist.ts` -- NEW: `toggleChecklistItem`, `autoSortChecked`, `insertChecklist`, `isChecklistLine`
- `modules/notes/src/engine/__tests__/checklist.test.ts` -- 11+ unit tests
- `modules/notes/src/engine/markdown.ts` -- no changes (existing `countChecklistItems` used as-is)
- `modules/notes/src/index.ts` -- re-export checklist functions
- `apps/mobile/app/(notes)/components/ChecklistItem.tsx` -- interactive checkbox component
- `apps/web/app/notes/components/ChecklistItem.tsx` -- web interactive checkbox

### Known Limitations
- Auto-sort checked to bottom is approximate within contiguous groups. Non-contiguous checklists sort independently.
- No drag-to-reorder for checklist items (future feature).
- No due dates or priorities on checklist items (would need structured data beyond markdown).
- Nested checklist depth is limited by markdown indentation (practical limit ~6 levels).

### Context for Next Agent
- The `countChecklistItems(body)` function in `engine/markdown.ts` already handles the regex parsing. Use it for progress badges.
- `toggleChecklistItem` should operate on the raw `body` string by line index, swapping `[ ]` with `[x]` (or vice versa). Use `body.split('\n')`, modify the target line, then `join('\n')`.
- The checklist regex pattern is `^(\s*)-\s+\[([ x])\]\s*(.*)$` where group 1 is indent, group 2 is check state, group 3 is text.
- For auto-continue on Enter, detect if the current line matches the checklist pattern and if the cursor is at the end of the line.
- Code block detection: track fenced code block state (```` ``` ````) to skip checklist rendering inside code blocks.
- The `updateNote` function handles auto-save. Checklist toggle just needs to call `updateNote` with the modified body.
