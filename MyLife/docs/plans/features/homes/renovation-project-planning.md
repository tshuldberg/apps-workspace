# Feature Spec: Renovation Project Planning

## Metadata
- **Module:** homes
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [2] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 10
- **Estimated CC Time:** 5-6 hours
- **Depends On:** Cost tracking (B-tier), Contractor contacts (B-tier)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Home renovation projects are complex, multi-phase endeavors that routinely go over budget, over schedule, and over-scope. The average US kitchen remodel costs $25,000-75,000 and takes 3-6 months, with 60% of projects exceeding their original budget. Homeowners currently track renovations across spreadsheets, notes apps, text threads with contractors, and email chains. No single tool gives them a unified view of budget vs. actual spending, phase-by-phase progress, contractor assignments, and before/after documentation. HomeZada ($59-99/yr) offers basic project tracking but does not integrate with maintenance schedules, cost history, or contractor management. By building renovation tracking into MyHomes, where properties, maintenance, costs, and contractors already live, MyLife creates a connected homeownership platform that no competitor matches. This is the most complex Homes feature because it ties together costs (from cost tracking), contractors (from contractor contacts), documents, and property records into a single workflow.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| HomeZada | Partial | Yes ($59-99/yr) | Basic project tracking with cost estimates. No phase-level budgeting. No contractor assignment per phase. No before/after photo organization. |
| Centriq | No | N/A | Appliance-focused. No renovation project tracking. |
| Houzz | Partial | No (free) | Design inspiration boards and contractor directory. No project management, no budget tracking, no timeline tools. |
| Thumbtack | No | N/A | Contractor marketplace. No project tracking after contractor is hired. |
| Angi | No | N/A | Same as Thumbtack. Contractor discovery only. |
| Buildertrend | Yes | Yes ($499+/mo) | Professional-grade construction management. Overkill for homeowners. Designed for general contractors. |

### Target User
Homeowners (28-65) planning or actively managing 1-3 renovation projects who currently track budgets in spreadsheets, communicate with contractors via text/email, and store before/after photos in their camera roll with no organization. Multi-property owners doing staged renovations across properties who need a portfolio-level view of all active projects. Users who have already set up cost tracking and contractor contacts in MyHomes and want project-level organization on top of that data. First-time renovators who need structure and guardrails to keep a kitchen or bathroom remodel on track. The cross-module score (2/5) reflects that renovation tracking integrates cost and contractor data, creating a more connected experience than any standalone project tool.

## Technical Context

### Where This Lives in MyLife

```
modules/homes/src/
  types.ts                                  -- New Zod schemas: Project, ProjectPhase, ProjectPhoto, ProjectStatus, ProjectCategory, ProjectInput, PhaseInput
  db/schema.ts                              -- New tables: hm_projects, hm_project_phases, hm_project_photos + indexes
  db/projects.ts                            -- NEW: project CRUD operations
  db/phases.ts                              -- NEW: phase CRUD operations
  db/project-photos.ts                      -- NEW: project photo CRUD operations
  db/index.ts                               -- Re-export project, phase, and photo CRUD
  engines/project-engine.ts                 -- NEW: project analysis, budget tracking, timeline, progress
  engines/index.ts                          -- Re-export project engine functions
  definition.ts                             -- Migration v4 (or v5 depending on prior migrations) for new tables
  index.ts                                  -- Re-export new types and engine functions
  __tests__/project-engine.test.ts          -- NEW: unit tests for project engine

apps/mobile/app/(homes)/
  projects.tsx                              -- NEW: Projects list screen (per-property + cross-property)
  project-detail.tsx                        -- NEW: Project detail with phases, budget, photos
  add-project.tsx                           -- NEW: Add/Edit project form
  project-phase.tsx                         -- NEW: Phase detail/edit screen
  add-project-photo.tsx                     -- NEW: Add photo to project/phase

apps/web/app/homes/
  projects/page.tsx                         -- NEW: Projects list web page
  projects/[id]/page.tsx                    -- NEW: Project detail web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHomes card
       ├── Search tab (existing listings)
       ├── Saved tab (existing saved listings)
       ├── Properties tab (V2 - existing)
       │    └── Property Detail
       │         ├── Maintenance section (existing)
       │         ├── Insurance section (B-tier)
       │         ├── Appliances section (B-tier)
       │         └── Projects section ← NEW (YOU ARE HERE)
       │              ├── Active project cards
       │              └── "New Project" button
       └── Reminders tab (V2 - existing)
```

Projects are accessed from:
1. Property detail screen's new "Projects" section (primary entry point)
2. A dedicated "Projects" screen accessible from the Properties tab overflow menu (cross-property view)
3. The hub dashboard "Active Projects" summary card (if any projects are in_progress)

### Data Model

```sql
-- New table: hm_projects (Migration v4 or v5)
CREATE TABLE IF NOT EXISTS hm_projects (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'planning',
    budget_cents INTEGER NOT NULL DEFAULT 0,
    actual_cost_cents INTEGER NOT NULL DEFAULT 0,
    start_date TEXT,
    target_end_date TEXT,
    actual_end_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL DEFAULT 'other',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: hm_project_phases (Migration v4 or v5)
CREATE TABLE IF NOT EXISTS hm_project_phases (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES hm_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    start_date TEXT,
    end_date TEXT,
    budget_cents INTEGER,
    contractor_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: hm_project_photos (Migration v4 or v5)
CREATE TABLE IF NOT EXISTS hm_project_photos (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES hm_projects(id) ON DELETE CASCADE,
    phase_id TEXT,
    photo_uri TEXT NOT NULL,
    caption TEXT,
    photo_type TEXT NOT NULL DEFAULT 'during',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS hm_projects_property_idx
    ON hm_projects(property_id);
CREATE INDEX IF NOT EXISTS hm_projects_status_idx
    ON hm_projects(status);
CREATE INDEX IF NOT EXISTS hm_phases_project_idx
    ON hm_project_phases(project_id);
CREATE INDEX IF NOT EXISTS hm_phases_sort_idx
    ON hm_project_phases(project_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS hm_photos_project_idx
    ON hm_project_photos(project_id);
CREATE INDEX IF NOT EXISTS hm_photos_phase_idx
    ON hm_project_photos(phase_id);
```

**status enum values (projects):** `planning`, `in_progress`, `on_hold`, `completed`, `cancelled`

**status enum values (phases):** `pending`, `in_progress`, `completed`, `skipped`

**priority enum values:** `low`, `medium`, `high`

**category enum values:** `kitchen`, `bathroom`, `bedroom`, `exterior`, `landscaping`, `structural`, `electrical`, `plumbing`, `other`

**photo_type enum values:** `before`, `during`, `after`, `inspiration`

**Note on contractor_id:** The `contractor_id` field in hm_project_phases is a plain TEXT column (no REFERENCES constraint) that soft-links to the contractor contacts table. It becomes a functional link once the Contractor contacts (B-tier) feature ships. Until then, the field stores a user-provided name or is null.

**Note on actual_cost_cents:** The `actual_cost_cents` field on hm_projects is a denormalized total. When cost tracking (B-tier) is available, it can be auto-calculated from linked cost records. Until then, it is manually entered and updated by the user.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type for next schema version)
- **External:** `zod` (schema validation). No external APIs required.
- **Cross-Module:** Soft link to contractor contacts via `contractor_id` in phases (same module, future table). Soft link to cost tracking via `actual_cost_cents` (same module, future integration). Future integration with MyBudget for renovation expense categorization (deferred). No hard cross-module dependencies.

## Functional Requirements

### User Stories
1. As a homeowner planning a kitchen remodel, I want to create a project with a budget, timeline, and phases (demo, plumbing, electrical, cabinets, countertops, painting, finishing), so I can track progress against the plan.
2. As a homeowner managing a renovation, I want to see budget vs. actual cost at both the project and phase level, so I know immediately if I am going over budget.
3. As a homeowner, I want to assign a contractor to each phase (e.g., plumber for plumbing phase, electrician for electrical phase), so I know who is responsible for each stage of work.
4. As a homeowner, I want to take before, during, and after photos organized by project and phase, so I can document the transformation and share progress.
5. As a multi-property owner, I want to see all active renovation projects across all properties in one view, so I can prioritize and allocate resources.
6. As a homeowner with a completed renovation, I want to keep the project record with its total cost, timeline, and photos as a permanent record, so I can reference it when selling the home or planning future work.
7. As a homeowner with a stalled renovation, I want to put a project "on hold" with a note explaining why, so I can pick it up later without losing context.

### Behavior Specification

**Creating a project:**
1. User navigates to Property detail > Projects section.
2. User taps "New Project".
3. Form shows: name (text, required), description (text area), category selector (Kitchen/Bathroom/Bedroom/Exterior/Landscaping/Structural/Electrical/Plumbing/Other), priority selector (Low/Medium/High), budget (currency input), start date (date picker), target end date (date picker), notes (text area).
4. User saves. The project is created with status "planning".
5. System prompts: "Add project phases?" with a "Yes, add phases" button and a "Skip for now" link.
6. If user chooses to add phases, the phase editor opens (see below).

**Managing project phases:**
1. From the project detail screen, user taps "Add Phase" or edits existing phases.
2. Phase form shows: name (text, required), description (text area), sort order (drag handle or numeric input), budget (currency input, optional), contractor assignment (text input or dropdown from contractor contacts if available), start date (date picker), end date (date picker), notes (text area).
3. Phases display in sort_order sequence on the project detail screen.
4. Each phase has a status that can be toggled: Pending -> In Progress -> Completed (or Skipped).
5. Phase status transitions:
   - Pending -> In Progress: user taps "Start Phase". start_date is set to today if not already set.
   - In Progress -> Completed: user taps "Complete Phase". end_date is set to today if not already set.
   - Any -> Skipped: user taps "Skip Phase" from the overflow menu.
   - Completed -> Pending: user taps "Reopen Phase" (undo completion).

**Project status lifecycle:**
1. `planning`: Initial state. No phases started. User is defining scope and budget.
2. `in_progress`: At least one phase has status "in_progress". Transition happens automatically when the first phase is started, or manually via "Start Project" button.
3. `on_hold`: User manually pauses the project. A reason note is recommended but not required. All phase work is paused conceptually but phase statuses are preserved.
4. `completed`: All phases are either "completed" or "skipped". Transition can be manual ("Mark Complete") or prompted when the last active phase is completed. actual_end_date is set to today.
5. `cancelled`: User cancels the project. A reason note is recommended. Project and phases are preserved but marked cancelled.

**Budget vs. actual tracking:**
1. Project detail shows a budget progress bar: budget_cents vs. actual_cost_cents.
2. Color coding: green when actual <= budget, amber when actual is 80-100% of budget, red when actual > budget.
3. Phase-level budgets are optional. If set, the sum of phase budgets is shown alongside the project budget as a consistency check.
4. If phase budgets sum exceeds project budget, a warning appears: "Phase budgets ($X) exceed project budget ($Y)."
5. actual_cost_cents is manually updated by the user (until cost tracking integration is built).

**Project timeline view:**
1. `getProjectTimeline(projectId)` returns a structured timeline of phases with their date ranges and statuses.
2. Timeline displays as a vertical list of phase cards with:
   - Phase name and status badge
   - Date range (start - end) or "Not scheduled" if dates are null
   - Duration in days (calculated from dates)
   - Contractor name (if assigned)
   - Phase budget vs. actual (if budget is set)
3. A project-level summary shows: total planned duration (start_date to target_end_date), elapsed time, phases completed vs. total.

**Before/after photos:**
1. From project detail or phase detail, user taps "Add Photo".
2. Camera/gallery picker opens.
3. User selects photo type: Before, During, After, Inspiration.
4. User optionally selects a phase to link the photo to.
5. User adds an optional caption.
6. Photo is saved with URI, type, phase link, and caption.
7. Photos display in a grid on the project detail screen, filterable by type (Before/During/After/Inspiration).
8. If photos are linked to phases, they also appear on the phase detail screen.

**Cross-property project view:**
1. From Properties tab overflow menu > "All Projects".
2. Screen shows all projects across all properties, grouped by status (Active first, then On Hold, Planning, Completed, Cancelled).
3. Each card shows: project name, property name, category badge, budget progress bar, phase progress (e.g., "3/5 phases done"), priority indicator.
4. Summary bar: count of active projects, total budget across active projects, total actual spend.

**Viewing project detail:**
1. User taps a project card.
2. Detail screen shows:
   - Header: project name, category badge, priority indicator, status badge
   - Budget section: budget vs. actual progress bar with amounts
   - Timeline section: start date, target end, elapsed time, projected completion
   - Phases section: ordered list of phase cards with status, dates, contractor, budget
   - Photos section: grid of photos filterable by type
   - Notes section
3. Action buttons vary by status:
   - Planning: "Start Project", "Edit", "Cancel"
   - In Progress: "Put On Hold", "Edit", "Cancel"
   - On Hold: "Resume", "Edit", "Cancel"
   - Completed: "Reopen", "Edit"
   - Cancelled: "Reopen", "Delete"

### Edge Cases

- **No properties exist:** Projects section is not visible. User must add a property first.
- **Property with no projects:** Section shows empty state with "Start a renovation project" message and "New Project" CTA.
- **Project with no phases:** Allowed. Some simple projects (e.g., "Paint bedroom") do not need phase decomposition. Status transitions are manual.
- **Project with all phases skipped:** Treated as "completed" when the user manually marks it complete. The engine does not auto-complete a project where all phases are skipped (user may want to add more phases).
- **Budget of $0:** Allowed for DIY projects with no material costs. Budget progress bar is hidden when budget is $0.
- **Actual cost exceeds budget:** Show red progress bar with overage amount. No cap on actual_cost_cents.
- **Phase budget sum exceeds project budget:** Warning banner, not an error. Users may intentionally over-allocate for contingency tracking.
- **No start date or target end date:** Allowed. Timeline section shows "Not scheduled" where dates are missing. Duration calculations are skipped.
- **Target end date before start date:** Rejected by Zod validation.
- **Phase dates outside project date range:** Warning, not an error. A phase may start before the project or extend after the target end.
- **Contractor_id references non-existent contractor:** Handled gracefully. Show the raw contractor_id text or "Unknown contractor" if the contacts table is available but the ID is not found.
- **Many phases (20+ per project):** Phase list must render without lag. Use FlatList with drag-and-drop for reordering.
- **Many photos (50+ per project):** Photo grid uses lazy loading with thumbnails. Full-size photos load on tap.
- **Property deleted with active projects:** CASCADE delete removes all projects, phases, and photos.
- **Project deleted:** CASCADE deletes all phases and photos. This is destructive and requires confirmation dialog.
- **Photo URI points to deleted file:** Show broken image placeholder. Photo record is preserved for metadata.
- **User navigates away mid-form:** Unsaved changes are discarded. No draft persistence.
- **Reopen completed project:** Sets status to "in_progress", clears actual_end_date. Phase statuses are preserved.
- **Cancel in-progress project:** Sets status to "cancelled". Phase statuses are preserved. actual_end_date is set to today.
- **Phase reordering:** Drag-and-drop updates sort_order for all affected phases in a batch transaction.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Creating a new project with required fields (name, category) saves successfully and appears on the property detail Projects section with "planning" status.
- [ ] **AC-2:** Adding 3 phases to a project displays them in sort_order sequence on the project detail screen.
- [ ] **AC-3:** Starting a phase (Pending -> In Progress) updates its status badge and sets start_date to today if not already set.
- [ ] **AC-4:** Completing a phase (In Progress -> Completed) updates its status badge and sets end_date to today if not already set.
- [ ] **AC-5:** Starting the first phase of a project auto-transitions the project status from "planning" to "in_progress".
- [ ] **AC-6:** The budget progress bar shows green when actual <= budget, amber at 80-100%, and red when over budget.
- [ ] **AC-7:** Entering an actual cost that exceeds the budget turns the progress bar red and shows the overage amount.
- [ ] **AC-8:** Phase budgets summing higher than project budget displays a warning banner.
- [ ] **AC-9:** Adding a before photo with a caption saves correctly and appears in the "Before" filter of the photo grid.
- [ ] **AC-10:** Photos linked to a phase appear on both the project detail and the phase detail screens.
- [ ] **AC-11:** The cross-property project view groups projects by status with active projects first.
- [ ] **AC-12:** Each project card in the list shows name, property, category badge, budget bar, and phase progress.
- [ ] **AC-13:** Putting a project "on hold" changes its status badge and preserves all phase statuses.
- [ ] **AC-14:** Resuming an on-hold project returns it to "in_progress" status.
- [ ] **AC-15:** Completing the last active phase prompts "All phases complete. Mark project as done?"
- [ ] **AC-16:** Marking a project complete sets actual_end_date to today and status to "completed".
- [ ] **AC-17:** Cancelling a project sets status to "cancelled" and preserves all data.
- [ ] **AC-18:** Reopening a completed project sets status to "in_progress" and clears actual_end_date.
- [ ] **AC-19:** Deleting a project requires confirmation and removes all phases and photos.
- [ ] **AC-20:** Skipping a phase sets its status to "skipped" without requiring start/end dates.
- [ ] **AC-21:** Reordering phases via drag-and-drop updates sort_order correctly.
- [ ] **AC-22:** Empty state shows "Start a renovation project" with "New Project" CTA when no projects exist for a property.
- [ ] **AC-23:** Assigning a contractor name/ID to a phase displays the contractor info on the phase card.

### Technical Criteria
- [ ] **TC-1:** Schema migration creates hm_projects, hm_project_phases, and hm_project_photos tables with all columns, 6 indexes, and correct hm_ prefix.
- [ ] **TC-2:** `getProjectSummary(projectId)` returns project details with phase count, completed phase count, budget, actual cost, and photo count.
- [ ] **TC-3:** `getProjectTimeline(projectId)` returns phases sorted by sort_order with calculated durations.
- [ ] **TC-4:** `getBudgetVsActual(projectId)` returns budget_cents, actual_cost_cents, variance (budget - actual), variance percentage, and status (under/warning/over).
- [ ] **TC-5:** `getBudgetVsActual` returns status "under" when actual <= 80% of budget, "warning" at 80-100%, "over" when actual > budget.
- [ ] **TC-6:** `getActiveProjects(propertyId)` returns projects with status "in_progress" or "planning".
- [ ] **TC-7:** `getActiveProjects()` (no property ID) returns active projects across all properties.
- [ ] **TC-8:** `getProjectsByStatus(status)` returns projects filtered by status, sorted by updated_at DESC.
- [ ] **TC-9:** `getPhaseProgress(projectId)` returns total phases, completed phases, skipped phases, and completion percentage.
- [ ] **TC-10:** Project CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-11:** Phase CRUD operations (create, read, update, delete, reorder) persist correctly in SQLite.
- [ ] **TC-12:** Photo CRUD operations (create, read, delete) persist correctly in SQLite.
- [ ] **TC-13:** Deleting a project CASCADE-deletes all phases and photos.
- [ ] **TC-14:** Deleting a property CASCADE-deletes all projects, their phases, and their photos.
- [ ] **TC-15:** Phase reorder operation updates sort_order for all affected phases in a single transaction.
- [ ] **TC-16:** Zod validation requires project name as non-empty string.
- [ ] **TC-17:** Zod validation restricts project status to the 5 allowed enum values.
- [ ] **TC-18:** Zod validation restricts phase status to the 4 allowed enum values.
- [ ] **TC-19:** Zod validation restricts photo_type to the 4 allowed enum values.
- [ ] **TC-20:** Zod validation rejects target_end_date before start_date.
- [ ] **TC-21:** Querying 10 projects with 10 phases each and 20 photos per project completes in < 300ms.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Project operations must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Adding or modifying projects must NOT affect existing hm_maintenance_schedules, hm_listings, hm_tours, or hm_insurance_policies records.
- [ ] **NC-3:** Deleting a project must NOT delete the associated property.
- [ ] **NC-4:** Deleting a phase must NOT delete its parent project or sibling phases.
- [ ] **NC-5:** The contractor_id field must NOT use a REFERENCES constraint. It is a plain TEXT column for forward-compatible soft linking.
- [ ] **NC-6:** The phase_id field in hm_project_photos must NOT use a REFERENCES constraint. It is a plain TEXT column allowing photos to exist independently of phases.
- [ ] **NC-7:** Cancelling a project must NOT delete any data. All records are preserved.
- [ ] **NC-8:** Auto-transitioning project status to "in_progress" must NOT happen when a phase is skipped (only when started).

## UI Specification

### Mobile (Expo)

**Projects Section (Property Detail):**
- Background: `#0A0A0F` (background token)
- Section header: "Projects" with active count badge in module accent `#D97706`
- Project cards: glass token fill (`rgba(255,255,255,0.04)`) with glassBorder (`rgba(255,255,255,0.10)`)
- Card layout: Category icon (left, accent-colored) | Name (bold, `#F0F0F5`) + description preview in `textSecondary` | Status badge (right) | Budget progress bar (bottom, full-width within card)
- Status badges:
  - Planning: `rgba(255,255,255,0.15)` background, clipboard icon, `textSecondary` text
  - In Progress: `#D97706` background (accent), hammer icon, white text
  - On Hold: `#FFD60A` background, pause icon, dark text
  - Completed: `#30D158` background, check-circle icon, white text
  - Cancelled: `#FF453A` background, x-circle icon, white text
- Priority indicators: small dot - green (low), amber (medium), red (high)
- Budget progress bar: thin bar below card content, green/amber/red based on actual vs. budget ratio
- "New Project" button at bottom: accent color outline, glass background
- Empty state: Blueprint icon (centered), "Start a renovation project" in `textSecondary`, "New Project" button in accent color

**Project Detail Screen:**
- Full-screen push navigation
- Header: project name (large), category badge and priority dot, status badge (right-aligned)
- Budget section: glass card with budget amount (large), actual amount (large), progress bar (full-width), variance text in green/amber/red
- Timeline section: glass card with start date, target end, actual end (if completed), elapsed days counter, phase progress ring (e.g., "3/5")
- Phase warning banner (if applicable): amber glass card with "Phase budgets ($X) exceed project budget ($Y)"
- Phases section: vertically stacked phase cards in sort_order
  - Phase card: name (bold) | Status badge (inline) | Date range | Contractor name (if assigned) | Budget (if set)
  - Drag handles on left edge for reordering
  - Tap to expand phase detail
  - "Add Phase" button at bottom of list
- Photos section: horizontal scrollable grid, filtered by photo_type tabs (All/Before/During/After/Inspiration)
  - Each photo: thumbnail with photo_type label overlay, caption below
  - "Add Photo" button (camera icon)
- Notes section: expandable text area
- Action buttons: contextual based on project status (see Behavior Specification)

**Phase Detail Screen:**
- Bottom sheet
- Phase name and status badge at top
- Date range, duration, contractor, budget in glass cards
- Photos linked to this phase
- Status transition buttons: "Start Phase", "Complete Phase", "Skip Phase", or "Reopen Phase" depending on current status
- "Edit Phase", "Delete Phase" in overflow menu

**Photo Capture:**
- Action sheet: "Take Photo" (camera), "Choose from Library" (gallery)
- After selection: photo type picker (Before/During/After/Inspiration), phase selector (optional, dropdown of project phases), caption input (text, optional)
- Save adds photo to project and optionally links to phase

**Cross-Property Projects View:**
- Accessible from Properties tab overflow > "All Projects"
- Grouped by status: In Progress (expanded), On Hold (expanded), Planning (expanded), Completed (collapsed), Cancelled (collapsed)
- Summary bar: active project count, total active budget, total actual spend

### Web (Next.js)

- Same tokens via CSS variables
- Projects accessible from property detail at `/homes/properties/[id]#projects`
- Cross-property view at `/homes/projects`
- Individual project detail at `/homes/projects/[id]`
- Cards use glass morphism via `backdrop-filter: blur(16px)` and glass token backgrounds
- Phase list supports drag-and-drop reordering via mouse
- Photo grid is a responsive masonry layout with lightbox on click
- Budget progress bars are wider on web for better readability
- Phase detail opens as a side panel rather than bottom sheet
- Timeline section could render as a horizontal Gantt-style bar chart on wide screens (optional enhancement, not required for MVP)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards (2) with pulsing animation | Initial data fetch from SQLite |
| Empty | Blueprint icon, "Start a renovation project" + "New Project" CTA | No records in hm_projects for this property |
| Error | "Something went wrong loading projects" + retry button | SQLite read failure |
| Success (planning) | Project cards in "planning" status, no progress bars filled | Only planning-stage projects |
| Success (active) | Project cards with progress bars, phase counts, budget tracking | Projects in "in_progress" status |
| Success (mixed) | Projects grouped by status, active on top, completed at bottom | Mix of statuses |
| Partial (over budget) | Red budget progress bar, overage amount in red text | actual_cost_cents > budget_cents |

## Test Requirements

### Unit Tests (modules/homes/src/__tests__/project-engine.test.ts)
- [ ] `getProjectSummary`: returns correct phase count and completed count
- [ ] `getProjectSummary`: returns correct budget and actual cost
- [ ] `getProjectSummary`: returns correct photo count
- [ ] `getProjectSummary`: handles project with no phases
- [ ] `getProjectTimeline`: returns phases sorted by sort_order
- [ ] `getProjectTimeline`: calculates duration in days from start/end dates
- [ ] `getProjectTimeline`: handles phases with no dates (returns null duration)
- [ ] `getBudgetVsActual`: returns "under" when actual is 50% of budget
- [ ] `getBudgetVsActual`: returns "warning" when actual is 85% of budget
- [ ] `getBudgetVsActual`: returns "over" when actual exceeds budget
- [ ] `getBudgetVsActual`: returns "under" when budget is 0 and actual is 0
- [ ] `getBudgetVsActual`: calculates correct variance and percentage
- [ ] `getActiveProjects`: returns only planning and in_progress projects
- [ ] `getActiveProjects`: excludes on_hold, completed, and cancelled projects
- [ ] `getActiveProjects`: returns empty array when no active projects exist
- [ ] `getProjectsByStatus("completed")`: returns only completed projects
- [ ] `getProjectsByStatus("completed")`: sorts by updated_at descending
- [ ] `getPhaseProgress`: returns correct total, completed, and skipped counts
- [ ] `getPhaseProgress`: calculates completion percentage correctly (completed / (total - skipped))
- [ ] `getPhaseProgress`: handles project with no phases (0/0, 0%)
- [ ] `getPhaseProgress`: handles project with all phases skipped (0/0, 0%)
- [ ] Zod validation: requires project name as non-empty string
- [ ] Zod validation: rejects invalid project status
- [ ] Zod validation: rejects invalid phase status
- [ ] Zod validation: rejects invalid photo_type
- [ ] Zod validation: rejects target_end_date before start_date
- [ ] Zod validation: accepts nullable optional fields (description, start_date, target_end_date, notes, contractor_id)

### Integration Tests
- [ ] Full flow: create project, add 3 phases, phases appear in correct sort_order
- [ ] Full flow: start first phase, project auto-transitions to "in_progress"
- [ ] Full flow: complete all phases, prompt appears to mark project complete
- [ ] Full flow: mark project complete, actual_end_date is set, status changes
- [ ] Full flow: add before/during/after photos, filter by type shows correct subsets
- [ ] Full flow: link photo to phase, photo appears on both project and phase detail
- [ ] Full flow: set budget $10,000, actual $12,000, budget bar shows red with "$2,000 over budget"
- [ ] Full flow: reorder phases via drag-and-drop, sort_order updates persist
- [ ] Full flow: put project on hold, resume, verify status transitions and data preservation
- [ ] Full flow: cancel project, verify all data preserved, status set to cancelled
- [ ] Full flow: delete project, verify phases and photos are CASCADE-deleted
- [ ] Error flow: create project with target_end_date before start_date, validation error

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyHomes module. Go to Properties tab. Ensure at least one property exists (e.g., "Main House"). -- Setup prerequisite.
3. Tap "Main House" to open property detail. Scroll to Projects section. Verify empty state with "New Project" CTA. -- Verifies empty state, AC-22.
4. Tap "New Project". Fill in: name "Kitchen Remodel", category "Kitchen", priority "High", budget $25,000, start date today, target end date 3 months from today. Save. -- Verifies AC-1.
5. When prompted "Add project phases?", tap "Yes". -- Setup for phases.
6. Add phase 1: name "Demo", sort order 1, budget $2,000. Add phase 2: name "Plumbing", sort order 2, budget $5,000, contractor "ABC Plumbing". Add phase 3: name "Cabinets", sort order 3, budget $10,000. -- Verifies AC-2.
7. Return to project detail. Verify 3 phases listed in order: Demo, Plumbing, Cabinets. All show "Pending" badges. -- Corresponds to AC-2.
8. Verify phase budget warning: "Phase budgets ($17,000) do not account for full project budget ($25,000)." No warning because $17K < $25K. -- Corresponds to AC-8 negative case.
9. Edit Cabinets phase budget to $20,000 (total now $27,000). Verify warning banner: "Phase budgets ($27,000) exceed project budget ($25,000)." -- Corresponds to AC-8.
10. Tap Demo phase, tap "Start Phase". Verify: Demo status changes to "In Progress", project status auto-transitions to "in_progress". -- Corresponds to AC-3, AC-5.
11. Verify budget progress bar shows green (actual $0 vs. budget $25,000). -- Corresponds to AC-6.
12. Edit project: set actual cost to $20,000. Verify budget bar turns amber (80% of $25,000). -- Corresponds to AC-6.
13. Edit project: set actual cost to $30,000. Verify budget bar turns red with "$5,000 over budget" text. -- Corresponds to AC-7.
14. Tap "Add Photo" on the project. Take/select a photo. Set type to "Before", link to "Demo" phase, caption "Old kitchen before demo". Save. -- Verifies AC-9, AC-10.
15. Verify photo appears in the project detail photo grid under "Before" filter. Navigate to Demo phase detail. Verify same photo appears. -- Corresponds to AC-9, AC-10.
16. Complete Demo phase. Start and complete Plumbing phase. Start and complete Cabinets phase. -- Setup for AC-15.
17. After completing the last phase, verify prompt: "All phases complete. Mark project as done?" Tap "Yes". Verify project status changes to "completed" and actual_end_date is set. -- Corresponds to AC-15, AC-16.
18. Tap "Reopen" on the completed project. Verify status returns to "in_progress" and actual_end_date is cleared. -- Corresponds to AC-18.
19. Create a second project: "Paint Bedroom", category "Bedroom", priority "Low", no phases. Tap "Start Project" manually. Verify it enters "in_progress" status. -- Verifies project without phases.
20. Put "Paint Bedroom" on hold. Verify status badge changes and all data is preserved. -- Corresponds to AC-13.
21. Resume "Paint Bedroom". Verify it returns to "in_progress". -- Corresponds to AC-14.
22. Cancel "Paint Bedroom". Verify status is "cancelled" and data is preserved. -- Corresponds to AC-17.
23. Delete "Paint Bedroom". Confirm deletion dialog. Verify it is removed from the list. -- Corresponds to AC-19.
24. Navigate to cross-property project view (Properties tab > overflow > All Projects). Verify "Kitchen Remodel" appears grouped under its current status. -- Corresponds to AC-11, AC-12.
25. Add a phase to Kitchen Remodel with contractor "Smith Electric" assigned. Verify contractor name appears on the phase card. -- Corresponds to AC-23.
26. Test drag-and-drop phase reordering: drag "Plumbing" above "Demo". Verify sort_order updates. -- Corresponds to AC-21.
27. Skip a phase. Verify "Skipped" badge and that it is excluded from phase progress calculation. -- Corresponds to AC-20.
28. Repeat key steps (3-7, 10-13, 14-15) on web at `/homes/properties/[id]#projects` and `/homes/projects`. Verify functional parity. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to property detail Projects section, verify all states (loading, empty, error, success-planning, success-active, success-mixed, partial-over-budget)
- [ ] Batch QA: after 5 features in homes module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `project-engine.ts` (getProjectSummary, getProjectTimeline, getBudgetVsActual, getActiveProjects, getProjectsByStatus, getPhaseProgress)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- homes module has active standalone counterpart (MyHomes)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Homes module has 5-6 tables (V1: hm_listings, hm_tours; V2: hm_properties, hm_maintenance_schedules, hm_settings; possibly V3: hm_insurance_policies and/or hm_appliances)
- Properties, maintenance reminders, and possibly insurance/appliance tracking are built
- No concept of renovation project tracking, phase management, budget vs. actual analysis, or photo documentation
- Property detail screen exists with maintenance (and possibly insurance/appliance) sections
- Cost tracking and contractor contacts are expected to exist as B-tier features (this feature depends on them)

### After This Work
- Homes module gains 3 tables (hm_projects, hm_project_phases, hm_project_photos) with 6 new indexes
- Schema version incremented to the next available version
- New "Projects" section on property detail screen showing project cards with status badges, budget progress bars, and phase counts
- Full project lifecycle: create, add phases, track budget vs. actual, assign contractors, document with photos, transition through planning/in_progress/on_hold/completed/cancelled states
- `project-engine.ts` contains pure functions for project summary, timeline analysis, budget tracking, status filtering, and phase progress calculation
- Cross-property project view for portfolio-level oversight
- Mobile and web: project views with drag-and-drop phase reordering, photo capture, and budget visualization

### Files Changed

- `modules/homes/src/types.ts` -- Add ProjectSchema, ProjectStatusSchema, ProjectCategorySchema, PrioritySchema, PhaseSchema, PhaseStatusSchema, ProjectPhotoSchema, PhotoTypeSchema, ProjectInputSchema, PhaseInputSchema
- `modules/homes/src/db/schema.ts` -- Add CREATE_PROJECTS, CREATE_PROJECT_PHASES, CREATE_PROJECT_PHOTOS tables, 6 indexes, export in migration tables array
- `modules/homes/src/db/projects.ts` -- NEW: project CRUD (create, get, getByProperty, getAll, getByStatus, update, updateStatus, delete)
- `modules/homes/src/db/phases.ts` -- NEW: phase CRUD (create, get, getByProject, update, updateStatus, reorder, delete)
- `modules/homes/src/db/project-photos.ts` -- NEW: photo CRUD (create, get, getByProject, getByPhase, getByType, delete)
- `modules/homes/src/db/index.ts` -- Re-export project, phase, and photo CRUD functions
- `modules/homes/src/engines/project-engine.ts` -- NEW: getProjectSummary, getProjectTimeline, getBudgetVsActual, getActiveProjects, getProjectsByStatus, getPhaseProgress
- `modules/homes/src/engines/index.ts` -- Re-export project engine functions and types
- `modules/homes/src/definition.ts` -- Add next migration version, update schemaVersion, add project screens to navigation
- `modules/homes/src/index.ts` -- Re-export new types and engine functions
- `modules/homes/src/__tests__/project-engine.test.ts` -- NEW: 27+ unit tests for project engine
- `apps/mobile/app/(homes)/projects.tsx` -- NEW: Projects list screen
- `apps/mobile/app/(homes)/project-detail.tsx` -- NEW: Project detail screen with phases, budget, photos
- `apps/mobile/app/(homes)/add-project.tsx` -- NEW: Add/Edit project form
- `apps/mobile/app/(homes)/project-phase.tsx` -- NEW: Phase detail/edit bottom sheet
- `apps/mobile/app/(homes)/add-project-photo.tsx` -- NEW: Photo capture and metadata screen
- `apps/web/app/homes/projects/page.tsx` -- NEW: Projects list web page
- `apps/web/app/homes/projects/[id]/page.tsx` -- NEW: Project detail web page

### Known Limitations
- actual_cost_cents is manually updated by the user. No auto-calculation from cost tracking line items until cost tracking integration is built.
- contractor_id is a soft FK (plain TEXT). Contractor lookup and display depend on the Contractor contacts (B-tier) feature being available. Until then, contractor names are stored as plain text in the phase notes or the contractor_id field.
- No Gantt chart visualization in MVP. Timeline is a vertical phase list, not a horizontal bar chart. Gantt is a future enhancement.
- No integration with calendar apps for project milestones. Phase dates exist in-app only.
- Photo storage is URI-based (local file paths). No cloud sync, compression, or backup. Photos persist only as long as the device retains the files.
- No material list or shopping list feature. Users track costs at the project/phase level, not individual materials.
- No permit tracking. Building permits are a future enhancement.
- Phase budgets are independent of the project budget. There is no automatic rollup or enforcement. The warning when phase budgets exceed project budget is advisory.
- No multi-user collaboration. Project tracking is single-user. Sharing with contractors or family members is a future feature.

### Context for Next Agent
- This is the most complex Homes feature. Allocate 5-6 hours and consider splitting into sub-tasks: (1) data model + CRUD, (2) engine functions, (3) mobile UI, (4) web UI, (5) tests.
- The migration version depends on which B-tier features ship first. Check `definition.ts` at build time for the current schema version and increment by 1.
- Follow the same migration pattern as V2: arrays of SQL strings exported as named constants, referenced in the migration object.
- The project engine should be a pure function module (no database access). It receives project/phase/photo data as arguments. Database queries live in the CRUD layer.
- Phase reordering must be a batch transaction (update all affected sort_order values in a single transaction). Use `db.transaction()` if available, or run multiple updates with a shared timestamp.
- The auto-transition from "planning" to "in_progress" should be handled in the CRUD layer's phase status update function, not in the engine. When a phase status changes to "in_progress" and the parent project is in "planning", update the project status in the same transaction.
- Photo URIs should use the Expo FileSystem.documentDirectory for persistent storage on mobile. Web can use object URLs or base64 data URIs temporarily, with a proper file storage solution later.
- The budget "warning" vs "over" thresholds are: <= 80% = green/"under", 80-100% = amber/"warning", > 100% = red/"over". These are calculated as (actual_cost_cents / budget_cents) * 100.
- For phase progress percentage, use: completed / (total - skipped). If total == skipped, return 0%. This avoids division by zero when all phases are skipped.
