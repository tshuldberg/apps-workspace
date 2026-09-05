# Feature Spec: Packing List Generator

## Metadata
- **Module:** closet
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** 2
- **Estimated CC Time:** 30 min
- **Depends On:** none (engine, tables, and CRUD already exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Packing for trips is universally stressful. Users who manage their wardrobe digitally expect packing lists that draw from their actual inventory -- not generic "pack 5 shirts" checklists. Stylebook and Clueless both offer packing lists as differentiating features. The engine and data model already exist in MyCloset (V2 migration). This feature is about building the UI that surfaces that functionality.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Stylebook | Yes | $5.99 one-time | Packing lists from wardrobe, outfit-based planning, checklist |
| Clueless | Yes | $69/yr | Weather-integrated packing, destination-based suggestions |
| Indyx | No | N/A | No packing features |
| Alta | No | N/A | No packing features |

### Target User
Travelers who want to pack from their actual wardrobe. Frequent travelers who want reusable packing templates. Users who want to know which clean items to pack and which need washing first.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/engine/packing.ts     -- ALREADY EXISTS: inferPackingSeason, generatePackingSuggestions
modules/closet/src/db/crud.ts            -- ALREADY EXISTS: createPackingList, listPackingLists, togglePackingListItemPacked, addPackingListCustomItem
modules/closet/src/db/schema.ts          -- ALREADY EXISTS: cl_packing_lists, cl_packing_list_items (V2)
apps/mobile/app/(closet)/packing-list.tsx -- EXISTS in nav definition, needs implementation
apps/mobile/components/closet/PackingListCreate.tsx -- NEW: Creation wizard
apps/mobile/components/closet/PackingListChecklist.tsx -- NEW: Checklist component
apps/web/app/closet/packing/page.tsx     -- NEW: Web packing page
apps/web/app/closet/packing/[id]/page.tsx -- NEW: Web packing list detail
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       ├── Wardrobe tab
       ├── Outfits tab
       ├── Calendar tab
       ├── Stats tab
       └── Packing List screen (existing nav)  ← YOU ARE HERE
            ├── Active trips (upcoming/current)
            ├── Past trips
            ├── Create New List wizard
            └── Checklist view with pack/unpack toggles
```

### Data Model
Tables already exist (V2 migration):

```sql
-- cl_packing_lists: id, name, start_date, end_date, occasions_json, season, mode, created_at, updated_at
-- cl_packing_list_items: id, packing_list_id, clothing_item_id (nullable for custom), custom_name, category_group, quantity, is_packed, sort_order, created_at
```

CRUD functions already exist:
- `createPackingList` -- creates list with auto-generated suggestions
- `getPackingListById` -- returns list with items
- `listPackingLists` -- returns all lists, active first
- `togglePackingListItemPacked` -- toggles packed state
- `addPackingListCustomItem` -- adds non-wardrobe items (toiletries, etc.)

Engine functions already exist:
- `inferPackingSeason(startDate)` -- determines season from trip date
- `generatePackingSuggestions(items, input)` -- suggests wardrobe items based on trip duration, season, occasions

### Dependencies
- **Internal:** `@mylife/closet` (engine/packing.ts, db/crud.ts), `@mylife/ui`
- **External:** None
- **Cross-Module:** Trails module -- future cross-module link for hiking trip packing lists. Not blocking.

## Functional Requirements

### User Stories
1. As a traveler, I want to create a packing list for my trip so I can organize what to bring.
2. As a closet user, I want the app to suggest items from my wardrobe based on trip details.
3. As a packer, I want a checklist where I can mark items as packed so I don't forget anything.
4. As an organizer, I want to add custom items (toiletries, chargers) that aren't in my wardrobe.
5. As a frequent traveler, I want to see past packing lists for reference.

### Behavior Specification

1. User navigates to Packing List screen (existing nav entry)
2. Screen shows two sections: Active Trips (end_date >= today) and Past Trips (end_date < today, collapsed)
3. Each trip card shows: name, dates, season badge, progress (X/Y packed)
4. "Create New" button opens creation wizard:
   a. **Step 1:** Trip name (required), start date, end date (date pickers)
   b. **Step 2:** Occasions multi-select (work, casual, formal, active, beach)
   c. **Step 3:** Mode selection: "Quick List" (auto-suggestions) or "Outfit Planning" (per-day outfits)
   d. Engine generates suggestions, user reviews and can add/remove items
5. Tapping a trip opens the Checklist View:
   a. Items grouped by category (Tops, Bottoms, Shoes, Essentials, etc.)
   b. Each item shows: name (or custom name), quantity, pack checkbox
   c. Tapping checkbox toggles packed state (persisted immediately)
   d. Progress bar at top shows packed/total
   e. "Add Item" button to add custom items or wardrobe items
6. Completed trip (all items packed + trip date passed): show "Trip complete!" badge
7. Swipe to delete a packing list

### Edge Cases
- Empty wardrobe: show only custom item slots (Toiletries, Chargers, Documents)
- 1-day trip: minimal suggestions (no sleepwear, fewer underwear)
- 30+ day trip: cap suggestions at reasonable limits (7 tops, 5 bottoms, etc.)
- All items dirty: show dirty-status warning on suggested items ("needs washing first")
- End date before start date: validation prevents creation (Zod schema already handles this)
- Deleted clothing item that was in a packing list: item row shows "Item removed from wardrobe" with original name
- Mode 'outfit_planning' with no outfits defined: fall back to quick_list suggestions with "Create outfits for outfit planning"
- 10+ packing lists: list view with scroll, no pagination needed (low volume data)

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Packing List screen shows Active Trips and Past Trips sections
- [ ] **AC-2:** Each trip card shows name, dates, season badge, and pack progress (X/Y)
- [ ] **AC-3:** Create wizard collects trip name, dates, occasions, and mode
- [ ] **AC-4:** Quick List mode auto-generates wardrobe suggestions based on trip details
- [ ] **AC-5:** Review step allows adding and removing suggested items
- [ ] **AC-6:** Checklist view groups items by category with pack checkboxes
- [ ] **AC-7:** Checkbox toggle persists immediately (no save button needed)
- [ ] **AC-8:** Progress bar updates in real-time as items are packed
- [ ] **AC-9:** "Add Item" allows adding custom items and additional wardrobe items
- [ ] **AC-10:** Past trips are collapsed by default
- [ ] **AC-11:** Dirty items show a warning indicator in suggestions

### Technical Criteria
- [ ] **TC-1:** `createPackingList` calls `generatePackingSuggestions` to auto-populate
- [ ] **TC-2:** `togglePackingListItemPacked` persists state change immediately
- [ ] **TC-3:** `addPackingListCustomItem` adds non-wardrobe items with correct sort order
- [ ] **TC-4:** `listPackingLists` returns active trips first, sorted by start date
- [ ] **TC-5:** Packing suggestions respect season, occasion, and clean status
- [ ] **TC-6:** Trip duration affects suggestion counts (1-day vs 7-day vs 30-day)

### Negative Criteria
- [ ] **NC-1:** Packing a list must NOT change item laundry status or wear count
- [ ] **NC-2:** Deleting a packing list must NOT delete the underlying clothing items
- [ ] **NC-3:** Feature must NOT require network access
- [ ] **NC-4:** Past trip data must NOT be auto-deleted

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F`
- Trip cards: glass card with season-colored accent stripe (spring green, summer amber, fall orange, winter blue)
- Progress bar: thin accent bar below trip name, filled proportion = packed/total
- Checklist: glass rows with circular checkbox (accent fill when checked), item name, quantity badge
- Category headers: uppercase label in secondary text with count
- Create wizard: bottom sheet with step indicator dots
- "Needs washing" badge: small warning pill in `#FF453A` (danger token)

### Web (Next.js)
- Accessible via `/closet/packing` (list) and `/closet/packing/[id]` (checklist)
- Table layout for checklist with sortable columns
- Create wizard as modal with step navigation
- Same tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton trip cards | Initial data fetch |
| Empty | "Plan your next trip!" + Create button | No packing lists |
| Error | "Couldn't load packing lists. Pull to retry." | SQLite query failure |
| Success | Active + Past trips with progress | Lists exist |
| Partial | Active trips only (no past) | All trips are upcoming |

## Test Requirements

### Unit Tests
- [ ] `inferPackingSeason`: all 12 months map correctly for northern hemisphere
- [ ] `generatePackingSuggestions`: 3-day trip generates correct category counts
- [ ] `generatePackingSuggestions`: prioritizes clean items over dirty
- [ ] `generatePackingSuggestions`: includes essentials (Toiletries, Chargers, Documents)
- [ ] `generatePackingSuggestions`: active occasion adds activewear suggestions
- [ ] `getSuggestedCategoryCounts`: 1-day trip has minimal counts
- [ ] `getSuggestedCategoryCounts`: 7-day trip caps at defined limits

### Integration Tests
- [ ] Full flow: create trip -> checklist appears -> toggle items -> verify progress
- [ ] Custom item flow: add custom item -> verify in checklist -> toggle packed
- [ ] Sort flow: active trips before past trips

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyCloset module
3. Access Packing List screen
4. Verify: Empty state "Plan your next trip!" -- corresponds to AC-1 empty
5. Add 8 items to wardrobe (2 tops, 2 bottoms, 1 shoes, 1 outerwear, 1 sleepwear, 1 underwear)
6. Mark 1 top as dirty (log a wear)
7. Tap "Create New"
8. Fill: "Beach Vacation", dates June 15-20, occasions: casual + beach
9. Verify: Season auto-detected as "summer" -- corresponds to AC-4
10. Verify: Suggestions include clean tops first, dirty top last with warning -- corresponds to AC-11
11. Verify: Essentials section includes Toiletries, Chargers, Documents -- corresponds to AC-4
12. Remove 1 suggested item, confirm
13. Save packing list
14. Verify: Trip card shows in Active section with correct dates and progress 0/N -- corresponds to AC-2
15. Tap trip to open checklist
16. Verify: Items grouped by category -- corresponds to AC-6
17. Tap 3 checkboxes to pack items
18. Verify: Progress bar shows 3/N -- corresponds to AC-8
19. Verify: Checkbox state persists after navigating away and back -- corresponds to AC-7
20. Tap "Add Item", add "Sunscreen" custom item
21. Verify: Custom item appears in Essentials group -- corresponds to AC-9
22. Create a past trip (dates in February)
23. Verify: February trip in "Past Trips" (collapsed) -- corresponds to AC-10
24. Repeat key checks on web at `/closet/packing`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to packing screen, click every button, verify all 5 states

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- Full engine exists: `inferPackingSeason`, `generatePackingSuggestions` in `engine/packing.ts`
- Full CRUD exists: `createPackingList`, `listPackingLists`, `togglePackingListItemPacked`, `addPackingListCustomItem`
- Schema exists: `cl_packing_lists`, `cl_packing_list_items` tables (V2)
- Navigation entry exists: `packing-list` screen defined in definition.ts
- No UI implementation exists

### After This Work
- Packing list screen with create wizard
- Checklist view with grouped items and pack/unpack toggles
- Active/Past trip organization
- Custom item addition flow
- Web packing pages

### Files Changed
- `apps/mobile/app/(closet)/packing-list.tsx` -- Packing list screen implementation
- `apps/mobile/components/closet/PackingListCreate.tsx` -- NEW: Creation wizard
- `apps/mobile/components/closet/PackingListChecklist.tsx` -- NEW: Checklist component
- `apps/web/app/closet/packing/page.tsx` -- NEW: Web packing list page
- `apps/web/app/closet/packing/[id]/page.tsx` -- NEW: Web packing list detail

### Known Limitations
- No weather-integrated packing (would combine with weather-aware feature)
- No packing list sharing/export
- No reusable packing templates (e.g., "my standard weekend trip list")
- Outfit Planning mode is scaffolded but may show "Create outfits first" for users without outfits

### Context for Next Agent
- Engine is fully implemented and tested. This is 100% a UI feature.
- The `createPackingList` CRUD function already calls `generatePackingSuggestions` internally. You don't need to call the engine directly from the UI.
- `togglePackingListItemPacked` returns the updated `PackingListItem`. Use the return value to update UI state without re-fetching.
- `listPackingLists` already sorts active trips first. Don't re-sort in the UI.
- The `packing-list` screen is already defined in the module's navigation config.
