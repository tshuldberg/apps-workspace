# Feature Spec: Templates UI

## Metadata
- **Module:** notes
- **Priority Score:** 36 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** NT-008 (Note Templates -- `nt_templates` table exists with CRUD)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The `nt_templates` table and CRUD operations already exist, but there is no user-facing UI for creating, editing, browsing, or applying templates. Users cannot access template functionality at all. Notion's template system is a key differentiator -- users create reusable structures for meeting notes, project plans, weekly reviews, and more. Obsidian has community templates and a Templater plugin that is among the most installed. MyNotes needs a polished template browser with built-in starter templates and full CRUD so users can build their own. This closes a major gap where the backend exists but the frontend does not.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Notion | Yes | Free tier | Template gallery with categories, community templates, /template command, duplicate page as template. |
| Obsidian | Yes | Free | Core Templates plugin (insert template content) + community Templater plugin (variables, dates, prompts). |
| Evernote | Yes | Premium | Template gallery with categories, apply on new note. Premium feature. |
| Apple Notes | No | N/A | No template system. |

### Target User
Users who create structurally similar notes repeatedly: meeting notes, project plans, weekly reviews, daily standups, reading notes, recipe cards. Primary migration target: Notion users who rely on templates for structured note-taking and Obsidian users with template workflows.

## Technical Context

### Where This Lives in MyLife

```
modules/notes/src/templates/                      -- NEW: template engine enhancements
modules/notes/src/templates/built-in.ts           -- 8 built-in starter templates
modules/notes/src/templates/variables.ts          -- Template variable expansion ({{date}}, {{time}})
modules/notes/src/templates/index.ts              -- Barrel export
modules/notes/src/templates/__tests__/            -- Tests
apps/mobile/app/(notes)/templates.tsx             -- Mobile template browser
apps/mobile/app/(notes)/template-editor.tsx       -- Mobile template editor
apps/web/app/notes/templates/page.tsx             -- Web template browser
apps/web/app/notes/templates/editor/page.tsx      -- Web template editor
```

### Wireframe Position

```
Hub Dashboard
  └── MyNotes card
       └── Notes tab -> "New Note" -> "From Template" ← YOU ARE HERE
       └── Settings tab -> "Templates" ← ALSO HERE (manage templates)
```

### Data Model

Extend existing `nt_templates` table in migration V2:

```sql
ALTER TABLE nt_templates ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE nt_templates ADD COLUMN category TEXT DEFAULT 'custom'
  CHECK (category IN ('built_in', 'custom'));
ALTER TABLE nt_templates ADD COLUMN icon TEXT DEFAULT '📄';
ALTER TABLE nt_templates ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE nt_templates ADD COLUMN is_built_in INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS nt_templates_category_idx ON nt_templates(category);
```

### Dependencies
- **Internal:** `@mylife/db`, templates CRUD (existing: `createTemplate`, `getTemplates`, `deleteTemplate`), notes CRUD (`createNote`)
- **External:** none
- **Cross-Module:** Templates could be shared concept with journal module's prompt templates, but they are independent implementations.

## Functional Requirements

### User Stories
1. As a user, I want to browse available templates when creating a new note so that I can start with a useful structure.
2. As a power user, I want to create and edit my own templates so that I can standardize my recurring note formats.
3. As a new user, I want built-in starter templates so that I can see examples and start using templates immediately.

### Behavior Specification

1. User taps "New Note" on the Notes tab.
2. Action sheet: "Blank Note" (default) or "From Template".
3. User taps "From Template":
   a. Template browser opens with two sections: "Built-in" (8 starter templates) and "My Templates" (user-created).
   b. Each template card shows: icon, name, description, preview of first 2 lines of body.
4. User taps a template card:
   a. New note created with `body = expandVariables(template.body)`.
   b. Template `use_count` incremented.
   c. Note editor opens with the pre-populated content.
5. Template variable expansion:
   - `{{date}}` -> today's date in the user's preferred format
   - `{{time}}` -> current time (HH:MM)
   - `{{day}}` -> day of the week (e.g., "Monday")
   - `{{month}}` -> month name (e.g., "March")
   - `{{year}}` -> year (e.g., "2026")
6. Template management (Settings > Templates):
   a. List of all templates with edit/delete actions.
   b. "Create Template" button opens template editor.
   c. Template editor: name, description, icon picker, body (markdown editor).
   d. "Save as Template" option in note overflow menu: saves current note's body as a new template.
7. Built-in templates cannot be deleted but can be hidden. They can be duplicated to create custom versions.

### Edge Cases

- **No custom templates:** Only built-in templates shown in the browser.
- **Empty template body:** Creates a note with just the title. Body is empty.
- **Template with variables:** Variables expanded at creation time. If a variable is unrecognized, it stays as literal text.
- **Delete custom template:** Confirmation dialog. Existing notes created from it are unaffected.
- **Very long template:** No limit on template body length. Same as note body.
- **Built-in template hidden:** Disappears from browser. Can be unhidden in template management.
- **Duplicate template name:** Allowed. Templates are identified by ID, not name.
- **Save as Template from note:** Current note body becomes template body. Title becomes template name.

### Built-in Templates (8)

1. **Meeting Notes** -- Attendees, Agenda, Discussion, Action Items checklist
2. **Project Plan** -- Overview, Goals, Milestones, Timeline, Resources
3. **Weekly Review** -- Wins, Challenges, Lessons, Next Week Goals, Gratitude
4. **Daily Standup** -- Yesterday, Today, Blockers (with `{{date}}` variable)
5. **Reading Notes** -- Book/Article info, Key Ideas, Quotes, My Thoughts, Rating
6. **Decision Log** -- Context, Options, Pros/Cons, Decision, Rationale
7. **Bug Report** -- Summary, Steps to Reproduce, Expected/Actual, Environment
8. **Cornell Notes** -- Cues column, Notes column, Summary section

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "From Template" option appears in the new note action sheet.
- [ ] **AC-2:** Template browser shows built-in and custom templates with icons and descriptions.
- [ ] **AC-3:** Tapping a template creates a new note with expanded template body.
- [ ] **AC-4:** Template variables (`{{date}}`, `{{time}}`, etc.) are expanded at creation time.
- [ ] **AC-5:** Template management screen lists all templates with edit/delete actions.
- [ ] **AC-6:** Template editor allows creating and editing custom templates.
- [ ] **AC-7:** "Save as Template" option in note overflow menu.
- [ ] **AC-8:** 8 built-in starter templates available on first use.
- [ ] **AC-9:** Built-in templates can be hidden but not deleted.
- [ ] **AC-10:** Template use count tracked and displayed.

### Technical Criteria
- [ ] **TC-1:** Migration V2 adds description, category, icon, use_count, is_built_in columns to `nt_templates`.
- [ ] **TC-2:** Built-in templates seeded on first migration run.
- [ ] **TC-3:** `expandVariables(body)` replaces all recognized `{{variable}}` patterns.
- [ ] **TC-4:** Template CRUD uses existing `createTemplate`, `getTemplates`, `deleteTemplate` functions.
- [ ] **TC-5:** Use count incremented atomically on each template use.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Deleting a template must NOT affect notes previously created from it.
- [ ] **NC-2:** Built-in templates must NOT be deletable (only hideable).
- [ ] **NC-3:** Unrecognized template variables must NOT be stripped -- they remain as literal text.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Template browser: grid of glass cards (2 columns), icon (32px), name (16px semibold), description (13px textSecondary), body preview (12px, 2 lines, monospace)
- Section headers: "Built-in" and "My Templates" in 14px semibold
- Template editor: name field, description field, icon picker (emoji grid), markdown body editor (reuse existing editor)
- "Save as Template" in note overflow menu
- Module accent: `#64748B`

### Web (Next.js)

- Route: `/notes/templates` (browser), `/notes/templates/editor` (editor)
- Grid layout (3 columns on desktop)
- Same template editor with side-by-side preview

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Custom Templates | Only built-in templates in browser | Fresh install |
| Mixed Templates | Built-in section + My Templates section | User has created templates |
| Template Editor | Name, description, icon, body editor | Creating/editing a template |
| Empty Template | Warning: "This template has no content" | User saves template with empty body |
| Variable Preview | Variables shown as `{{date}}` in editor, expanded in preview | Editing template with variables |

## Test Requirements

### Unit Tests
- [ ] `expandVariables`: `{{date}}` -> today's ISO date
- [ ] `expandVariables`: `{{time}}` -> current HH:MM
- [ ] `expandVariables`: `{{day}}` -> current day name
- [ ] `expandVariables`: `{{unknown}}` -> literal `{{unknown}}` (not stripped)
- [ ] `expandVariables`: no variables -> body unchanged
- [ ] `expandVariables`: multiple variables in one string -> all expanded
- [ ] `seedBuiltInTemplates`: creates 8 templates with is_built_in = 1
- [ ] `incrementUseCount`: use_count 5 -> 6
- [ ] `createNoteFromTemplate`: note body matches expanded template body
- [ ] `hideBuiltInTemplate`: template excluded from browser query

### Integration Tests
- [ ] Full flow: browse templates -> select "Meeting Notes" -> note created with expanded variables -> edit and save
- [ ] Custom flow: create custom template -> use it to create a note -> verify body matches

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyNotes > Notes tab
3. Tap "New Note"
4. Verify: "Blank Note" and "From Template" options -- corresponds to AC-1
5. Tap "From Template"
6. Verify: template browser with built-in templates (Meeting Notes, Project Plan, etc.) -- corresponds to AC-2, AC-8
7. Tap "Daily Standup" template
8. Verify: new note created with expanded `{{date}}` variable -- corresponds to AC-3, AC-4
9. Navigate to Settings > Templates
10. Verify: template list with edit/delete options -- corresponds to AC-5
11. Tap "Create Template"
12. Verify: template editor with name, description, icon, body -- corresponds to AC-6
13. Create a custom template, save it
14. Open a note, tap overflow menu
15. Verify: "Save as Template" option -- corresponds to AC-7
16. Try to delete a built-in template
17. Verify: only "Hide" option, not "Delete" -- corresponds to AC-9
18. Open the app on web
19. Navigate to Notes > Templates
20. Verify: same template browser and editor functionality

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to template browser, create note from template, manage templates

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The `nt_templates` table exists with basic CRUD (name, body, created_at). No UI for browsing, creating, or applying templates. No built-in templates. No template variables.

### After This Work
Template browser with 8 built-in starters and custom templates. Template editor for creating/editing. Variable expansion (`{{date}}`, `{{time}}`, etc.). "Save as Template" from notes. Template management in settings. Use count tracking.

### Files Changed
- `modules/notes/src/db/schema.ts` -- ALTER TABLE for new nt_templates columns
- `modules/notes/src/definition.ts` -- add template columns to NOTES_MIGRATION_V2
- `modules/notes/src/templates/built-in.ts` -- 8 built-in template definitions
- `modules/notes/src/templates/variables.ts` -- expandVariables function
- `modules/notes/src/templates/index.ts` -- barrel export
- `modules/notes/src/templates/__tests__/variables.test.ts` -- 10+ unit tests
- `modules/notes/src/db/crud.ts` -- add updateTemplate, incrementUseCount, hideTemplate
- `modules/notes/src/types.ts` -- extend NoteTemplateSchema with new fields
- `modules/notes/src/index.ts` -- re-export templates module
- `apps/mobile/app/(notes)/templates.tsx` -- template browser
- `apps/mobile/app/(notes)/template-editor.tsx` -- template editor
- `apps/web/app/notes/templates/page.tsx` -- web template browser
- `apps/web/app/notes/templates/editor/page.tsx` -- web template editor

### Known Limitations
- No conditional logic in templates (no if/else blocks).
- No template inheritance or composition (no "template of templates").
- No community template sharing or marketplace.
- Variables are text-only. No dynamic content like "last 5 notes" or "today's tasks."

### Context for Next Agent
- The existing `createTemplate`, `getTemplates`, `deleteTemplate` functions in `db/crud.ts` handle basic CRUD. Extend with `updateTemplate`, `incrementUseCount`, and `hideTemplate`.
- Built-in templates should be seeded in the V2 migration's `up` array as INSERT statements with `is_built_in = 1`.
- Variable expansion runs at note creation time, not at template save time. Template body stores literal `{{date}}` text.
- The `expandVariables` function should be a simple `string.replace` with a map of known variables. Unknown variables pass through unchanged.
- V2 migration coordination: shares V2 with image/file attachments and daily notes. Combine all into one V2.
