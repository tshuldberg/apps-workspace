# Feature Spec: Therapy Templates

## Metadata
- **Module:** journal
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 3 x1
- **Sprint:** Sprint 5 (S+A Features)
- **Estimated CC Time:** 2-3 hours
- **Depends On:** JR-015 (CBT Thought Records -- spec'd here, can be built in parallel), JR-017 (Templates -- basic template system)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Therapy is expensive ($150-300/session). Most people see their therapist every 1-2 weeks and waste significant session time catching up on "what happened since last time." Structured therapy prep saves 10-15 minutes per session, effectively adding value equivalent to thousands of dollars per year. Daylio ($35.99/yr, 20M users) pioneered in-app therapy tools. Stoic ($40/yr) focuses specifically on therapy prep and CBT. MyJournal can offer the same structured templates with the critical advantage that therapy prep notes -- among the most sensitive personal data imaginable -- never leave the device. No cloud, no therapist portal, no data breach risk.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Daylio | Yes | $35.99/yr | Therapy-related templates, mood tracking for therapy discussions. Cloud-synced. |
| Stoic | Yes | $40/yr | CBT thought records, therapy session prep, guided reflection. Cloud-stored. |
| Day One | No | N/A | Generic templates but no therapy-specific tooling. |
| Apple Journal | No | N/A | No structured templates at all. |

### Target User
People in therapy (individual, couples, or group) who want to prepare for sessions and track progress. Also self-directed mental health practitioners using CBT or therapeutic journaling techniques. These users currently maintain separate notes apps or paper worksheets for therapy prep, creating a fragmented experience.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/therapy/                    -- NEW: therapy template engine
modules/journal/src/therapy/types.ts            -- TherapySession, TherapyTemplate, TherapyTopic types
modules/journal/src/therapy/templates.ts        -- 4 built-in therapy template definitions
modules/journal/src/therapy/session-engine.ts   -- Session numbering, auto-population, timeline
modules/journal/src/therapy/index.ts            -- Barrel export
modules/journal/src/therapy/__tests__/          -- Tests
modules/journal/src/db/therapy.ts               -- NEW: CRUD for therapy tables
apps/mobile/app/(journal)/therapy-prep.tsx      -- Mobile therapy prep entry screen
apps/mobile/app/(journal)/therapy-timeline.tsx  -- Mobile session timeline
apps/web/app/journal/therapy/page.tsx           -- Web therapy prep
apps/web/app/journal/therapy/timeline/page.tsx  -- Web therapy timeline
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Entries tab / Today tab
            └── "New Entry" -> "Therapy Prep" option
                 └── Template Selector -> Therapy Prep Screen ← YOU ARE HERE
       └── Settings tab
            └── "Session Timeline" ← ALSO HERE
```

### Data Model

Two new tables and entry columns in migration V3 (coordinate with voice/metadata):

```sql
-- Extend entries with therapy metadata
ALTER TABLE jn_entries ADD COLUMN entry_type TEXT DEFAULT 'standard'
  CHECK (entry_type IN ('standard', 'therapy_prep'));
ALTER TABLE jn_entries ADD COLUMN therapy_session_number INTEGER;
ALTER TABLE jn_entries ADD COLUMN therapy_template_type TEXT
  CHECK (therapy_template_type IN ('pre_session', 'post_session', 'crisis_plan', 'progress_checkin'));

-- Therapy topics (structured items within therapy entries)
CREATE TABLE IF NOT EXISTS jn_therapy_topics (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  section TEXT NOT NULL
    CHECK (section IN (
      'topics', 'wins', 'challenges', 'questions',
      'takeaways', 'action_items', 'followup_questions',
      'warning_signs', 'coping_strategies', 'support_contacts', 'safe_actions',
      'original_goals', 'new_goals', 'patterns', 'working', 'not_working'
    )),
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS jn_therapy_topics_entry_idx ON jn_therapy_topics(entry_id, section, sort_order);
CREATE INDEX IF NOT EXISTS jn_entries_therapy_session_idx ON jn_entries(therapy_session_number);
CREATE INDEX IF NOT EXISTS jn_entries_type_idx ON jn_entries(entry_type);
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, mood distribution from `engine/stats.ts`
- **External:** none (fully local)
- **Cross-Module:** CBT thought records (JR-015, if implemented) provide auto-populated data. Mood tagging provides mood trend data. Both degrade gracefully if unavailable.

## Functional Requirements

### User Stories
1. As a therapy client, I want structured templates for pre-session prep so that I make the most of my limited session time.
2. As a therapy client, I want post-session reflection templates so that I can capture key takeaways and homework before I forget.
3. As someone managing mental health, I want a crisis plan template so that I have my coping strategies and support contacts readily accessible.
4. As a long-term therapy client, I want a session timeline showing all my therapy entries so that I can track my progress over months.

### Behavior Specification

1. User taps "New Entry" and selects "Therapy Prep" from entry type options.
2. Template selector appears with 4 options:
   - **Pre-Session Prep**: Topics, Wins, Challenges, Questions, (auto-populated: Mood Summary, Thought Records)
   - **Post-Session Reflection**: Takeaways, Action Items, Follow-Up Questions, Post-Session Mood
   - **Crisis Plan**: Warning Signs, Coping Strategies, Support Contacts, Safe Actions
   - **Progress Check-In**: Original Goals, Progress Ratings, New Goals, Patterns, What's Working/Not
3. User selects a template. Therapy prep screen opens.
4. Header shows: template name, "Session #N" (auto-incremented), "Since last session: X days".
5. Each template section is a collapsible card:
   - Section header (tappable to collapse/expand)
   - Content area: text fields, ordered lists, or auto-populated data
6. **Auto-populated sections (Pre-Session Prep):**
   - "Mood Trend Summary": if mood tagging is used, shows average mood and distribution since last session
   - "Thought Records to Review": if CBT records exist, shows recent records with situation previews
   - If features are disabled: shows "Enable [feature] for auto-populated data"
7. User fills in sections. Order is suggested but not enforced.
8. User taps "Done". Entry saved with `entry_type = 'therapy_prep'`, session number assigned, auto-tagged "therapy".
9. Session Timeline (accessible from Settings or Entries filter): vertical timeline of all therapy prep entries.

### Edge Cases

- **First therapy session ever:** Session number = 1. Auto-populated sections use 14-day lookback. No "since last session" calculation.
- **Long gap between sessions (90+ days):** Query all data in the gap. Show "It has been X days since your last session."
- **CBT feature not enabled:** "Thought Records to Review" shows graceful fallback text.
- **Mood tagging not used:** "Mood Trend Summary" shows graceful fallback text.
- **User saves partial template:** All sections save as-is. No required fields (user may prepare only what they need).
- **Deleting a therapy entry:** Session numbers are never renumbered. Gap is expected.
- **Crisis Plan is special:** It is a living document, not session-specific. User creates once and updates. No session number assigned to crisis plans.
- **Action items from Post-Session:** `is_completed` flag allows tracking homework completion.
- **Reordering topics:** User can drag to reorder items within a section via `sort_order`.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Therapy Prep" option appears in the new entry type selector.
- [ ] **AC-2:** Template selector shows 4 therapy-specific templates with descriptions.
- [ ] **AC-3:** Pre-Session Prep shows 6 sections: Topics, Wins, Challenges, Questions, Mood Summary, Thought Records.
- [ ] **AC-4:** Post-Session Reflection shows 4 sections: Takeaways, Action Items, Follow-Up Questions, Post-Session Mood.
- [ ] **AC-5:** Crisis Plan shows 4 sections: Warning Signs, Coping Strategies, Support Contacts, Safe Actions.
- [ ] **AC-6:** Progress Check-In shows 5 sections: Original Goals, Progress, New Goals, Patterns, What's Working/Not.
- [ ] **AC-7:** Session number auto-increments from previous therapy entries.
- [ ] **AC-8:** "Since last session: X days" displayed in header.
- [ ] **AC-9:** Auto-populated mood summary shows average mood and distribution (when mood data exists).
- [ ] **AC-10:** Auto-populated thought records shows recent CBT records (when CBT data exists).
- [ ] **AC-11:** Session Timeline shows all therapy entries chronologically with session numbers.
- [ ] **AC-12:** Entries are auto-tagged "therapy" on save.

### Technical Criteria
- [ ] **TC-1:** Migration V3 adds `entry_type`, `therapy_session_number`, `therapy_template_type` to `jn_entries` and creates `jn_therapy_topics` table.
- [ ] **TC-2:** Session number = `MAX(therapy_session_number) + 1` at save time.
- [ ] **TC-3:** Auto-population queries entries between last session date and today for mood data.
- [ ] **TC-4:** Template section mapping enforced: each template type has a defined set of valid sections.
- [ ] **TC-5:** `jn_therapy_topics` supports ordered items per section via `sort_order`.
- [ ] **TC-6:** Crisis Plan entries do not receive session numbers (null).
- [ ] **TC-7:** Entry type filter works on existing `listJournalEntries` with new `entry_type` parameter.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Therapy data must NEVER leave the device. No cloud sync for therapy entries.
- [ ] **NC-2:** Deleting a therapy entry must NOT renumber other sessions.
- [ ] **NC-3:** Auto-populated data must NOT modify the source entries (read-only references).
- [ ] **NC-4:** No sections should be required. User can save with any subset filled in.

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Template selector: 4 glass cards with template name, description, icon
- Section cards: collapsible glass cards with header, expand/collapse chevron
- Section header: 16px semibold, `#A78BFA` accent icon per section
- Topic items: text fields within sections, drag handle for reorder, "x" to delete
- Action items: checkbox + text (for Post-Session homework tracking)
- Auto-populated sections: "Refreshed from your data" label with refresh icon, data displayed as read-only cards
- Session indicator: "Session #N" badge in `#A78BFA`, "Since last session: X days" in textSecondary
- Timeline: vertical line with circular nodes per session, tap to open
- Module accent: `#A78BFA`

### Web (Next.js)

- Route: `/journal/therapy` (new entry), `/journal/therapy/timeline` (history)
- Two-column layout: sections on left, auto-populated data on right
- Same template selector and section structure

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Template Selection | 4 template cards to choose from | User taps "Therapy Prep" |
| New Session | Empty sections, session #1, no auto-populated data | First therapy entry |
| Returning | Session #N, auto-populated sections with recent data | Previous sessions exist |
| No CBT Data | Fallback text in Thought Records section | CBT not enabled |
| No Mood Data | Fallback text in Mood Summary section | No mood-tagged entries |
| Saving | Brief spinner, then success | User taps "Done" |
| Timeline | Chronological list of therapy entries | User opens timeline |

## Test Requirements

### Unit Tests
- [ ] `autoIncrementSession`: 3 existing sessions -> new session = 4
- [ ] `firstSession`: no existing sessions -> session = 1
- [ ] `autoPopulateMoodSummary`: 5 mood-tagged entries since last session -> avg mood + distribution
- [ ] `autoPopulateNoMoodData`: no mood entries -> fallback text
- [ ] `crisisPlanNoSessionNumber`: crisis plan entry -> therapy_session_number = null
- [ ] `templateSectionMapping`: pre_session -> [topics, wins, challenges, questions]
- [ ] `reorderTopics`: swap sort_order of 2 items -> order updated
- [ ] `filterByEntryType`: listEntries with entry_type='therapy_prep' -> only therapy entries
- [ ] `autoTagTherapy`: save therapy entry -> "therapy" tag added
- [ ] `calculateDaysSinceLastSession`: last session 14 days ago -> "Since last session: 14 days"

### Integration Tests
- [ ] Full flow: select Pre-Session Prep -> fill sections -> save -> verify entry_type, session_number, topics stored
- [ ] Timeline flow: create 3 therapy entries -> open timeline -> verify all 3 shown in order

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Today tab
3. Tap "New Entry"
4. Verify: "Therapy Prep" option in entry type selector -- corresponds to AC-1
5. Tap "Therapy Prep"
6. Verify: 4 template cards shown -- corresponds to AC-2
7. Select "Pre-Session Prep"
8. Verify: 6 sections visible (Topics, Wins, Challenges, Questions, Mood Summary, Thought Records) -- corresponds to AC-3
9. Verify: "Session #1" displayed (first session) -- corresponds to AC-7
10. Add 3 topics in "Topics I Want to Discuss"
11. Add 2 wins, 1 challenge
12. Verify: items are reorderable via drag
13. Tap "Done"
14. Verify: entry saved with "therapy" tag -- corresponds to AC-12
15. Create a second therapy entry
16. Verify: "Session #2" and "Since last session: X days" shown -- corresponds to AC-7, AC-8
17. Navigate to Session Timeline
18. Verify: both sessions shown chronologically -- corresponds to AC-11
19. Select "Post-Session Reflection" template
20. Verify: 4 sections (Takeaways, Action Items, Follow-Up, Post-Session Mood) -- corresponds to AC-4
21. Select "Crisis Plan" template
22. Verify: 4 sections shown, no session number -- corresponds to AC-5
23. Select "Progress Check-In" template
24. Verify: 5 sections shown -- corresponds to AC-6
25. Open the app on web
26. Navigate to Journal > Therapy
27. Verify: same template selection and section flow

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to /journal/therapy, create a prep entry, verify timeline

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal entries are untyped (all standard). No therapy-specific templates, session tracking, or structured sections exist. The prompts engine has "therapy" as a category but only provides daily prompts, not structured templates.

### After This Work
Entries can be typed as `therapy_prep` with session numbering and template type. A `jn_therapy_topics` table stores structured items per section. Four therapy templates are available. Session timeline shows therapy history. Auto-population fetches mood and CBT data (if available).

### Files Changed
- `modules/journal/src/db/schema.ts` -- add ALTER TABLE for entry_type/session/template columns, CREATE_THERAPY_TOPICS, indexes
- `modules/journal/src/definition.ts` -- add therapy tables to JOURNAL_MIGRATION_V3
- `modules/journal/src/db/therapy.ts` -- CRUD for therapy topics, session numbering
- `modules/journal/src/therapy/types.ts` -- TherapySession, TherapyTemplate, TherapyTopic, TemplateSection types
- `modules/journal/src/therapy/templates.ts` -- 4 template definitions with section mappings
- `modules/journal/src/therapy/session-engine.ts` -- autoIncrementSession, autoPopulate, daysSinceLastSession
- `modules/journal/src/therapy/index.ts` -- barrel export
- `modules/journal/src/therapy/__tests__/session-engine.test.ts` -- 10+ unit tests
- `modules/journal/src/types.ts` -- extend JournalEntrySchema with therapy fields, add TherapyTopic schema
- `modules/journal/src/index.ts` -- re-export therapy module
- `apps/mobile/app/(journal)/therapy-prep.tsx` -- therapy prep entry screen
- `apps/mobile/app/(journal)/therapy-timeline.tsx` -- session timeline
- `apps/web/app/journal/therapy/page.tsx` -- web therapy prep
- `apps/web/app/journal/therapy/timeline/page.tsx` -- web timeline

### Known Limitations
- Auto-population depends on CBT and mood features being implemented. Both degrade gracefully.
- No therapist sharing portal. Users share by showing their phone or exporting to PDF.
- No appointment integration (no calendar sync for therapy schedules).
- Session numbering is linear only. No support for multiple therapists.

### Context for Next Agent
- The `jn_entries` table uses `journal_id` column (from V2) for notebook assignment. Therapy entries go in the default notebook unless the user chooses otherwise.
- Auto-population for mood uses `summarizeMoodDistribution` from `engine/stats.ts` filtered to entries since `last_session_date`.
- The "therapy" tag auto-assignment uses existing tag CRUD. Check if tag "therapy" exists, create if not, then link via `jn_entry_tags`.
- Crisis Plan entries should NOT have `therapy_session_number` set (they are living documents, not session-specific).
- Template section mapping is a simple constant: `{ pre_session: ['topics', 'wins', 'challenges', 'questions'], ... }`.
- The `sort_order` on `jn_therapy_topics` enables drag-to-reorder on mobile.
