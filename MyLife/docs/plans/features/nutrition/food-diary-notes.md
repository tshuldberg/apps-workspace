# Feature Spec: Food Diary Notes

## Metadata
- **Module:** nutrition
- **Priority Score:** 32 / 50 (A-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 2 x3 + Complexity 5 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** 5
- **Estimated CC Time:** 1-2 hours
- **Depends On:** none (uses existing nu_food_log table)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Food diary notes let users add context to their meals beyond just the food items: how they felt, where they ate, who they were with, why they chose certain foods. Cronometer and MacroFactor both offer this, and it's valuable for users working with dietitians or tracking emotional eating patterns. Complexity is 5 (trivial) because the `notes` column already exists on `nu_food_log` -- this feature is about surfacing it in the UI with a dedicated editing experience, adding daily journal-style notes, and enabling search across notes.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Cronometer | Yes | Free | Per-meal notes field, searchable |
| MacroFactor | Yes | Yes ($71.88/yr) | Daily notes with template prompts |
| MyFitnessPal | Partial | Free | Basic meal notes, no search |
| Lose It! | No | N/A | No diary notes feature |

### Target User
Users who want to track more than macros: emotional state around meals, dining context, food sensitivities, or notes for their dietitian. Users practicing mindful eating or investigating food-symptom correlations.

## Technical Context

### Where This Lives in MyLife

```
modules/nutrition/src/notes/types.ts         -- Daily note types
modules/nutrition/src/notes/crud.ts          -- Daily note CRUD
modules/nutrition/src/db/schema.ts           -- New nu_daily_notes table
modules/nutrition/src/index.ts               -- Export note functions
apps/mobile/app/(nutrition)/diary-notes.tsx  -- Daily notes editor
```

### Wireframe Position

```
Hub Dashboard
  └── MyNutrition card
       └── Diary tab
            └── Day view
                 ├── Water section
                 ├── Breakfast / Lunch / Dinner / Snack (existing)
                 │    └── Per-meal notes (existing field, now editable) ← ENHANCED
                 └── Daily Notes section ← NEW
                      ├── Free-text daily note
                      ├── Prompt suggestions
                      └── Tags (optional)
```

### Data Model

The `nu_food_log` table already has a `notes TEXT` column for per-meal notes. This feature enhances its UI and adds a new table for daily-level notes.

```sql
CREATE TABLE IF NOT EXISTS nu_daily_notes (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  tags TEXT,                               -- JSON array of string tags, e.g., '["restaurant","social"]'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS nu_daily_notes_date_idx ON nu_daily_notes(date);
```

### Dependencies
- **Internal:** `@mylife/db`, nu_food_log (existing notes column), nu_settings
- **External:** None
- **Cross-Module:** Mood module could read food diary notes for emotional eating correlation. Journal module has similar note-taking patterns. Health wellness timeline could surface nutrition notes.

## Functional Requirements

### User Stories
1. As a user, I want to add notes to individual meals so I can record context like "ate out at a restaurant" or "stress eating."
2. As a user, I want a daily journal note section so I can capture overall nutrition observations for the day.
3. As a user, I want searchable notes so I can find patterns like "every time I ate pasta, I felt bloated."
4. As a user, I want optional prompt suggestions to help me think about what to write.

### Behavior Specification

**Per-meal notes (enhanced existing):**
1. Each meal entry (breakfast/lunch/dinner/snack) on the Diary tab shows a "notes" icon if notes exist, or a "+" icon to add notes.
2. Tapping the icon opens a text input (expandable, multiline).
3. Notes are saved to the existing `nu_food_log.notes` column.
4. Notes appear as a collapsible section below the meal's food items.

**Daily notes section:**
1. At the bottom of the Diary tab day view, a "Daily Notes" card appears.
2. Tapping opens a full-screen text editor.
3. Optional prompt suggestions shown above the keyboard:
   - "How did your meals make you feel?"
   - "Any cravings today?"
   - "What would you change about today's eating?"
   - "Energy level after meals?"
4. User can dismiss prompts and type freely.
5. Optional tags: user can add tags from a preset list or create custom ones.
   - Preset tags: "restaurant", "home-cooked", "takeout", "social", "stress", "celebration", "travel"
6. Note auto-saves on dismiss (no explicit save button).

**Notes search:**
1. In Trends tab, a "Search Notes" button opens a search interface.
2. User types a search query.
3. System searches both nu_food_log.notes and nu_daily_notes.content using LIKE queries.
4. Results show matching dates with highlighted snippets.
5. Tapping a result navigates to that day's diary view.

### Edge Cases

- **Empty note:** Don't save empty strings. If user clears all text, delete the nu_daily_notes row.
- **Very long note (>5000 chars):** Allow. No character limit. Text area should scroll.
- **Same day, multiple edits:** Auto-save overwrites. nu_daily_notes has UNIQUE on date.
- **Per-meal note vs daily note:** These are separate. Per-meal lives on nu_food_log.notes, daily lives on nu_daily_notes.
- **Search with no results:** Show "No notes match your search" empty state.
- **Special characters in notes:** Allow all Unicode. No sanitization needed (local storage only).
- **Tags with spaces:** Allow. Store as JSON array. "home cooked" is valid.
- **Day with no food logged:** Daily notes still available. Users can write about why they didn't eat (fasting, sick, etc.).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Per-meal notes icon visible on each meal entry
- [ ] **AC-2:** Tapping meal notes icon opens multiline text editor
- [ ] **AC-3:** Per-meal notes saved and displayed below meal items
- [ ] **AC-4:** Daily Notes card visible at bottom of Diary day view
- [ ] **AC-5:** Daily notes editor shows prompt suggestions
- [ ] **AC-6:** Tags can be added to daily notes (preset + custom)
- [ ] **AC-7:** Notes auto-save on dismiss
- [ ] **AC-8:** Search Notes finds matches in both per-meal and daily notes
- [ ] **AC-9:** Search results navigate to the matching day's diary

### Technical Criteria
- [ ] **TC-1:** nu_daily_notes table created by migration v4
- [ ] **TC-2:** Per-meal notes use existing nu_food_log.notes column (no schema change)
- [ ] **TC-3:** Daily notes UNIQUE on date (upsert behavior)
- [ ] **TC-4:** Tags stored as JSON array string
- [ ] **TC-5:** Search uses LIKE '%query%' on both tables

### Negative Criteria
- [ ] **NC-1:** Notes must NOT be synced or transmitted over network
- [ ] **NC-2:** Notes must NOT be visible outside the nutrition module (private)
- [ ] **NC-3:** Prompt suggestions must NOT be AI-generated (static list only)

## UI Specification

### Mobile (Expo)
- **Per-meal notes:** Small text icon (`message-square`) in `rgba(240,240,245,0.65)` next to meal type header. Filled icon when notes exist. Notes text below meal items in secondary text color.
- **Daily Notes card:** Glass card at bottom of day view. Placeholder text: "Add notes about today..." in `rgba(240,240,245,0.40)`. When content exists, show first 2 lines with "Read more" link.
- **Notes editor:** Full-screen modal. Background `#12121A`. Multiline text input with `#F0F0F5` text. Prompt chips above keyboard in glass pill shapes. Tag selector below text area.
- **Search:** Search bar at top of results screen. Glass cards per result with date, snippet, and source (meal/daily) badge.

### Web (Next.js)
- `/nutrition/diary` -- notes inline on day view. Daily notes at bottom.
- Search available via `/nutrition/notes/search` route.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No notes | "+" icon on meals, empty Daily Notes card | No notes for today |
| Meal note exists | Filled icon, note text below meal items | Note saved on meal |
| Daily note exists | Card shows first 2 lines + "Read more" | Note saved for day |
| Editing | Full-screen editor with prompts | Tap note card/icon |
| Search results | Date cards with highlighted snippets | Search query entered |
| No search results | "No notes match" empty state | Query has no matches |

## Test Requirements

### Unit Tests
- [ ] `createDailyNote`: stores content, date, tags
- [ ] `getDailyNote`: retrieves by date
- [ ] `updateDailyNote`: updates content and updated_at
- [ ] `deleteDailyNote`: removes row when content is empty
- [ ] `upsertDailyNote`: creates if not exists, updates if exists (same date)
- [ ] `searchNotes`: finds matches in nu_daily_notes.content
- [ ] `searchNotes`: finds matches in nu_food_log.notes
- [ ] `searchNotes`: returns empty array for no matches
- [ ] `parseTags`: parses JSON array string to string[]
- [ ] `serializeTags`: converts string[] to JSON array string

### Integration Tests
- [ ] Full flow: add daily note -> auto-save -> navigate away -> return -> note persists
- [ ] Search flow: add notes on 3 days -> search keyword -> correct results returned -> tap navigates to day

### QA Verification Script

1. Navigate to MyNutrition > Diary tab
2. Verify: Per-meal notes icon on each meal entry -- corresponds to AC-1
3. Tap notes icon on a meal
4. Type "Ate at a new Italian restaurant, great pasta"
5. Dismiss editor
6. Verify: Note saved and visible below meal items -- corresponds to AC-2, AC-3
7. Scroll to bottom of day view
8. Verify: Daily Notes card visible -- corresponds to AC-4
9. Tap Daily Notes card
10. Verify: Prompt suggestions shown -- corresponds to AC-5
11. Type "Felt low energy after lunch, maybe too many carbs"
12. Add tags: "restaurant", "low-energy"
13. Verify: Tags attached -- corresponds to AC-6
14. Dismiss editor
15. Verify: Note auto-saved, card shows preview -- corresponds to AC-7
16. Navigate to Trends > Search Notes
17. Search "restaurant"
18. Verify: Both the meal note and daily note appear in results -- corresponds to AC-8
19. Tap a result
20. Verify: Navigates to that day's diary -- corresponds to AC-9

## gstack Quality Gates

Based on Complexity 5 (Inverse), this feature is "Trivial" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
The `notes` column exists on `nu_food_log` but is not surfaced in the UI. No daily-level notes or search functionality exists.

### After This Work
- Per-meal notes UI with inline display and editing
- Daily notes table with free-text content and tags
- Prompt suggestions for guided note-taking
- Cross-table note search (both per-meal and daily)
- Navigation from search results to diary day view

### Files Changed
- `modules/nutrition/src/notes/types.ts` -- New: daily note types
- `modules/nutrition/src/notes/crud.ts` -- New: daily note CRUD + search
- `modules/nutrition/src/db/schema.ts` -- Extended: nu_daily_notes table
- `modules/nutrition/src/db/migrations.ts` -- Extended: migration v4
- `modules/nutrition/src/definition.ts` -- Bump schemaVersion
- `modules/nutrition/src/index.ts` -- Export note functions
- `apps/mobile/app/(nutrition)/diary-notes.tsx` -- Daily notes editor screen

### Known Limitations
- No FTS on notes (uses LIKE queries, which is fine for personal data volumes)
- No rich text (plain text only)
- No image attachments in notes
- No AI-powered note analysis or pattern detection
- Prompt suggestions are static, not personalized

### Context for Next Agent
- The `nu_food_log.notes` column already exists and is already mapped in `rowToLogEntry()` in `db/food-log.ts`. No schema change is needed for per-meal notes; only UI work.
- The `updateFoodLogEntry()` function already accepts `notes` in its updates parameter. The UI just needs to call it.
- Daily notes use UNIQUE on date, so use INSERT OR REPLACE (or ON CONFLICT DO UPDATE) for upsert.
- Tags are stored as a JSON string. Use `JSON.parse()` to read and `JSON.stringify()` to write.
- If multiple features share migration v4 (water tracking, wearable sync, food diary notes, restaurant menus), coordinate all table creations in a single migration to avoid version conflicts. Group them as `NUTRITION_MIGRATION_V4`.
