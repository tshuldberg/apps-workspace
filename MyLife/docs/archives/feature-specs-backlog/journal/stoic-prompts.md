# Feature Spec: Stoic/Philosophy Prompts

## Metadata
- **Module:** journal
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 5 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 6 (B+C Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** JR-002 (Daily Journaling with Prompts -- implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The Stoic app charges $40/yr for daily Stoic quotes with reflection prompts and has built a significant user base among philosophy-minded journalers. Day One includes philosophical prompts in its premium tier. MyJournal already has a "stoic" prompt category with 4 static prompts, but this feature expands to a full 365-quote library across 5 philosophical traditions, calendar-anchored daily rotation, and a searchable library. All quotes are bundled on-device, requiring no network access.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Stoic | Yes | $40/yr | Daily Stoic quotes, CBT exercises, guided meditation. Cloud-synced progress. |
| Day One | Partial | $34.99/yr | Some philosophical prompt categories. Premium feature. |
| Daylio | No | N/A | No philosophical content. Mood + activity tracking only. |
| Reflectly | No | N/A | AI prompts but not philosophy-focused. |

### Target User
Stoic app users paying $40/yr for daily philosophy quotes. Reflective journalers who want structured intellectual engagement in their practice. Users interested in multiple philosophical traditions (not just Stoicism). The daily calendar-anchored rotation creates a shared experience even in a privacy-first app.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/philosophy/                    -- NEW: philosophy quote engine
modules/journal/src/philosophy/types.ts            -- PhilosophyQuote, PhiloTradition types
modules/journal/src/philosophy/quotes.ts           -- 365 bundled quotes (seed data)
modules/journal/src/philosophy/quote-engine.ts     -- Daily selection, favorites, reflection entry
modules/journal/src/philosophy/index.ts            -- Barrel export
modules/journal/src/philosophy/__tests__/          -- Tests
modules/journal/src/db/philosophy.ts               -- NEW: CRUD for philosophy quotes
apps/mobile/app/(journal)/components/PhilosophyCard.tsx   -- Mobile daily quote card
apps/mobile/app/(journal)/philosophy-library.tsx          -- Mobile quote library
apps/web/app/journal/philosophy/page.tsx                  -- Web quote library
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Today tab
            └── Daily Philosophy Card ← YOU ARE HERE (below entry/above entries list)
       └── Settings
            └── Philosophy Library ← ALSO HERE
```

### Data Model

New table in migration V4:

```sql
CREATE TABLE IF NOT EXISTS jn_philosophy_quotes (
  id TEXT PRIMARY KEY NOT NULL,
  day_number INTEGER NOT NULL UNIQUE,
  quote_text TEXT NOT NULL,
  author TEXT NOT NULL,
  tradition TEXT NOT NULL
    CHECK (tradition IN ('stoicism', 'buddhism', 'existentialism', 'pragmatism', 'general_wisdom')),
  reflection_prompt TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  times_reflected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS jn_philosophy_quotes_day_idx ON jn_philosophy_quotes(day_number);
CREATE INDEX IF NOT EXISTS jn_philosophy_quotes_tradition_idx ON jn_philosophy_quotes(tradition);
CREATE INDEX IF NOT EXISTS jn_philosophy_quotes_fav_idx ON jn_philosophy_quotes(is_favorite);

INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('philosophyEnabled', 'true');
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, existing tag system
- **External:** none (all 365 quotes bundled on-device)
- **Cross-Module:** none

## Functional Requirements

### User Stories
1. As a reflective thinker, I want a daily Stoic or philosophical quote with a reflection prompt so that I can engage with timeless wisdom as part of my journaling practice.
2. As a daily journaler, I want to write a journal entry responding to a philosophical prompt so that my daily writing has a meaningful starting point.
3. As a philosophy enthusiast, I want to explore different philosophical traditions (Stoicism, Buddhism, Existentialism, Pragmatism) so that my reflections draw from diverse perspectives.

### Behavior Specification

1. User enables Philosophy Prompts in Settings (default: on).
2. On the Today tab, a Daily Philosophy Card appears.
3. **Calendar-anchored selection:**
   a. Calculate `day_of_year` (1-366) from today's date.
   b. Query `jn_philosophy_quotes WHERE day_number = day_of_year`.
   c. Leap year Feb 29: use day_number = 366.
   d. All users see the same quote on the same day.
4. Card displays: quote text (italic, large), author attribution, tradition badge (color-coded), and reflection prompt.
5. **Actions:**
   a. "Reflect on This" -- opens new entry with quote as blockquote, reflection prompt as H3 heading, cursor positioned below.
   b. Heart icon -- toggles favorite.
   c. Share icon -- copies quote + attribution to system clipboard.
   d. Swipe left/right -- browse to adjacent days' quotes (does not change today's daily).
6. Saving a reflection entry: auto-tags with "philosophy" and the tradition name, increments `times_reflected`.
7. **Philosophy Library:** searchable, filterable by tradition, shows favorites tab.

### Edge Cases

- **Leap year February 29:** Uses day_number = 366 (dedicated leap day quote).
- **Quote database not seeded:** First launch triggers seed of all 365 quotes. Show loading state.
- **Quote for today not found:** Fallback to `((day_of_year - 1) MOD 365) + 1`.
- **Multiple app launches same day:** Same quote shown (cached by calendar date).
- **User browses to tomorrow's quote:** Viewing only; today's selection unchanged.
- **Search in library:** Matches quote text, author name, or tradition name.
- **Feature disabled:** No card shown, no database queries for quotes.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Daily Philosophy Card shows today's quote with author and tradition badge.
- [ ] **AC-2:** "Reflect on This" opens entry editor with quote as blockquote and reflection prompt.
- [ ] **AC-3:** Saving reflection entry auto-tags with "philosophy" and tradition name.
- [ ] **AC-4:** Heart icon toggles favorite status.
- [ ] **AC-5:** Share icon copies "quote text -- author" to clipboard.
- [ ] **AC-6:** Swiping left/right browses to adjacent days' quotes.
- [ ] **AC-7:** Philosophy Library shows all 365 quotes filterable by tradition.
- [ ] **AC-8:** Favorites tab in library shows only favorited quotes.
- [ ] **AC-9:** Same quote shows for all users on the same calendar day.
- [ ] **AC-10:** Philosophy toggle exists in Settings (default: on).

### Technical Criteria
- [ ] **TC-1:** Migration V4 creates `jn_philosophy_quotes` with 365 rows (366 including leap day).
- [ ] **TC-2:** Daily selection is calendar-anchored: day_of_year -> day_number lookup.
- [ ] **TC-3:** Quote distribution: Stoicism 120, Buddhism 75, Existentialism 60, Pragmatism 55, General Wisdom 55+1 (leap).
- [ ] **TC-4:** Each quote has non-empty text, author, tradition, and reflection_prompt.
- [ ] **TC-5:** `times_reflected` increments when a reflection entry is saved from the quote.
- [ ] **TC-6:** Quotes are read-only (users cannot edit or delete built-in quotes).

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Quotes must NEVER require network access. All 365 are bundled locally.
- [ ] **NC-2:** The daily quote must NOT change if the user re-opens the app on the same day.
- [ ] **NC-3:** Disabling philosophy prompts must NOT delete quote data or favorites.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Philosophy Card: glass card with top border gradient
- Quote text: 18px italic, `#F0F0F5`, centered, max 4 lines
- Attribution: 14px, textSecondary, "-- Author Name"
- Tradition badge: small pill with tradition color (Stoicism: blue, Buddhism: amber, Existentialism: purple, Pragmatism: green, General: slate)
- Reflection prompt: 15px, regular weight, textSecondary, below a subtle divider
- "Reflect on This" button: accent color pill, primary action
- Heart and share: icon buttons, textSecondary
- Module accent: `#A78BFA`

### Web (Next.js)

- Route: `/journal/philosophy` (library)
- Daily card on journal home page
- Two-column library layout: quote list left, detail/preview right
- Search bar with tradition filter tabs

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Today's Quote | Full card with quote, author, prompt | Daily card loaded |
| Reflected | "Reflected" badge, link to entry | User wrote entry from quote |
| Favorited | Filled heart icon | User tapped heart |
| Loading | Skeleton card (rare, local data) | First launch, seeding quotes |
| Disabled | No card | Feature toggle off |

## Test Requirements

### Unit Tests
- [ ] `getDayOfYear`: March 7 -> 66
- [ ] `getDayOfYear`: Jan 1 -> 1, Dec 31 (non-leap) -> 365
- [ ] `getDayOfYear`: Feb 29 leap year -> 60, uses day_number 366
- [ ] `selectDailyQuote`: day 66 -> returns quote with day_number 66
- [ ] `formatReflectionEntry`: quote + author + prompt -> Markdown blockquote + H3 heading
- [ ] `toggleFavorite`: is_favorite 0 -> 1
- [ ] `incrementTimesReflected`: times_reflected 0 -> 1
- [ ] `filterByTradition`: tradition = 'stoicism' -> only stoicism quotes
- [ ] `countByTradition`: full library -> stoicism=120, buddhism=75, existentialism=60, pragmatism=55, general=56
- [ ] `clipboardFormat`: quote + author -> '"Quote text" -- Author Name'

### Integration Tests
- [ ] Full flow: view daily quote -> "Reflect on This" -> write entry -> save -> tagged "philosophy" + "stoicism" -> times_reflected incremented
- [ ] Library browse: open library -> filter "Buddhism" -> 75 quotes shown -> search "compassion" -> subset shown

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Today tab
3. Verify: Daily Philosophy Card visible with quote, author, tradition badge -- corresponds to AC-1
4. Tap "Reflect on This"
5. Verify: entry editor opens with quote as blockquote and reflection prompt -- corresponds to AC-2
6. Write a response and save
7. Verify: entry tagged "philosophy" and tradition name -- corresponds to AC-3
8. Return to Today tab
9. Verify: Philosophy Card shows "Reflected" badge -- corresponds to AC-3
10. Tap heart icon on a quote
11. Verify: heart fills (favorite toggled) -- corresponds to AC-4
12. Tap share icon
13. Verify: clipboard contains quote text + author -- corresponds to AC-5
14. Swipe left on card
15. Verify: previous day's quote shown -- corresponds to AC-6
16. Navigate to Philosophy Library
17. Verify: all quotes listed, filterable by tradition -- corresponds to AC-7
18. Tap "Favorites" tab
19. Verify: only favorited quotes shown -- corresponds to AC-8
20. Close and re-open the app
21. Verify: same daily quote shown -- corresponds to AC-9, NC-2

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to journal today tab, verify philosophy card flow

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal has 4 static stoic prompts in `engine/prompts.ts` that cycle by date. No philosophy quote library, no daily quote card, no tradition filtering.

### After This Work
A `jn_philosophy_quotes` table stores 366 quotes across 5 traditions. A `philosophy/` directory provides calendar-anchored daily selection, favorite management, and reflection entry creation. Daily Philosophy Card appears on the Today tab. Philosophy Library screen provides search and tradition filtering.

### Files Changed
- `modules/journal/src/db/schema.ts` -- add CREATE_PHILOSOPHY_QUOTES, indexes, settings
- `modules/journal/src/definition.ts` -- add to JOURNAL_MIGRATION_V4
- `modules/journal/src/philosophy/types.ts` -- PhilosophyQuote, PhiloTradition types
- `modules/journal/src/philosophy/quotes.ts` -- 366 quote seed data records
- `modules/journal/src/philosophy/quote-engine.ts` -- getDayOfYear, selectDailyQuote, formatReflectionEntry
- `modules/journal/src/philosophy/index.ts` -- barrel export
- `modules/journal/src/philosophy/__tests__/quote-engine.test.ts` -- 10+ tests
- `modules/journal/src/db/philosophy.ts` -- CRUD for quotes
- `modules/journal/src/types.ts` -- add PhilosophyQuote Zod schema
- `modules/journal/src/index.ts` -- re-export philosophy module
- `apps/mobile/app/(journal)/components/PhilosophyCard.tsx` -- daily quote card
- `apps/mobile/app/(journal)/philosophy-library.tsx` -- quote library screen
- `apps/web/app/journal/philosophy/page.tsx` -- web library

### Known Limitations
- 366 quotes are hardcoded as seed data. Adding user-created quotes is deferred.
- Quote distribution favors Stoicism (120) as the largest tradition. Others may feel underrepresented.
- No community features (e.g., sharing reflections, seeing how many others reflected on the same quote).
- Calendar-anchored means users who start mid-year miss earlier quotes (they can browse the library manually).

### Context for Next Agent
- The `quotes.ts` file will be the largest file (366 objects). Generate representative quotes for each tradition with proper attribution. Ensure all quotes are public domain or widely attributed with no copyright issues.
- The existing `engine/prompts.ts` "stoic" category has 4 prompts. These are separate from the philosophy quotes system. Do not modify the existing prompts.
- Quote day_number is 1-indexed: Jan 1 = 1, Dec 31 = 365 (or 366 in leap year). Feb 29 always uses day_number = 366.
- Tags auto-added on reflection entry save: "philosophy" (always) + tradition name as second tag (e.g., "stoicism"). Use existing `syncEntryTags` from crud.ts.
- Migration V4 coordination: combine with AI-powered prompts if both ship in same sprint.
