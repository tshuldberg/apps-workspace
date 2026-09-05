# Feature Spec: Time Tracking with Billable Hours

## Metadata
- **Module:** habits
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 3 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 4-5 hours
- **Depends On:** HB-004 (Timed Sessions infrastructure)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Toggl charges $108/user/year for time tracking with billable hours. Most freelancers and independent workers only need basic project-based time tracking: start/stop a timer, associate it with a project, set an hourly rate, and generate a simple time report for invoicing. MyHabits already has timed sessions infrastructure. Extending it with project metadata, hourly rates, and report generation turns an existing feature into a lightweight Toggl replacement at no additional cost. This is a high-value add for the freelancer persona without significant engineering complexity.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Toggl | Yes | Yes ($108/yr/user) | Full-featured time tracking with team management, invoicing, dashboards. Enterprise-focused. |
| Clockify | Yes | Freemium | Free time tracking, paid for reports/invoicing. Cloud-required. |
| Habitify | Yes (partial) | Yes | Basic time tracking per habit, no project/billing features. |
| Harvest | Yes | Yes ($132/yr/user) | Time tracking + invoicing + expenses. Enterprise-focused. |
| Streaks | No | N/A | No time tracking. |

### Target User
Freelancers and independent contractors paying $108+/yr for Toggl or Harvest who need basic time tracking with project categorization and billable hour reports. Not teams or enterprises. Migration path: solo freelancer discovers MyLife tracks time AND integrates it with their habit/productivity workflow, replacing both Toggl and a habit tracker with one app.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  time-tracking/
    engine.ts                     -- NEW: Billable calculation, report generation, project stats
    __tests__/engine.test.ts      -- NEW: Engine tests
  db/
    time-tracking.ts              -- NEW: Project config CRUD, time report queries
    schema.ts                     -- MODIFY: Add hb_projects table (V4)
  types.ts                        -- MODIFY: Add Project, TimeReport, TimeEntry schemas
  definition.ts                   -- MODIFY: Add V4 migration, add time-reports screen
  index.ts                        -- MODIFY: Export time-tracking engine + types + CRUD
apps/mobile/app/(habits)/
  time-reports.tsx                -- NEW: Time reports screen
apps/web/app/habits/
  time-reports/page.tsx           -- NEW: Web time reports page (or fallback)
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Timed habit with project badge]
       ├── Habits tab
       │    └── [Edit habit > "Track as project" toggle]
       ├── Stats tab
       │    └── Time Reports ← YOU ARE HERE
       └── Settings tab
```

### Data Model

```sql
-- Project metadata linked to timed habits
CREATE TABLE IF NOT EXISTS hb_projects (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  client_name TEXT,
  hourly_rate INTEGER NOT NULL DEFAULT 0,  -- cents per hour
  currency TEXT NOT NULL DEFAULT 'USD',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(habit_id)  -- one project per timed habit
);

CREATE INDEX IF NOT EXISTS hb_projects_habit_idx ON hb_projects(habit_id);
CREATE INDEX IF NOT EXISTS hb_projects_active_idx ON hb_projects(is_active);
```

Note: Time entries themselves are stored in the existing `hb_timed_sessions` table. The `hb_projects` table adds project/billing metadata on top.

### Dependencies
- **Internal:** `@mylife/habits` (timed sessions CRUD, session start/end), `@mylife/db` (DatabaseAdapter)
- **External:** None. Pure local calculation. Report export uses the same CSV pattern as `export.ts`.
- **Cross-Module:** Budget module (billable earnings could feed into income tracking). None required for V1.

## Functional Requirements

### User Stories
1. As a freelancer, I want to mark a timed habit as a "project" with a client name and hourly rate so I can track billable time.
2. As a freelancer, I want to view a time report for a date range showing total hours and billable amount per project, so I can invoice clients.
3. As a freelancer, I want to export a CSV time report so I can attach it to invoices or import into accounting software.
4. As a user, I want to see a running total of today's billable work on the Today tab so I know how much I've earned today.

### Behavior Specification

**Enabling project tracking on a habit:**
1. User creates or edits a timed habit (habitType = "timed").
2. A toggle appears: "Track as project."
3. When enabled, additional fields appear:
   - Project name (required, text input)
   - Client name (optional, text input)
   - Hourly rate (currency input, default $0.00, stored as cents)
   - Currency (selector: USD, EUR, GBP, CAD, AUD, JPY; default USD)
4. This creates an `hb_projects` record linked to the habit.

**Time tracking workflow:**
1. User starts a timed session on a project-enabled habit (existing start/stop flow).
2. The running timer shows the project name and accumulating billable amount.
3. When the session ends, `durationSeconds` is recorded in `hb_timed_sessions`.
4. The billable amount is calculated: `(durationSeconds / 3600) * hourlyRate`.

**Time reports screen:**
1. Date range selector: This Week, This Month, Last Month, Custom Range.
2. Summary card: Total hours, total billable amount across all projects.
3. Per-project breakdown: project name, client name, hours, billable amount.
4. Expandable: individual sessions under each project (date, start time, duration, amount).
5. "Export CSV" button: generates a downloadable CSV report.

**CSV report format:**
```
Project,Client,Date,Start Time,Duration (hours),Hourly Rate,Amount
Website Redesign,Acme Corp,2026-03-15,09:00,2.50,$75.00,$187.50
Website Redesign,Acme Corp,2026-03-16,14:00,1.75,$75.00,$131.25
...
TOTAL,,,6.25,,$468.75
```

### Edge Cases

- **Hourly rate = $0:** Valid. Time is tracked but billable amount shows $0.00. Useful for personal time tracking.
- **Very short sessions (< 1 minute):** Included in totals. Displayed as "< 1 min" in reports. Billable amount rounds to nearest cent.
- **Session spans midnight:** Attributed to the day it started.
- **No sessions in date range:** Report shows "No time tracked in this period" with empty state.
- **Habit type changes from timed to standard:** Project data preserved but time tracking stops. Re-changing to timed resumes.
- **Currency change:** Applies to all future calculations. Past sessions are retrospectively updated with new rate (not new currency; currency changes are rare).
- **Multiple projects:** Each timed habit is its own project. Total report aggregates all.
- **Archived habits with projects:** Project data preserved. Historical sessions still appear in reports.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Track as project" toggle appears on timed habit edit screen
- [ ] **AC-2:** Project fields (name, client, rate, currency) are configurable
- [ ] **AC-3:** Running timer shows project name and accumulating billable amount
- [ ] **AC-4:** Time reports screen shows summary with total hours and billable amount
- [ ] **AC-5:** Per-project breakdown shows hours and billable amount correctly
- [ ] **AC-6:** Date range selector filters report data correctly
- [ ] **AC-7:** CSV export generates correct file with proper formatting
- [ ] **AC-8:** Feature renders correctly on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `calculateBillableAmount(durationSeconds, hourlyRateCents)` returns correct amount in cents
- [ ] **TC-2:** `generateTimeReport(sessions, projects, dateRange)` aggregates correctly per project
- [ ] **TC-3:** `generateCSV(report)` produces correctly formatted CSV with header and summary row
- [ ] **TC-4:** V4 migration creates hb_projects table
- [ ] **TC-5:** UNIQUE(habit_id) prevents multiple projects per habit
- [ ] **TC-6:** Engine functions are pure (no side effects, no database calls)
- [ ] **TC-7:** Hourly rate stored as integer cents to avoid floating-point precision issues

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Billable amounts must NOT use floating-point dollars (use integer cents internally)
- [ ] **NC-2:** Time reports must NOT include sessions from non-project habits
- [ ] **NC-3:** CSV export must NOT include any data outside the selected date range
- [ ] **NC-4:** Deleting a project must NOT delete the underlying timed sessions

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#8B5CF6` (habits purple)
- Billable amount: `#22C55E` (green), bold
- Project badge: small accent-colored label on timed habit card
- Date range pills: horizontal scrollable

Layout:
```
[Time Reports Screen]

  [This Week ▾]                  [date range selector]

  [Summary Card]
  Total: 18.5 hours  |  $1,387.50
  3 projects tracked

  [Website Redesign - Acme Corp]
  12.0 hours  |  $900.00 ($75/hr)
    Mar 15: 2.5h - $187.50
    Mar 16: 1.75h - $131.25
    Mar 17: 3.0h - $225.00
    Mar 18: 4.75h - $356.25

  [Mobile App - StartupCo]
  4.5 hours  |  $337.50 ($75/hr)
    ...

  [Writing - Personal]
  2.0 hours  |  $0.00 ($0/hr)
    ...

  [Export CSV]                   [button, bottom]
```

### Web (Next.js)

- Route: `/habits/time-reports`
- Same tokens via CSS variables
- Table layout for individual sessions (columns: Date, Start, Duration, Rate, Amount)
- Responsive: max-width 800px centered

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton summary card | Initial data fetch |
| Empty (no projects) | "Create a timed habit with project tracking to get started" + CTA | No projects exist |
| No data in range | "No time tracked in this period" | No sessions match date range |
| Data loaded | Summary + per-project breakdown | Sessions found |
| Exporting | Brief loading indicator | CSV generation in progress |
| Error | "Could not load time data" + retry | Data fetch failure |

## Test Requirements

### Unit Tests
- [ ] `calculateBillableAmount`: 3600s at $75/hr (7500 cents) = 7500 cents
- [ ] `calculateBillableAmount`: 5400s (1.5h) at $100/hr = 15000 cents
- [ ] `calculateBillableAmount`: 0s at any rate = 0 cents
- [ ] `calculateBillableAmount`: any duration at $0/hr = 0 cents
- [ ] `calculateBillableAmount`: 30s (< 1 min) at $120/hr = 100 cents ($1.00)
- [ ] `generateTimeReport`: 3 sessions across 2 projects = correct per-project totals
- [ ] `generateTimeReport`: empty sessions array = empty report with $0 total
- [ ] `generateTimeReport`: sessions outside date range are excluded
- [ ] `generateCSV`: produces correct header row
- [ ] `generateCSV`: produces correct data rows with formatted amounts
- [ ] `generateCSV`: includes summary total row at bottom
- [ ] `formatDuration`: 5400s = "1.50" (hours with 2 decimals)
- [ ] `formatCurrency`: 7500 cents USD = "$75.00"

### Integration Tests
- [ ] Full flow: create project habit -> track 3 sessions -> view report -> totals match
- [ ] Export flow: generate CSV -> verify file content matches report data
- [ ] Date range: sessions from March, filter to "This Week" -> only current week sessions shown

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyHabits > Habits tab
3. Create a timed habit "Website Redesign"
4. Edit habit, enable "Track as project"
5. Verify: Project fields appear (name, client, rate) -- AC-1, AC-2
6. Enter: Project "Website Redesign", Client "Acme Corp", Rate $75
7. Start a timed session, let it run for 2 minutes, stop
8. Verify: Running timer showed project name and accumulating amount -- AC-3
9. Navigate to Stats > Time Reports
10. Verify: Summary shows correct hours and billable amount -- AC-4, AC-5
11. Change date range to "This Month"
12. Verify: Data filters correctly -- AC-6
13. Tap "Export CSV"
14. Verify: CSV file generated with correct formatting -- AC-7
15. Verify on web at /habits/time-reports -- AC-8

## gstack Quality Gates

Based on Complexity score 4 (Small), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to time reports, verify calculations, test CSV export

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for billable amount + report generation

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Timed sessions exist in `hb_timed_sessions` with habit_id, started_at, duration_seconds, target_seconds, completed.
- No project metadata, no hourly rates, no billable calculations, no time reports.

### After This Work
- New engine: `modules/habits/src/time-tracking/engine.ts` with billable calculation, report generation, CSV export.
- New CRUD: `modules/habits/src/db/time-tracking.ts` for project metadata.
- New table: `hb_projects` (V4 migration).
- New screens: mobile time reports, web `/habits/time-reports` page.

### Files Changed
- `modules/habits/src/time-tracking/engine.ts` -- NEW: Billable + report engine
- `modules/habits/src/time-tracking/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/time-tracking.ts` -- NEW: Project CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add V4 table + indexes
- `modules/habits/src/types.ts` -- MODIFY: Add Project, TimeReport, TimeEntry schemas
- `modules/habits/src/definition.ts` -- MODIFY: Add V4 migration, add time-reports screen
- `modules/habits/src/index.ts` -- MODIFY: Export time-tracking engine + types + CRUD
- `apps/mobile/app/(habits)/time-reports.tsx` -- NEW: Mobile time reports screen
- `apps/web/app/habits/time-reports/page.tsx` -- NEW: Web time reports page

### Known Limitations
- **No invoicing.** Report generation creates CSV, not formatted invoices. Future: PDF invoice generation.
- **No team/multi-user support.** Solo freelancer only. Enterprise time tracking is out of scope.
- **No integration with accounting software.** CSV export is the bridge. Future: QuickBooks/FreshBooks import format.
- **No running timer widget.** Timer only visible in the app. Future: notification-based persistent timer.
- **Hourly rate only.** No flat-rate or per-project pricing. Always hourly.

### Context for Next Agent
- `hourly_rate` is stored as integer cents (like the budget module and sobriety daily_cost). Display as dollars with 2 decimal places.
- Time entries use the existing `hb_timed_sessions` table. The `hb_projects` table only adds metadata. Join on `habit_id` to get project info for a session.
- The UNIQUE(habit_id) constraint means one project config per timed habit. If users want to change the project name/rate, they edit the existing record.
- The CSV export follows the same pattern as `exportAllCSV` in the existing export module. Use the same approach for file creation.
- Date range filtering should use `started_at` from `hb_timed_sessions`, not `created_at`.
