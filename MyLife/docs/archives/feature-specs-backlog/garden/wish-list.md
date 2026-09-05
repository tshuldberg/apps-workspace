# Feature Spec: Wish List

## Metadata
- **Module:** garden
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 5 x2 + CrossModule 1 x1 + PaidUser 1 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 1-2 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Plant enthusiasts maintain mental or paper wish lists of plants they want to acquire. During nursery visits, garden center sales, or online browsing, they need quick access to this list. Planter offers a wish list as part of its premium features. This is a high-complexity-simplicity feature (Complexity score 5/5) meaning it's easy to build with high user value. The wish list also creates a natural bridge to the plant catalog: when a wish list item is acquired, it converts to a real plant record.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Planter | Yes | Premium ($49.99 lifetime) | Simple wish list with name, photo, notes, and "acquired" toggle |
| PlantIn | No | N/A | No wish list feature |
| Planta | No | N/A | No wish list feature |
| Seed to Spoon | No | N/A | No wish list feature |

### Target User
Plant collectors and enthusiasts who browse nurseries, plant swaps, and online shops. Users who currently keep wish lists in Notes or shopping apps but want it integrated with their garden tracker so acquired items auto-populate their plant catalog.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/types.ts                        -- WishListItem, CreateWishListInput types
modules/garden/src/db/schema.ts                    -- gd_wishlist table (V2 migration)
modules/garden/src/db/crud.ts                      -- Wish list CRUD operations
modules/garden/src/definition.ts                   -- V2 migration
apps/mobile/app/(garden)/wishlist.tsx              -- Wish list screen
apps/mobile/app/(garden)/components/WishListCard.tsx  -- Wish list item card
apps/web/app/garden/wishlist/page.tsx              -- Web wish list page
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── [Toggle: Plants | Zones | Wish List]
                 └── Wish List ← YOU ARE HERE
```

### Data Model

```sql
-- V2 migration: plant wish list
CREATE TABLE IF NOT EXISTS gd_wishlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  species TEXT,
  source TEXT,
  estimated_price REAL,
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  image_uri TEXT,
  added_date TEXT NOT NULL DEFAULT (date('now')),
  acquired INTEGER NOT NULL DEFAULT 0,
  acquired_date TEXT,
  acquired_plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS gd_wishlist_priority_idx ON gd_wishlist(priority);
CREATE INDEX IF NOT EXISTS gd_wishlist_acquired_idx ON gd_wishlist(acquired);
```

**Column notes:**
- `source`: Where to buy (e.g., "Local nursery", "Etsy: ShopName", "Trader Joe's")
- `estimated_price`: Optional price estimate in user's currency
- `priority`: 'high' | 'medium' | 'low'
- `acquired`: 0 (not acquired) or 1 (acquired) -- SQLite boolean
- `acquired_plant_id`: FK to the plant record created when item is acquired

### Dependencies
- **Internal:** `@mylife/garden` (types, crud, createPlant), `@mylife/ui`
- **External:** `expo-image-picker` (optional item photos)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a plant enthusiast, I want to maintain a list of plants I want to buy so that I can reference it during nursery visits.
2. As a plant enthusiast, I want to mark a wish list item as acquired and have it automatically create a plant record so that my catalog stays in sync.
3. As a plant enthusiast, I want to set priority on wish list items so that I know what to look for first.
4. As a plant enthusiast, I want to add price estimates and sources so that I can compare options and budget.
5. As a plant enthusiast, I want to share my wish list (e.g., as a gift guide) so that friends and family know what plants I want.

### Behavior Specification

**Wish list view:**
1. User navigates to Garden tab and selects "Wish List" from the toggle (Plants | Zones | Wish List)
2. List shows all non-acquired items, sorted by priority (high first), then by added date
3. Each card shows: name, species (if set), source, price estimate, priority badge, photo thumbnail, days on list
4. FAB or "+" button opens Add to Wish List form
5. Swipe-left reveals "Acquired" (green) and "Delete" (red) actions
6. Tapping a card opens detail/edit view

**Add wish list item:**
1. Modal form: name (required), species (optional), source (optional text), estimated price (optional number), priority (segmented: High/Medium/Low, default Medium), photo (camera/gallery), notes (optional text)
2. Save creates record in gd_wishlist

**Mark as acquired:**
1. User swipes left and taps "Acquired" or opens item and taps "Mark as Acquired"
2. Confirmation: "Add [name] to your plant catalog?"
3. If yes: opens Add Plant form pre-filled with wish list item's name, species, notes, and photo. On plant creation, wish list item is updated with acquired=1, acquired_date=today, acquired_plant_id=new plant ID
4. If no (just mark acquired without creating plant): sets acquired=1, acquired_date=today
5. Acquired items move to a collapsible "Acquired" section at the bottom of the wish list

**Share wish list:**
1. "Share" button in top action bar
2. Generates a formatted text list: plant names, species, sources, prices
3. Shares via system share sheet (copy, messages, email, etc.)

### Edge Cases

- **Empty wish list:** Illustration with "Your plant wish list is empty. Start dreaming!" + "Add Plant" CTA
- **All items acquired:** Show "All wishes granted!" celebration message above the acquired section
- **Delete acquired item:** Prompt "Delete wish list entry? The plant in your catalog will not be affected."
- **Delete plant that was acquired from wish list:** acquired_plant_id SET NULL, wish list item keeps acquired=1 but link is broken (acceptable)
- **Duplicate names:** Allowed (user might want two of the same plant)
- **Very long source URLs:** Truncate display at 50 chars, full value in detail view
- **Price without currency:** Display as raw number. V1 does not handle currency conversion.
- **Priority change after creation:** Allowed via edit

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Wish list accessible via toggle on Garden tab
- [ ] **AC-2:** Items sorted by priority (high first), then by date added
- [ ] **AC-3:** Each card shows name, species, source, price, priority badge, days on list
- [ ] **AC-4:** Add form accepts name, species, source, price, priority, photo, notes
- [ ] **AC-5:** "Mark as Acquired" prompts to create plant record with pre-filled data
- [ ] **AC-6:** Acquired items move to collapsible "Acquired" section
- [ ] **AC-7:** Swipe-left reveals "Acquired" and "Delete" actions
- [ ] **AC-8:** Share button generates and shares formatted wish list text
- [ ] **AC-9:** Edit mode allows updating any field including priority
- [ ] **AC-10:** Acquired item links to its plant record (tappable)

### Technical Criteria
- [ ] **TC-1:** Wish list items persisted to gd_wishlist with all fields
- [ ] **TC-2:** Marking acquired updates acquired, acquired_date, and acquired_plant_id
- [ ] **TC-3:** Plant creation from wish list sets all available fields (name, species, notes, photo)
- [ ] **TC-4:** Deleting a plant sets acquired_plant_id to NULL (ON DELETE SET NULL)
- [ ] **TC-5:** Priority filter/sort works correctly across all 3 levels
- [ ] **TC-6:** Share output formats correctly with names, species, and sources

### Negative Criteria
- [ ] **NC-1:** Acquiring a wish list item must NOT create a plant without user confirmation
- [ ] **NC-2:** Deleting a wish list item must NOT delete the associated plant
- [ ] **NC-3:** Wish list photos must NOT be uploaded to any server
- [ ] **NC-4:** Share must use system share sheet, NOT a custom sharing mechanism

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E`
- Priority badges: High = `#FF453A` (red) pill, Medium = `#FFD60A` (yellow) pill, Low = `rgba(255,255,255,0.3)` (gray) pill
- Price: displayed in accent color with "$" prefix (or no symbol if not set)
- "Days on list" badge: small secondary text (e.g., "14d")
- Acquired section: collapsed by default, header shows count (e.g., "Acquired (3)"), items have muted styling with checkmark overlay
- Photo thumbnails: 48x48 rounded square, placeholder is accent-colored circle with plant emoji

### Web (Next.js)

- Same tokens via CSS variables
- Route: `/garden/wishlist`
- Table layout on desktop: columns for Name, Species, Source, Price, Priority, Added Date, Actions
- Cards layout on mobile breakpoint
- Acquired items in a separate tab or toggle

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards | Initial data fetch |
| Empty | "Your plant wish list is empty" + Add CTA | No items |
| Success | Sorted wish list with priority badges | 1+ items |
| All Acquired | "All wishes granted!" + acquired section | All items acquired |
| Error | "Could not load wish list. Pull to retry." | DB query fails |

## Test Requirements

### Unit Tests
- [ ] `createWishListItem()`: persists with all fields
- [ ] `createWishListItem()`: rejects empty name
- [ ] `getWishList()`: returns non-acquired items sorted by priority, then date
- [ ] `getAcquiredItems()`: returns only acquired items
- [ ] `markAsAcquired()`: updates acquired, acquired_date, acquired_plant_id
- [ ] `deleteWishListItem()`: removes item without affecting linked plant
- [ ] `updateWishListItem()`: updates individual fields
- [ ] `formatWishListForShare()`: generates clean text output

### Integration Tests
- [ ] Full flow: add item -> mark acquired -> verify plant created -> verify wish list updated
- [ ] Delete flow: add item -> mark acquired -> delete plant -> verify wish list item still exists with null FK

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden module
3. Select "Wish List" toggle on Garden tab -- AC-1
4. Verify: empty state with CTA
5. Tap "+" to add item
6. Fill in: name "Monstera Thai Constellation", species "Monstera deliciosa 'Thai Constellation'", source "Local Nursery", price $45, priority High, add a photo
7. Save
8. Verify: item appears at top of list with red "High" badge, photo, price -- AC-2, AC-3, AC-4
9. Add 2 more items: one Medium, one Low priority
10. Verify: sorted High > Medium > Low -- AC-2
11. Swipe left on the High-priority item
12. Verify: "Acquired" (green) and "Delete" (red) actions appear -- AC-7
13. Tap "Acquired"
14. Verify: prompt to create plant record -- AC-5
15. Confirm creation
16. Verify: Add Plant form pre-filled with wish list data
17. Save plant
18. Verify: item moves to "Acquired" section -- AC-6
19. Expand acquired section
20. Tap the acquired item
21. Verify: link to plant record is tappable -- AC-10
22. Tap "Share" button
23. Verify: system share sheet shows formatted wish list -- AC-8
24. Edit a wish list item, change priority
25. Verify: updated priority reflected in sort order -- AC-9
26. On web: navigate to /garden/wishlist
27. Verify: table layout with sortable columns

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No wish list capability in the garden module. Users track desired plants outside the app.

### After This Work
- gd_wishlist table with priority, price, source, acquisition tracking
- Wish list view with priority sorting and acquired section
- Acquire flow that converts wish list items to plant records
- Share functionality for gift lists
- Mobile and web UIs

### Files Changed
- `modules/garden/src/types.ts` -- WishListItem, CreateWishListInput, WishListPriority types
- `modules/garden/src/db/schema.ts` -- gd_wishlist table
- `modules/garden/src/db/crud.ts` -- Wish list CRUD, markAsAcquired
- `modules/garden/src/definition.ts` -- V2 migration
- `apps/mobile/app/(garden)/wishlist.tsx` -- Wish list screen
- `apps/mobile/app/(garden)/components/WishListCard.tsx` -- Item card
- `apps/web/app/garden/wishlist/page.tsx` -- Web wish list

### Known Limitations
- V1 does not support currency selection. Prices are stored as raw numbers.
- Sharing generates plain text only. Rich formatting (HTML, PDF) is a future enhancement.
- No integration with external plant shops or nursery databases.

### Context for Next Agent
- The wish list is a simple CRUD feature. The interesting part is the "acquire" flow where a wish list item converts to a plant. Make sure `createPlant()` is called with the wish list data and the resulting plant ID is stored back in gd_wishlist.acquired_plant_id.
- The Garden tab toggle should be extensible: currently "Plants | Zones | Wish List" but more views may be added later. Use a segmented control or tab bar that scales.
- Priority is stored as text ('high'/'medium'/'low') not a number, to keep display logic simple.
