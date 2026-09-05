# Feature Spec: Filters

## Metadata
- **Module:** mail
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (types.ts already has MailFilter/MailFilterField/MailFilterAction schemas)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Email volume is overwhelming without automation. Gmail's filters are one of its most-used power features, allowing users to auto-sort, auto-star, auto-archive, and auto-delete messages based on rules. MyMail already defines MailFilter types in `types.ts` but has no filter execution engine, no filter CRUD in the database, and no UI. Activating filters transforms MyMail from a passive inbox into an automated email management tool.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gmail | Yes | No | Rule-based filters: match from/to/subject/content, actions: skip inbox, star, label, archive, delete, forward. UI in Settings > Filters. |
| Outlook | Yes | No | "Rules" with conditions and actions. Sweep feature for bulk actions. |
| Superhuman | Yes | Yes ($30/mo) | Auto-triage: AI-powered smart filters + manual rules. Split inbox. |
| Spark | Yes | No | Smart inbox auto-categorizes. Manual rules for move/star/mark-read. |

### Target User
Users receiving 50+ emails per day who need automated inbox management. Gmail power users who rely on filters to keep their inbox manageable. Anyone transitioning from a mail client with existing filter rules.

## Technical Context

### Where This Lives in MyLife

```
modules/mail/src/
  types.ts                            -- Already has MailFilter, MailFilterField, MailFilterAction
  db/schema.ts                        -- V2 migration: ml_filters table
  db/crud.ts                          -- New filter CRUD: create, get, list, update, delete, toggle
  engine/filters.ts                   -- NEW: filter matching engine, filter execution

apps/mobile/app/(mail)/
  settings/filters.tsx                 -- NEW: filter list screen
  settings/filter-editor.tsx           -- NEW: create/edit filter screen
  components/FilterCard.tsx            -- NEW: filter list item

apps/web/app/mail/
  settings/filters/page.tsx            -- NEW: filter management page
  settings/filters/[id]/page.tsx       -- NEW: filter editor page
```

### Wireframe Position

```
Hub Dashboard
  └── MyMail card
       └── Settings tab
            └── Filters ← YOU ARE HERE
                 └── + Add Filter
                 └── Filter 1 (active toggle, edit, delete)
                 └── Filter 2
```

### Data Model

```sql
-- V2 migration
CREATE TABLE IF NOT EXISTS ml_filters (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES ml_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field TEXT NOT NULL CHECK(field IN ('from', 'to', 'subject', 'body')),
  pattern TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('move', 'star', 'mark_read', 'delete')),
  action_value TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ml_filters_account_idx ON ml_filters(account_id);
CREATE INDEX IF NOT EXISTS ml_filters_active_idx ON ml_filters(is_active);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing MailFilter types in `types.ts`
- **External:** None
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a mail user, I want to create filters that auto-sort incoming mail so that my inbox stays organized.
2. As a mail user, I want to create filters that auto-star important messages so that I never miss them.
3. As a mail user, I want to create filters that auto-mark promotional mail as read so that my unread count stays meaningful.
4. As a mail user, I want to toggle filters on/off so that I can temporarily disable rules without deleting them.
5. As a mail user, I want to test a filter against existing messages so that I can see what it would match before activating.

### Behavior Specification

1. User navigates to Settings > Filters
2. Screen shows list of existing filters with name, field, pattern, action, and active toggle
3. User taps "+ Add Filter"
4. Editor screen shows:
   - Name field (required, e.g., "Newsletter auto-read")
   - Match field picker: From, To, Subject, Body
   - Pattern input: substring to match (case-insensitive)
   - Action picker: Move to folder, Star, Mark as read, Delete
   - If action is "Move to folder": folder picker appears
   - Active toggle (default on)
5. User saves. Filter row created in ml_filters
6. When new messages arrive (via IMAP sync), the filter engine runs:
   a. Load all active filters for the message's account, ordered by priority
   b. For each filter, check if message's [field] contains [pattern] (case-insensitive)
   c. If match, execute action: move to folder / toggle star / mark as read / delete
   d. First matching filter wins (stop processing for that message after first match)
7. User can tap "Test" button on a filter to see how many existing messages match
8. User can reorder filters by drag handle to set priority

### Edge Cases

- Pattern is empty string: reject with "Pattern cannot be empty"
- Pattern matches every message (e.g., single letter "e"): warn "This filter matches N messages. Are you sure?"
- Filter action is "move" but no folder specified: reject with "Select a destination folder"
- Filter action is "delete" and user is creating: confirm dialog "Messages matching this filter will be permanently deleted"
- Two filters match the same message: first by priority wins, second is skipped
- Account deleted: CASCADE deletes all filters for that account
- Filter matches a message already in the target folder: skip (no-op move)
- 100+ filters: paginate the list, warn about performance
- Filter pattern with regex-like characters: treat as literal substring, not regex

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Filter list shows all filters with name, match summary, action, and active toggle
- [ ] **AC-2:** "+ Add Filter" opens editor with field picker, pattern input, action picker
- [ ] **AC-3:** Saving a valid filter creates it and returns to filter list
- [ ] **AC-4:** Toggle switch enables/disables filter without deleting
- [ ] **AC-5:** New incoming messages are auto-processed by active filters
- [ ] **AC-6:** "Test" button shows count of existing messages matching the filter
- [ ] **AC-7:** Filters can be reordered by drag (priority order)
- [ ] **AC-8:** Delete button removes filter with confirmation dialog

### Technical Criteria
- [ ] **TC-1:** ml_filters table created with correct schema and constraints
- [ ] **TC-2:** Filter CRUD: create, get, list by account, update, delete, toggle active
- [ ] **TC-3:** Filter engine: case-insensitive substring match on specified field
- [ ] **TC-4:** Filter engine: first-match-wins priority ordering
- [ ] **TC-5:** Filter engine: executes correct action (move, star, mark_read, delete)
- [ ] **TC-6:** Filter engine: processes a batch of 100 messages in < 100ms
- [ ] **TC-7:** Cascade delete removes filters when account is deleted

### Negative Criteria
- [ ] **NC-1:** Filters must NOT use regex (substring match only, predictable performance)
- [ ] **NC-2:** Filter with empty pattern must NOT be saveable
- [ ] **NC-3:** Inactive filters must NOT process incoming messages
- [ ] **NC-4:** Filter execution must NOT modify the filter's own state

## UI Specification

### Mobile (Expo)
- Filter list: `#0A0A0F` background, glass cards per filter
- Filter card: name in `#F0F0F5`, match rule summary in `rgba(240,240,245,0.65)` (e.g., "From contains 'newsletter'"), action badge (color-coded: move=blue, star=yellow, read=green, delete=red), active toggle right-aligned
- Editor screen: form fields with `#12121A` surface inputs, `#3B82F6` accent for Save button
- Drag handle: 6-dot grip icon on left edge of each filter card

### Web (Next.js)
- Settings page at `/mail/settings/filters`
- Table layout on wide screens: Name | Match Rule | Action | Active | Actions (edit/delete)
- Modal editor instead of separate page
- Drag-and-drop reordering via HTML5 Drag API

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards | First load |
| Empty | "No filters yet" with illustration + "Create your first filter" CTA | No filters |
| Error | "Could not save filter" toast | DB write failure |
| Success | Filter list with cards | Filters loaded |
| Partial | Filter list with "Testing..." spinner on one card | Test button pressed |

## Test Requirements

### Unit Tests
- [ ] Filter CRUD: create filter persists to ml_filters
- [ ] Filter CRUD: list filters by account returns sorted by priority
- [ ] Filter CRUD: toggle active flips is_active
- [ ] Filter CRUD: delete removes row
- [ ] Filter CRUD: cascade delete with account
- [ ] Filter engine: matches "from" field case-insensitively
- [ ] Filter engine: matches "to" field
- [ ] Filter engine: matches "subject" field
- [ ] Filter engine: matches "body" field
- [ ] Filter engine: executes "move" action (changes folder)
- [ ] Filter engine: executes "star" action (sets is_starred)
- [ ] Filter engine: executes "mark_read" action (sets is_read)
- [ ] Filter engine: executes "delete" action (removes message)
- [ ] Filter engine: first-match-wins (stops after first match)
- [ ] Filter engine: skips inactive filters
- [ ] Test mode: returns count of matching messages without modifying them

### Integration Tests
- [ ] Full flow: create filter -> new message arrives -> filter auto-processes
- [ ] Disable flow: create filter -> disable -> new message arrives -> not processed

### QA Verification Script

1. Open MyMail on mobile
2. Navigate to Settings > Filters
3. Verify: empty state with "Create your first filter" CTA -- corresponds to AC-1 (empty variant)
4. Tap "+ Add Filter"
5. Verify: editor with field picker, pattern input, action picker -- corresponds to AC-2
6. Create filter: name "Newsletter", field "From", pattern "newsletter@", action "Mark as read"
7. Tap Save
8. Verify: filter appears in list with correct summary -- corresponds to AC-1, AC-3
9. Tap "Test" on the filter
10. Verify: shows count of matching existing messages -- corresponds to AC-6
11. Send a test email from an address containing "newsletter@"
12. Verify: message arrives already marked as read -- corresponds to AC-5
13. Toggle the filter off
14. Verify: toggle shows disabled state -- corresponds to AC-4
15. Send another test email from "newsletter@"
16. Verify: message arrives as unread (filter inactive)
17. Toggle filter back on
18. Create a second filter with "Delete" action
19. Verify: confirmation dialog appears -- corresponds to AC-8 (via delete action warning)
20. Reorder filters by dragging
21. Verify: priority updates -- corresponds to AC-7

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to filter settings, create/edit/delete filters
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- verify mail module parity

## Handoff State

### Before This Work
Mail module has MailFilter Zod types defined in types.ts but no database table, no CRUD, no execution engine, and no UI. Filters are type-only.

### After This Work
Full filter system: ml_filters table, CRUD operations, matching engine with priority ordering and first-match-wins logic, create/edit/test/toggle/delete UI on both mobile and web.

### Files Changed
- `modules/mail/src/db/schema.ts` -- Added ml_filters table + indexes
- `modules/mail/src/db/crud.ts` -- Added filter CRUD (create, get, list, update, delete, toggle)
- `modules/mail/src/engine/filters.ts` -- NEW: filter matching and execution engine
- `modules/mail/src/definition.ts` -- V2 migration entry
- `apps/mobile/app/(mail)/settings/filters.tsx` -- NEW filter list
- `apps/mobile/app/(mail)/settings/filter-editor.tsx` -- NEW filter editor
- `apps/mobile/app/(mail)/components/FilterCard.tsx` -- NEW
- `apps/web/app/mail/settings/filters/page.tsx` -- NEW
- `apps/web/app/mail/settings/filters/[id]/page.tsx` -- NEW

### Known Limitations
- Substring match only (no regex, no boolean operators like AND/OR).
- No "apply to existing messages" bulk action (filters only run on new incoming messages).
- No filter import/export (cannot migrate Gmail filters).
- No compound conditions (single field + pattern per filter).

### Context for Next Agent
The MailFilter types in types.ts already define the field enum (from, to, subject, body) and action enum (move, star, mark_read, delete). The engine should accept a MailMessage and a list of MailFilter objects and return the action to take. Keep the engine pure (no DB side effects) so it can be tested independently. The CRUD layer calls the engine and then executes the action.
