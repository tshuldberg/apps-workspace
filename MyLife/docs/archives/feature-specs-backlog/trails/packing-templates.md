# Feature Spec: Packing Templates

## Metadata
- **Module:** trails
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [4] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** 6
- **Estimated CC Time:** 1-2 hours (Complexity Inverse = 4, "Small")
- **Depends On:** none (standalone feature, reads trail metadata for smart suggestions)
- **Blocks:** Trip itinerary (packing lists can be attached to trip days)

## Business Context

### Why This Feature Exists
Forgetting essential gear on a hike is a common source of frustration and potential danger. AllTrails added a packing list feature to their premium tier, providing pre-built templates for different hike types (day hike, overnight backpacking, winter hike) that users customize before each trip. The feature drives engagement (users open the app the night before a hike to review their list) and adds a practical utility that extends the app beyond just recording. For MyTrails, packing templates turn the module from a "recording tool you use on the trail" into a "trip companion you use before, during, and after the trail."

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| AllTrails | Yes | Yes ($26.99-53.99/yr) | Curated packing lists by hike type. Users can check items off. Premium feature. |
| Komoot | No | N/A | No packing feature. Users use external apps (notes, Lighterpack). |
| Gaia GPS | No | N/A | No packing feature. Backcountry-focused but no gear management. |
| Lighterpack | Yes | Free (basic) | Dedicated gear list app with weight tracking. $7/yr for full features. No trail integration. |

### Target User
Weekend hikers (25-55) who pack the night before a hike and frequently forget items (headlamp, first aid kit, extra water). Backpackers planning multi-day trips who need a comprehensive checklist. Users new to hiking who don't know what to bring and benefit from curated templates. Families hiking with kids who have additional gear needs.

## Technical Context

### Where This Lives in MyLife

```
modules/trails/src/
  types.ts                      -- New PackingTemplate, PackingItem, PackingList schemas
  db/schema.ts                  -- New tr_packing_templates, tr_packing_items tables (migration V6)
  db/crud.ts                    -- CRUD for templates and items
  packing/
    default-templates.ts        -- NEW: built-in templates (day hike, overnight, winter, etc.)
  definition.ts                 -- Add V6 migration, bump schemaVersion
  index.ts                      -- Export new packing functions and types

apps/mobile/app/(trails)/
  packing.tsx                   -- NEW: packing list management screen
  packing-checklist.tsx         -- NEW: active checklist with check-off

apps/web/app/trails/
  page.tsx                      -- Updated: packing section
```

### Wireframe Position

```
Hub Dashboard
  └── MyTrails card
       └── Settings tab
            └── Packing Lists ← template browser + custom list creation
       └── Trail Detail
            └── "Pack for This Trail" ← create a checklist from template, smart-filtered
```

### Data Model

```sql
-- Migration V6: Packing templates and items
CREATE TABLE IF NOT EXISTS tr_packing_templates (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('day_hike', 'overnight', 'backpacking', 'winter', 'trail_run', 'custom')),
  is_built_in INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tr_packing_items (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES tr_packing_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'essentials',
  is_checked INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tr_packing_items_template ON tr_packing_items(template_id);
CREATE INDEX IF NOT EXISTS idx_tr_packing_items_category ON tr_packing_items(template_id, category);
```

### Dependencies
- **Internal:** `@mylife/trails` (trail data for smart suggestions), `@mylife/db` (DatabaseAdapter)
- **External:** None. Static templates + local CRUD.
- **Cross-Module:** None (score: 1).

## Functional Requirements

### User Stories
1. As a day hiker, I want a pre-built packing list for day hikes so that I don't forget essentials like water, sunscreen, and a first aid kit.
2. As a backpacker, I want an overnight template with tent, sleeping bag, and cooking gear so that I can start from a comprehensive base and customize.
3. As a user preparing for a specific trail, I want the app to suggest packing additions based on the trail's difficulty and conditions (e.g., add trekking poles for hard trails, headlamp for long trails).
4. As a user, I want to check items off my list as I pack so that I can visually confirm everything is ready.
5. As a repeat hiker, I want to save my customized list as a personal template so that I can reuse it for similar trips.

### Behavior Specification

**Browsing templates:**
1. User navigates to Settings > Packing Lists
2. System shows built-in templates: Day Hike, Overnight, Backpacking, Winter Hike, Trail Run
3. Each template shows item count and category summary
4. User can also see their custom templates

**Creating a packing list from template:**
1. User selects a template (or taps "Pack for This Trail" on trail detail)
2. System creates a copy of the template items as a new active list
3. If triggered from trail detail, smart suggestions are added:
   - Hard/Expert trails: add "Trekking poles" if not in template
   - Estimated >4 hours: add "Headlamp" and "Extra water"
   - Winter region or cold weather: add "Extra layers" and "Hand warmers"
4. User can add/remove items before starting to pack
5. Items are organized by category (Essentials, Clothing, Food & Water, Navigation, Safety, Shelter)

**Checking off items:**
1. User opens an active packing list
2. Taps items to check them off (strikethrough + checkmark)
3. Progress shown: "8 of 12 items packed"
4. Checked state persists across app restarts

**Saving as custom template:**
1. After customizing a list, user can tap "Save as Template"
2. User names their template
3. Template saved with `type = 'custom'` and available for future use

### Edge Cases

- **Duplicate item names:** Allow duplicate names across categories (e.g., "Water" in Food & Water and "Water purification" in Safety) but warn if exact duplicate in same category.
- **Empty template:** A template with 0 items is valid (user can add items from scratch).
- **Deleting a built-in template:** Built-in templates cannot be deleted. Only custom templates can be deleted.
- **Very long list:** No practical limit on items. Lists with 50+ items should still scroll smoothly.
- **Module disabled while packing:** Packing list state persists in SQLite. Re-enabling the module restores the list.
- **Resetting a checked list:** "Uncheck All" button resets all items to unchecked for reuse on the next trip.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can browse 5+ built-in packing templates with item counts
- [ ] **AC-2:** User can create a packing list from a template with all items copied
- [ ] **AC-3:** User can check off items and see progress ("8 of 12 packed")
- [ ] **AC-4:** Checked items show strikethrough and persist across app restarts
- [ ] **AC-5:** User can add custom items to any packing list
- [ ] **AC-6:** User can remove items from a packing list
- [ ] **AC-7:** "Pack for This Trail" on trail detail creates a list with smart suggestions based on trail difficulty and duration
- [ ] **AC-8:** User can save a customized list as a reusable custom template
- [ ] **AC-9:** User can "Uncheck All" to reset a list for reuse
- [ ] **AC-10:** Built-in templates cannot be deleted

### Technical Criteria
- [ ] **TC-1:** `tr_packing_templates` and `tr_packing_items` tables are created by migration V6
- [ ] **TC-2:** Built-in templates are seeded on first access (not during migration)
- [ ] **TC-3:** Cascade delete: deleting a template removes all its items
- [ ] **TC-4:** Smart suggestions correctly add items based on trail difficulty and estimated duration

### Negative Criteria
- [ ] **NC-1:** Packing feature must NOT require network access
- [ ] **NC-2:** Built-in templates must NOT be deletable by the user
- [ ] **NC-3:** Checking off items must NOT modify the source template (works on a copy)

## UI Specification

### Mobile (Expo)

**Packing List Browser:**
- Background: `#0A0A0F`
- Section: "Built-in" (5 template cards) and "My Templates" (custom)
- Each card: glass background, template name, item count badge, type icon
- "New List" button: lime `#65A30D` accent

**Active Checklist:**
- Items grouped by category (collapsible sections)
- Each item: checkbox + name, tap to toggle
- Checked items: strikethrough text, dimmed opacity
- Progress bar at top: lime fill showing % packed
- "Add Item" button at bottom of each category
- "Save as Template" and "Uncheck All" in the action menu

### Web (Next.js)

- Packing section in trails settings area
- Template browser as a card grid
- Active checklist as a simple checkbox list with category headers

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty | "Create your first packing list" + template browser | No active lists |
| Loading | Skeleton cards | Initial template load |
| Browsing | Template cards with item counts | User in packing list browser |
| Active | Checklist with progress bar | User opened a packing list |
| Complete | "All packed!" banner with green checkmark | All items checked |

## Test Requirements

### Unit Tests
- [ ] `DEFAULT_TEMPLATES`: contains 5+ built-in templates with items
- [ ] Each built-in template has items in at least 3 categories
- [ ] `createPackingList(templateId)`: copies all items from template
- [ ] `checkItem(id)`: toggles is_checked to 1
- [ ] `uncheckItem(id)`: toggles is_checked to 0
- [ ] `uncheckAll(templateId)`: resets all items in list
- [ ] `addItem(templateId, name, category)`: adds item with correct sort order
- [ ] `removeItem(id)`: deletes item
- [ ] `getPackingProgress(templateId)`: returns correct checked/total counts
- [ ] `smartSuggestions(trail)`: adds trekking poles for hard trails
- [ ] `smartSuggestions(trail)`: adds headlamp for long trails (>4 hours)
- [ ] `saveAsTemplate(listId, name)`: creates custom template with items

### Integration Tests
- [ ] Full flow: select template -> create list -> check items -> verify progress
- [ ] Smart flow: "Pack for This Trail" on a hard trail -> verify extra items added
- [ ] Save flow: customize list -> save as template -> verify template appears in browser
- [ ] Reset flow: check all items -> "Uncheck All" -> verify all unchecked

### QA Verification Script
1. Open the app on iOS simulator
2. Navigate to Trails > Settings > Packing Lists
3. Verify: 5+ built-in templates shown with item counts -- corresponds to AC-1
4. Tap "Day Hike" template
5. Verify: list created with all day hike items, organized by category -- corresponds to AC-2
6. Check off 3 items
7. Verify: progress shows "3 of N packed" with strikethrough on checked items -- corresponds to AC-3
8. Close and reopen the app
9. Verify: checked items are still checked -- corresponds to AC-4
10. Add a custom item "Trail mix" to the list
11. Verify: item appears in the correct category -- corresponds to AC-5
12. Remove an item
13. Verify: item is gone from the list -- corresponds to AC-6
14. Navigate to a Hard difficulty trail, tap "Pack for This Trail"
15. Verify: list includes smart suggestions (trekking poles, etc.) -- corresponds to AC-7
16. Tap "Save as Template," name it "My Day Hike"
17. Verify: "My Day Hike" appears in the My Templates section -- corresponds to AC-8
18. Tap "Uncheck All"
19. Verify: all items are unchecked, progress resets -- corresponds to AC-9
20. Try to delete a built-in template
21. Verify: delete option is not available -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to packing list browser and checklist, verify all states

### Post-merge:
- [ ] `/parity-check` -- trails module parity
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Trails module focuses on recording and navigation
- No packing or gear management features
- No pre-trip planning utilities

### After This Work
- New V6 migration adds `tr_packing_templates` and `tr_packing_items` tables
- New `packing/default-templates.ts` with 5 built-in templates
- Packing list browser and checklist screens on mobile
- Smart suggestions based on trail difficulty and duration
- Custom template creation for reuse

### Files Changed
- `modules/trails/src/types.ts` -- New `PackingTemplate`, `PackingItem`, `PackingList` schemas
- `modules/trails/src/db/schema.ts` -- V6 migration SQL
- `modules/trails/src/db/crud.ts` -- CRUD for templates and items
- `modules/trails/src/packing/default-templates.ts` -- 5 built-in template definitions
- `modules/trails/src/definition.ts` -- Add V6 migration
- `modules/trails/src/index.ts` -- Export packing functions
- `apps/mobile/app/(trails)/packing.tsx` -- Template browser
- `apps/mobile/app/(trails)/packing-checklist.tsx` -- Active checklist
- `apps/web/app/trails/page.tsx` -- Packing section

### Known Limitations
- **No weight tracking:** Lighterpack ($7/yr) tracks gear weight for ultralight backpacking. V1 is a simple checklist without weight data. Weight tracking is a future enhancement.
- **No weather-based suggestions:** Smart suggestions use trail difficulty and estimated duration but not actual weather data. Integration with the weather overlay (V4) for weather-based suggestions is a future enhancement.
- **No photo attachment:** Users can't attach photos of gear items. Simple text-only items.

### Context for Next Agent
- Built-in templates should be seeded on first access (not during migration SQL). Use an `INSERT OR IGNORE` pattern in the CRUD layer when `getTemplates()` is called and no built-in templates exist.
- The "smart suggestions" feature reads trail data (difficulty, estimated_minutes) and adds items to the copied list. This is a pure function that returns additional items, not a modification to the template itself.
- Categories for items: "Essentials" (water, food, first aid), "Clothing" (layers, rain gear), "Navigation" (map, compass, phone), "Safety" (whistle, headlamp), "Shelter" (tent, sleeping bag), "Comfort" (trekking poles, sit pad).
