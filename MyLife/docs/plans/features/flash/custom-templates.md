# Feature Spec: Custom Templates

## Metadata
- **Module:** flash
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 6+ (B+C Features)
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (builds on existing card_type and template_ordinal system)
- **Blocks:** Anki .apkg import (custom note types map to templates)

## Business Context

### Why This Feature Exists
Custom templates are Anki's most powerful differentiator. While Quizlet limits users to front/back, Anki lets users define note types with arbitrary fields (e.g., a vocabulary note with "Word", "Reading", "Meaning", "Example Sentence" fields, generating multiple cards from one note). This enables structured learning patterns like sentence mining, medical pharmacology cards (drug/class/mechanism/side-effects/contraindications), and language cards with audio + pronunciation + meaning fields. MyFlash currently only supports 3 fixed card types (basic, reversed, cloze). Adding custom templates captures the Anki power user segment that refuses to downgrade to simpler tools, and is a prerequisite for importing Anki .apkg files with custom note types.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Anki | Yes | Free | "Note Types" with arbitrary fields. Each note type has card templates (HTML/CSS). Users define field layout per card face. Plugin ecosystem extends this further. |
| Quizlet | No | N/A | Fixed front/back only. No custom fields. |
| Brainscape | No | N/A | Fixed "question/answer" format. No custom fields. |
| StudyFetch | No | N/A | AI-generated cards only. No user-defined templates. |

### Target User
Anki power users (estimated 10M+ active) who have invested hundreds of hours in custom note types and refuse to switch to apps that cannot replicate their card structure. Language learners using Japanese/Chinese study decks with reading + meaning + example fields. Medical students using pharmacology templates with 5+ fields per drug. These users will pay for a premium flashcard app if it matches Anki's customization while offering a better UI.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/templates/types.ts                -- Template, TemplateField, TemplateFace types
modules/flash/src/templates/engine.ts               -- Template-to-card generation, field rendering
modules/flash/src/templates/defaults.ts             -- Built-in templates (Basic, Reversed, Cloze, Vocabulary)
modules/flash/src/templates/index.ts                -- Barrel export
modules/flash/src/templates/__tests__/              -- Tests
modules/flash/src/db/templates.ts                   -- SQLite CRUD for templates and fields
modules/flash/src/db/schema.ts                      -- V4 migration: fl_templates, fl_template_fields
modules/flash/src/definition.ts                     -- Add V4 migration
apps/mobile/app/(flash)/components/TemplateEditor.tsx     -- Template designer UI
apps/mobile/app/(flash)/components/TemplateFieldCard.tsx  -- Reorderable field card
apps/mobile/app/(flash)/components/TemplateCardEditor.tsx -- Card input using template fields
apps/web/app/flash/components/TemplateEditor.tsx          -- Web template designer
apps/web/app/flash/components/TemplateCardEditor.tsx      -- Web card input
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Settings tab -> Templates
            └── [+] New Template / Edit Template <- YOU ARE HERE
```

Also accessed during card creation:
```
Decks tab -> [+] New Card -> Template picker (shows all templates)
  └── TemplateCardEditor (fields from selected template) <- AND HERE
```

### Data Model

Two new tables in V4 migration:

```sql
-- V4 migration: custom card templates
CREATE TABLE IF NOT EXISTS fl_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  card_count_per_note INTEGER NOT NULL DEFAULT 1,
  front_format TEXT NOT NULL DEFAULT '{{Front}}',
  back_format TEXT NOT NULL DEFAULT '{{Back}}',
  css TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS fl_template_fields (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES fl_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'richtext', 'media', 'audio')),
  is_required INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  placeholder TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS fl_templates_builtin_idx ON fl_templates(is_builtin);
CREATE INDEX IF NOT EXISTS fl_template_fields_tpl_idx ON fl_template_fields(template_id, sort_order);
```

Also extend `fl_cards`:
```sql
ALTER TABLE fl_cards ADD COLUMN template_id TEXT REFERENCES fl_templates(id) ON DELETE SET NULL;
ALTER TABLE fl_cards ADD COLUMN fields_json TEXT NOT NULL DEFAULT '{}';
```

The `fields_json` column stores the user's input for each field as a JSON object: `{"Front": "Hello", "Back": "Hola", "Example": "Hello, how are you?"}`. The `front_format` and `back_format` on the template use `{{FieldName}}` mustache-style placeholders that are rendered at display time.

Seed the built-in templates:
```sql
INSERT OR IGNORE INTO fl_templates (id, name, description, is_builtin, card_count_per_note, front_format, back_format, sort_order)
VALUES
  ('fl_tpl_basic', 'Basic', 'Simple front/back card', 1, 1, '{{Front}}', '{{Back}}', 0),
  ('fl_tpl_reversed', 'Basic (Reversed)', 'Creates front->back and back->front cards', 1, 2, '{{Front}}', '{{Back}}', 1),
  ('fl_tpl_cloze', 'Cloze', 'Fill in the blank using {{c1::...}} syntax', 1, 1, '{{Text}}', '{{Extra}}', 2),
  ('fl_tpl_vocab', 'Vocabulary', 'Word, reading, meaning, example', 1, 2, '{{Word}}\n{{Reading}}', '{{Meaning}}\n{{Example}}', 3);
```

### Dependencies
- **Internal:** `@mylife/flash` (existing card types, fl_cards table), `@mylife/ui` (Cool Obsidian tokens)
- **External:** None. Pure template rendering with string interpolation.
- **Cross-Module:** Words module (future): flashcard integration could use the Vocabulary template to auto-create cards from saved words.

## Functional Requirements

### User Stories
1. As a language learner, I want to create a vocabulary template with Word, Reading, Meaning, and Example fields so that I can create structured cards efficiently.
2. As a medical student, I want to create a pharmacology template with Drug, Class, Mechanism, Side Effects, and Contraindications fields so that I can study drugs systematically.
3. As a power user, I want to define which fields appear on the front vs back of each card so that I control exactly what I'm tested on.
4. As a card creator, I want to select my template when creating new cards so that the input form shows the correct fields.
5. As a template author, I want to reorder and rename fields after creation so that I can refine my template over time.

### Behavior Specification

**Creating a template:**
1. User navigates to Settings tab -> Templates
2. User sees list of templates: built-in (Basic, Reversed, Cloze, Vocabulary) and any custom ones
3. User taps [+] New Template
4. TemplateEditor opens with: Name field, Description field, Fields list (starts with "Front" and "Back")
5. User can add fields: tap [+] Add Field, enter name, select type (text/richtext/media/audio), set required flag
6. User can reorder fields by drag handle
7. User can delete non-required fields (must have at least 2 fields)
8. User configures front format and back format using `{{FieldName}}` syntax
9. A live preview shows how a card would look with sample data
10. User taps "Save Template"
11. Template is persisted to `fl_templates` and `fl_template_fields`

**Creating cards with a template:**
1. User taps [+] New Card in a deck
2. Card type picker now shows templates: Basic, Reversed, Cloze, Vocabulary, [Custom templates...]
3. User selects a template (e.g., "Vocabulary")
4. TemplateCardEditor shows one input field per template field (Word, Reading, Meaning, Example)
5. Required fields are marked with an asterisk
6. User fills in the fields
7. User taps "Create"
8. System generates card(s) based on `card_count_per_note`:
   - For 1-card templates: one card with `front` = rendered `front_format`, `back` = rendered `back_format`
   - For 2-card templates: forward card + reversed card (swap front/back formats)
9. The `fields_json` stores the raw field values for future editing
10. The `template_id` links to the template for display formatting

**Editing a template:**
1. User taps an existing template in the list
2. Built-in templates allow field reorder and format changes but not deletion of built-in fields
3. Custom templates allow full editing (add, remove, rename, reorder fields)
4. Changing a template does NOT retroactively modify existing cards (they store rendered content in `front`/`back` and raw data in `fields_json`)
5. Deleting a custom template sets `template_id = NULL` on associated cards (they keep their rendered front/back)

### Edge Cases

- **Template with no fields:** Block save. Minimum 2 fields required.
- **Field name collision:** Block if two fields have the same name (case-insensitive).
- **Template referenced by cards then deleted:** `ON DELETE SET NULL` on `template_id`. Cards keep rendered front/back content and fields_json. They become "template-less" cards.
- **Format string references non-existent field:** Render as empty string. Show warning in preview: "Field '{{Xxx}}' not found."
- **Empty required field during card creation:** Block save. Highlight the field with error border.
- **Very long field values (> 10,000 chars):** Truncate at 10,000 characters per field. Show character count.
- **Special characters in field names:** Allow alphanumeric, spaces, hyphens, underscores. Strip other characters.
- **Built-in template modification:** Allow format changes (front_format, back_format) but not deletion of the template itself or its core fields.
- **Module disabled mid-edit:** Template state persists in SQLite. In-memory form state is lost.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Settings -> Templates shows a list of built-in templates (Basic, Reversed, Cloze, Vocabulary)
- [ ] **AC-2:** Tapping [+] New Template opens the TemplateEditor with Name, Description, and default Front/Back fields
- [ ] **AC-3:** Adding a field via [+] creates a new field row with name input, type picker, and required toggle
- [ ] **AC-4:** Dragging a field handle reorders the fields in the list
- [ ] **AC-5:** The front/back format editor accepts `{{FieldName}}` syntax and shows a live preview
- [ ] **AC-6:** Saving a template returns to the template list with the new template visible
- [ ] **AC-7:** [+] New Card in a deck shows all templates (built-in + custom) in the type picker
- [ ] **AC-8:** Selecting a custom template shows input fields matching the template's field definitions
- [ ] **AC-9:** Creating a card with a template stores field values in `fields_json` and rendered content in `front`/`back`
- [ ] **AC-10:** Editing an existing card shows the template fields pre-filled from `fields_json`
- [ ] **AC-11:** Deleting a custom template does not delete cards that used it

### Technical Criteria
- [ ] **TC-1:** `fl_templates` and `fl_template_fields` tables created in V4 migration
- [ ] **TC-2:** Built-in templates seeded with `is_builtin = 1` and correct field/format definitions
- [ ] **TC-3:** `renderCardContent(format, fields)` correctly replaces `{{FieldName}}` placeholders
- [ ] **TC-4:** `renderCardContent` handles missing fields gracefully (empty string, no crash)
- [ ] **TC-5:** `fl_cards.fields_json` stores valid JSON and is parseable on read
- [ ] **TC-6:** V4 migration adds `template_id` and `fields_json` columns to `fl_cards` without data loss
- [ ] **TC-7:** Template deletion cascades to `fl_template_fields` but only NULLs `fl_cards.template_id`

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Built-in templates must NOT be deletable
- [ ] **NC-2:** Modifying a template must NOT retroactively change existing card content (front/back columns)
- [ ] **NC-3:** Template field names must NOT contain `{{` or `}}` characters
- [ ] **NC-4:** Deleting a template must NOT delete cards or their review history
- [ ] **NC-5:** Custom templates must NOT affect basic/reversed/cloze card creation flow (those still work without templates)

## UI Specification

### Mobile (Expo)

**Template List (Settings -> Templates)**
- Background: `#0A0A0F` (background token)
- Section header: "Built-in" and "Custom" with `rgba(240,240,245,0.65)` text
- Template rows: glass card (`rgba(255,255,255,0.04)`) with name, field count badge, cards-using-count
- Built-in templates: lock icon, cannot swipe-to-delete
- Custom templates: swipe-to-delete with confirmation
- [+] New Template: floating action button, `#FBBF24` accent

**Template Editor (full-screen)**
- Name input: large font, `fontSize: 24`, placeholder "Template Name"
- Description: smaller, `rgba(240,240,245,0.65)` text, placeholder "What is this template for?"
- Fields section: sortable list, each field is a glass card with:
  - Drag handle (left), field name input, type picker badge, required toggle (right)
- Format section: two text areas (Front Format, Back Format) with `{{}}` syntax highlighting
- Live preview: below formats, shows rendered card with sample data
- "Save" button: top-right, `#FBBF24` background

**Template Card Editor (during card creation)**
- One input per field, stacked vertically
- Field labels include type icon (text/richtext/media/audio)
- Required fields: label has red asterisk
- Template name shown at top: "Creating: [Template Name]"

### Web (Next.js)

- Same design tokens via CSS variables
- Template editor: two-column layout (fields on left, preview on right)
- Drag-and-drop via HTML Drag API
- Route: `/flash/templates` (list), `/flash/templates/new` (editor), `/flash/templates/:id` (edit)
- Card creation: template picker appears as a dropdown alongside the deck selector

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton list | Templates loading from SQLite |
| Empty | "No custom templates yet" + CTA to create | No custom templates, only built-ins shown |
| List | Template cards with field counts | Templates loaded |
| Editing | Full editor with fields, formats, preview | Template opened for edit |
| Preview | Rendered card faces with sample data | Format fields have content |

## Test Requirements

### Unit Tests
- [ ] `renderCardContent('{{Front}} - {{Back}}', {Front: 'A', Back: 'B'})`: returns "A - B"
- [ ] `renderCardContent('{{Missing}}', {})`: returns "" (empty string, no crash)
- [ ] `renderCardContent('{{Front}}\n{{Front}}', {Front: 'A'})`: replaces all occurrences
- [ ] `createTemplate(name, fields)`: persists to fl_templates and fl_template_fields
- [ ] `createTemplate(name, [])`: throws error (min 2 fields)
- [ ] `createTemplate(name, fields)`: built-in field names are case-insensitive unique
- [ ] `getTemplateById(id)`: returns template with fields ordered by sort_order
- [ ] `deleteTemplate(builtinId)`: throws error (cannot delete built-in)
- [ ] `deleteTemplate(customId)`: deletes template and fields, NULLs card template_ids
- [ ] `createCardFromTemplate(templateId, fields)`: generates card with rendered front/back
- [ ] `createCardFromTemplate(templateId, fields)`: 2-card template generates forward and reversed cards
- [ ] `createCardFromTemplate(templateId, missingRequired)`: throws error for missing required field
- [ ] V4 migration: tables created, built-in templates seeded
- [ ] V4 migration: existing fl_cards data unaffected, new columns have defaults

### Integration Tests
- [ ] Full flow: create template -> create card with template -> edit card -> verify fields_json persisted
- [ ] Delete flow: delete custom template -> cards still exist -> front/back content intact
- [ ] Built-in flow: vocabulary template -> create 2-card note -> both cards generated with correct front/back

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyFlash -> Settings tab -> Templates
3. **Verify:** Built-in templates visible (Basic, Reversed, Cloze, Vocabulary) (AC-1)
4. Tap [+] New Template
5. **Verify:** Editor opens with Name, Description, and default Front/Back fields (AC-2)
6. Enter name: "Pharmacology"
7. Tap [+] Add Field, enter "Drug", type: text, required: yes
8. Tap [+] Add Field, enter "Mechanism", type: text
9. Tap [+] Add Field, enter "Side Effects", type: richtext
10. **Verify:** New fields appear in the list (AC-3)
11. Drag "Drug" field above "Front" field
12. **Verify:** Field reorders (AC-4)
13. Set front format: `{{Drug}}\n{{Mechanism}}`
14. Set back format: `{{Side Effects}}`
15. **Verify:** Live preview shows rendered sample (AC-5)
16. Tap "Save"
17. **Verify:** Template list now includes "Pharmacology" (AC-6)
18. Navigate to a deck, tap [+] New Card
19. **Verify:** "Pharmacology" appears in the template picker (AC-7)
20. Select "Pharmacology"
21. **Verify:** Input fields match template: Drug*, Mechanism, Side Effects (AC-8)
22. Fill in fields: Drug: "Metformin", Mechanism: "Decreases hepatic glucose production", Side Effects: "GI upset, lactic acidosis"
23. Tap "Create"
24. **Verify:** Card created with correct front/back rendering (AC-9)
25. Open the card in the browser, tap Edit
26. **Verify:** Template fields pre-filled from fields_json (AC-10)
27. Go back to Templates, delete "Pharmacology"
28. **Verify:** Template deleted, but the Metformin card still exists (AC-11)
29. Open web at /flash/templates, repeat steps 4-28
30. **Verify:** Web template editor works identically

## gstack Quality Gates

Based on this feature's complexity score (3 -- Medium), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in flash module, run `/qa` on the module URL

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for template rendering engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Flash module has 3 fixed card types (basic, reversed, cloze) with no concept of user-defined fields or templates. Cards store plain text in `front` and `back` columns. The `template_ordinal` column on `fl_cards` tracks the ordinal within a note (0 for basic, 0+1 for reversed) but is not linked to a template definition.

### After This Work
- Two new tables: `fl_templates` (template definitions) and `fl_template_fields` (field definitions)
- Two new columns on `fl_cards`: `template_id` (FK to template) and `fields_json` (raw field data)
- Four built-in templates seeded (Basic, Reversed, Cloze, Vocabulary)
- Users can create, edit, and delete custom templates with arbitrary fields
- Card creation offers template selection with field-specific input forms
- Template rendering engine resolves `{{FieldName}}` placeholders

### Files Changed
- `modules/flash/src/templates/types.ts` -- New: Template, TemplateField, TemplateFace types
- `modules/flash/src/templates/engine.ts` -- New: renderCardContent, generateCardsFromTemplate
- `modules/flash/src/templates/defaults.ts` -- New: built-in template definitions
- `modules/flash/src/templates/index.ts` -- New: barrel export
- `modules/flash/src/templates/__tests__/engine.test.ts` -- New: unit tests
- `modules/flash/src/db/templates.ts` -- New: CRUD for templates and fields
- `modules/flash/src/db/schema.ts` -- Add V4 migration SQL
- `modules/flash/src/definition.ts` -- Add FLASH_MIGRATION_V4
- `modules/flash/src/index.ts` -- Export template types and functions
- `apps/mobile/app/(flash)/components/TemplateEditor.tsx` -- New: template designer
- `apps/mobile/app/(flash)/components/TemplateCardEditor.tsx` -- New: field-based card input
- `apps/web/app/flash/components/TemplateEditor.tsx` -- New: web template designer
- `apps/web/app/flash/components/TemplateCardEditor.tsx` -- New: web card input

### Known Limitations
- V1 does not support HTML/CSS styling in templates (Anki allows full HTML templates). MyFlash uses `{{FieldName}}` plain text rendering.
- V1 does not support conditional field rendering (Anki supports `{{#FieldName}}...{{/FieldName}}`). Future enhancement.
- V1 does not support per-card-face templates (Anki allows different templates per card ordinal). All cards from one note use the same front/back format.
- No template sharing/import between users. Local only.

### Context for Next Agent
- The V4 migration adds both `template_id` and `fields_json` columns to `fl_cards`. Existing cards get `template_id = NULL` and `fields_json = '{}'` defaults.
- Built-in templates have `is_builtin = 1` and should not be deletable. Enforce this in the CRUD layer, not just the UI.
- The `card_count_per_note` field determines how many cards are generated per note. For "Reversed" type, it's 2 (forward + backward). For most others, it's 1.
- The existing `card_type` column on `fl_cards` remains for backward compatibility. Cards created via templates still get a card_type ('basic' for single-card templates, 'reversed' for 2-card templates).
- If image occlusion (B-tier) and custom templates share a V4 migration, coordinate the migration ordering carefully. Both features add columns/tables but do not conflict.
