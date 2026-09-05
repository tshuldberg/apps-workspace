# Feature Spec: RSVP Gift Registry

## Metadata
- **Module:** rsvp
- **Priority Score:** 20 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 4
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Event creation (built), event links system (built, rv_event_links with type='registry')
- **Blocks:** none

## Business Context

### Why This Feature Exists
"Where's the registry?" is one of the most common questions guests ask about birthdays, weddings, and baby showers. Currently, hosts paste registry links into the event description or use `rv_event_links` with type='registry' -- but there is no structured registry experience. Evite is the only event platform with a built-in registry aggregator that pulls items from Amazon, Target, and custom lists into a single unified view. By building a structured gift registry, MyRSVP eliminates the friction of guests hunting for registry links and gives hosts a clear view of what has been claimed.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Evite | Yes | Free | Registry link aggregator, Amazon/Target integration, "I'm bringing this" button |
| Partiful | No | N/A | No gift registry. Only a "chip in" external link. |
| RSVPify | No | N/A | No gift registry |
| Amazon | Yes (standalone) | Free | Full registry with purchasing. Not event-platform integrated. |

### Target User
Hosts of gift-giving events: birthdays, weddings, baby showers, housewarmings. Currently these hosts share Amazon or Target registry links separately from the RSVP. Guests must navigate to multiple sites, and the host has no visibility into what has been claimed until the gift arrives. Evite users who rely on the in-app registry aggregator.

## Technical Context

### Where This Lives in MyLife

```
modules/rsvp/src/db/schema.ts                  -- V3: rv_registry_items table
modules/rsvp/src/definition.ts                 -- Add to RSVP_MIGRATION_V3
modules/rsvp/src/types.ts                      -- RegistryItem, RegistryCategory types
modules/rsvp/src/db/crud.ts                    -- Registry CRUD operations
modules/rsvp/src/index.ts                      -- Re-export registry API
modules/rsvp/src/__tests__/registry.test.ts    -- Registry CRUD tests
apps/mobile/app/(rsvp)/registry.tsx            -- Mobile registry screen
apps/web/app/rsvp/[eventId]/registry/page.tsx  -- Web registry page
```

### Wireframe Position

```
Hub Dashboard
  └── MyRSVP card
       └── Events tab
            └── Event Detail
                 └── "Registry" button ← YOU ARE HERE
```

### Data Model

```sql
-- V3 Migration: Add gift registry

CREATE TABLE IF NOT EXISTS rv_registry_items (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES rv_events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'other',
    url TEXT,
    price_cents INTEGER,
    quantity_wanted INTEGER NOT NULL DEFAULT 1,
    quantity_claimed INTEGER NOT NULL DEFAULT 0,
    claimed_by_name TEXT,
    claimed_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS rv_registry_items_event_idx ON rv_registry_items(event_id);
CREATE INDEX IF NOT EXISTS rv_registry_items_category_idx ON rv_registry_items(event_id, category);
```

**Design:** Items are manually added by the host (no API integration with Amazon/Target in v1). External registry links remain available via `rv_event_links` with `type='registry'`. The registry screen shows both local items and external registry links.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (list components, Cool Obsidian tokens)
- **External:** None. No external registry API integration in v1.
- **Cross-Module:** MyBudget -- when both modules enabled, claimed gifts could log as "received" in the budget module. Low priority, not required for this feature.

## Functional Requirements

### User Stories
1. As a host, I want to create a gift registry with items guests can claim so I get what I need.
2. As a host, I want to categorize registry items (kitchen, clothing, experiences, etc.) for easy browsing.
3. As a guest, I want to browse the registry and claim items so the host knows what I am bringing.
4. As a host, I want to add external registry links (Amazon, Target) alongside local items.
5. As a guest, I want to see which items have been claimed so I do not duplicate gifts.

### Behavior Specification

**Host creates registry:**
1. Host opens event detail and taps "Registry"
2. If no items exist, shows empty state with "Add your first item" CTA
3. Host taps "Add Item"
4. Form fields: Name (required), Description (optional), Category (dropdown), URL (optional external link), Price (optional), Quantity (default 1)
5. Categories: Kitchen, Clothing, Experiences, Home, Baby, Electronics, Books, Other
6. Host saves item -> stored in rv_registry_items
7. Host can reorder items via drag handle (updates sort_order)
8. Host can also add external registry links (e.g., "Amazon Registry") using existing rv_event_links

**Guest views registry:**
1. Guest opens event detail and taps "Registry"
2. Registry screen shows items grouped by category
3. Each item card shows: name, description (if set), price (if set), claimed/available status
4. Claimed items show "Claimed by [name]" and are visually dimmed
5. Available items show "Claim" button
6. External registry links shown in a separate "External Registries" section at the bottom

**Guest claims item:**
1. Guest taps "Claim" on an available item
2. System prompts for confirmation: "Claim [item name]? Other guests will see you claimed this."
3. On confirm: quantity_claimed increments, claimed_by_name set to guest name, claimed_at set
4. Item card updates to show "Claimed by [your name]" with checkmark
5. If quantity_wanted > 1 and more are available, item remains claimable by others

**Guest unclaims item:**
1. Guest long-presses an item they claimed
2. "Unclaim" option appears
3. On confirm: quantity_claimed decrements, claimed_by_name cleared (if quantity drops to 0)

**Host manages registry:**
1. Host can edit any item (name, description, price, category, quantity)
2. Host can delete items (claimed or unclaimed)
3. Host can see who claimed each item
4. Host can manually mark items as claimed (for gifts received outside the app)

### Edge Cases
- **Guest tries to claim already-claimed item (quantity=1):** Button disabled, shows "Claimed by [name]"
- **Item with quantity > 1:** Show "X of Y claimed". Claim button available until all claimed.
- **Guest not RSVP'd tries to claim:** Show "RSVP first to claim registry items"
- **Price is $0 or not set:** Price field hidden on item card. "Priceless" is not shown -- just omitted.
- **Very long item name (>200 chars):** Truncate display to 2 lines with ellipsis
- **External URL is not a valid URL:** Show the link text but make it non-clickable. Validate format on save.
- **Host deletes claimed item:** Claimed data is lost. No notification to the claimer.
- **Event deleted:** CASCADE deletes all registry items.
- **Registry with 50+ items:** No pagination needed. Single scrollable list grouped by category.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Host can add registry items with name, description, category, URL, price, quantity
- [ ] **AC-2:** Items displayed grouped by category (8 categories)
- [ ] **AC-3:** Guest can claim available items with confirmation prompt
- [ ] **AC-4:** Claimed items show claimer name and are visually dimmed
- [ ] **AC-5:** Guest can unclaim items they previously claimed
- [ ] **AC-6:** Host can edit, delete, and reorder registry items
- [ ] **AC-7:** External registry links displayed in separate section
- [ ] **AC-8:** Items with quantity > 1 show "X of Y claimed" progress
- [ ] **AC-9:** Non-RSVP'd guests see read-only registry with RSVP CTA

### Technical Criteria
- [ ] **TC-1:** V3 migration creates rv_registry_items table with correct indexes
- [ ] **TC-2:** quantity_claimed never exceeds quantity_wanted
- [ ] **TC-3:** claimed_by_name and claimed_at set atomically on claim
- [ ] **TC-4:** sort_order supports drag-to-reorder
- [ ] **TC-5:** CASCADE delete removes all items when event is deleted
- [ ] **TC-6:** Price stored in cents (INTEGER) to avoid floating-point issues

### Negative Criteria
- [ ] **NC-1:** Guests must NOT edit or delete other guests' claims
- [ ] **NC-2:** Guests must NOT see other guests' claimed-by names if the host disables this (future setting)
- [ ] **NC-3:** Registry must NOT require network access (local SQLite)
- [ ] **NC-4:** Claiming an item must NOT affect RSVP status

## UI Specification

### Mobile (Expo)
- **Background:** `#0A0A0F`
- **Category headers:** `subheading` typography in `#F0F0F5` with divider line
- **Item card:** Glass card with `rgba(255,255,255,0.04)` fill. Left: item info (name, description, price). Right: "Claim" button or "Claimed" badge.
- **Claimed state:** Card opacity reduced to 0.5, "Claimed by [name]" in `rgba(240,240,245,0.65)`, green checkmark
- **"Claim" button:** Module accent `#FB7185` background, white text
- **Price display:** `$XX.XX` in `textSecondary` color, right-aligned
- **External registry links:** Glass cards with external link icon, opens in browser
- **Add Item FAB:** Bottom-right, `#FB7185` circle with "+" icon

### Web (Next.js)
- Accessible at `/rsvp/[eventId]/registry`
- 2-column layout: items left, external links right sidebar
- Same glass card tokens via CSS variables

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty | "No registry items yet" with "Add your first item" CTA (host) | No items exist |
| Guest Empty | "No registry set up for this event" | No items, guest view |
| Has Items | Category-grouped item list with claim buttons | Items exist |
| Fully Claimed | All items dimmed with "All items claimed!" banner | All quantities claimed |
| Read-Only | Registry visible but claim buttons disabled, RSVP CTA | Guest not RSVP'd |

## Test Requirements

### Unit Tests
- [ ] `createRegistryItem`: stores item with correct fields
- [ ] `getRegistryItemsByEvent`: returns items ordered by sort_order
- [ ] `getRegistryItemsByEvent`: groups by category correctly
- [ ] `claimRegistryItem`: increments quantity_claimed and sets claimed_by
- [ ] `claimRegistryItem`: rejects claim when quantity_claimed >= quantity_wanted
- [ ] `unclaimRegistryItem`: decrements quantity_claimed and clears claimed_by
- [ ] `unclaimRegistryItem`: does not decrement below 0
- [ ] `updateRegistryItem`: updates item fields correctly
- [ ] `deleteRegistryItem`: removes item
- [ ] `reorderRegistryItems`: updates sort_order for affected items

### Integration Tests
- [ ] Create 3 items in different categories -> verify grouped query
- [ ] Claim item with quantity=1 -> verify fully claimed
- [ ] Claim item with quantity=3 twice -> verify 2 of 3 claimed
- [ ] Unclaim item -> verify quantity restored
- [ ] Delete event -> verify all items CASCADE deleted
- [ ] V3 migration runs cleanly on existing V2 database

### QA Verification Script

1. Open MyRSVP, navigate to a birthday event
2. Tap "Registry"
3. **Verify:** Empty state with "Add your first item" CTA
4. Add item: "Stand Mixer", Kitchen, $299.99, quantity 1
5. Add item: "Cooking Class", Experiences, $75.00, quantity 2
6. Add item: "Donation to Charity", Other, no price, quantity 1
7. **Verify:** Items grouped by Kitchen, Experiences, Other -- AC-2
8. Switch to guest view, open registry
9. Tap "Claim" on "Stand Mixer"
10. **Verify:** Confirmation prompt appears -- AC-3
11. Confirm claim
12. **Verify:** Item shows "Claimed by [your name]", dimmed -- AC-4
13. Tap "Claim" on "Cooking Class"
14. **Verify:** Shows "1 of 2 claimed" -- AC-8
15. Long-press "Stand Mixer", tap "Unclaim"
16. **Verify:** Item is available again -- AC-5
17. Switch to host view
18. Edit "Cooking Class" price to $80.00
19. **Verify:** Price updates -- AC-6
20. Open as a non-RSVP'd user
21. **Verify:** Registry visible but claim buttons disabled -- AC-9

## gstack Quality Gates

Based on Complexity Inverse score of 1 (Complex):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required for Complex features (Complexity <= 1):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Required if this feature has UI:
- [ ] `/browse` -- navigate to registry, add items, test claim flow

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- rv_event_links with type='registry' supports external registry URLs
- No structured gift registry with individual items
- No claim tracking -- hosts have no visibility into what guests plan to bring
- No rv_registry_items table

### After This Work
- V3 migration adds rv_registry_items table with indexes
- Full CRUD: createRegistryItem, getRegistryItemsByEvent, updateRegistryItem, deleteRegistryItem, claimRegistryItem, unclaimRegistryItem, reorderRegistryItems
- 8 predefined categories as static constant
- Registry screen on mobile and web with category grouping
- Claim/unclaim flow with quantity tracking
- External registry links section (uses existing rv_event_links)
- 10+ unit tests, 6+ integration tests

### Files Changed
- `modules/rsvp/src/db/schema.ts` -- V3 migration: rv_registry_items table
- `modules/rsvp/src/definition.ts` -- Add to RSVP_MIGRATION_V3
- `modules/rsvp/src/types.ts` -- RegistryItem, RegistryCategory types
- `modules/rsvp/src/db/crud.ts` -- Registry CRUD and claim operations
- `modules/rsvp/src/index.ts` -- Re-export registry API
- `modules/rsvp/src/__tests__/registry.test.ts` -- Registry CRUD and claim tests
- `apps/mobile/app/(rsvp)/registry.tsx` -- Mobile registry screen
- `apps/web/app/rsvp/[eventId]/registry/page.tsx` -- Web registry page

### Known Limitations
- No API integration with Amazon, Target, or other retailers (items are manually added)
- No image for registry items (text-only in v1)
- No price tracking or comparison across retailers
- No "purchased" confirmation (only "claimed" intent tracking)
- No anonymous claiming (claimer name is always visible to host)
- No gift card or cash gift support
- External registry links open in browser, not embedded

### Context for Next Agent
- V3 migration is shared with recurring events, map/directions, custom designs, and messaging. Combine all V3 DDL into a single migration.
- `quantity_wanted` defaults to 1. `quantity_claimed` starts at 0. When `quantity_claimed >= quantity_wanted`, the item is fully claimed. The `claimed_by_name` field stores the most recent claimer's name. For multi-quantity items, the claim history is not tracked per-unit (v1 limitation).
- Price is stored as `price_cents INTEGER` (nullable). Display: `(priceCents / 100).toFixed(2)`. Null price means no price shown.
- The `sort_order` field enables drag-to-reorder. When reordering, update sort_order for all affected items in a single transaction.
- External registry links use the existing `rv_event_links` table with `type='registry'`. Query them separately and display in a distinct section below the local items.
- The 8 categories are a static constant (not stored in DB): `['kitchen', 'clothing', 'experiences', 'home', 'baby', 'electronics', 'books', 'other']`. Each has a display label and icon.
