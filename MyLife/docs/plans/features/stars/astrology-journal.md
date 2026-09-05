# Feature Spec: Astrology Journal

## Metadata
- **Module:** stars
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market 1 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3-4
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Existing astro engine (getMoonPhase, getZodiacSign, getTarotCardOfDay); Transit Tracking (optional, for transit context)
- **Blocks:** none
- **Spec Reference:** SPEC-mystars.md ST-017 (Astrology Journal)

## Business Context

### Why This Feature Exists
Users who engage deeply with astrology want to correlate astrological events with their personal experiences. The astrology journal auto-captures the cosmic snapshot (moon phase, sign, retrogrades, active transits) alongside user-written reflections. Over time, this builds a personal database that reveals patterns between astrological conditions and moods. Co-Star has a similar journaling feature. This has the highest cross-module score (3) of all Stars features because it bridges astrology, mood tracking, and journaling.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Co-Star | Yes | Premium | Daily reflections with transit context, shareable |
| The Pattern | Yes | Premium ($120/yr) | "Journal" feature tied to personal timing cycles |
| Nebula | No | N/A | No journaling feature |
| TimePassages | No | N/A | Transit tracking but no journaling |
| Stardust | No | N/A | Daily horoscope but no user journaling |

### Target User
Spiritual Explorers who combine astrology with journaling and mindfulness. Dedicated Practitioners who want to verify whether astrological influences align with lived experience. Cross-module users who already use MyLife's Journal or Mood modules and want astrological context added.

## Technical Context

### Where This Lives in MyLife

```
modules/stars/src/engine/journal-context.ts        -- Astrological context auto-capture
modules/stars/src/engine/pattern-detection.ts      -- Pattern analysis across entries
modules/stars/src/db/schema.ts                     -- V2 migration: st_journal_entries + FTS5
modules/stars/src/db/crud.ts                       -- Journal CRUD with search
modules/stars/src/types.ts                         -- JournalEntry, JournalMood, JournalPattern schemas
modules/stars/src/__tests__/journal.test.ts        -- Engine + CRUD tests
apps/mobile/app/(stars)/journal.tsx                -- Mobile journal list
apps/mobile/app/(stars)/journal-compose.tsx         -- Mobile compose screen
apps/mobile/app/(stars)/journal-patterns.tsx        -- Mobile patterns view
apps/web/app/stars/journal/page.tsx                -- Web journal page
```

### Wireframe Position

```
Hub Dashboard
  └── MyStars card
       └── Chart tab
       └── Transits tab
       └── Journal ← NEW (accessible as a screen from Settings tab or a new tab)
            └── Journal List ← YOU ARE HERE
                 ├── Entries (default segment)
                 └── Patterns (requires 30+ entries)
            └── Compose Entry
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS st_journal_entries (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES st_birth_profiles(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  mood TEXT,
  moon_phase TEXT NOT NULL,
  moon_sign TEXT NOT NULL,
  sun_sign TEXT NOT NULL,
  retrograde_planets TEXT,
  active_transits TEXT,
  tarot_card_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- FTS5 full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS st_journal_entries_fts USING fts5(
  content,
  content=st_journal_entries,
  content_rowid=rowid
);

CREATE INDEX IF NOT EXISTS st_journal_entries_date_idx ON st_journal_entries(date);
CREATE INDEX IF NOT EXISTS st_journal_entries_profile_idx ON st_journal_entries(profile_id);
CREATE INDEX IF NOT EXISTS st_journal_entries_mood_idx ON st_journal_entries(mood);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing `engine/astro.ts` (getMoonPhase, getZodiacSign, getTarotCardOfDay)
- **External:** None.
- **Cross-Module:** High cross-module potential:
  - **Mood module**: mood tag in journal entries mirrors Mood module's mood tracking. Future integration could show mood trends correlated with astrological conditions.
  - **Journal module**: astrology journal is a specialized journal. Future integration could surface astrology entries in the main journal timeline.

## Functional Requirements

### User Stories
1. As a Spiritual Explorer, I want to write journal entries that automatically capture the current moon phase, sun sign, and retrograde status, so that I can correlate astrological conditions with my experiences over time.
2. As a Dedicated Practitioner, I want a "Patterns" view that shows correlations between astrological conditions and my moods, so that I can verify astrological influences from my own data.
3. As any user, I want to search my journal entries by keyword, so that I can find past reflections on specific topics.

### Behavior Specification

1. User navigates to the Journal screen.
2. **Entries view** (default): Scrollable list of journal entries sorted by most recent. Each preview shows: date, mood tag (colored dot), moon phase icon, first 100 characters.
3. User taps "New Entry" (plus icon).
4. **Compose screen** opens with:
   - Auto-captured context card at top: date, moon phase and sign, sun sign, active retrogrades (if any), today's tarot card (if drawn).
   - Mood tag selector: 8 options (inspired, calm, anxious, frustrated, joyful, contemplative, energized, drained) as colored pill buttons. Optional (none selected by default).
   - Large text input area with placeholder "How are the stars affecting you today?" and character count (0/5,000).
5. User writes content and optionally selects a mood tag.
6. User taps "Save": entry saved with auto-captured context. Navigates back to list.
7. User taps "Cancel": confirmation dialog if text has been entered.
8. **Search**: User taps search icon, types query, real-time full-text search filters the entry list.
9. **Patterns view** (requires 30+ entries): Shows detected correlations with confidence indicators. Each pattern: description, supporting entry count, confidence level (low/medium/high).
10. User taps a pattern: shows the list of supporting entries.

### Edge Cases
- No entries exist: show empty state illustration with "Your astrology journal is empty" and "Write First Entry" button.
- Content is empty or whitespace-only: Save button disabled, validation message shown.
- Content exceeds 5,000 characters: character count turns red, Save disabled.
- Cancel with unsaved text: confirmation dialog "Discard this entry?"
- No birth profile exists: journal works but `profile_id` is null and `active_transits` is null. Context card shows moon phase, sun sign, retrogrades but omits transit context.
- Fewer than 30 entries for Patterns: show "Write [N] more entries to unlock pattern detection" with progress bar.
- Pattern detection finds no significant correlations: show "No strong patterns detected yet. Keep journaling!"
- Maximum 1,000 entries: warn at 900 entries.
- FTS5 search with special characters: sanitize query input.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Journal list shows entries sorted by most recent, with date, mood dot, moon phase icon, and text preview.
- [ ] **AC-2:** Tapping "New Entry" opens compose screen with auto-captured astrological context card.
- [ ] **AC-3:** Context card shows: current date, moon phase and sign, sun sign, retrograde status.
- [ ] **AC-4:** Mood tag selector offers 8 options as colored pills; selecting one highlights it.
- [ ] **AC-5:** Text input accepts up to 5,000 characters with live character count.
- [ ] **AC-6:** Tapping "Save" with valid content saves the entry and returns to the list.
- [ ] **AC-7:** Search icon activates full-text search that filters entries in real-time.
- [ ] **AC-8:** Patterns tab shows detected mood-astrology correlations (requires 30+ entries).
- [ ] **AC-9:** Empty state shows illustration and "Write First Entry" button.

### Technical Criteria
- [ ] **TC-1:** Auto-captured context correctly reflects current moon phase (matches `getMoonPhase` for today).
- [ ] **TC-2:** Auto-captured sun sign correctly reflects current sun sign (matches `getZodiacSign` for today).
- [ ] **TC-3:** Journal entries persisted in `st_journal_entries` with `st_` prefix.
- [ ] **TC-4:** FTS5 index enables sub-100ms full-text search across all entries.
- [ ] **TC-5:** Pattern detection requires minimum 30 entries and minimum 5 entries per group.
- [ ] **TC-6:** Mood validation: only the 8 defined mood values accepted.
- [ ] **TC-7:** Content validation: non-empty, non-whitespace, max 5,000 characters.

### Negative Criteria
- [ ] **NC-1:** This feature must NOT require a birth profile. Journal works without one (transit context omitted).
- [ ] **NC-2:** This feature must NOT make network requests.
- [ ] **NC-3:** Deleting a birth profile must NOT delete journal entries (profile_id set to null via ON DELETE SET NULL).

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Entry cards: glass surface with mood dot, moon phase icon, date, text preview
- Mood dots: inspired=#FFD700, calm=#30D158, anxious=#FF9F0A, frustrated=#FF453A, joyful=#FF375F, contemplative=#8B5CF6, energized=#32D74B, drained=#98989D
- Context card on compose: elevated surface with moon glyph, sun sign, retrograde badges
- Character count: secondary text, turns `#FF453A` (danger) when over 4,800

### Web (Next.js)
- Same tokens via CSS variables
- Route: `/stars/journal`
- Compose accessible via `/stars/journal/new`
- Two-column layout on desktop: entry list left, selected entry or compose right
- Search bar inline at top of list

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Shimmer on entry list | Loading entries from SQLite |
| Empty | Illustration + "Write First Entry" button | No entries exist |
| Error | "Could not load journal. Pull to retry." | Database error |
| Success | Scrollable list of entry previews | Entries loaded |
| Patterns Locked | "Write [N] more entries to unlock" with progress bar | Fewer than 30 entries |

## Test Requirements

### Unit Tests
- [ ] `captureAstrologicalContext`: returns correct moon phase for today
- [ ] `captureAstrologicalContext`: returns correct sun sign for today
- [ ] `captureAstrologicalContext`: includes retrograde planets list (empty if none)
- [ ] `detectPatterns`: returns empty for < 30 entries
- [ ] `detectPatterns`: detects mood appearing 50%+ more frequently during a condition
- [ ] `detectPatterns`: assigns confidence: high (10+ entries), medium (7+), low (5+)
- [ ] Content validation: rejects empty, whitespace-only, > 5000 chars
- [ ] Mood validation: accepts all 8 valid values, rejects invalid
- [ ] Journal CRUD: create, get by id, list by date, search by content, update, delete

### Integration Tests
- [ ] Full flow: compose entry with context -> save -> appears in list -> search finds it
- [ ] Pattern flow: create 30+ entries with mood tags -> patterns detected -> tapping pattern shows entries
- [ ] Profile deletion: delete profile -> journal entries remain with null profile_id

### QA Verification Script
1. Open MyStars module
2. Navigate to Journal
3. Verify: empty state or entry list shown -- AC-9 / AC-1
4. Tap "New Entry" (plus icon)
5. Verify: context card shows date, moon phase, sun sign, retrogrades -- AC-2, AC-3
6. Tap a mood tag
7. Verify: mood pill highlights -- AC-4
8. Type journal content
9. Verify: character count updates -- AC-5
10. Tap "Save"
11. Verify: entry appears in list with mood dot and moon icon -- AC-6, AC-1
12. Tap search icon, type a keyword from the entry
13. Verify: entry appears in filtered results -- AC-7
14. (If 30+ entries exist) Tap Patterns tab
15. Verify: correlations shown with confidence indicators -- AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to journal, compose an entry, verify search
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for pattern detection engine

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No journaling capability exists in MyStars. The module has daily readings but those are auto-generated readings, not user-written reflections. No FTS5 search, no mood tagging, no pattern detection.

### After This Work
- New `engine/journal-context.ts` for auto-capturing astrological snapshots
- New `engine/pattern-detection.ts` for mood-astrology correlation analysis
- New `st_journal_entries` table with FTS5 index
- Full journal list, compose, search, and patterns UI
- Cross-module foundation for future Mood and Journal module integration

### Files Changed
- `modules/stars/src/engine/journal-context.ts` -- context auto-capture
- `modules/stars/src/engine/pattern-detection.ts` -- pattern detection
- `modules/stars/src/db/schema.ts` -- V2 migration adding st_journal_entries + FTS5
- `modules/stars/src/db/crud.ts` -- journal CRUD with search
- `modules/stars/src/types.ts` -- JournalEntry, JournalMood, JournalPattern schemas
- `modules/stars/src/definition.ts` -- V2 migration, navigation update
- `modules/stars/src/__tests__/journal.test.ts` -- tests
- `apps/mobile/app/(stars)/journal.tsx` -- list screen
- `apps/mobile/app/(stars)/journal-compose.tsx` -- compose screen
- `apps/mobile/app/(stars)/journal-patterns.tsx` -- patterns view
- `apps/web/app/stars/journal/page.tsx` -- web page

### Known Limitations
- Active transit context capture depends on Transit Tracking (ST-008) being built. Without it, journal entries will have null `active_transits` field.
- Pattern detection is statistical and requires significant data (30+ entries). New users will see the Patterns tab locked for weeks/months.
- FTS5 on SQLite: works well on both expo-sqlite and better-sqlite3 but the virtual table syntax may need platform-specific handling.

### Context for Next Agent
- The FTS5 virtual table creation uses `content=st_journal_entries, content_rowid=rowid`. This means the FTS index is a "content sync" table that reads from the main table. Insert/update/delete triggers must keep the FTS index in sync. Use SQLite's `INSERT INTO st_journal_entries_fts(st_journal_entries_fts) VALUES('rebuild')` after bulk operations.
- Mood colors should match the existing Mood module's color palette if possible, for visual consistency across modules.
- Pattern detection is a simple frequency comparison: if a mood appears 50%+ more often during a condition (e.g., Mercury retrograde) than in the overall dataset, it is flagged. This is correlation, not causation; label patterns carefully in the UI.
