# Feature Spec: Laundry Tracking

## Metadata
- **Module:** closet
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 3 x3 + Complexity 4 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** 2
- **Estimated CC Time:** 30 min
- **Depends On:** none (engine and tables already exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Laundry awareness prevents over-wearing items (fabric degradation), under-washing (hygiene), and lost laundry. Users who track laundry cycles make smarter wardrobe decisions. Indyx's 4M users cite laundry tracking as a top reason for engagement. The backend engine and database tables already exist -- this feature is about surfacing that data through a polished UI.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Indyx | Yes | Free | Dirty/clean toggle per item, laundry basket view, laundry day reminders |
| Clueless | No | N/A | No laundry tracking |
| Stylebook | No | N/A | Tracks wears but not laundry state |
| Alta | No | N/A | No laundry tracking |

### Target User
Users who want to know which items need washing, how many wears between washes, and when to do laundry. Users with mixed-care wardrobes (machine wash, hand wash, dry clean) who want items grouped by care type on laundry day.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/engine/laundry.ts     -- ALREADY EXISTS: avg wears, group by care
modules/closet/src/db/crud.ts            -- ALREADY EXISTS: markLaundryItemsClean, listDirtyClothingItems, etc.
modules/closet/src/db/schema.ts          -- ALREADY EXISTS: cl_laundry_events table (V2 migration)
apps/mobile/app/(closet)/laundry.tsx     -- NEW: Laundry basket screen
apps/mobile/components/closet/LaundryBasket.tsx -- NEW: Grouped dirty items component
apps/web/app/closet/laundry/page.tsx     -- NEW: Web laundry page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       ├── Wardrobe tab
       ├── Outfits tab
       ├── Calendar tab
       ├── Stats tab
       │    └── Laundry stats section (avg wears between washes)
       └── Laundry basket (FAB or tab)  ← YOU ARE HERE
            ├── Dirty items grouped by care instruction
            ├── Mark clean (batch select)
            └── Laundry history
```

### Data Model
No new tables needed. Everything exists in V2 migration:

```sql
-- Already exists: cl_laundry_events
-- Columns: id, clothing_item_id, event_type ('washed'|'dry_cleaned'), event_date, wears_before_wash, created_at

-- Already on cl_items:
-- laundry_status TEXT ('clean'|'dirty'|'washing')
-- care_instructions TEXT ('machine_wash'|'hand_wash'|'dry_clean'|'delicate')
-- auto_dirty_on_wear INTEGER (boolean)
-- wears_since_wash INTEGER
```

Settings already exist in cl_settings:
- `laundryAutoDirty` -- global auto-dirty toggle
- `laundryWearsBeforeDirty` -- wears threshold before auto-dirty
- `laundryReminder` -- reminder frequency ('none', 'weekly', 'biweekly')
- `laundryReminderDay` -- day of week for reminder (0=Sun)

### Dependencies
- **Internal:** `@mylife/closet` (engine/laundry.ts, db/crud.ts), `@mylife/ui`
- **External:** None
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a closet user, I want to see all my dirty items in one place so I know what needs washing.
2. As a user with mixed fabrics, I want dirty items grouped by care instruction so I can sort laundry loads efficiently.
3. As a user finishing laundry, I want to batch-select items and mark them clean with one tap.
4. As a data-curious user, I want to see my average wears between washes per item to optimize my laundry schedule.
5. As a forgetful user, I want weekly/biweekly laundry reminders so I don't let dirty items pile up.

### Behavior Specification

1. User taps Laundry FAB (floating action button) or Laundry tab on the closet module
2. Laundry basket screen shows:
   a. **Summary header:** "X items need washing" with dirty item count
   b. **Care groups:** Sections for Machine Wash, Hand Wash, Dry Clean, Delicate (only sections with items shown)
   c. Each item card shows: thumbnail, name, wears since last wash, care icon
3. User can select multiple items via checkboxes
4. "Mark Clean" button (fixed bottom) becomes active when items are selected
5. User taps "Mark Clean" -> confirmation sheet with event type selector (washed / dry cleaned) and date picker (defaults to today)
6. On confirm, selected items' laundry_status resets to 'clean', wears_since_wash resets to 0, laundry event recorded
7. Laundry History tab shows past laundry events sorted by date descending
8. Each history entry shows: date, items washed, event type, wears before wash per item
9. Settings section (in closet Settings tab) shows:
   a. Auto-dirty toggle (on/off)
   b. Wears before dirty threshold (slider: 1-10)
   c. Laundry reminder frequency (none / weekly / biweekly)
   d. Reminder day picker (when frequency != none)

### Edge Cases
- No dirty items: show "All clean!" empty state with illustration
- Item marked dirty manually (via item edit) should appear in basket
- Item in 'washing' status: show in a "Currently Washing" section between summary and care groups
- All items are one care type: show only that section, no empty sections
- User marks items clean but sets date in the past: allow it (backfilling laundry logs)
- 500+ dirty items: virtualized list, lazy load beyond 50
- Auto-dirty setting changed after items already have wear counts: only affects future wears, don't retroactively change existing dirty/clean states

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Laundry screen accessible from closet module via FAB or dedicated entry point
- [ ] **AC-2:** Dirty items displayed grouped by care instruction (Machine Wash, Hand Wash, Dry Clean, Delicate)
- [ ] **AC-3:** Each dirty item shows name, thumbnail, wears since last wash, and care icon
- [ ] **AC-4:** Multi-select checkboxes allow batch selection of dirty items
- [ ] **AC-5:** "Mark Clean" button becomes active only when 1+ items selected
- [ ] **AC-6:** Mark clean flow shows event type selector and date picker
- [ ] **AC-7:** After marking clean, items disappear from basket and laundry_status resets to 'clean'
- [ ] **AC-8:** Laundry history shows past events with date, items, type, and wears-before-wash
- [ ] **AC-9:** Settings include auto-dirty toggle, wears threshold slider, reminder frequency, reminder day
- [ ] **AC-10:** "All clean!" empty state shown when no dirty items exist
- [ ] **AC-11:** Summary header shows accurate dirty item count

### Technical Criteria
- [ ] **TC-1:** `markLaundryItemsClean` creates laundry events and resets item state in a single transaction
- [ ] **TC-2:** `listDirtyClothingItems` returns items sorted by care instruction then wears descending
- [ ] **TC-3:** `groupDirtyItemsByCare` correctly groups and sorts within groups
- [ ] **TC-4:** Laundry settings changes persist via `setClosetSetting` and take effect on next wear event
- [ ] **TC-5:** Laundry history query returns events with item details, paginated
- [ ] **TC-6:** Batch mark-clean handles 50+ items without timeout

### Negative Criteria
- [ ] **NC-1:** Marking items clean must NOT delete wear logs or change times_worn
- [ ] **NC-2:** Changing auto-dirty setting must NOT retroactively change existing laundry statuses
- [ ] **NC-3:** Non-active items (donated/sold/archived) must NOT appear in laundry basket
- [ ] **NC-4:** Feature must NOT require network access

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Care group headers: `rgba(255,255,255,0.08)` (glassStrong), section title in `#F0F0F5` with care icon
- Item cards: glass card with 48x48 thumbnail, name, "X wears" badge in accent color `#E879A8`
- Checkbox: custom circular checkbox, accent fill when selected
- Mark Clean button: fixed bottom bar, accent background, white text, disabled state at 50% opacity
- FAB: accent-colored floating button with laundry basket icon, bottom-right corner

### Web (Next.js)
- Same tokens via CSS variables
- Accessible via `/closet/laundry`
- Sidebar shows "Laundry" sub-nav item under Closet
- Table layout with sortable columns: Item, Category, Care, Wears Since Wash
- Batch select via checkboxes, top-bar "Mark Clean" action

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton list with care section placeholders | Initial data fetch |
| Empty | "All clean!" illustration + "Your laundry basket is empty" | No dirty items |
| Error | "Couldn't load laundry data. Pull to retry." | SQLite query failure |
| Success | Grouped dirty items with count header | Dirty items exist |
| Partial | Some care groups populated, others empty (hidden) | Mixed dirty/clean wardrobe |

## Test Requirements

### Unit Tests
- [ ] `groupDirtyItemsByCare`: empty input returns empty groups
- [ ] `groupDirtyItemsByCare`: correctly groups items by care instruction
- [ ] `groupDirtyItemsByCare`: sorts within groups by wearsSinceWash descending
- [ ] `calculateAverageWearsBetweenWashes`: empty events returns null
- [ ] `calculateAverageWearsBetweenWashes`: single event returns exact value
- [ ] `calculateAverageWearsBetweenWashes`: multiple events returns correct average

### Integration Tests
- [ ] Full flow: create items -> log wears -> items become dirty -> mark clean -> basket empties
- [ ] Settings flow: disable auto-dirty -> log wear -> item stays clean
- [ ] Threshold flow: set threshold to 3 -> log 2 wears -> stays clean -> log 3rd wear -> becomes dirty

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyCloset module
3. Add 4 items: "Tee" (machine_wash), "Silk Blouse" (hand_wash), "Suit Jacket" (dry_clean), "Lace Top" (delicate)
4. Log wears on all 4 items
5. Verify: All 4 appear in laundry basket -- corresponds to AC-2
6. Verify: Items grouped under correct care sections -- corresponds to AC-2
7. Verify: Summary shows "4 items need washing" -- corresponds to AC-11
8. Select "Tee" and "Lace Top" via checkboxes
9. Verify: "Mark Clean" button is active -- corresponds to AC-5
10. Tap "Mark Clean"
11. Verify: Event type selector shows "Washed" and "Dry Cleaned" -- corresponds to AC-6
12. Select "Washed", tap confirm
13. Verify: "Tee" and "Lace Top" disappear from basket -- corresponds to AC-7
14. Verify: Summary now shows "2 items need washing" -- corresponds to AC-11
15. Navigate to laundry history
16. Verify: Event entry shows today's date, 2 items, "washed" type -- corresponds to AC-8
17. Mark remaining items clean
18. Verify: "All clean!" empty state appears -- corresponds to AC-10
19. Go to Settings, set wears-before-dirty to 3
20. Log 2 wears on "Tee"
21. Verify: "Tee" still shows clean status
22. Log 3rd wear on "Tee"
23. Verify: "Tee" now appears in laundry basket
24. Toggle auto-dirty OFF in settings
25. Log wear on "Silk Blouse"
26. Verify: "Silk Blouse" stays clean -- corresponds to NC-2
27. Repeat key checks on web at `/closet/laundry`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to laundry screen, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in closet module, run `/qa` on the module URL

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- Engine exists: `calculateAverageWearsBetweenWashes`, `groupDirtyItemsByCare` in `engine/laundry.ts`
- CRUD exists: `markLaundryItemsClean`, `listDirtyClothingItems`, `listLaundryEventsForItem`
- Schema exists: `cl_laundry_events` table, laundry columns on `cl_items`, laundry settings
- No UI exists for laundry tracking

### After This Work
- Laundry basket screen on mobile and web
- Grouped dirty items view with batch mark-clean flow
- Laundry history view
- Laundry settings UI wired to existing cl_settings

### Files Changed
- `apps/mobile/app/(closet)/laundry.tsx` -- NEW: Laundry basket screen
- `apps/mobile/components/closet/LaundryBasket.tsx` -- NEW: Grouped dirty items component
- `apps/mobile/components/closet/LaundryHistory.tsx` -- NEW: History list component
- `apps/web/app/closet/laundry/page.tsx` -- NEW: Web laundry page
- `modules/closet/src/db/crud.ts` -- Add `listLaundryHistory()` pagination query

### Known Limitations
- Laundry reminders are stored in settings but notification scheduling requires expo-notifications (separate feature)
- No "laundry load" concept (grouping multiple items into a named load)
- No dry cleaner pickup/delivery tracking

### Context for Next Agent
- All engine functions already exist and are tested. Focus is 100% UI.
- The `logWearEvent` function in crud.ts already handles auto-dirty logic with threshold. Don't duplicate.
- Settings keys are pre-seeded in V2 migration -- read via `getClosetSetting`, write via `setClosetSetting`.
