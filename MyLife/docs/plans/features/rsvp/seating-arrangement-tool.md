# Feature Spec: RSVP Seating Arrangement Tool

## Metadata
- **Module:** rsvp
- **Priority Score:** 19 / 50 (C-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 1 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 4
- **Estimated CC Time:** 5-6 hours
- **Depends On:** RSVP system (built), guest list (built, rv_rsvps)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Wedding planners and formal event hosts spend hours manually arranging seating charts on paper or in spreadsheet tools like AllSeated and Social Tables. RSVPify is the only RSVP platform with built-in seating, and they charge $19/mo for it. For weddings with 100+ guests, seating is one of the most stressful planning tasks. By integrating seating into the RSVP flow (where the guest list already lives), MyRSVP eliminates the need for a separate seating tool and provides a seamless planning experience.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| RSVPify | Yes | $19/mo | Drag-and-drop floor plan, round/rectangle tables, guest assignment |
| AllSeated | Yes | $99/event | 3D venue visualization, social optimization, vendor collaboration |
| Social Tables | Yes | $199/mo | Enterprise-grade floor plans, event diagramming |
| Partiful | No | N/A | No seating |
| Evite | No | N/A | No seating |

### Target User
Wedding planners and formal event hosts (30-60) managing seating for 50-200+ guests. Currently they use paper charts, Excel spreadsheets, or expensive standalone tools (AllSeated $99/event). These users already have their guest list in MyRSVP -- seating should be a natural extension, not a separate app.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/db/schema.ts                      -- V3: rv_tables, rv_seat_assignments tables
modules/rsvp/src/definition.ts                     -- Add to RSVP_MIGRATION_V3
modules/rsvp/src/types.ts                          -- SeatingTable, SeatAssignment, TableShape types
modules/rsvp/src/engines/seating.ts                -- Pure functions: capacity calc, assignment validation, auto-assign
modules/rsvp/src/db/crud.ts                        -- Seating CRUD operations
modules/rsvp/src/index.ts                          -- Re-export seating API
modules/rsvp/src/__tests__/seating.test.ts         -- Seating engine and CRUD tests
apps/mobile/app/(rsvp)/seating.tsx                 -- Mobile seating view
apps/mobile/app/(rsvp)/components/FloorPlan.tsx    -- Interactive floor plan canvas
apps/web/app/rsvp/[eventId]/seating/page.tsx       -- Web seating page
apps/web/app/rsvp/[eventId]/components/FloorPlan.tsx -- Web floor plan canvas
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Event Detail
                 └── "Seating" button (host only) ← YOU ARE HERE
```

### Data Model

```sql
-- V3 Migration: Add seating arrangement

CREATE TABLE IF NOT EXISTS rv_tables (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    shape TEXT NOT NULL DEFAULT 'round',
    capacity INTEGER NOT NULL DEFAULT 8,
    position_x REAL NOT NULL DEFAULT 0,
    position_y REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rv_seat_assignments (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL REFERENCES rv_tables(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    rsvp_id TEXT REFERENCES rv_rsvps(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    seat_number INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS rv_tables_event_idx ON rv_tables(event_id);
CREATE INDEX IF NOT EXISTS rv_seat_assignments_table_idx ON rv_seat_assignments(table_id);
CREATE INDEX IF NOT EXISTS rv_seat_assignments_event_idx ON rv_seat_assignments(event_id);
CREATE INDEX IF NOT EXISTS rv_seat_assignments_rsvp_idx ON rv_seat_assignments(rsvp_id);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (canvas/drag components, Cool Obsidian tokens)
- **External:** None. Floor plan is rendered with native canvas (React Native Canvas on mobile, HTML Canvas on web).
- **Cross-Module:** Dietary preferences (A-tier, built) -- seating assignments could display dietary badges next to guest names so hosts seat allergy-aware guests near appropriate food stations.

## Functional Requirements

### User Stories
1. As a host, I want to create tables on a floor plan and assign guests to seats.
2. As a host, I want to drag guests from the unassigned list to table seats.
3. As a host, I want to auto-assign remaining unassigned guests to available seats.
4. As a host, I want to print or share the seating chart.
5. As a host, I want to add notes to seat assignments (e.g., "near the speaker", "wheelchair accessible").

### Behavior Specification

**Creating tables:**
1. Host opens "Seating" from event detail
2. If no tables exist, shows empty floor plan with "Add Table" button
3. Host taps "Add Table"
4. Table creation sheet: Label (e.g., "Table 1"), Shape (Round/Rectangle/Long), Capacity (2-20)
5. Table appears on the floor plan at a default position
6. Host can drag the table to reposition it on the floor plan
7. Host can tap table to edit label, shape, capacity, or delete

**Assigning guests:**
1. Sidebar/bottom panel shows unassigned guests list (all "going" RSVPs not yet seated)
2. Host drags a guest name onto a table
3. System assigns guest to that table. If table has numbered seats, assigns next available seat.
4. Table visual updates: guest name appears at the table, seat count updates ("6/8")
5. Host can also tap a table -> see its assigned guests -> tap "Add Guest" to pick from unassigned list
6. Host can remove a guest from a table (moves back to unassigned list)

**Auto-assign:**
1. Host taps "Auto-Assign" button
2. System assigns all unassigned "going" guests to tables with available seats
3. Assignment is sequential: fill tables in sort_order, guests in alphabetical order
4. If not enough seats for all guests, show "X guests could not be assigned. Add more tables."
5. Host can undo auto-assign (restores previous state)

**Floor plan interactions:**
1. Pan: drag empty space to scroll the floor plan
2. Zoom: pinch (mobile) or scroll wheel (web) to zoom in/out
3. Select table: tap a table to see its details and assigned guests
4. Move table: drag a table to reposition
5. Tables snap to a grid (optional, can be toggled)

**Sharing/printing:**
1. Host taps "Share" or "Print" button
2. System generates a clean summary: table labels with assigned guest names
3. On mobile: share as image or text list
4. On web: print-friendly CSS view
5. Text format: "Table 1: Alice, Bob, Carol\nTable 2: Dave, Eve, Frank"

### Edge Cases
- **Guest RSVPs after seating is done:** Guest appears in "unassigned" list. Host manually assigns.
- **Guest changes RSVP from going to declined:** Guest is removed from their seat assignment (SET NULL on rsvp_id). Seat becomes available. Guest name preserved in assignment for reference with notes.
- **Table deleted with assigned guests:** Guests moved to "unassigned" list.
- **Capacity reduced below current assignments:** Prompt: "Table has X guests but new capacity is Y. Remove X-Y guests?" Remove excess guests (last assigned first) to unassigned list.
- **No going RSVPs:** Show "No confirmed guests to seat. Wait for RSVPs."
- **200+ guests:** Floor plan supports scrolling and zooming. Performance target: pan/zoom at 60fps.
- **Duplicate guest at two tables:** Prevent via UNIQUE constraint on (event_id, guest_name) in assignments. Error: "Guest is already assigned to [Table X]."
- **Plus-ones:** Plus-ones do not have RSVP records. Host can manually add plus-one names to seats by typing the name directly.
- **Mobile small screen:** Simplified view: list of tables with guest counts, tap to expand. Floor plan available via "Floor Plan View" toggle.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Host can create tables with label, shape (round/rectangle/long), and capacity
- [ ] **AC-2:** Tables display on an interactive floor plan that supports drag, pan, and zoom
- [ ] **AC-3:** Host can drag guests from unassigned list onto tables
- [ ] **AC-4:** Tables show assigned guest names and seat count (e.g., "6/8")
- [ ] **AC-5:** "Auto-Assign" fills empty seats with unassigned guests
- [ ] **AC-6:** Host can remove a guest from a table (moves to unassigned)
- [ ] **AC-7:** Host can add notes to individual seat assignments
- [ ] **AC-8:** "Share" generates a text list or image of the seating arrangement
- [ ] **AC-9:** Dietary badges shown next to guest names (if dietary preferences collected)
- [ ] **AC-10:** Seating view is host-only (guests do not see seating assignments)

### Technical Criteria
- [ ] **TC-1:** V3 migration creates rv_tables and rv_seat_assignments tables with correct indexes
- [ ] **TC-2:** Auto-assign algorithm fills tables sequentially by sort_order
- [ ] **TC-3:** Duplicate guest assignment prevented by engine validation
- [ ] **TC-4:** Table capacity enforced: cannot assign more guests than capacity
- [ ] **TC-5:** Guest RSVP change to declined removes seat assignment via SET NULL trigger
- [ ] **TC-6:** Floor plan renders at 60fps on mobile for up to 20 tables
- [ ] **TC-7:** position_x, position_y stored as REAL for sub-pixel positioning

### Negative Criteria
- [ ] **NC-1:** Guests must NOT see seating assignments (host-only feature)
- [ ] **NC-2:** Seating must NOT affect RSVP status or event details
- [ ] **NC-3:** Auto-assign must NOT overwrite existing manual assignments
- [ ] **NC-4:** Deleting a table must NOT delete the guest's RSVP record

## UI Specification

### Mobile (Expo)
- **Floor plan:** Full-screen canvas with `#0A0A0F` background
- **Tables:** Round tables as circles, rectangle/long tables as rounded rectangles. Fill: `rgba(255,255,255,0.08)`. Border: `rgba(255,255,255,0.15)`. Label centered.
- **Seat dots:** Small circles around table edges showing assigned seats. Filled = assigned (`#FB7185`), empty = available (`rgba(255,255,255,0.15)`)
- **Unassigned panel:** Bottom sheet with guest list, drag handle at top
- **Table detail:** Bottom sheet showing table name, assigned guests with dietary badges, "Add Guest" and "Remove" actions
- **Auto-Assign button:** Glass button at top of floor plan, module accent text

### Web (Next.js)
- Accessible at `/rsvp/[eventId]/seating`
- Full-width canvas with sidebar for unassigned guests (left panel)
- Drag from sidebar to canvas for assignment
- Table detail panel slides in from right
- Print view: clean white background, table labels with guest names

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty Floor Plan | Blank canvas with "Add Table" CTA | No tables created |
| Tables Added | Tables on canvas, unassigned panel shows guest list | Tables exist, guests not assigned |
| Partially Assigned | Some tables with guests, unassigned count shown | Mixed state |
| Fully Assigned | All guests assigned, "All guests seated!" banner | No unassigned guests |
| No Guests | Tables on canvas, "No confirmed guests to seat" message | No going RSVPs |
| Overflow | "X guests could not be assigned. Add more tables." banner | More guests than total capacity |

## Test Requirements

### Unit Tests (engines/seating.ts)
- [ ] `validateAssignment`: accepts assignment when table has capacity
- [ ] `validateAssignment`: rejects when table is full
- [ ] `validateAssignment`: rejects duplicate guest at another table
- [ ] `autoAssign`: assigns all guests when enough seats
- [ ] `autoAssign`: assigns as many as possible, returns unassigned overflow
- [ ] `autoAssign`: does not overwrite existing assignments
- [ ] `autoAssign`: fills tables in sort_order
- [ ] `calculateRemainingCapacity`: returns capacity - assigned count
- [ ] `generateSeatingText`: formats tables with guest names for sharing
- [ ] `generateSeatingText`: handles empty tables
- [ ] `getUnassignedGuests`: returns going RSVPs not in any assignment
- [ ] `getUnassignedGuests`: excludes declined RSVPs

### Integration Tests
- [ ] Create 3 tables with capacity 4 -> assign 10 guests -> verify correct distribution
- [ ] Auto-assign 12 guests across 2 tables (capacity 8 each) -> verify 4 overflow
- [ ] Delete table -> verify its assignments cleared, guests in unassigned list
- [ ] RSVP changes to declined -> verify seat assignment cleared
- [ ] Delete event -> verify all tables and assignments CASCADE deleted
- [ ] V3 migration runs cleanly on existing V2 database

### QA Verification Script

1. Open MyRSVP, navigate to a wedding event with 12 going RSVPs
2. Tap "Seating"
3. **Verify:** Empty floor plan with "Add Table" CTA
4. Add 2 tables: "Table 1" (round, capacity 8), "Table 2" (rectangle, capacity 6)
5. **Verify:** Both tables appear on floor plan -- AC-1, AC-2
6. Drag a guest from unassigned panel onto Table 1
7. **Verify:** Guest appears at Table 1, count shows "1/8" -- AC-3, AC-4
8. Assign 2 more guests manually to Table 1
9. Tap "Auto-Assign"
10. **Verify:** Remaining 9 guests distributed across both tables -- AC-5
11. **Verify:** Table 1 shows "8/8", Table 2 shows "4/6"
12. Tap Table 2, remove a guest
13. **Verify:** Guest moves back to unassigned list -- AC-6
14. Add a note to a seat: "Near the speaker"
15. **Verify:** Note appears on seat assignment -- AC-7
16. Tap "Share"
17. **Verify:** Text list shows "Table 1: [names]\nTable 2: [names]" -- AC-8
18. Check guest view of the event
19. **Verify:** No "Seating" button visible to guests -- AC-10
20. If dietary preferences collected, verify dietary badges on guest names -- AC-9

## gstack Quality Gates

Based on Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Large features (Complexity <= 2):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature has UI:
- [ ] `/browse` -- navigate to seating tool, create tables, test drag-and-drop assignment

### Required for business logic engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for auto-assign algorithm

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- No seating arrangement capability
- Guest list exists in rv_rsvps but with no table/seat assignment
- No floor plan or visual layout tool
- No rv_tables or rv_seat_assignments tables

### After This Work
- V3 migration adds rv_tables and rv_seat_assignments tables with indexes
- Pure engine: `validateAssignment()`, `autoAssign()`, `calculateRemainingCapacity()`, `generateSeatingText()`, `getUnassignedGuests()`
- Full CRUD: createTable, updateTable, deleteTable, getTables, assignSeat, removeSeat, getAssignmentsByTable
- Interactive floor plan component for mobile and web
- Auto-assign algorithm with overflow reporting
- Share/print seating chart as text or image
- Dietary badge integration for guest names
- 12+ unit tests, 6+ integration tests

### Files Changed
- `modules/rsvp/src/db/schema.ts` -- V3 migration: rv_tables, rv_seat_assignments tables
- `modules/rsvp/src/definition.ts` -- Add to RSVP_MIGRATION_V3
- `modules/rsvp/src/types.ts` -- SeatingTable, SeatAssignment, TableShape types
- `modules/rsvp/src/engines/seating.ts` -- Assignment validation, auto-assign, text generation
- `modules/rsvp/src/db/crud.ts` -- Seating CRUD and assignment operations
- `modules/rsvp/src/index.ts` -- Re-export seating API
- `modules/rsvp/src/__tests__/seating.test.ts` -- Seating engine and CRUD tests
- `apps/mobile/app/(rsvp)/seating.tsx` -- Mobile seating screen
- `apps/mobile/app/(rsvp)/components/FloorPlan.tsx` -- Interactive canvas
- `apps/web/app/rsvp/[eventId]/seating/page.tsx` -- Web seating page
- `apps/web/app/rsvp/[eventId]/components/FloorPlan.tsx` -- Web canvas

### Known Limitations
- No 3D venue visualization (2D floor plan only)
- No venue import from AllSeated or Social Tables
- No social optimization (e.g., "seat friends together") -- all assignment is manual or sequential
- No individual seat labels on round tables (just seat numbers 1-N)
- No undo history (only auto-assign has undo)
- Floor plan is not to scale (decorative layout, not architecturally precise)
- No meal choice integration per seat (future: combine dietary + seating)

### Context for Next Agent
- V3 migration is shared with recurring events, map/directions, custom designs, messaging, and gift registry. Combine all V3 DDL into a single migration.
- `position_x` and `position_y` on `rv_tables` store the table's position on the floor plan canvas in normalized coordinates (0-1 range, relative to canvas dimensions). This makes the layout responsive across screen sizes.
- `shape` is one of: 'round', 'rectangle', 'long'. Round tables render as circles with seats around the perimeter. Rectangle tables render as rounded rectangles with seats on all sides. Long tables render as elongated rectangles with seats on the long sides only.
- `seat_number` on assignments is optional. When set, it represents a specific seat at the table (1-indexed). When null, the guest is assigned to the table but not a specific seat.
- Auto-assign algorithm: iterate tables by sort_order, iterate unassigned guests alphabetically, assign until table is full, move to next table. Return any remaining unassigned guests.
- The floor plan canvas should use a gesture handler library (e.g., `react-native-gesture-handler` on mobile, native DOM events on web) for drag, pan, zoom. Keep the rendering simple: colored shapes with labels. No fancy graphics.
- Dietary badge integration: when rendering guest names in the seating view, check if the guest has dietary responses (query `getDietaryResponses` from the dietary engine). Show small colored dots for each dietary flag (e.g., green for vegetarian, red for nut allergy).
