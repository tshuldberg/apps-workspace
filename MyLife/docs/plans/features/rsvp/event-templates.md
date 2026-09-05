# Feature Spec: RSVP Event Templates

## Metadata
- **Module:** rsvp
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Event creation (built), custom questions system (built, rv_questions table)
- **Blocks:** "Save event as template" (future feature)

## Business Context

### Why This Feature Exists
Creating an event from scratch requires filling in 10+ fields (title, description, time, location, settings, custom questions). For hosts who throw the same type of event repeatedly (birthday, dinner party, game night), this is tedious. Templates solve the cold-start problem: one tap and the form is pre-filled with smart defaults, suggested RSVP questions, and a host checklist. Evite and RSVPify both offer this, and it is a key onboarding feature that reduces time-to-first-event from 5 minutes to under 1 minute.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Evite | Yes | Free (basic) / Premium (custom) | 100+ invitation templates with visual designs, category browsing |
| RSVPify | Yes | Free | Professional event templates for corporate, weddings, conferences |
| Partiful | No | N/A | No templates (simple creation flow instead) |
| Invyt | No | N/A | No templates |

### Target User
Social hosts creating their first event in MyRSVP who face a blank creation form. Also repeat hosts (game night every week, monthly potluck) who want consistent setup without re-entering the same details. These users currently use Evite templates (ad-supported, free tier) or skip event apps entirely and just text their friends.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/engine/templates.ts        -- Template definitions (static data, 12 templates)
modules/rsvp/src/types.ts                   -- EventTemplate type, TemplateId enum
modules/rsvp/src/index.ts                   -- Re-export template API
modules/rsvp/src/__tests__/templates.test.ts  -- Template validation tests
apps/mobile/app/(rsvp)/components/TemplatePicker.tsx  -- Template grid picker
apps/web/app/rsvp/new/components/TemplatePicker.tsx   -- Web template picker
```

No database changes. Templates are static data bundled with the app. Template application populates the event creation form and optionally creates rv_questions records after event save.

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── "Create Event" button
                 └── Template Picker (optional step) ← YOU ARE HERE
                      └── Create Event form (pre-filled)
```

### Data Model

No new tables or migrations. Templates are a static TypeScript constant array. When a template is applied:
1. Event creation form fields are pre-filled (in-memory, not persisted until save)
2. After event save, `rv_questions` records are created from `template.suggestedQuestions`
3. Host checklist is stored in `rv_settings` as a JSON value keyed `checklist:{eventId}`

### Dependencies
- **Internal:** `@mylife/ui` (template card components, Cool Obsidian tokens)
- **External:** None (templates are bundled, no network)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a host, I want to pick a template (e.g., "Birthday Party") when creating an event so that the form is pre-filled with sensible defaults.
2. As a host, I want to preview a template's contents before applying it so I know what I am getting.
3. As a host, I want to modify any pre-filled value after applying a template so I am not locked into defaults.
4. As a host, I want to skip templates entirely and create from scratch if none fit.

### Behavior Specification

**Template picker flow:**
1. User taps "Create Event" on the events tab
2. System shows Template Picker screen: "Start from a template?" with a 2-column grid of 12 template cards
3. Each card shows: emoji icon, template name, 1-line description
4. "Skip - Start from scratch" link at bottom
5. User taps a template card
6. System pre-fills the Create Event form:
   - Description = template.suggestedDescription
   - End time = start time + template.suggestedDurationHours
   - Settings toggles from template.suggestedSettings
   - "Template: [name]" badge shown on form
7. User can modify any field. User's changes take precedence over template defaults.
8. User taps "Create"
9. System creates event, then creates `rv_questions` from `template.suggestedQuestions`
10. If template has a `hostChecklist`, store it in rv_settings

**Template preview (long press):**
1. User long-presses a template card
2. Modal shows full template details: description, duration, suggested questions, checklist items, settings
3. "Use This Template" button at bottom, "Cancel" at top

**Built-in Templates (12):**

| ID | Name | Icon | Duration | Key Contents |
|----|------|------|----------|-------------|
| birthday | Birthday Party | birthday cake | 3h | Gift registry prompt, "Surprise?" toggle, dietary Q |
| dinner_party | Dinner Party | fork and knife | 3h | Dietary preference Q, seating note, max_guests=12 |
| game_night | Game Night | die | 4h | "What game?" poll suggestion, BYOB note |
| wedding | Wedding | ring | 8h | Seating arrangement, gift registry, requires_approval |
| baby_shower | Baby Shower | baby | 3h | Gift registry, dietary Q, "Is it a surprise?" toggle |
| holiday | Holiday Gathering | holiday | 5h | Potluck sign-up poll, dietary Q, plus-ones=true |
| brunch | Brunch | pancakes | 2h | Dietary Q, max_guests=10 |
| happy_hour | Happy Hour | cocktail | 2h | Plus-ones encouraged, casual tone |
| potluck | Potluck | salad | 3h | "What are you bringing?" poll, dietary Q |
| movie_night | Movie Night | popcorn | 3h | "What should we watch?" poll |
| bbq | BBQ / Cookout | fire | 5h | Dietary Q, "Bring your own" poll |
| book_club | Book Club | books | 2h | "Next book?" poll, recurring event suggestion |

### Edge Cases
- **User skips templates:** Blank Create Event form opens (no template applied)
- **User applies template then modifies description:** User's modified text is saved (not template default)
- **Template references question type not yet implemented:** Skip that question silently (e.g., if `dietary` type is not fully built yet, skip dietary questions)
- **Template data corrupt (unlikely, static data):** Show blank form with toast "Template unavailable"
- **User applies template, changes their mind:** "Clear Template" button on the form removes all pre-filled values
- **All 12 templates must pass validation:** Each template's suggestedSettings must only reference valid Event field names

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Template picker grid shows 12 template cards when user taps "Create Event"
- [ ] **AC-2:** Tapping a template card pre-fills the event creation form with template values
- [ ] **AC-3:** "Skip" link opens a blank event creation form
- [ ] **AC-4:** Long-pressing a template shows a preview modal with full template contents
- [ ] **AC-5:** User can modify any pre-filled field and the modification is saved (not the template default)
- [ ] **AC-6:** After event creation with a template, suggested RSVP questions are auto-created as rv_questions
- [ ] **AC-7:** "Template: [name]" badge visible on the pre-filled form
- [ ] **AC-8:** Host checklist items are stored and retrievable for the event

### Technical Criteria
- [ ] **TC-1:** All 12 templates pass schema validation (valid field names, valid question types, valid settings keys)
- [ ] **TC-2:** Template application does not persist anything until the user saves the event
- [ ] **TC-3:** suggestedQuestions create proper rv_questions records with correct type, options, and sort_order
- [ ] **TC-4:** Host checklist stored in rv_settings as JSON with key `checklist:{eventId}`
- [ ] **TC-5:** Template data is a pure TypeScript constant (no database, no network)

### Negative Criteria
- [ ] **NC-1:** Templates must NOT create any database records until the event is saved
- [ ] **NC-2:** Applying a template must NOT prevent the user from modifying any field
- [ ] **NC-3:** Templates must NOT reference external resources (images, fonts, APIs)
- [ ] **NC-4:** Skipping the template picker must NOT affect event creation functionality

## UI Specification

### Mobile (Expo)
- **Template picker:** 2-column grid of glass cards on `#0A0A0F` background
- **Template card:** `rgba(255,255,255,0.04)` fill, `rgba(255,255,255,0.10)` border, 12px radius
- **Card contents:** 32px emoji icon centered, template name in `#F0F0F5`, 1-line description in `rgba(240,240,245,0.65)`
- **Selected state:** `#FB7185` accent border, slight scale-up animation (100ms)
- **"Skip" link:** Bottom-aligned, `rgba(240,240,245,0.65)` text
- **Preview modal:** Full-screen modal with glass background, template details in sections

### Web (Next.js)
- Same tokens via CSS variables
- Template picker at `/rsvp/new` as the first step
- 3-column grid on wider screens, 2-column on tablet
- Hover effect on cards: `backdrop-filter: blur(12px)`, border transitions to accent

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Template Grid | 12 template cards + "Skip" link | User taps "Create Event" |
| Preview | Modal with full template details | Long-press on template card |
| Applied | Pre-filled form with "Template: [name]" badge | User taps a template |
| Skipped | Blank creation form | User taps "Skip" |

## Test Requirements

### Unit Tests (engine/templates.ts)
- [ ] All 12 templates exist and have valid structure
- [ ] Each template has required fields: id, name, icon, suggestedDurationHours
- [ ] Each template's suggestedSettings only contains valid Event field keys
- [ ] Each template's suggestedQuestions use valid QuestionType values
- [ ] `applyTemplate()` returns correct form values for "birthday" template
- [ ] `applyTemplate()` returns correct form values for "dinner_party" template
- [ ] `applyTemplate()` handles unknown template ID gracefully (returns null)
- [ ] Template with dietary question creates correct question structure

### Integration Tests
- [ ] Apply "birthday" template -> create event -> verify rv_questions created
- [ ] Apply template -> modify description -> save -> verify modified description stored
- [ ] Apply template with checklist -> verify rv_settings contains checklist JSON
- [ ] Skip template -> create event -> verify no template-related rv_questions created

### QA Verification Script

1. Open MyRSVP, tap "Create Event"
2. **Verify:** Template picker shows 12 cards in a grid -- AC-1
3. **Verify:** "Skip" link visible at bottom -- AC-3
4. Long-press "Birthday Party" card
5. **Verify:** Preview modal shows description, duration (3h), suggested questions, checklist -- AC-4
6. Dismiss preview, tap "Birthday Party" card
7. **Verify:** Create Event form pre-filled with birthday description and 3-hour duration -- AC-2
8. **Verify:** "Template: Birthday Party" badge visible on form -- AC-7
9. Change the description to "My 30th Birthday Bash"
10. Set date/time and save
11. **Verify:** Event created with modified description (not template default) -- AC-5
12. Navigate to event detail
13. **Verify:** RSVP questions from birthday template exist (e.g., dietary preference) -- AC-6
14. Go back, tap "Create Event" again
15. Tap "Skip"
16. **Verify:** Blank creation form opens -- AC-3
17. Tap "Create Event" again, tap "Dinner Party"
18. **Verify:** Form shows max_guests=12 and dietary question will be created -- AC-2
19. Save the event
20. **Verify:** Dietary preference question appears in RSVP flow for this event -- AC-6

## gstack Quality Gates

Based on Complexity Inverse score of 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to template picker, test all 12 templates, verify skip flow

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Event creation form is blank (all fields empty)
- rv_questions table exists and supports text, single, multi, number, boolean, dietary types
- rv_settings table exists for key-value storage
- No template system

### After This Work
- 12 built-in event templates as a static TypeScript constant
- `getTemplates()`, `getTemplateById()`, `applyTemplate()` pure functions
- Template picker component for mobile and web
- rv_questions auto-created from template after event save
- Host checklist stored in rv_settings
- 8+ unit tests, 4+ integration tests

### Files Changed
- `modules/rsvp/src/engine/templates.ts` -- Template definitions and application logic
- `modules/rsvp/src/types.ts` -- EventTemplate type, TemplateId type
- `modules/rsvp/src/index.ts` -- Re-export template API
- `modules/rsvp/src/__tests__/templates.test.ts` -- Template validation + application tests
- `apps/mobile/app/(rsvp)/components/TemplatePicker.tsx` -- Mobile template grid
- `apps/web/app/rsvp/new/components/TemplatePicker.tsx` -- Web template grid

### Known Limitations
- Templates are read-only (bundled with app). Users cannot create custom templates in this version.
- No "save past event as template" feature (future)
- No visual invitation design per template (that is RS-014, a separate feature)
- Suggested polls are prompts, not auto-created (user decides whether to create each poll)
- No template analytics (which templates are most popular)

### Context for Next Agent
- Templates are a static array in `engine/templates.ts`. No database storage. This is intentional for simplicity and offline-first design.
- The existing `QuestionTypeSchema` already includes `'dietary'` which several templates reference. The dietary question from templates uses the standard `rv_questions` + `rv_question_responses` flow.
- Host checklist is stored in rv_settings with key format `checklist:{eventId}` and value as a JSON array of strings. Each string is a checklist item. Completion tracking is done in a parallel key `checklist_done:{eventId}` as a JSON array of completed item indexes.
- When creating rv_questions from template, use sort_order starting at 100 to leave room for host-added questions (which default to sort_order 0-99).
