# Feature Spec: Shopping Wishlist

## Metadata
- **Module:** closet
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** 2
- **Estimated CC Time:** 30 min
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Users plan clothing purchases before buying. A wishlist bridges the gap between "I need a black jacket" and the actual purchase. Without it, users track shopping ideas in notes apps or browser bookmarks, fragmenting their wardrobe planning. Both Indyx and Stylebook offer wishlists because they keep users engaged between purchases and provide data on wardrobe gaps.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Indyx | Yes | Free | Wishlist with photos, links, price tracking |
| Stylebook | Yes | $5.99 one-time | Shopping list with budget tracking, notes |
| Clueless | No | N/A | No shopping features |
| Alta | No | N/A | No shopping features |

### Target User
Users who plan wardrobe additions deliberately rather than impulse-buying. Users who want to fill wardrobe gaps identified by analytics (e.g., "I don't own waterproof outerwear"). Budget-conscious users who track desired items and wait for sales.

## Technical Context

### Where This Lives in MyLife

```
modules/closet/src/db/schema.ts          -- Add cl_wishlist_items table (V3 migration)
modules/closet/src/types.ts              -- Add WishlistItem, CreateWishlistItemInput types
modules/closet/src/db/crud.ts            -- Add wishlist CRUD operations
modules/closet/src/definition.ts         -- Add V3 migration
apps/mobile/app/(closet)/wishlist.tsx    -- NEW: Wishlist screen
apps/web/app/closet/wishlist/page.tsx    -- NEW: Web wishlist page
```

### Wireframe Position

```
Hub Dashboard
  └── MyCloset card
       ├── Wardrobe tab
       ├── Outfits tab
       ├── Calendar tab
       ├── Stats tab
       └── Wishlist (new screen, accessible from + menu or Settings)  ← YOU ARE HERE
            ├── Wishlist items (grid or list)
            ├── Add item form
            └── "Move to Wardrobe" action
```

### Data Model

```sql
-- V3 migration
CREATE TABLE IF NOT EXISTS cl_wishlist_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  color TEXT,
  estimated_price_cents INTEGER,
  url TEXT,
  image_uri TEXT,
  notes TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  is_purchased INTEGER NOT NULL DEFAULT 0,
  purchased_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cl_wishlist_priority_idx ON cl_wishlist_items(priority, is_purchased, created_at DESC);
```

### Dependencies
- **Internal:** `@mylife/closet` (types, CRUD patterns), `@mylife/ui`
- **External:** None
- **Cross-Module:** Budget module -- future integration to show wishlist spending vs budget. Not blocking.

## Functional Requirements

### User Stories
1. As a closet user, I want to save items I want to buy so I can plan wardrobe additions.
2. As a budget-aware user, I want to see the total estimated cost of my wishlist so I can prioritize.
3. As a shopper, I want to mark items as purchased and optionally move them to my wardrobe inventory.
4. As an organized user, I want to prioritize wishlist items (high/medium/low) so the most wanted items surface first.

### Behavior Specification

1. User accesses Wishlist via the closet module's navigation (new screen or sub-tab)
2. Wishlist shows items sorted by priority (high first), then by date added
3. Each wishlist card shows: name, category, brand (if set), estimated price, priority badge, thumbnail (if set)
4. Add item form includes: name (required), category (required), brand, color, estimated price, URL (for reference), image (camera/gallery), notes, priority (high/medium/low)
5. Swipe-to-delete or long-press for delete action
6. "Mark Purchased" action on each item:
   a. Sets is_purchased = true, purchased_date = today
   b. Prompts: "Add to your wardrobe?" with Yes/No
   c. If Yes, opens pre-filled "Add Item" form with name, category, brand, color, price already populated
   d. If No, item moves to "Purchased" section (collapsed by default)
7. Wishlist summary at top: total items, total estimated cost, items by priority
8. Purchased section at bottom: collapsed list of purchased items with dates, clearable

### Edge Cases
- Empty wishlist: show "Start planning your next wardrobe additions" with CTA
- Item with no price: show in list but exclude from cost total, show "--" for price
- Very long URL: truncate display, store full URL
- Purchased item moved to wardrobe: wishlist item stays in "Purchased" section for reference
- All items purchased: show "All caught up!" state + "Add more" CTA
- Image from URL: don't auto-fetch images from URLs (privacy). Only accept user-provided images.
- Duplicate item names: allow (user might want "Black T-Shirt" from different brands)
- 100+ wishlist items: paginate or virtualize list

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Wishlist screen accessible from closet module navigation
- [ ] **AC-2:** Wishlist items sorted by priority (high/medium/low) then date
- [ ] **AC-3:** Each item shows name, category, brand, estimated price, priority badge
- [ ] **AC-4:** Add item form includes all fields: name, category, brand, color, price, URL, image, notes, priority
- [ ] **AC-5:** Swipe or long-press to delete a wishlist item
- [ ] **AC-6:** "Mark Purchased" sets is_purchased and prompts to add to wardrobe
- [ ] **AC-7:** "Add to wardrobe" pre-fills the clothing item creation form
- [ ] **AC-8:** Wishlist summary shows total items and total estimated cost
- [ ] **AC-9:** Purchased items appear in collapsed "Purchased" section
- [ ] **AC-10:** Empty state shown when no wishlist items exist

### Technical Criteria
- [ ] **TC-1:** `cl_wishlist_items` table created in V3 migration with all columns
- [ ] **TC-2:** CRUD operations: createWishlistItem, getWishlistItemById, listWishlistItems, updateWishlistItem, deleteWishlistItem
- [ ] **TC-3:** `listWishlistItems` supports filter by is_purchased and priority
- [ ] **TC-4:** `getWishlistSummary` returns total count, total cost, count by priority
- [ ] **TC-5:** Purchased flow correctly sets is_purchased=1 and purchased_date in transaction
- [ ] **TC-6:** V3 migration is backward-compatible (no changes to existing V1/V2 tables)

### Negative Criteria
- [ ] **NC-1:** Wishlist items must NOT automatically create clothing items -- only via explicit "Add to wardrobe" action
- [ ] **NC-2:** Deleting a wishlist item must NOT affect any wardrobe items (even if one was created from it)
- [ ] **NC-3:** Feature must NOT fetch any external URLs (images, price checking, etc.) -- privacy-first
- [ ] **NC-4:** Feature must NOT require network access

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F`
- Wishlist cards: glass card with thumbnail area (placeholder if no image), name, brand, price, priority pill
- Priority pills: High = accent `#E879A8`, Medium = `rgba(255,255,255,0.15)`, Low = `rgba(255,255,255,0.06)`
- Summary bar: glass strip at top with "X items | $Y.YY total" in secondary text
- Add button: FAB with "+" icon, accent color
- Purchased section: collapsible, dimmed text, strikethrough on item names

### Web (Next.js)
- Accessible via `/closet/wishlist`
- Table layout with sortable columns: Name, Category, Brand, Price, Priority, Added Date
- Inline "Mark Purchased" button per row
- Add form as modal or side panel

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards | Initial data fetch |
| Empty | "Start planning your next wardrobe additions" + Add button | No wishlist items |
| Error | "Couldn't load wishlist. Pull to retry." | SQLite query failure |
| Success | Sorted wishlist with summary bar | Items exist |
| Partial | Active items + collapsed "Purchased" section | Mix of active and purchased |

## Test Requirements

### Unit Tests
- [ ] `createWishlistItem`: creates with all fields, defaults priority to 'medium'
- [ ] `createWishlistItem`: validates name and category required
- [ ] `listWishlistItems`: returns sorted by priority then date
- [ ] `listWishlistItems`: filters by is_purchased
- [ ] `updateWishlistItem`: partial update preserves other fields
- [ ] `deleteWishlistItem`: removes item, returns true/false
- [ ] `markWishlistItemPurchased`: sets is_purchased=1 and purchased_date
- [ ] `getWishlistSummary`: returns correct totals including null price handling
- [ ] `getWishlistSummary`: excludes purchased items from active total

### Integration Tests
- [ ] Full flow: create wishlist item -> mark purchased -> add to wardrobe -> verify clothing item created
- [ ] Delete flow: create item -> delete -> verify removed from list
- [ ] Summary flow: create 3 items (2 with price, 1 without) -> verify summary math

### QA Verification Script

1. Open app on iOS simulator
2. Navigate to MyCloset module
3. Access Wishlist screen
4. Verify: Empty state shown -- corresponds to AC-10
5. Tap Add (+) button
6. Fill form: "Black Leather Jacket", category: outerwear, brand: "AllSaints", price: $450, priority: high, notes: "Wait for end-of-season sale"
7. Save
8. Verify: Item appears with High priority badge and $450.00 price -- corresponds to AC-2, AC-3
9. Add 2 more items: "White Sneakers" ($120, medium priority), "Summer Hat" (no price, low priority)
10. Verify: Items sorted high -> medium -> low -- corresponds to AC-2
11. Verify: Summary shows "3 items | $570.00 total" (hat excluded from total) -- corresponds to AC-8
12. Tap "Mark Purchased" on the jacket
13. Verify: Prompt asks "Add to your wardrobe?" -- corresponds to AC-6
14. Tap Yes
15. Verify: Add Item form opens pre-filled with jacket details -- corresponds to AC-7
16. Save the clothing item
17. Verify: Jacket moves to "Purchased" section in wishlist -- corresponds to AC-9
18. Verify: Summary updates to "2 items | $120.00 total"
19. Swipe to delete "Summer Hat"
20. Verify: Hat removed from list -- corresponds to AC-5
21. Repeat key checks on web at `/closet/wishlist`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to wishlist, click every button, verify all 5 states

### Post-merge:
- [ ] `/parity-check` -- closet module parity

## Handoff State

### Before This Work
- No wishlist concept exists in the closet module
- No cl_wishlist_items table
- Module is at schema version 2

### After This Work
- cl_wishlist_items table with V3 migration
- Full CRUD for wishlist items
- Wishlist screen on mobile and web
- "Mark Purchased" flow with wardrobe integration
- Schema version bumped to 3

### Files Changed
- `modules/closet/src/db/schema.ts` -- Add CREATE_WISHLIST_ITEMS, wishlist index
- `modules/closet/src/definition.ts` -- Add CLOSET_MIGRATION_V3, bump schemaVersion to 3
- `modules/closet/src/types.ts` -- Add WishlistItem, CreateWishlistItemInput, UpdateWishlistItemInput, WishlistItemFilter schemas
- `modules/closet/src/db/crud.ts` -- Add wishlist CRUD functions
- `modules/closet/src/index.ts` -- Export wishlist types and functions
- `modules/closet/src/__tests__/wishlist.test.ts` -- NEW: Wishlist tests
- `apps/mobile/app/(closet)/wishlist.tsx` -- NEW: Wishlist screen
- `apps/web/app/closet/wishlist/page.tsx` -- NEW: Web wishlist page

### Known Limitations
- No price tracking or sale alerts (would require network monitoring)
- No link to external stores or product pages (privacy-first)
- No shared wishlists or gift registry features
- No auto-detection of wardrobe gaps ("you don't own any boots")

### Context for Next Agent
- Follow the exact CRUD pattern from existing `createClothingItem` -- same ID generation, transaction wrapping, schema validation.
- Priority enum: 'high' | 'medium' | 'low'. Store as text in SQLite.
- The "Add to wardrobe" flow should call `createClothingItem` with pre-filled data -- don't create a separate code path.
- V3 migration must be additive-only (no changes to V1/V2 tables). Add new `CLOSET_MIGRATION_V3` to the migrations array.
