# Feature Spec: RSVP Recurring Events

## Metadata
- **Module:** rsvp
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 3 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Calendar sync/iCal export (A-tier, built -- provides RRULE foundation in .ics generation)
- **Blocks:** Event budget tracker (RS-023, P2 -- needs aggregated expense view across recurrences)

## Business Context

### Why This Feature Exists
Hosts who run weekly game nights, monthly potlucks, or biweekly book clubs currently recreate the same event from scratch every time. That means re-entering title, location, settings, questions, and re-inviting the same guest list. RSVPify is the only competitor with true recurring event support, and they charge $19/mo for it. Recurring events are the #1 request from power users who host 4+ events per month because the repetitive setup kills their productivity.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| RSVPify | Yes | $19/mo | Full recurrence rules (weekly, biweekly, monthly, custom), linked RSVP series |
| Partiful | No | N/A | No recurrence. Users manually duplicate events |
| Evite | No | N/A | No recurrence. Template reuse only |
| Google Calendar | Yes | Free | RRULE-based recurrence, edit single/all/future instances |

### Target User
Power hosts (25-45) who run the same event repeatedly: weekly game nights, monthly dinners, biweekly book clubs. Currently these users either manually recreate events each time or use Google Calendar recurring events and lose RSVP/poll functionality. RSVPify users ($19/mo) who want recurring without the premium price.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/db/schema.ts              -- V3 migration: rv_recurrence_rules, rv_event_series tables
modules/rsvp/src/definition.ts             -- Add RSVP_MIGRATION_V3
modules/rsvp/src/types.ts                  -- RecurrenceRule, RecurrenceFrequency, EventSeries types
modules/rsvp/src/engines/recurrence.ts     -- Pure functions: next occurrence calculation, series generation
modules/rsvp/src/db/crud.ts               -- Recurrence CRUD, series management, instance generation
modules/rsvp/src/index.ts                  -- Re-export recurrence API
modules/rsvp/src/__tests__/recurrence.test.ts  -- Recurrence calculation tests
apps/mobile/app/(rsvp)/components/RecurrenceSelector.tsx  -- Mobile recurrence picker
apps/web/app/rsvp/[eventId]/components/RecurrenceSelector.tsx  -- Web recurrence picker
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Create Event form
                 └── Recurrence section ← YOU ARE HERE
```

### Data Model

```sql
-- V3 Migration: Add recurring event support

CREATE TABLE IF NOT EXISTS rv_recurrence_rules (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL DEFAULT 'weekly',
    interval_count INTEGER NOT NULL DEFAULT 1,
    day_of_week INTEGER,
    day_of_month INTEGER,
    end_type TEXT NOT NULL DEFAULT 'never',
    end_after_count INTEGER,
    end_by_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rv_event_series (
    id TEXT PRIMARY KEY,
    parent_event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    occurrence_event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    occurrence_index INTEGER NOT NULL,
    occurrence_date TEXT NOT NULL,
    is_cancelled INTEGER NOT NULL DEFAULT 0,
    is_modified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS rv_recurrence_rules_event_idx ON rv_recurrence_rules(event_id);
CREATE INDEX IF NOT EXISTS rv_event_series_parent_idx ON rv_event_series(parent_event_id);
CREATE INDEX IF NOT EXISTS rv_event_series_occurrence_idx ON rv_event_series(occurrence_event_id);
CREATE INDEX IF NOT EXISTS rv_event_series_date_idx ON rv_event_series(occurrence_date);
```

**Design:** The parent event stores the template and the recurrence rule. Each occurrence is a full `rv_events` record linked via `rv_event_series`. This allows per-occurrence modifications (different location, cancelled instance) without affecting the series.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (selector components, Cool Obsidian tokens)
- **External:** None. Recurrence calculation is pure local math.
- **Cross-Module:** Calendar sync -- when generating .ics for a recurring event, include RRULE in the VEVENT. The existing `engines/ical.ts` will need an `addRRule()` extension.

## Functional Requirements

### User Stories
1. As a host, I want to set an event as recurring (weekly, biweekly, monthly) so that future instances are auto-created with the same details.
2. As a host, I want to edit a single instance of a recurring event without changing the whole series.
3. As a host, I want to cancel a single instance without deleting the series.
4. As a host, I want to stop a recurring series ("end after N occurrences" or "end by date").
5. As a guest, I want to RSVP to each instance independently.

### Behavior Specification

**Setting up recurrence:**
1. Host creates a new event or edits an existing event
2. In the event form, a "Repeat" section appears below date/time
3. Options: Never (default), Weekly, Biweekly, Monthly, Custom
4. For Weekly/Biweekly: system auto-selects the day of week from the event's start date
5. For Monthly: system auto-selects the day of month from the event's start date
6. For Custom: user can set frequency (daily, weekly, monthly), interval (every N), and day
7. End condition: "Never", "After N occurrences" (2-52), or "By date"
8. User saves the event
9. System creates the `rv_recurrence_rules` record
10. System generates the next 4 occurrences as `rv_events` records linked via `rv_event_series`
11. Occurrences inherit: title, description, location, settings, questions, invites from parent
12. Each occurrence gets its own start_at/end_at calculated from the recurrence rule

**Viewing recurring events:**
1. On the events list, recurring events show a repeat icon badge
2. Tapping shows the next upcoming instance by default
3. "View all in series" link shows all past and future instances
4. Each instance shows "Part of [Event Name] series" badge

**Editing a single instance:**
1. Host opens a specific occurrence
2. Host modifies details (e.g., different location this week)
3. System prompts: "Edit this event only" or "Edit all future events"
4. "This event only": marks `rv_event_series.is_modified = 1`, updates only this occurrence
5. "All future events": updates parent event + regenerates future occurrences

**Cancelling a single instance:**
1. Host opens a specific occurrence
2. Host taps "Cancel this event"
3. System prompts: "Cancel this event only" or "Cancel entire series"
4. "This event only": marks `rv_event_series.is_cancelled = 1`, hides from guest view
5. "Cancel entire series": deletes parent event (CASCADE deletes all linked occurrences)

**Occurrence generation:**
1. System lazily generates occurrences: always maintain 4 upcoming instances
2. When an occurrence passes (start_at < now), generate the next one
3. Generation runs on event list load (not background process)
4. Respects end condition: stop generating if count reached or date passed

### Edge Cases
- **Event created on Jan 31, monthly recurrence:** Next occurrence is Feb 28 (or Feb 29 in leap year). Use "last day of month" logic for months with fewer days.
- **Recurrence end date is before next occurrence:** No new instances generated. Series shows "Ended" badge.
- **Host edits parent event title:** All unmodified future occurrences update their title. Modified instances keep their custom title.
- **Guest RSVPs to future instance that gets cancelled:** RSVP data preserved but hidden. If instance is un-cancelled, RSVPs reappear.
- **Changing recurrence rule on existing series:** Prompt "This will regenerate all future events. Past events and their RSVPs are preserved." Delete future unmodified occurrences, regenerate from new rule.
- **Deleting parent event:** CASCADE deletes all occurrences and their RSVPs, expenses, etc.
- **Very long series (52+ weeks):** Only generate 4 upcoming. Lazy generation prevents unbounded table growth.
- **Timezone change on parent:** Future occurrences use new timezone. Past occurrences unchanged.
- **Two recurring events on same day:** Both generate normally. No conflict resolution needed.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Repeat" selector appears on event creation/edit form with options: Never, Weekly, Biweekly, Monthly, Custom
- [ ] **AC-2:** Selecting a frequency auto-fills day of week/month from event date
- [ ] **AC-3:** End condition options: Never, After N occurrences, By date
- [ ] **AC-4:** Saving a recurring event creates the next 4 occurrence instances
- [ ] **AC-5:** Recurring events show repeat icon badge on events list
- [ ] **AC-6:** "View all in series" link shows full series timeline
- [ ] **AC-7:** Editing a single instance prompts "This event only" vs "All future events"
- [ ] **AC-8:** Cancelling a single instance hides it from guest view without deleting
- [ ] **AC-9:** Guests can RSVP independently to each occurrence
- [ ] **AC-10:** Invites from parent event are copied to each new occurrence
- [ ] **AC-11:** Past occurrences are preserved when recurrence rule changes

### Technical Criteria
- [ ] **TC-1:** V3 migration creates rv_recurrence_rules and rv_event_series tables with correct indexes
- [ ] **TC-2:** `calculateNextOccurrence()` correctly handles weekly, biweekly, monthly, custom frequencies
- [ ] **TC-3:** Monthly recurrence on day 31 falls back to last day of shorter months
- [ ] **TC-4:** Lazy generation maintains exactly 4 upcoming instances
- [ ] **TC-5:** End condition "after N" stops generation at the correct count
- [ ] **TC-6:** End condition "by date" stops generation past the specified date
- [ ] **TC-7:** Modified instances (is_modified=1) are not overwritten by parent edits
- [ ] **TC-8:** Cancelled instances (is_cancelled=1) are excluded from guest-facing queries

### Negative Criteria
- [ ] **NC-1:** Recurring events must NOT generate more than 4 upcoming instances at a time
- [ ] **NC-2:** Editing a single instance must NOT affect other instances in the series
- [ ] **NC-3:** Cancelling a single instance must NOT delete its RSVP data
- [ ] **NC-4:** Deleting the parent event must CASCADE delete all occurrences and related data

## UI Specification

### Mobile (Expo)
- **Repeat selector:** Segmented control with glass styling, module accent `#FB7185` for active segment
- **Custom frequency sheet:** Bottom sheet with frequency picker, interval stepper, day picker
- **End condition:** Radio buttons (Never / After N / By date) with inline date picker
- **Series badge:** Small repeat icon + "Weekly" text in `rgba(240,240,245,0.65)` below event title
- **Edit prompt:** Action sheet with "This event only" and "All future events" options

### Web (Next.js)
- Same tokens via CSS variables
- Repeat selector as dropdown on event form
- Custom frequency in expandable section
- Edit prompt as dialog modal

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No Recurrence | "Repeat: Never" default selected | New event form |
| Frequency Selected | Frequency badge + end condition options visible | User selects frequency |
| Series Active | Events list shows recurring badge + next instance | Recurring event saved |
| Single Instance Edit | Action sheet asking scope of edit | User edits an occurrence |
| Series Ended | "Ended" badge on parent, no future instances | End condition met |
| Instance Cancelled | Strikethrough on cancelled date in series view | Host cancels one instance |

## Test Requirements

### Unit Tests (engines/recurrence.ts)
- [ ] `calculateNextOccurrence`: weekly from Monday returns next Monday
- [ ] `calculateNextOccurrence`: biweekly from Jan 1 returns Jan 15
- [ ] `calculateNextOccurrence`: monthly from Jan 31 returns Feb 28
- [ ] `calculateNextOccurrence`: monthly from Jan 31 in leap year returns Feb 29
- [ ] `calculateNextOccurrence`: monthly from Jan 15 returns Feb 15
- [ ] `calculateNextOccurrence`: custom every 3 weeks works correctly
- [ ] `generateOccurrences`: generates exactly 4 upcoming dates
- [ ] `generateOccurrences`: respects "after N" end condition
- [ ] `generateOccurrences`: respects "by date" end condition
- [ ] `generateOccurrences`: returns empty array when end condition already met
- [ ] `shouldGenerateMore`: returns true when < 4 upcoming instances exist
- [ ] `shouldGenerateMore`: returns false when 4 upcoming instances exist

### Integration Tests
- [ ] Create recurring event -> verify 4 instances created in rv_event_series
- [ ] Edit single instance -> verify only that instance modified, is_modified=1
- [ ] Cancel single instance -> verify is_cancelled=1, guest query excludes it
- [ ] Edit parent title -> verify unmodified instances updated, modified instances unchanged
- [ ] Delete parent -> verify all occurrences CASCADE deleted
- [ ] V3 migration runs cleanly on existing V2 database

### QA Verification Script

1. Open MyRSVP, tap "Create Event"
2. Fill in "Weekly Game Night", set date to next Saturday 7 PM
3. Set Repeat to "Weekly"
4. **Verify:** Day of week auto-shows "Saturday" -- AC-2
5. Set End to "After 8 occurrences"
6. Save event
7. **Verify:** Events list shows game night with repeat badge -- AC-5
8. **Verify:** 4 upcoming Saturday instances visible -- AC-4
9. Tap the 2nd instance, change location to "Bob's House"
10. **Verify:** Prompt asks "This event only" vs "All future" -- AC-7
11. Select "This event only"
12. **Verify:** Only 2nd instance shows "Bob's House", others unchanged -- AC-8
13. Open 3rd instance, tap "Cancel this event"
14. Select "Cancel this event only"
15. **Verify:** 3rd instance hidden from guest view -- AC-8
16. Create event on Jan 31 with Monthly recurrence
17. **Verify:** Next occurrence is Feb 28 (or 29) -- TC-3

## gstack Quality Gates

Based on Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to recurrence selector, create recurring event, verify series

### Required for business logic engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for recurrence calculation

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Events are standalone with no link between repeated instances
- Calendar sync exports single events (no RRULE)
- Templates exist but do not auto-create recurring events
- No rv_recurrence_rules or rv_event_series tables

### After This Work
- V3 migration adds rv_recurrence_rules and rv_event_series tables
- Pure engine: `calculateNextOccurrence()`, `generateOccurrences()`, `shouldGenerateMore()`
- CRUD: createRecurrenceRule, getRecurrenceRule, updateRecurrenceRule, deleteRecurrenceRule, createOccurrence, getSeriesByParent, cancelOccurrence, editOccurrence
- Lazy generation: 4 upcoming instances maintained
- Mobile + web recurrence selector component
- 12+ unit tests, 6+ integration tests

### Files Changed
- `modules/rsvp/src/db/schema.ts` -- V3 tables and indexes
- `modules/rsvp/src/definition.ts` -- Add RSVP_MIGRATION_V3
- `modules/rsvp/src/types.ts` -- RecurrenceFrequency, RecurrenceRule, EventSeries types
- `modules/rsvp/src/engines/recurrence.ts` -- Occurrence calculation and series generation
- `modules/rsvp/src/db/crud.ts` -- Recurrence and series CRUD
- `modules/rsvp/src/index.ts` -- Re-export recurrence API
- `modules/rsvp/src/__tests__/recurrence.test.ts` -- Recurrence algorithm tests
- `apps/mobile/app/(rsvp)/components/RecurrenceSelector.tsx` -- Mobile recurrence picker
- `apps/web/app/rsvp/[eventId]/components/RecurrenceSelector.tsx` -- Web recurrence picker

### Known Limitations
- Only 4 upcoming instances generated at a time (lazy generation, not full series pre-creation)
- No "every weekday (Mon-Fri)" shortcut (use Custom with individual day selection)
- No cross-timezone recurrence (all occurrences use parent event's timezone)
- No conflict detection with other events or modules
- RRULE generation in .ics is basic (FREQ, INTERVAL, COUNT, UNTIL) -- no BYDAY exceptions

### Context for Next Agent
- The `rv_event_series` table links a parent event to its occurrence events. Both parent and occurrence are full `rv_events` records. The parent serves as the template; occurrences inherit from it.
- When querying events for the events list, join with `rv_event_series` and exclude `is_cancelled=1` rows. Show the repeat badge by checking if the event has a `rv_recurrence_rules` record.
- Lazy generation: on events list load, check if fewer than 4 upcoming instances exist for any recurring event. If so, generate the next batch. This avoids creating hundreds of future events.
- Monthly recurrence on day 31: use `Math.min(ruleDay, daysInMonth)` to clamp to the last valid day.
- The existing `engines/ical.ts` `generateICalString()` does not include RRULE. Add an optional `rrule` parameter and render it as an additional VEVENT property when present.
