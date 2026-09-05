# Feature Spec: RSVP Dietary Preference Collection

## Metadata
- **Module:** rsvp
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 2-3 hours
- **Depends On:** RSVP system (built), custom questions (built, rv_questions with type='dietary'), question responses (built, rv_question_responses)
- **Blocks:** MyRecipes cross-module integration (recipe filtering by dietary needs for events)

## Business Context

### Why This Feature Exists
Every dinner party host asks the same question: "Does anyone have dietary restrictions?" The answer comes back via scattered texts, forgotten replies, and last-minute surprises at the table. RSVPify is the only competitor with structured dietary collection, and they charge $19/mo for it. By embedding dietary preference collection directly in the RSVP flow (not as a separate step), MyRSVP captures this data at the moment of highest engagement -- when the guest is already responding. The cross-module synergy with MyRecipes (filter recipes by guest dietary needs) is unique to MyLife.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| RSVPify | Yes | $19/mo | Structured dietary form in RSVP, aggregated summary for host |
| Partiful | No | N/A | Free-text RSVP notes field (guests self-report, no aggregation) |
| Evite | No | N/A | Custom questions exist but no predefined dietary type |
| Invyt | No | N/A | No dietary collection |

### Target User
Social hosts who plan dinner parties, potlucks, holiday gatherings, and wedding receptions where food is served. These hosts currently send a separate "any dietary restrictions?" message after the RSVP and manually compile results. RSVPify users ($19/mo) who want this capability without the premium price tag.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/engine/dietary.ts           -- Pure functions: aggregation, summary generation
modules/rsvp/src/types.ts                    -- DietaryOption, DietaryAnswer, DietarySummary types
modules/rsvp/src/db/crud.ts                  -- getDietarySummary helper (queries rv_question_responses)
modules/rsvp/src/index.ts                    -- Re-export dietary API
modules/rsvp/src/__tests__/dietary.test.ts   -- Aggregation and edge case tests
apps/mobile/app/(rsvp)/components/DietaryQuestion.tsx   -- Checkbox list in RSVP flow
apps/mobile/app/(rsvp)/components/DietarySummary.tsx    -- Host-view aggregation card
apps/web/app/rsvp/[eventId]/components/DietaryQuestion.tsx  -- Web RSVP dietary step
apps/web/app/rsvp/[eventId]/components/DietarySummary.tsx   -- Web host summary
```

### Wireframe Position

**Guest view (RSVP flow):**
```
Hub Dashboard
  └── MyRSVP card
       └── Event Detail
            └── RSVP Flow
                 └── Response (Going/Maybe/Declined)
                      └── Plus-ones
                           └── Dietary Preferences ← YOU ARE HERE
                                └── Confirm
```

**Host view (event detail):**
```
Hub Dashboard
  └── MyRSVP card
       └── Event Detail
            └── Dietary Summary Card ← YOU ARE HERE
```

### Data Model

No new tables or migrations. This feature uses the existing `rv_questions` table (with `type='dietary'`) and `rv_question_responses` table (with `answer_json` storing dietary selections).

The dietary question is auto-created when the host enables dietary collection for an event (or uses a template that includes it). It uses `type='dietary'` which is already defined in `QuestionTypeSchema`.

**Answer format (stored in rv_question_responses.answer_json):**
```json
{
  "selections": ["vegetarian", "nut_allergy"],
  "other": "No cilantro please"
}
```

**Predefined Dietary Options (static config, not database):**

| Option ID | Label | Category |
|-----------|-------|----------|
| vegetarian | Vegetarian | Diet |
| vegan | Vegan | Diet |
| gluten_free | Gluten-Free | Allergy |
| dairy_free | Dairy-Free | Allergy |
| nut_allergy | Nut Allergy | Allergy |
| shellfish_allergy | Shellfish Allergy | Allergy |
| kosher | Kosher | Religious |
| halal | Halal | Religious |
| other | Other (specify) | Custom |

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (checkbox components, Cool Obsidian tokens)
- **External:** None
- **Cross-Module:** MyRecipes integration. When both modules enabled, expose dietary summary as a structured object that MyRecipes can query: "For this event, filter recipes excluding [allergens], scale servings to [guest count]." Uses `@mylife/module-registry` to check module availability.

## Functional Requirements

### User Stories
1. As a host, I want to enable dietary preference collection for my event so guests can report restrictions when they RSVP.
2. As a guest, I want to select my dietary restrictions from a checklist during RSVP so the host knows what I can eat.
3. As a host, I want to see an aggregated summary of all dietary restrictions across guests so I can plan the menu.
4. As a host, I want to see which specific guests have which restrictions so I can plan seating or individual plates.

### Behavior Specification

**Host enables dietary collection:**
1. Host creates or edits an event
2. In event settings, toggles "Collect Dietary Preferences" to ON
3. System creates a `rv_questions` record with `type='dietary'`, `label='Any dietary restrictions?'`, `options_json` containing the 9 predefined options, `required=0`
4. The dietary question appears in the RSVP flow for all guests

**Guest responds with dietary info:**
1. Guest opens event and taps "RSVP"
2. After selecting response (Going/Maybe) and plus-ones, the dietary step appears
3. Screen shows: "Any dietary restrictions?" with 8 checkbox options + "Other (specify)" text field
4. Guest checks applicable options (multi-select) and optionally enters free text
5. Guest taps "Continue" or "Skip"
6. System saves response as `rv_question_responses` with `answer_json`: `{ "selections": [...], "other": "..." }`
7. If guest skips: no response recorded

**Guest updates dietary info:**
1. Guest re-opens RSVP flow to update response
2. Dietary step shows previously selected options pre-checked
3. Guest modifies selections and saves
4. System replaces previous response (existing `saveQuestionResponse` deletes old + inserts new)

**Host views dietary summary:**
1. Host views event detail
2. A "Dietary Summary" card appears below RSVP summary (if dietary collection is enabled and at least 1 response exists)
3. Card shows aggregated counts: "Vegetarian (3), Gluten-Free (2), Nut Allergy (1)"
4. Below counts: list of "Other" responses with guest names: 'Dave: "No cilantro please"'
5. Tapping the card expands to show per-guest breakdown: each guest's name with their selections

**Aggregation engine:**
1. Query all `rv_question_responses` where question type='dietary' for this event
2. Parse each `answer_json` and count each selected option
3. Collect "other" text entries with guest names (join with rv_rsvps for name)
4. Return `DietarySummary`: option counts + other entries + total respondents + total guests

### Edge Cases
- **Guest skips dietary question:** No response recorded. Not counted in any option. Summary shows "[N] of [total] guests responded."
- **Guest selects nothing but enters "Other" text:** Only "other" is counted. Selections array is empty.
- **Guest updates RSVP from Going to Declined:** Dietary response remains (not deleted), but summary should only aggregate responses from Going/Maybe guests (not Declined).
- **Host disables dietary collection after responses collected:** Question and responses remain in database but the dietary summary card is hidden. Re-enabling shows the data again.
- **No responses yet:** Summary card shows "No dietary preferences reported yet. [N] guests invited."
- **Event with no dietary question enabled:** No dietary step in RSVP flow, no summary card shown.
- **Multiple dietary questions on same event:** Only one allowed per event. Enabling dietary collection when one already exists updates the existing question rather than creating a duplicate.
- **Plus-one dietary needs:** Plus-ones do not have individual RSVP records, so dietary collection applies only to the named guest. Host can note plus-one restrictions in free-text "Other" field.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Host can enable "Collect Dietary Preferences" toggle in event settings
- [ ] **AC-2:** Dietary step appears in RSVP flow after response and plus-ones (for Going/Maybe only)
- [ ] **AC-3:** Guest can select multiple dietary options from the 8 predefined checkboxes
- [ ] **AC-4:** Guest can enter free-text dietary notes in "Other (specify)" field
- [ ] **AC-5:** Guest can skip the dietary step entirely
- [ ] **AC-6:** Host sees aggregated dietary summary card with counts per option
- [ ] **AC-7:** Host sees "Other" entries listed with guest names
- [ ] **AC-8:** Host can expand summary to see per-guest breakdown
- [ ] **AC-9:** Guest's previously selected options are pre-checked when updating RSVP
- [ ] **AC-10:** Summary only counts Going/Maybe guests (excludes Declined)

### Technical Criteria
- [ ] **TC-1:** Dietary question uses existing rv_questions with type='dietary' (no new tables)
- [ ] **TC-2:** Answer stored as JSON: `{ "selections": [...], "other": "..." }` in rv_question_responses
- [ ] **TC-3:** Aggregation correctly counts each option across all responses
- [ ] **TC-4:** Aggregation joins with rv_rsvps to get guest names for "Other" entries
- [ ] **TC-5:** Only one dietary question per event (upsert, not duplicate)
- [ ] **TC-6:** Aggregation filters out Declined RSVP responses
- [ ] **TC-7:** Cross-module: dietary summary exposed as structured type for MyRecipes integration

### Negative Criteria
- [ ] **NC-1:** Declining an RSVP must NOT delete dietary response data (but must exclude from summary)
- [ ] **NC-2:** Disabling dietary collection must NOT delete existing responses
- [ ] **NC-3:** Dietary data must NOT be visible to other guests (host-only summary)
- [ ] **NC-4:** "Other" text must NOT be longer than 500 chars

## UI Specification

### Mobile (Expo)

**Dietary Question (guest RSVP flow):**
- Title: "Any dietary restrictions?" in `#F0F0F5`
- Subtitle: "Select all that apply" in `rgba(240,240,245,0.65)`
- Checkboxes: 8 rows, each with unchecked/checked state using module accent `#FB7185`
- "Other (specify)" text input below checkboxes, single line, max 500 chars
- "Skip" link at bottom in secondary text color
- "Continue" button at bottom with `#FB7185` background

**Dietary Summary (host view):**
- Glass card: `rgba(255,255,255,0.04)` fill with `rgba(255,255,255,0.10)` border
- Header: "Dietary Summary" with fork-and-knife icon
- Option counts: horizontal chips, each showing "[Label] ([count])" with module accent background
- "Other" section: list of "Guest Name: 'note'" entries
- Expandable: tap to see full per-guest breakdown
- Response rate: "[N] of [total] guests responded" in secondary text

### Web (Next.js)
- Same tokens via CSS variables
- Dietary question appears as a form step in the RSVP flow
- Summary card on event detail page, below RSVP summary
- Expandable per-guest table with columns: Guest Name, Dietary Needs

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Collection | No dietary step in RSVP, no summary card | Host did not enable dietary collection |
| Enabled, No Responses | Summary card: "No dietary preferences reported yet" | Enabled but no guests have responded |
| Has Responses | Summary card with aggregated counts and "Other" entries | At least 1 guest responded |
| Expanded | Full per-guest breakdown table | Host taps summary card |
| Guest View | Checkbox list with 8 options + Other field | Guest in RSVP flow |
| Guest Pre-filled | Checkboxes pre-checked from prior response | Guest updating RSVP |

## Test Requirements

### Unit Tests (engine/dietary.ts)
- [ ] `aggregateDietaryResponses`: 3 guests select vegetarian -> { vegetarian: 3 }
- [ ] `aggregateDietaryResponses`: 1 guest selects vegetarian + nut_allergy -> both counted
- [ ] `aggregateDietaryResponses`: guest enters "Other" text -> other_entries includes entry with name
- [ ] `aggregateDietaryResponses`: guest updates from vegan to gluten_free -> vegan: 0, gluten_free: 1
- [ ] `aggregateDietaryResponses`: guest skips -> not counted in any option
- [ ] `aggregateDietaryResponses`: excludes Declined RSVP responses
- [ ] `aggregateDietaryResponses`: empty selections + "Other" text -> only other counted
- [ ] `aggregateDietaryResponses`: no responses -> empty counts, respondents: 0
- [ ] `parseDietaryAnswer`: valid JSON -> parsed correctly
- [ ] `parseDietaryAnswer`: invalid JSON -> returns empty selections + null other
- [ ] `DIETARY_OPTIONS` constant has exactly 9 entries with valid IDs

### Integration Tests
- [ ] Enable dietary collection -> creates rv_questions with type='dietary'
- [ ] Guest responds with selections -> rv_question_responses created with correct answer_json
- [ ] Guest updates response -> old response replaced, new one stored
- [ ] Aggregation returns correct counts from database
- [ ] Multiple events with dietary questions -> data isolated per event
- [ ] Disable dietary collection -> question remains, summary card hidden

### QA Verification Script

1. Open MyRSVP, create a new event "Dinner Party"
2. In event settings, toggle "Collect Dietary Preferences" ON
3. **Verify:** Setting saves successfully -- AC-1
4. Open the event as a guest (or simulate guest RSVP)
5. RSVP "Going" with 1 plus-one
6. **Verify:** After response and plus-ones, dietary step appears -- AC-2
7. Select "Vegetarian" and "Nut Allergy" checkboxes
8. Enter "No cilantro please" in Other field
9. Tap Continue
10. **Verify:** RSVP completes with dietary data saved -- AC-3, AC-4
11. RSVP as a second guest "Going", select "Vegan"
12. RSVP as a third guest "Going", skip dietary step
13. **Verify:** RSVP completes without dietary data -- AC-5
14. Switch to host view, navigate to event detail
15. **Verify:** Dietary Summary card shows "Vegetarian (1), Nut Allergy (1), Vegan (1)" -- AC-6
16. **Verify:** "Other" section shows 'Guest 1: "No cilantro please"' -- AC-7
17. Tap summary card to expand
18. **Verify:** Per-guest breakdown shows each guest's selections -- AC-8
19. Update Guest 1's RSVP, change from Vegetarian to Gluten-Free
20. **Verify:** Summary updates: Vegetarian (0), Gluten-Free (1), Nut Allergy (1), Vegan (1) -- AC-9
21. RSVP as Guest 4 "Declined" with "Kosher" selected
22. **Verify:** Kosher is NOT counted in summary (Declined guests excluded) -- AC-10, TC-6
23. Create an event WITHOUT dietary collection enabled
24. **Verify:** No dietary step in RSVP flow, no summary card on event detail -- NC state

## gstack Quality Gates

Based on Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate through RSVP flow with dietary step, verify host summary

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `QuestionTypeSchema` already includes `'dietary'` enum value
- rv_questions and rv_question_responses tables exist and support arbitrary question types
- `saveQuestionResponse()` CRUD function exists and handles upsert (delete old + insert new)
- No predefined dietary options list
- No dietary aggregation engine
- No dietary-specific UI components

### After This Work
- `DIETARY_OPTIONS` static constant with 9 predefined options
- `aggregateDietaryResponses()` pure function for host summary
- `parseDietaryAnswer()` / `formatDietaryAnswer()` utility functions
- `DietarySummary` type: counts per option, other entries with guest names, response rate
- Guest RSVP dietary step component (mobile + web)
- Host dietary summary card component (mobile + web)
- Cross-module dietary summary type exposed for MyRecipes integration
- 11+ unit tests, 6+ integration tests

### Files Changed
- `modules/rsvp/src/engine/dietary.ts` -- Dietary options, aggregation, parse/format
- `modules/rsvp/src/types.ts` -- DietaryOption, DietaryAnswer, DietarySummary types
- `modules/rsvp/src/db/crud.ts` -- getDietarySummary helper query
- `modules/rsvp/src/index.ts` -- Re-export dietary API
- `modules/rsvp/src/__tests__/dietary.test.ts` -- Aggregation and edge case tests
- `apps/mobile/app/(rsvp)/components/DietaryQuestion.tsx` -- Guest RSVP step
- `apps/mobile/app/(rsvp)/components/DietarySummary.tsx` -- Host summary card
- `apps/web/app/rsvp/[eventId]/components/DietaryQuestion.tsx` -- Web RSVP step
- `apps/web/app/rsvp/[eventId]/components/DietarySummary.tsx` -- Web summary card

### Known Limitations
- Plus-one dietary needs are not individually captured (only named RSVP guests)
- No dietary conflict warnings (e.g., "3 guests are nut-allergic but you have peanut dishes planned")
- No integration with external allergy databases or standardized dietary codes
- Free-text "Other" is limited to 500 chars and not structured/searchable
- MyRecipes integration is one-directional: RSVP exposes summary, Recipes consumes it

### Context for Next Agent
- The existing `QuestionTypeSchema` already has `'dietary'` -- do not add it again. The `rv_questions.options_json` for a dietary question stores the option IDs as a JSON array, but the actual option labels come from the `DIETARY_OPTIONS` constant (not from the database). This allows updating labels without a migration.
- `saveQuestionResponse()` in `crud.ts` already handles the upsert pattern: it deletes the old response for the same rsvp_id + question_id, then inserts the new one. Use this directly for dietary responses.
- The `answer_json` field stores `{ "selections": string[], "other": string | null }`. Parse with `JSON.parse()` and validate the shape. If parsing fails, treat as no selections.
- When aggregating, join `rv_question_responses` with `rv_rsvps` to get guest names AND filter by response status. Only include Going and Maybe responses. Declined guests' dietary data should be preserved in the database but excluded from the aggregated summary.
