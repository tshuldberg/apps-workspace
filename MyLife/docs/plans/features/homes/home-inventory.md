# Feature Spec: Home Inventory

## Metadata
- **Module:** homes
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [3] x2 + CrossModule [2] x1 + PaidUser [3] x1
- **Sprint:** 8
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Document storage (B-tier, Sprint 7)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The average US household owns $300,000+ in personal belongings, yet fewer than 5% have a documented home inventory. When disaster strikes (fire, flood, theft), homeowners scramble to recall what they owned and what it was worth. Insurance claims without documentation are commonly reduced by 30-50%. HomeZada ($59-99/yr) includes a home inventory feature as part of their premium tier, and standalone inventory apps like Sortly ($9-49/mo) exist in the market. By adding room-by-room inventory tracking to MyHomes, users get a complete home management solution: maintenance reminders tell them what to do, cost tracking tells them what they spent, document storage holds their paperwork, and inventory catalogs what they own. The document storage dependency enables linking warranty documents and manuals directly to inventory items.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| HomeZada | Yes | Yes ($59-99/yr) | Room-by-room inventory, photo uploads, value tracking, insurance report export, barcode scanning, cloud storage |
| Centriq | Partial | Yes ($32/yr) | Appliance-centric product catalog via barcode scan, warranty tracking, how-to guides. Not a full belongings inventory. |
| Sortly | Yes | Yes ($9-49/mo) | Dedicated inventory app with QR labels, folders, photo catalog, CSV/PDF export. Not home-specific. |
| Thumbtack | No | N/A | No inventory features |
| Angi | No | N/A | No inventory features |

### Target User
Homeowners (30-65) who want insurance-ready documentation of their belongings. Renters cataloging valuables for renter's insurance. Users who are moving and want to catalog items room by room. Families with high-value collections (art, electronics, jewelry, tools) who need a private, offline record. Users of Sortly ($9-49/mo) who want inventory tracking bundled into a hub subscription instead of paying for a standalone app. The privacy-first angle (all data on-device) is critical for users cataloging expensive items like jewelry, firearms, or art -- they do not want that data in the cloud.

## Technical Context

### Where This Lives in MyLife

```
modules/homes/src/
  types.ts                                  -- New Zod schemas: Room, RoomType, InventoryItem, ItemCategory, ItemCondition
  db/schema.ts                              -- New tables: hm_rooms, hm_inventory_items + indexes
  db/crud.ts                                -- New CRUD: room and item create/read/update/delete, value queries
  engines/inventory-engine.ts               -- NEW: getRoomSummary, getPropertyInventoryValue, getItemsByCategory, exportInventoryCSV, getHighValueItems
  definition.ts                             -- Migration v4 (or v5 depending on earlier migrations)
  __tests__/inventory-engine.test.ts        -- NEW: unit tests for inventory engine

apps/mobile/app/(homes)/
  inventory.tsx                             -- NEW: Room list screen (per property)
  room-detail.tsx                           -- NEW: Room detail with item grid
  add-room.tsx                              -- NEW: Add/Edit room form
  add-item.tsx                              -- NEW: Add/Edit inventory item form
  item-detail.tsx                           -- NEW: Inventory item detail view

apps/web/app/homes/
  inventory/page.tsx                        -- NEW: Home inventory web page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHomes card
       ├── Search tab (existing)
       ├── Saved tab (existing)
       ├── Properties tab (existing)
       │    └── Property Detail
       │         ├── Maintenance section (existing)
       │         ├── Documents section (existing, from document-storage)
       │         └── Inventory section ← NEW (YOU ARE HERE)
       │              ├── Room cards with item count and total value
       │              ├── "Add Room" button
       │              └── Property-wide value summary
       └── Reminders tab (existing)
```

Inventory is accessed from:
1. Property detail screen's "Inventory" section (primary entry point)
2. A standalone "Inventory" screen accessible from the property detail (full room browser)
3. Room detail screen for drilling into items per room

### Data Model

```sql
-- New table: hm_rooms (Migration v4 or v5)
CREATE TABLE IF NOT EXISTS hm_rooms (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                               -- "Master Bedroom", "Kitchen", etc.
    room_type TEXT NOT NULL DEFAULT 'other',           -- bedroom, bathroom, kitchen, living, dining, garage, basement, attic, office, outdoor, other
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- New table: hm_inventory_items (Migration v4 or v5)
CREATE TABLE IF NOT EXISTS hm_inventory_items (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL REFERENCES hm_rooms(id) ON DELETE CASCADE,
    property_id TEXT NOT NULL REFERENCES hm_properties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',            -- furniture, electronics, appliance, clothing, jewelry, art, tool, sporting, other
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    purchase_date TEXT,                                -- ISO date string, nullable
    purchase_price_cents INTEGER,                      -- original price paid, nullable
    estimated_value_cents INTEGER,                     -- current estimated value for insurance, nullable
    condition TEXT NOT NULL DEFAULT 'good',            -- new, good, fair, poor
    photo_uri TEXT,                                    -- local file path, nullable
    warranty_expiry TEXT,                              -- ISO date string, nullable
    document_id TEXT REFERENCES hm_documents(id) ON DELETE SET NULL,  -- optional link to warranty/manual doc
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS hm_rooms_property_idx
    ON hm_rooms(property_id);
CREATE INDEX IF NOT EXISTS hm_rooms_sort_idx
    ON hm_rooms(property_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS hm_items_room_idx
    ON hm_inventory_items(room_id);
CREATE INDEX IF NOT EXISTS hm_items_property_idx
    ON hm_inventory_items(property_id);
CREATE INDEX IF NOT EXISTS hm_items_category_idx
    ON hm_inventory_items(category);
CREATE INDEX IF NOT EXISTS hm_items_value_idx
    ON hm_inventory_items(estimated_value_cents DESC);
```

**room_type enum values:** `bedroom`, `bathroom`, `kitchen`, `living`, `dining`, `garage`, `basement`, `attic`, `office`, `outdoor`, `other`

**category enum values (items):** `furniture`, `electronics`, `appliance`, `clothing`, `jewelry`, `art`, `tool`, `sporting`, `other`

**condition enum values:** `new`, `good`, `fair`, `poor`

**document_id:** Optional FK to hm_documents. Links an inventory item to a warranty document, appliance manual, or receipt stored in the document storage feature. ON DELETE SET NULL preserves the item if the linked document is deleted.

**Dual FK pattern:** `hm_inventory_items` has both `room_id` and `property_id` FKs. The `property_id` is denormalized for efficient property-wide queries (total value, export) without joining through hm_rooms. Both use ON DELETE CASCADE.

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter for SQLite operations), `@mylife/ui` (Cool Obsidian tokens, glass card components), `@mylife/module-registry` (Migration type)
- **External:** `expo-image-picker` (item photo capture on mobile), `zod` (schema validation). No external APIs required.
- **Cross-Module:** Direct dependency on document storage (B-tier, Sprint 7) for the optional `document_id` FK. Items can reference warranty/manual documents stored in hm_documents. This is a soft dependency; inventory works without any documents linked.

## Functional Requirements

### User Stories
1. As a homeowner, I want to catalog my belongings room by room with photos, so I have a visual record of everything I own.
2. As a homeowner, I want to record the estimated value of each item, so I can determine my total insurable value per room and per property.
3. As a homeowner, I want to export my inventory as a CSV file, so I can submit it to my insurance company for a claim or policy review.
4. As a renter, I want to catalog my belongings for renter's insurance documentation, so I can prove what I own if something happens.
5. As a homeowner, I want to link warranty documents to inventory items, so I can find the warranty info for a broken appliance with one tap.
6. As a homeowner, I want to see my highest-value items across all rooms, so I know what to prioritize for insurance riders or special coverage.
7. As someone who is moving, I want to see all items per room, so I can plan packing and verify nothing was lost in the move.

### Behavior Specification

**Adding a room:**
1. User navigates to Property Detail > Inventory section.
2. User taps "Add Room".
3. Form shows: room name (required, e.g., "Master Bedroom"), room type selector (bedroom/bathroom/kitchen/living/dining/garage/basement/attic/office/outdoor/other).
4. User taps Save. Room record is created with sort_order set to the next available integer for this property.
5. Room card appears in the Inventory section.

**Viewing rooms:**
1. Property Detail > Inventory section shows room cards sorted by sort_order.
2. Each room card shows: room type icon, room name, item count, total estimated value (sum of estimated_value_cents for items in that room).
3. Below the room list: property-wide summary card showing total rooms, total items, and total estimated value across all rooms.

**Reordering rooms:**
1. User long-presses a room card to enter reorder mode.
2. Drag handles appear. User drags rooms to the desired order.
3. sort_order values are updated on drop.

**Adding an inventory item:**
1. User taps a room card to open Room Detail.
2. User taps "Add Item".
3. Form shows: name (required), category selector (furniture/electronics/appliance/clothing/jewelry/art/tool/sporting/other), brand (optional), model (optional), serial number (optional), purchase date (optional date picker), purchase price (optional numeric), estimated current value (optional numeric), condition selector (new/good/fair/poor), photo button (optional, camera or library), warranty expiry date (optional date picker), link document button (optional, shows documents for this property), notes (optional text area).
4. User fills in details and taps Save.
5. Item record is created. Item card appears in the room's item grid.

**Viewing room detail:**
1. Room detail screen shows the room name, type badge, and item grid.
2. Items displayed as a 2-column grid of cards.
3. Each card shows: photo thumbnail (or category icon placeholder), name, brand (if set), estimated value, condition badge.
4. Category filter chips allow filtering items within the room.
5. Sort options: by name (A-Z), by value (high to low), by date added (newest first).

**Viewing item detail:**
1. User taps an item card.
2. Detail screen shows: large photo (or placeholder), name, category badge, brand, model, serial number, purchase date, purchase price (formatted), estimated value (formatted), condition badge, warranty expiry with status (active/expired/none), linked document (tappable to view), notes.
3. Action buttons: "Edit", "Delete".

**Property inventory value summary:**
1. Shown at the bottom of the Inventory section on property detail.
2. Displays: total rooms, total items, total estimated value.
3. Category breakdown: total value per item category (electronics: $12,500, furniture: $8,200, etc.).
4. Tappable to navigate to a full property inventory view.

**Exporting inventory as CSV:**
1. User taps "Export" button on the property inventory summary.
2. System generates a CSV file with columns: Room, Item Name, Category, Brand, Model, Serial Number, Purchase Date, Purchase Price, Estimated Value, Condition, Warranty Expiry, Notes.
3. System presents the share sheet with the CSV file attached.
4. File name: `{property_name}-inventory-{YYYY-MM-DD}.csv`.

**High-value items view:**
1. Accessible from the property inventory summary by tapping "High-Value Items".
2. Shows all items across all rooms with estimated_value_cents above a threshold (default: $500 / 50000 cents).
3. Sorted by estimated value descending.
4. Useful for identifying items that need insurance riders or special coverage.

### Edge Cases

- **No rooms exist:** Inventory section shows empty state "Add rooms to start cataloging your belongings" with "Add Room" CTA.
- **Room with no items:** Room detail shows "No items yet" with "Add Item" CTA.
- **Item with no value:** estimated_value_cents is nullable. Items without values are excluded from total calculations. A note appears: "Some items have no estimated value and are not included in the total."
- **Item with no photo:** Display a category-specific placeholder icon (e.g., TV icon for electronics, couch for furniture).
- **Photo file deleted outside the app:** Display placeholder. Do not crash.
- **Deleting a room:** CASCADE deletes all items in that room. Confirmation dialog: "Delete this room and all N items? This cannot be undone."
- **Deleting a property:** CASCADE deletes all rooms and all items. Property deletion confirmation already warns about this.
- **Deleting a linked document:** The item's document_id is SET NULL. Item is preserved. Linked document section shows "Document removed."
- **Very large inventory (500+ items across 20+ rooms):** Room list and item grids use virtualized lists (FlatList on mobile). Property-wide queries use indexed columns.
- **CSV export with special characters:** Item names and notes containing commas or quotes are properly escaped in CSV output (RFC 4180 compliant).
- **Duplicate item names in the same room:** Allowed. Users may have two "Desk Lamp" items.
- **Duplicate room names for the same property:** Allowed but discouraged. No validation prevents "Bedroom" and "Bedroom" as separate rooms.
- **Condition change over time:** Users manually update condition. No automatic degradation.
- **Purchase price vs estimated value:** These are independent fields. Purchase price is historical (what you paid). Estimated value is current (what it's worth now for insurance). Both are optional.
- **Reordering rooms with only 1 room:** Reorder mode activates but has no practical effect. No error.
- **Module disabled mid-use:** Data preserved. Re-enabling restores all rooms and items.
- **Zero dollar value items:** Allowed. Some items (gifts, inherited items) have no purchase price but may have estimated value, or vice versa.

## Acceptance Criteria

**These are the definitive checks that prove this feature works. A QA tester will verify each one. Every criterion must be independently testable.**

### User Experience Criteria
- [ ] **AC-1:** Adding a room with name "Living Room" and type "living" creates a room card visible in the Inventory section with 0 items and $0 value.
- [ ] **AC-2:** Adding an item "Samsung TV" to "Living Room" with category "electronics", estimated value $1,200, and a photo creates an item card visible in the room detail grid.
- [ ] **AC-3:** The room card updates to show 1 item and $1,200 total value after adding the item.
- [ ] **AC-4:** The property inventory summary shows the correct total rooms, items, and estimated value.
- [ ] **AC-5:** Tapping an item card opens the detail view showing all fields including photo, category, brand, value, and condition.
- [ ] **AC-6:** Editing an item's estimated value updates the room card total and property summary immediately.
- [ ] **AC-7:** Deleting an item removes it from the room grid and updates all totals. Confirmation dialog shown first.
- [ ] **AC-8:** Deleting a room removes the room card and all its items. Confirmation dialog shows item count.
- [ ] **AC-9:** Room cards can be reordered via long-press drag. New order persists after navigating away and back.
- [ ] **AC-10:** Category filter chips on the room detail screen filter items correctly.
- [ ] **AC-11:** Sort options (name A-Z, value high-low, date newest-first) reorder the item grid correctly.
- [ ] **AC-12:** Exporting inventory generates a CSV file with correct columns and data, and opens the share sheet.
- [ ] **AC-13:** The high-value items view shows all items with estimated value above $500, sorted by value descending.
- [ ] **AC-14:** Linking a document from document storage to an inventory item makes it accessible from the item detail screen.
- [ ] **AC-15:** Items without photos display a category-appropriate placeholder icon.
- [ ] **AC-16:** Items without estimated values show "No value set" and are excluded from totals with an explanatory note.

### Technical Criteria
- [ ] **TC-1:** Schema migration creates hm_rooms and hm_inventory_items tables with all columns, indexes, and correct hm_ prefix.
- [ ] **TC-2:** `getRoomSummary(db, propertyId)` returns rooms with item count and total value per room.
- [ ] **TC-3:** `getPropertyInventoryValue(db, propertyId)` returns the sum of estimated_value_cents for all items across all rooms for the property.
- [ ] **TC-4:** `getItemsByCategory(db, propertyId, category)` returns all items matching the given category across all rooms.
- [ ] **TC-5:** `exportInventoryCSV(db, propertyId)` generates RFC 4180-compliant CSV with correct headers and escaped values.
- [ ] **TC-6:** `getHighValueItems(db, propertyId, thresholdCents)` returns items with estimated_value_cents >= threshold, sorted descending.
- [ ] **TC-7:** Zod validation requires name (min 1) for both rooms and items.
- [ ] **TC-8:** Zod validation restricts room_type to the 11 allowed values.
- [ ] **TC-9:** Zod validation restricts item category to the 9 allowed values.
- [ ] **TC-10:** Zod validation restricts condition to the 4 allowed values (new, good, fair, poor).
- [ ] **TC-11:** Zod validation accepts null for optional fields (purchase_price_cents, estimated_value_cents, photo_uri, document_id, warranty_expiry, brand, model, serial_number).
- [ ] **TC-12:** Deleting a room CASCADE-deletes all items in that room.
- [ ] **TC-13:** Deleting a property CASCADE-deletes all rooms and items.
- [ ] **TC-14:** Deleting a linked document SET NULLs the document_id on items (items preserved).
- [ ] **TC-15:** Room and item CRUD operations (create, read, update, delete) persist correctly in SQLite.
- [ ] **TC-16:** Room reorder updates sort_order values correctly for all affected rooms.
- [ ] **TC-17:** `getPropertyInventoryValue` excludes items with null estimated_value_cents.
- [ ] **TC-18:** Property-wide inventory queries (value sum, item count) for 500+ items complete in < 300ms.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Inventory data must NOT be uploaded to any server. All storage is on-device.
- [ ] **NC-2:** Adding or editing rooms/items must NOT affect hm_properties, hm_documents, hm_maintenance_schedules, or hm_listings records.
- [ ] **NC-3:** Deleting an inventory item must NOT delete the linked document (only clears the reference).
- [ ] **NC-4:** Items without estimated values must NOT be counted as $0 in totals. They must be excluded entirely.
- [ ] **NC-5:** CSV export must NOT include file URIs (photo_uri, document paths). Only human-readable data.

## UI Specification

### Mobile (Expo)

**Inventory Section (within Property Detail):**
- Background: `#0A0A0F` (background token)
- Section header: "Inventory" with item count badge, amber accent `#D97706`
- Room cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
  - Card layout: Room type icon (left, amber) | Room name + item count (center) | Total value (right, bold, text token)
  - Long-press activates drag reorder mode
- Property summary card at bottom: `rgba(255,255,255,0.08)` (glassStrong token)
  - Layout: "Total Inventory" title, 3 stat pills: N rooms, N items, $XX,XXX total value
  - "Export CSV" and "High-Value Items" buttons below stats
- "Add Room" button: accent color outline, glass background

**Room Detail:**
- Background: `#0A0A0F`
- Room name and type badge at top (large, accent-colored type icon)
- Category filter chips: horizontal scroll, selected chip uses `#D97706` fill
- Sort selector: dropdown (Name A-Z, Value High-Low, Newest First)
- Item grid: 2-column layout
  - Each card: glass token fill, glassBorder border
  - Photo thumbnail (or category placeholder icon), 1:1 aspect ratio
  - Below: item name (1 line, text token), brand (textSecondary, if set), estimated value (accent color, bold), condition badge (small, colored: new=green, good=blue, fair=amber, poor=red)
- "Add Item" FAB: circular, `#D97706` background, white plus icon

**Add/Edit Item Form:**
- Background: `#0A0A0F`
- Photo area at top: large dashed-border glass card, camera icon, "Add Photo" text. If photo exists, shows preview with "Change" button.
- Form fields below: name (text), category (dropdown), brand (text), model (text), serial number (text), purchase date (date picker), purchase price (numeric with dollar sign), estimated value (numeric with dollar sign), condition (segmented: New/Good/Fair/Poor), warranty expiry (date picker), link document (picker showing property documents), notes (text area)
- Save button: full-width, `#D97706` background, white text

**Item Detail:**
- Large photo at top (full-width, tappable for zoom) or category placeholder
- Name prominently displayed (24pt, text token)
- Category badge and condition badge inline
- Info rows: brand, model, serial number, purchase date, purchase price, estimated value (each label in textSecondary, value in text token)
- Warranty section: expiry date with status badge (Active: green, Expired: red, None: gray)
- Linked document card (if set): glass card with document thumbnail, title, tappable to view
- "Edit" and "Delete" buttons at bottom

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Inventory accessible at `/homes/properties/[id]/inventory` route
- Room list as a vertical card list on the left, item grid on the right (master-detail layout)
- Category filter and sort controls in the header area
- Item detail opens as a side panel
- CSV export triggers browser download
- Room reorder via drag handles (HTML5 Drag and Drop API)
- "Add Room" and "Add Item" buttons in header
- File upload for item photos via drag-and-drop or file input

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton room cards (3) with pulsing animation | Initial data fetch from SQLite |
| Empty (no rooms) | Centered room icon, "Add rooms to start cataloging your belongings" + "Add Room" CTA | No rooms for this property |
| Empty (room, no items) | Room detail with "No items yet" + "Add Item" CTA | Room exists but has no items |
| Error | "Something went wrong loading inventory" + retry button | SQLite read failure |
| Success | Room cards with item counts and values, property summary at bottom | Data loaded |
| Partial | Some room cards loaded, others still calculating values (showing spinner in value position) | Large inventory, staggered aggregation |

## Test Requirements

### Unit Tests (modules/homes/src/__tests__/inventory-engine.test.ts)
- [ ] `getRoomSummary`: returns rooms with correct item count and total value
- [ ] `getRoomSummary`: returns empty array when no rooms exist for property
- [ ] `getRoomSummary`: excludes items with null estimated_value_cents from value total
- [ ] `getPropertyInventoryValue`: returns sum of all estimated_value_cents across rooms
- [ ] `getPropertyInventoryValue`: returns 0 when no items have estimated values
- [ ] `getPropertyInventoryValue`: excludes null estimated_value_cents items
- [ ] `getItemsByCategory`: returns only items matching the given category
- [ ] `getItemsByCategory`: returns empty array when no items match
- [ ] `getItemsByCategory`: works across all rooms for the property
- [ ] `exportInventoryCSV`: generates correct headers
- [ ] `exportInventoryCSV`: includes room name, item name, category, brand, model, serial number, purchase date, purchase price, estimated value, condition, warranty expiry, notes
- [ ] `exportInventoryCSV`: properly escapes commas and quotes in field values (RFC 4180)
- [ ] `exportInventoryCSV`: formats price values as dollars (not cents) in the CSV
- [ ] `exportInventoryCSV`: handles null/undefined fields as empty strings
- [ ] `exportInventoryCSV`: does NOT include photo_uri or document_id columns
- [ ] `getHighValueItems`: returns items with estimated_value_cents >= threshold
- [ ] `getHighValueItems`: returns empty array when no items meet threshold
- [ ] `getHighValueItems`: sorts by estimated_value_cents descending
- [ ] `getHighValueItems`: excludes items with null estimated_value_cents
- [ ] Zod validation: accepts valid RoomSchema with required fields
- [ ] Zod validation: accepts valid InventoryItemSchema with all fields populated
- [ ] Zod validation: accepts InventoryItemSchema with optional fields as null
- [ ] Zod validation: rejects room with empty name
- [ ] Zod validation: rejects item with invalid category
- [ ] Zod validation: rejects item with invalid condition
- [ ] Zod validation: rejects item with negative purchase_price_cents
- [ ] Zod validation: rejects item with negative estimated_value_cents

### Integration Tests
- [ ] Full flow: create room, add 3 items with values, verify room summary shows correct count and total
- [ ] Full flow: add items across 2 rooms, verify property-wide value is the sum of both rooms
- [ ] Full flow: edit item estimated value, verify room and property totals update
- [ ] Full flow: delete item, verify room count and value update
- [ ] Full flow: delete room with items, verify all items CASCADE-deleted
- [ ] Full flow: delete property, verify all rooms and items CASCADE-deleted
- [ ] Full flow: export CSV, verify file content matches expected format and data
- [ ] Full flow: link document to item, verify document accessible from item detail
- [ ] Full flow: delete linked document, verify item preserved with document_id set to NULL
- [ ] Full flow: reorder rooms, verify sort_order persists after re-fetch
- [ ] Error flow: create item with invalid data (empty name), validation error returned, no record persisted

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyHomes > Properties tab. Select an existing property. Scroll to "Inventory" section. -- Setup.
3. Verify empty state with "Add rooms to start cataloging..." message and "Add Room" CTA. -- Verifies empty state.
4. Tap "Add Room". Enter name "Living Room", type "living". Save. -- Room creation.
5. Verify room card appears showing "Living Room", 0 items, $0 value. -- Corresponds to AC-1.
6. Tap the "Living Room" card. Verify empty room detail with "No items yet" and "Add Item" CTA. -- Empty room state.
7. Tap "Add Item". Fill in: name "Samsung 65\" TV", category "electronics", brand "Samsung", model "QN65Q80B", serial number "SN12345", purchase date 6 months ago, purchase price $1,200, estimated value $900, condition "good", take a photo. Save. -- Corresponds to AC-2.
8. Verify item card appears in room grid with photo, name, brand, $900 value, "good" badge. -- Corresponds to AC-2.
9. Go back to property detail. Verify "Living Room" card now shows 1 item, $900 total value. -- Corresponds to AC-3.
10. Verify property inventory summary shows 1 room, 1 item, $900 total value. -- Corresponds to AC-4.
11. Add 2 more items to Living Room: "Sofa" (furniture, $2,500 value) and "Floor Lamp" (furniture, no value set). -- Additional items.
12. Verify room card shows 3 items, $3,400 value (TV $900 + Sofa $2,500; lamp excluded). Verify note about items without values. -- Corresponds to AC-16.
13. Add a second room "Kitchen" with 2 items: "Refrigerator" (appliance, $1,800) and "Toaster" (appliance, $50). -- Multi-room setup.
14. Verify property summary: 2 rooms, 5 items, $5,250 total. -- Corresponds to AC-4.
15. Tap the TV item. Verify detail view shows all fields (photo, brand, model, serial, dates, values, condition). -- Corresponds to AC-5.
16. Tap "Edit". Change estimated value to $800. Save. Verify room card updates to $3,300 and property total updates to $5,150. -- Corresponds to AC-6.
17. Tap the Floor Lamp item. Tap "Delete". Confirm. Verify lamp removed, item count drops to 2 in room card. -- Corresponds to AC-7.
18. Long-press on room cards. Drag "Kitchen" above "Living Room". Release. Navigate away and back. Verify Kitchen appears first. -- Corresponds to AC-9.
19. In Living Room detail, tap "electronics" filter chip. Verify only the TV shows. -- Corresponds to AC-10.
20. Select sort "Value High-Low". Verify Sofa ($2,500) appears before TV ($800). -- Corresponds to AC-11.
21. Tap "Export CSV" on property summary. Verify CSV file generated with correct data. Verify share sheet opens. -- Corresponds to AC-12.
22. Open the CSV. Verify columns: Room, Item Name, Category, Brand, Model, Serial Number, Purchase Date, Purchase Price, Estimated Value, Condition, Warranty Expiry, Notes. Verify no file URIs in the CSV. -- Corresponds to AC-12, NC-5.
23. Tap "High-Value Items" on property summary. Verify TV ($800), Sofa ($2,500), and Refrigerator ($1,800) appear. Toaster ($50) does NOT appear (below $500 threshold). -- Corresponds to AC-13.
24. Navigate to Documents section. Add a warranty document for the dishwasher. Return to inventory. Add item "Dishwasher", link the warranty document. Tap the item. Verify linked document is visible and tappable. -- Corresponds to AC-14.
25. Add an item without a photo. Verify category placeholder icon displays. -- Corresponds to AC-15.
26. Delete "Kitchen" room. Confirm when warned about 2 items. Verify Kitchen and its items are gone. Property summary updates. -- Corresponds to AC-8, TC-12.
27. Repeat key steps (4-10, 15-17, 21) on web at `/homes/properties/[id]/inventory`. Verify functional parity. -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to a property's Inventory section, click every button, verify all 5 states (loading, empty-no-rooms, empty-room-no-items, error, success)
- [ ] Batch QA: after 5 features in homes module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `inventory-engine.ts` (getRoomSummary, getPropertyInventoryValue, getItemsByCategory, exportInventoryCSV, getHighValueItems)

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- homes module has active standalone counterpart (MyHomes)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Homes module has tables for listings, tours, properties, maintenance schedules, settings, and possibly documents and cost entries (from earlier Sprint 7 features)
- No concept of room-based inventory or belongings cataloging
- No way to track the value of possessions or generate insurance documentation

### After This Work
- Homes module gains 2 new tables (hm_rooms, hm_inventory_items) with 6 new indexes
- Schema version incremented by 1
- Property detail screen gains an "Inventory" section with room cards, item grids, and property-wide value summary
- Full inventory lifecycle: create rooms, add items with photos and values, filter and sort, link warranty documents, export CSV for insurance, view high-value items
- `inventory-engine.ts` contains pure functions for room summaries, property value calculations, category queries, CSV export, and high-value item filtering
- CSV export generates insurance-ready documentation

### Files Changed

- `modules/homes/src/types.ts` -- Add RoomTypeSchema, RoomSchema, ItemCategorySchema, ItemConditionSchema, InventoryItemSchema Zod schemas and types
- `modules/homes/src/db/schema.ts` -- Add CREATE_ROOMS, CREATE_INVENTORY_ITEMS tables, 6 indexes
- `modules/homes/src/db/crud.ts` -- Add room CRUD (create, get, getByProperty, update, delete, reorder), item CRUD (create, get, getByRoom, getByProperty, getByCategory, update, delete), value aggregation queries
- `modules/homes/src/engines/inventory-engine.ts` -- NEW: getRoomSummary, getPropertyInventoryValue, getItemsByCategory, exportInventoryCSV, getHighValueItems
- `modules/homes/src/definition.ts` -- Add migration for new tables, update schemaVersion
- `modules/homes/src/index.ts` -- Re-export new types and engine functions
- `modules/homes/src/__tests__/inventory-engine.test.ts` -- NEW: 27+ unit tests for inventory engine
- `apps/mobile/app/(homes)/inventory.tsx` -- NEW: Room list screen
- `apps/mobile/app/(homes)/room-detail.tsx` -- NEW: Room detail with item grid
- `apps/mobile/app/(homes)/add-room.tsx` -- NEW: Add/Edit room form
- `apps/mobile/app/(homes)/add-item.tsx` -- NEW: Add/Edit inventory item form
- `apps/mobile/app/(homes)/item-detail.tsx` -- NEW: Item detail view
- `apps/web/app/homes/inventory/page.tsx` -- NEW: Home inventory web page

### Known Limitations
- No barcode/QR scanning for auto-populating item details (HomeZada and Sortly both offer this). Deferred to a future enhancement.
- No automatic depreciation calculation. Estimated value is manually set by the user.
- CSV export only. No PDF report generation. Insurance companies generally accept CSV, but PDF would be a nice-to-have.
- No multi-photo support per item. One photo per item for MVP.
- Photos stored on-device only. No cloud backup or cross-device sync.
- Room reorder uses a simple integer sort_order. No drag-across-properties support.
- No bulk import (e.g., importing from a spreadsheet). Items are added one at a time.
- No duplicate detection across rooms (user might catalog the same item in two rooms accidentally).

### Context for Next Agent
- The inventory engine should follow the same pure-function pattern as `reminder-engine.ts`, `cost-engine.ts`, and `document-engine.ts`. Functions take a DatabaseAdapter and return typed results.
- The `hm_inventory_items` table has a denormalized `property_id` FK alongside `room_id`. This is intentional for efficient property-wide queries. Both CASCADE on delete. When creating items, always set both FKs.
- The `document_id` FK on items references `hm_documents`. This creates a cross-table dependency within the homes module. The document storage feature (Sprint 7) must be complete before this feature can use the FK. If building without document storage, make document_id truly nullable and skip the FK constraint.
- CSV export should use a helper function that handles RFC 4180 escaping: wrap fields containing commas, quotes, or newlines in double quotes; escape internal double quotes by doubling them. Format cents as dollars (divide by 100, 2 decimal places).
- The condition badge colors (new=green, good=blue, fair=amber, poor=red) should use the existing Cool Obsidian danger/success tokens where applicable: success (#30D158) for new, a muted blue for good, the module accent (#D97706) for fair, and danger (#FF453A) for poor.
- Room reorder should update sort_order for all rooms in the property, not just the moved one. Use a batch update: renumber all rooms sequentially based on their new positions.
- Migration ordering depends on which Sprint 7 features have landed. Check the current schemaVersion in definition.ts before assigning the migration version number.
