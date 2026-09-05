# Feature Spec: Daily Notes

## Metadata
- **Module:** notes
- **Priority Score:** 38 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** NT-001 (Markdown Editor -- implemented), NT-008 (Note Templates -- `nt_templates` table exists)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Daily notes are Obsidian's most popular core feature. Users tap a button and instantly get (or create) a note for today, pre-populated with a template. It becomes a daily log, scratchpad, or journal -- always one tap away. Obsidian users who love daily notes but want a mobile-first experience are a prime migration target. MyNotes already has the `nt_templates` table for templates and the `nt_notes` table for content. Adding daily notes is a low-complexity, high-value feature that creates a daily engagement loop -- users open the app every day to write in their daily note.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Obsidian | Yes | Free | Daily notes with configurable template, auto-create on open, date-formatted title, navigable calendar. Core plugin. |
| Notion | Partial | Free tier | No native daily notes. Users build their own with databases + templates. |
| Logseq | Yes | Free | Daily journal is the default home screen. Each day auto-creates a page. |
| Apple Notes | No | N/A | No daily notes concept. |
| Evernote | No | N/A | No daily notes. Users manually create dated notes. |

### Target User
Daily journalers, bullet journalers, developers who keep daily standups/logs, students who write daily study logs. Primary migration target: Obsidian users (1.5M MAU) who rely on daily notes as their primary workflow and want a better mobile experience.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/daily/                          -- NEW: daily notes engine
modules/notes/src/daily/types.ts                  -- DailyNoteConfig types
modules/notes/src/daily/engine.ts                 -- Create/get today's note, date navigation
modules/notes/src/daily/index.ts                  -- Barrel export
modules/notes/src/daily/__tests__/                -- Tests
apps/mobile/app/(notes)/daily.tsx                 -- Mobile daily note screen
apps/web/app/notes/daily/page.tsx                 -- Web daily note page
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab
            └── "Today" button (floating) ← YOU ARE HERE
       └── Daily tab (new tab) ← OR HERE
```

### Data Model

New columns on `nt_notes` in migration V2:

```sql
ALTER TABLE nt_notes ADD COLUMN is_daily_note INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nt_notes ADD COLUMN daily_date TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS nt_notes_daily_date_idx ON nt_notes(daily_date) WHERE daily_date IS NOT NULL;
```

New settings keys (using existing `nt_settings`):

```sql
INSERT OR IGNORE INTO nt_settings (key, value) VALUES ('dailyNoteEnabled', 'true');
INSERT OR IGNORE INTO nt_settings (key, value) VALUES ('dailyNoteTemplateId', '');
INSERT OR IGNORE INTO nt_settings (key, value) VALUES ('dailyNoteFolderId', '');
INSERT OR IGNORE INTO nt_settings (key, value) VALUES ('dailyNoteTitleFormat', 'YYYY-MM-DD');
```

### Dependencies
- **Internal:** `@mylife/db`, notes CRUD, templates CRUD (`getTemplates`, `createNote`), settings (`getSetting`, `setSetting`)
- **External:** none (date formatting is standard JS)
- **Cross-Module:** Daily notes could feed into journal module's daily prompts. Cross-module search can index daily note content.

## Functional Requirements

### User Stories
1. As a daily logger, I want to tap one button to open today's note so that I can start writing immediately without creating a new note manually.
2. As an Obsidian user, I want daily notes auto-created from a template so that each day starts with my preferred structure (headers, checkboxes, sections).
3. As a user reviewing past days, I want to navigate between daily notes by date so that I can browse my history chronologically.

### Behavior Specification

1. User enables daily notes in Settings (enabled by default).
2. Configuration options in Settings:
   a. Template: choose from existing `nt_templates` (default: none/blank).
   b. Folder: choose a folder for daily notes (default: root).
   c. Title format: `YYYY-MM-DD` (default), `MMM D, YYYY`, or `dddd, MMMM D`.
3. User taps "Today" button (floating button on Notes tab or dedicated Daily tab).
4. System checks: does a note with `daily_date = today` exist?
   a. If yes: opens that note in the editor.
   b. If no: creates a new note with:
      - `is_daily_note = 1`
      - `daily_date = YYYY-MM-DD` (ISO date)
      - `title = formatted date` (per title format setting)
      - `body = template body` (if template configured, else empty)
      - `folder_id = configured folder` (if set)
5. Daily note editor has date navigation arrows: left arrow (previous day) and right arrow (next day).
6. Navigating to a date that has no daily note shows "No note for this date" with a "Create" button.
7. A calendar view (mini month calendar) shows dots on dates that have daily notes. Tapping a date navigates to that day's note.
8. Daily notes appear in the regular notes list with a calendar icon badge.

### Edge Cases

- **Multiple daily notes for same date:** UNIQUE index prevents this. The `getOrCreateDailyNote` function is atomic.
- **Template deleted after daily note created:** Note body is already populated; deletion of template has no effect.
- **Folder deleted:** Daily notes in that folder get `folder_id = NULL` (existing CASCADE behavior). New daily notes go to root until user reconfigures.
- **Date navigation beyond available notes:** Show "No note for [date]" with "Create" option.
- **Timezone changes (travel):** Daily date is determined by the device's local date at creation time.
- **Daily notes disabled:** "Today" button hidden. Existing daily notes remain accessible as regular notes.
- **Title format change:** Only affects new daily notes. Existing titles are not retroactively renamed.
- **First day ever:** Creates first daily note. Previous day navigation shows "No note."
- **User manually creates note with same title as daily note format:** Not a conflict -- `is_daily_note` flag distinguishes them.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Today" button visible on the Notes tab (floating) or as a dedicated Daily tab.
- [ ] **AC-2:** Tapping "Today" opens today's daily note if it exists.
- [ ] **AC-3:** Tapping "Today" creates a new daily note from template if none exists for today.
- [ ] **AC-4:** Daily note editor shows date navigation arrows (previous/next day).
- [ ] **AC-5:** Navigating to a date without a note shows "No note for [date]" with "Create" button.
- [ ] **AC-6:** Calendar view shows dots on dates with daily notes.
- [ ] **AC-7:** Daily notes configurable: template, folder, title format in Settings.
- [ ] **AC-8:** Daily notes appear in note list with calendar icon badge.
- [ ] **AC-9:** Daily note title formatted according to the user's chosen format.
- [ ] **AC-10:** Daily note body pre-populated from chosen template.

### Technical Criteria
- [ ] **TC-1:** Migration V2 adds `is_daily_note` and `daily_date` columns to `nt_notes`.
- [ ] **TC-2:** UNIQUE index on `daily_date` prevents duplicate daily notes for the same date.
- [ ] **TC-3:** `getOrCreateDailyNote(date)` is atomic -- no race condition on creation.
- [ ] **TC-4:** Settings stored in existing `nt_settings` table.
- [ ] **TC-5:** Daily note date is ISO format `YYYY-MM-DD` regardless of display title format.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Multiple daily notes for the same date must NEVER exist.
- [ ] **NC-2:** Deleting a template must NOT affect existing daily notes created from that template.
- [ ] **NC-3:** Changing the title format must NOT rename existing daily notes.
- [ ] **NC-4:** Daily notes disabled must NOT delete existing daily notes.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- "Today" floating button: circular, `#64748B` background, calendar-today icon, 56px, bottom-right positioned
- Date navigation bar: left arrow, date text (formatted), right arrow, calendar icon (opens mini calendar)
- Calendar view: glass card, dots on dates with notes in `#64748B`, today highlighted
- Daily note badge in list: small calendar icon (16px) in `#64748B` next to note title
- "No note" state: centered text "No note for [date]" in textSecondary, "Create" button in accent
- Module accent: `#64748B`

### Web (Next.js)

- Route: `/notes/daily` (daily note view), `/notes/daily/[date]` (specific date)
- Sidebar shows "Daily Notes" section with calendar widget
- Same date navigation and calendar view
- Keyboard shortcuts: Ctrl+T for today's note

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Today Exists | Today's note opens in editor | Tap "Today", note exists |
| Today New | New note created from template, opens in editor | Tap "Today", no note for today |
| Date With Note | That date's note opens | Navigate to date with note |
| Date Without Note | "No note for [date]" + Create button | Navigate to date without note |
| Calendar | Mini calendar with dots on dates with notes | Tap calendar icon |
| Disabled | No "Today" button, no Daily tab | Daily notes disabled in settings |

## Test Requirements

### Unit Tests
- [ ] `getOrCreateDailyNote`: no note exists -> creates note with correct date, title, template body
- [ ] `getOrCreateDailyNote`: note exists -> returns existing note, no new note created
- [ ] `getOrCreateDailyNote`: with template -> body matches template body
- [ ] `getOrCreateDailyNote`: with folder -> note placed in configured folder
- [ ] `formatDailyTitle`: YYYY-MM-DD format -> "2026-03-22"
- [ ] `formatDailyTitle`: MMM D, YYYY format -> "Mar 22, 2026"
- [ ] `getDailyNoteDates`: returns list of dates that have daily notes
- [ ] `navigateToDate`: date with note -> returns note
- [ ] `navigateToDate`: date without note -> returns null
- [ ] `isDailyNote`: daily note -> true, regular note -> false

### Integration Tests
- [ ] Full flow: tap Today -> note created with template -> add content -> navigate away -> tap Today -> same note opens
- [ ] Calendar flow: create 3 daily notes on different days -> calendar shows dots on those dates -> tap a dot -> correct note opens

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Settings
3. Verify: daily notes settings (template, folder, title format) -- corresponds to AC-7
4. Set a template for daily notes
5. Navigate to Notes tab
6. Verify: "Today" button visible -- corresponds to AC-1
7. Tap "Today"
8. Verify: new daily note created with template content and formatted title -- corresponds to AC-3, AC-9, AC-10
9. Type some content, go back to Notes tab
10. Tap "Today" again
11. Verify: same note opens with content preserved -- corresponds to AC-2
12. Verify: date navigation arrows visible in daily note editor -- corresponds to AC-4
13. Tap left arrow to go to yesterday
14. Verify: "No note for [yesterday's date]" with Create button -- corresponds to AC-5
15. Tap calendar icon
16. Verify: calendar shows dot on today's date -- corresponds to AC-6
17. Go back to note list
18. Verify: daily note has calendar icon badge -- corresponds to AC-8
19. Open the app on web
20. Navigate to Notes > Daily
21. Verify: same daily note functionality with calendar sidebar

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to daily notes, create today's note, verify calendar and navigation

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Notes have no concept of daily notes. Users must manually create dated notes. No calendar navigation. The `nt_templates` table exists but templates are not linked to any automated creation flow.

### After This Work
`nt_notes` has `is_daily_note` and `daily_date` columns. A "Today" button creates or opens today's note from a configurable template. Date navigation arrows and a mini calendar enable browsing daily notes chronologically. Settings control template, folder, and title format.

### Files Changed
- `modules/notes/src/db/schema.ts` -- add ALTER TABLE for is_daily_note, daily_date columns, UNIQUE index
- `modules/notes/src/definition.ts` -- add columns to NOTES_MIGRATION_V2, increment schemaVersion to 2
- `modules/notes/src/daily/types.ts` -- DailyNoteConfig type
- `modules/notes/src/daily/engine.ts` -- getOrCreateDailyNote, formatDailyTitle, getDailyNoteDates, navigateToDate
- `modules/notes/src/daily/index.ts` -- barrel export
- `modules/notes/src/daily/__tests__/engine.test.ts` -- 10+ unit tests
- `modules/notes/src/types.ts` -- extend NoteSchema with is_daily_note, daily_date fields
- `modules/notes/src/index.ts` -- re-export daily module
- `apps/mobile/app/(notes)/daily.tsx` -- daily note screen with date navigation
- `apps/web/app/notes/daily/page.tsx` -- web daily note page

### Known Limitations
- No recurring template placeholders (e.g., `{{date}}`, `{{day_of_week}}` in template body). Templates are static.
- No weekly or monthly note variants (daily only).
- Calendar view is a simple month view with dots. No week view or agenda view.
- Daily notes are strictly one per date. No support for multiple daily notes.

### Context for Next Agent
- `getOrCreateDailyNote` should use a transaction to prevent race conditions: check for existing note, create if missing, return note.
- The `daily_date` column stores ISO `YYYY-MM-DD` string. The `title` column stores the human-readable formatted date.
- Settings keys use the existing `nt_settings` key-value table. Query with `getSetting('dailyNoteTemplateId')`.
- If `dailyNoteTemplateId` is set, fetch the template body with `getTemplates().find(t => t.id === templateId)` and use it as the initial body.
- The UNIQUE index on `daily_date` with `WHERE daily_date IS NOT NULL` ensures regular notes (null daily_date) are not constrained.
- V2 migration coordination: this shares V2 with image/file attachments. Combine both into a single V2 migration.
