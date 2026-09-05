# Feature Spec: Custom Container Presets

## Metadata
- **Module:** fast
- **Priority Score:** 25 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [1] x3 + Complexity [5] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** 2+
- **Estimated CC Time:** 1-2 hours
- **Depends On:** Water intake logging (FT-007, already implemented)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The current water intake system logs in abstract "glasses" (8oz increments). In reality, users drink from specific containers: a 32oz Nalgene, a 40oz Stanley tumbler, a 12oz office mug. Forcing users to mentally convert "I drank my Nalgene" to "that's 4 glasses" creates friction and inaccuracy. Container presets let users tap once to log their exact intake. This is a high-Complexity (5/5) feature because it's simple to build but removes a daily UX friction point that compounds over time. Simple (the fasting app) has container presets as a premium feature; MyFast offering it free is a differentiator.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Simple | Yes | Yes ($59.99/yr) | Custom containers with names and volumes, quick-tap logging |
| WaterMinder | Yes | Free | Extensive container library (30+ presets), custom containers, Apple Watch |
| Zero | No | N/A | Only counts glasses, no container concept |
| Fastic | No | N/A | No water tracking at all |
| Water Tracker | Yes | Free | Custom bottles with visual fill animation |

### Target User
Anyone who drinks from a consistent container (water bottle, mug, tumbler) and wants one-tap logging instead of counting glasses. Users of WaterMinder who would prefer combined fasting + hydration tracking. Fitness-oriented users who carry specific water bottles (Hydro Flask, Nalgene, Stanley) and want to log accurately.

## Technical Context

### Where This Lives in MyLife

```
modules/fast/src/types.ts                 -- ContainerPreset type
modules/fast/src/db/schema.ts             -- ft_container_presets table (V4 migration)
modules/fast/src/db/containers.ts         -- Container preset CRUD operations
modules/fast/src/definition.ts            -- V4 migration (shared with FT-014)
modules/fast/src/index.ts                 -- Export container functions
apps/mobile/app/(fast)/timer.tsx          -- Container preset buttons on hydration card
apps/mobile/app/(fast)/settings.tsx       -- Container management in settings
apps/web/app/fast/page.tsx                -- Container buttons on web hydration section
```

### Wireframe Position

```
Hub Dashboard
  └── MyFast card
       └── Timer tab
            └── Hydration Card
                 └── Beverage Picker Row (from FT-014, if available)
                      └── Container Preset Buttons ← YOU ARE HERE
```

Container preset buttons appear as a secondary row below the beverage type icons (if FT-014 is built) or directly below the hydration progress bar (if only FT-007 water logging exists). Each button shows the container name and volume.

### Data Model

```sql
-- V4 Migration: Custom container presets

CREATE TABLE IF NOT EXISTS ft_container_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  volume_oz REAL NOT NULL,
  icon TEXT NOT NULL DEFAULT '(bottle)',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS ft_container_sort_idx ON ft_container_presets(sort_order);
```

**Default presets (seeded in migration):**

| id | Name | Volume (oz) | Icon |
|----|------|------------|------|
| small_glass | Small Glass | 8 | (glass) |
| can | Can | 12 | (can) |
| bottle | Bottle | 16 | (bottle) |
| large_bottle | Large Bottle | 32 | (large bottle) |
| xl_bottle | XL Bottle | 40 | (xl bottle) |

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), ft_water_intake (for count-based logging) OR ft_beverage_log (if FT-014 is available)
- **External:** None
- **Cross-Module:** None (container presets are Fast-specific)

## Functional Requirements

### User Stories
1. As someone with a 32oz Nalgene, I want to tap "Nalgene" once to log 32oz of water instead of tapping "+" four times.
2. As someone with multiple containers (office mug, gym bottle, home glass), I want presets for each so I always log accurately.
3. As a new user, I want sensible default containers (glass, can, bottle) so I can start logging immediately.
4. As a power user, I want to create, edit, and reorder my custom presets.

### Behavior Specification

**Logging with a container preset:**
1. User views the hydration card on the Timer tab
2. A row of container preset buttons appears (each showing name + volume)
3. User taps a preset (e.g., "Large Bottle 32oz")
4. System logs the intake:
   - If FT-014 (multi-beverage) is active: creates a BeverageLog entry with volume_oz=32, beverage_type_id=selected type (default: water)
   - If only FT-007: increments ft_water_intake count by volume_oz / 8.0 (glass equivalent), rounded to nearest 0.5
5. Hydration progress bar updates
6. Brief haptic feedback (mobile) or visual flash (web) confirms the log

**Creating a custom preset:**
1. User navigates to Settings > Container Presets
2. User taps "Add Container"
3. Form appears: name (required, max 30 chars), volume in oz (required, > 0, max 128), icon (emoji picker)
4. User saves
5. New preset appears in the container row on Timer tab

**Managing presets:**
1. Settings > Container Presets shows all presets (built-in first, then custom)
2. Built-in presets: volume can be edited, but preset cannot be deleted
3. Custom presets: all fields editable, can be deleted
4. Drag handles for reordering (changes sort_order)

**Interaction with FT-014 (multi-beverage):**
1. When both features are active, tapping a container preset logs the selected beverage type at the container's volume
2. Example flow: user selects "Coffee" beverage type, then taps "Office Mug (12oz)" container -- logs 12oz of coffee
3. If no beverage type is explicitly selected, container defaults to water

### Edge Cases

- **Volume of 0 or negative:** Rejected with inline validation "Enter a valid volume".
- **Volume exceeds 128oz:** Rejected with "Volume cannot exceed 128 oz".
- **Empty name:** Rejected with "Name is required".
- **Name exceeds 30 characters:** Truncated or rejected with "Name must be 30 characters or less".
- **Duplicate container name:** Allowed (users might have two containers with the same name but different volumes, e.g., "Water Bottle" 24oz and "Water Bottle" 32oz).
- **Built-in preset deletion:** Delete action hidden or disabled for built-in presets. UI shows lock icon.
- **No FT-014 available:** Container presets work with the simple ft_water_intake counter. Volume is converted to glass equivalents (volume_oz / 8.0).
- **Container row overflow:** If user has more than 5 presets, the row becomes horizontally scrollable with overflow indicator.
- **Module disabled:** Container preset data preserved. Re-enabling restores all presets.
- **Glass equivalent rounding:** When converting to ft_water_intake count, round to nearest 0.5 (e.g., 12oz = 1.5 glasses, 32oz = 4.0 glasses). Never round down to 0.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Container preset buttons appear on the hydration card showing name and volume
- [ ] **AC-2:** Tapping a preset logs the volume and updates the hydration progress bar within 200ms
- [ ] **AC-3:** Tapping "Large Bottle" (32oz) logs 4.0 glass equivalents (32/8) to ft_water_intake
- [ ] **AC-4:** Default presets (Small Glass, Can, Bottle, Large Bottle, XL Bottle) appear on first use
- [ ] **AC-5:** Settings > Container Presets shows all presets with name, volume, and icon
- [ ] **AC-6:** Users can create a custom preset with name, volume, and icon
- [ ] **AC-7:** Custom presets can be edited (all fields) and deleted
- [ ] **AC-8:** Built-in presets cannot be deleted (delete action hidden/disabled)
- [ ] **AC-9:** Presets can be reordered via drag handles
- [ ] **AC-10:** Container row scrolls horizontally if more than 5 presets exist
- [ ] **AC-11:** Brief haptic feedback (mobile) or visual flash (web) confirms logging

### Technical Criteria
- [ ] **TC-1:** V4 migration creates ft_container_presets table with correct schema
- [ ] **TC-2:** V4 migration seeds 5 built-in container presets
- [ ] **TC-3:** Container logging integrates with ft_water_intake (count-based) when FT-014 is not available
- [ ] **TC-4:** Container logging integrates with ft_beverage_log (volume-based) when FT-014 is available
- [ ] **TC-5:** Glass equivalent calculation: volume_oz / 8.0, rounded to nearest 0.5
- [ ] **TC-6:** All CRUD operations use the ft_ table prefix
- [ ] **TC-7:** Validation rejects: empty name, name > 30 chars, volume <= 0, volume > 128

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Built-in presets must NOT be deletable
- [ ] **NC-2:** Container data must NOT be sent off-device
- [ ] **NC-3:** Deleting a container preset must NOT affect any existing hydration/water logs
- [ ] **NC-4:** Glass equivalent conversion must NOT round down to 0 (minimum 0.5)

## UI Specification

### Mobile (Expo)

**Container Preset Row (Timer tab):**
- Horizontal ScrollView below beverage picker (or below progress bar if no FT-014)
- Each button: pill-shaped, `rgba(255,255,255,0.08)` background, `rgba(255,255,255,0.10)` border
- Button content: icon (left, 16x16), name (center, truncated at 12 chars), volume (right, secondary text)
- Active/pressed state: teal (`#14B8A6`) border highlight
- Height: 36px, horizontal gap: 8px

**Container Settings Screen:**
- List with drag handles (left) and swipe-to-delete (custom items only)
- Each row: icon (24x24), name, volume displayed as "XX oz"
- Built-in items: lock icon on right, no swipe action
- "Add Container" button at bottom: accent color, "+" icon

**New/Edit Container Form:**
- Modal or pushed screen
- Fields: Name (text input, 30 char max), Volume (number input with "oz" suffix), Icon (emoji picker grid)
- Save button: teal accent, disabled until validation passes
- Cancel button: secondary style

### Web (Next.js)

- Same tokens via CSS variables
- Container buttons: horizontal flex row, similar pill style
- Settings: table layout with edit/delete buttons (no swipe)
- Form: inline form or modal, standard inputs

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton pills in container row | Initial mount, DB query in flight |
| Default | 5 built-in presets in order | No custom presets created |
| Custom | Built-in + custom presets, scrollable if > 5 | User created custom presets |
| Error | "Could not load presets" + retry | DB read failure |
| Empty | Should not occur (5 built-ins always exist) | N/A |

## Test Requirements

### Unit Tests
- [ ] `getContainerPresets`: returns 5 built-in presets on fresh DB
- [ ] `createContainerPreset`: creates custom preset with correct fields
- [ ] `createContainerPreset`: rejects empty name
- [ ] `createContainerPreset`: rejects volume <= 0
- [ ] `createContainerPreset`: rejects volume > 128
- [ ] `createContainerPreset`: rejects name > 30 characters
- [ ] `updateContainerPreset`: updates name, volume, icon
- [ ] `updateContainerPreset`: allows editing built-in preset volume
- [ ] `deleteContainerPreset`: deletes custom preset
- [ ] `deleteContainerPreset`: rejects deletion of built-in preset
- [ ] `logWithContainer`: converts 32oz to 4.0 glass equivalents
- [ ] `logWithContainer`: converts 12oz to 1.5 glass equivalents
- [ ] `logWithContainer`: minimum 0.5 glasses for any positive volume
- [ ] `reorderPresets`: updates sort_order for all affected presets

### Integration Tests
- [ ] Full flow: create custom preset -> tap to log -> water intake increases correctly
- [ ] Migration flow: V4 migration runs, 5 built-in presets seeded
- [ ] Multi-beverage integration: container + beverage type -> correct BeverageLog entry
- [ ] Delete flow: delete custom preset -> existing logs unaffected

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyFast > Timer tab
3. Verify: container preset buttons visible with 5 defaults (Small Glass 8oz, Can 12oz, Bottle 16oz, Large Bottle 32oz, XL Bottle 40oz) -- AC-1, AC-4
4. Note current hydration total
5. Tap "Large Bottle" preset
6. Verify: hydration increases by 4.0 glasses, progress bar updates, haptic feedback fires -- AC-2, AC-3, AC-11
7. Tap "Can" preset
8. Verify: hydration increases by 1.5 glasses (12/8) -- AC-2
9. Navigate to Settings > Container Presets
10. Verify: all 5 defaults listed with name, volume, and icon -- AC-5
11. Try to delete "Small Glass" (built-in)
12. Verify: delete action is blocked/hidden -- AC-8, NC-1
13. Tap "Add Container"
14. Enter name "Stanley" (empty volume)
15. Verify: save button disabled / validation error -- TC-7
16. Enter volume 40 oz
17. Select an icon
18. Save
19. Verify: "Stanley 40oz" appears in the list -- AC-6
20. Navigate back to Timer tab
21. Verify: "Stanley" appears in the container row -- AC-6
22. Tap "Stanley" preset
23. Verify: hydration increases by 5.0 glasses (40/8) -- AC-2
24. Navigate to Settings > Container Presets
25. Edit "Stanley" to 48oz
26. Verify: updated volume shown -- AC-7
27. Delete "Stanley"
28. Verify: "Stanley" removed from list -- AC-7
29. Verify: previous hydration logs are preserved (total unchanged) -- NC-3
30. Create 3 more custom presets (total 8 presets)
31. Verify: container row scrolls horizontally -- AC-10
32. Drag to reorder presets
33. Verify: new order persists after navigating away and back -- AC-9
34. Repeat steps 3-8 on web at `/fast`

## gstack Quality Gates

Based on this feature's complexity score (5/5 = Inverse 0), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Water logging uses abstract "glass" count (ft_water_intake.count)
- No concept of physical containers or their volumes
- Users mentally convert container volumes to glass counts

### After This Work
- ft_container_presets table with 5 built-in + custom container support
- One-tap logging from container presets with accurate volume conversion
- Container management in Settings
- Integrates with both simple water counter (FT-007) and multi-beverage system (FT-014) if available

### Files Changed
- `modules/fast/src/types.ts` -- Added ContainerPreset interface
- `modules/fast/src/db/schema.ts` -- Added ft_container_presets table, seed data (V4 migration)
- `modules/fast/src/db/containers.ts` -- New file: container preset CRUD
- `modules/fast/src/definition.ts` -- Added V4 migration (shared with FT-014)
- `modules/fast/src/index.ts` -- Exported container functions
- `apps/mobile/app/(fast)/timer.tsx` -- Added container preset buttons
- `apps/mobile/app/(fast)/settings.tsx` -- Added container management
- `apps/web/app/fast/page.tsx` -- Added container buttons

### Known Limitations
- No unit conversion UI (oz/ml toggle). Volume stored as oz internally. Metric users must mentally convert or a future iteration can add a preference.
- No Apple Watch support for container presets in this iteration.
- No visual representation of container shapes (just name + volume text). A future iteration could add container silhouette icons.
- Reordering uses simple sort_order integers. Concurrent reordering across platforms could create conflicts (not an issue for single-device SQLite).

### Context for Next Agent
- If FT-014 (multi-beverage) is being built in the same migration (V4), the container presets table should be part of the same migration. Coordinate the V4 migration to include both ft_beverage_types, ft_beverage_log, and ft_container_presets.
- The `logWithContainer` function should check if FT-014 is available (presence of ft_beverage_types table or a feature flag in ft_settings). If available, create a BeverageLog entry. If not, fall back to incrementing ft_water_intake.
- Container presets are independent of beverage types. A container has a volume; a beverage type has a hydration coefficient. Logging with both means: "I drank [volume] of [beverage type]".
- Built-in preset IDs are string constants. Do not use numeric IDs.
