# Feature Spec: Vision Board

## Metadata
- **Module:** journal
- **Priority Score:** 22 / 50 (B-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 2 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 6 (B+C Features)
- **Estimated CC Time:** 4-5 hours
- **Depends On:** JR-006 (Photo Attachments -- implemented, image URI storage)
- **Blocks:** none

## Business Context

### Why This Feature Exists
The Gratitude app ($23/yr) includes vision boards as a key engagement feature for goal visualization. Reflectly ($59.99/yr) offers a similar tool. Vision boards serve a different journaling modality: visual goal-setting and aspiration mapping rather than text-based reflection. Users create collages of images, text cards, quotes, and goals arranged on a canvas. This creates a daily motivational touchpoint (via the "Daily Vision" launch screen feature) and gives users a reason to return beyond text journaling.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Gratitude (app) | Yes | $23/yr | Vision boards with images and text. Cloud-synced. |
| Reflectly | Yes | $59.99/yr | Vision board as part of premium wellness toolkit. Cloud-stored. |
| Day One | No | N/A | No vision board. Photo-only attachments. |
| Canva | Partial | Freemium | General design tool, not journal-integrated. Cloud-based. |

### Target User
Goal-oriented journalers who visualize their aspirations. Gratitude app users paying $23/yr for vision boards. People who prefer visual over textual goal expression. Users who want a daily motivational screen on app launch.

## Technical Context

### Where This Lives in MyLife

```
modules/journal/src/vision-board/                  -- NEW: vision board engine
modules/journal/src/vision-board/types.ts          -- VisionBoard, VisionBoardItem, ItemType types
modules/journal/src/vision-board/board-engine.ts   -- Canvas position normalization, export prep, limits
modules/journal/src/vision-board/index.ts          -- Barrel export
modules/journal/src/vision-board/__tests__/        -- Tests
modules/journal/src/db/vision-board.ts             -- NEW: CRUD for boards and items
apps/mobile/app/(journal)/vision-boards.tsx        -- Mobile board list
apps/mobile/app/(journal)/vision-canvas.tsx        -- Mobile canvas editor
apps/web/app/journal/vision-board/page.tsx         -- Web board list
apps/web/app/journal/vision-board/[id]/page.tsx    -- Web canvas editor
```

### Wireframe Position

```
Hub Dashboard
  └── MyJournal card
       └── Entries tab -> "Vision Boards" section
            └── Board List -> Canvas Editor ← YOU ARE HERE
       └── Settings
            └── "Daily Vision" toggle
```

### Data Model

New tables in migration V4:

```sql
CREATE TABLE IF NOT EXISTS jn_vision_boards (
  id TEXT PRIMARY KEY NOT NULL,
  entry_id TEXT NOT NULL REFERENCES jn_entries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  orientation TEXT NOT NULL DEFAULT 'portrait'
    CHECK (orientation IN ('portrait', 'landscape')),
  background_color TEXT NOT NULL DEFAULT '#1A1A2E',
  is_daily_vision INTEGER NOT NULL DEFAULT 0,
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jn_vision_board_items (
  id TEXT PRIMARY KEY NOT NULL,
  board_id TEXT NOT NULL REFERENCES jn_vision_boards(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL
    CHECK (item_type IN ('image', 'text', 'quote', 'goal')),
  content TEXT,
  image_path TEXT,
  position_x REAL NOT NULL DEFAULT 0.5,
  position_y REAL NOT NULL DEFAULT 0.5,
  width REAL NOT NULL DEFAULT 0.3,
  height REAL NOT NULL DEFAULT 0.3,
  rotation_deg REAL NOT NULL DEFAULT 0,
  z_index INTEGER NOT NULL DEFAULT 0,
  background_color TEXT,
  font_size INTEGER DEFAULT 18,
  goal_target_date TEXT,
  goal_progress INTEGER DEFAULT 0 CHECK (goal_progress >= 0 AND goal_progress <= 100),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS jn_vision_boards_daily_idx ON jn_vision_boards(is_daily_vision);
CREATE INDEX IF NOT EXISTS jn_vision_board_items_board_idx ON jn_vision_board_items(board_id);
CREATE INDEX IF NOT EXISTS jn_vision_board_items_z_idx ON jn_vision_board_items(board_id, z_index);

INSERT OR IGNORE INTO jn_settings (key, value) VALUES ('dailyVisionEnabled', 'false');
```

### Dependencies
- **Internal:** `@mylife/db`, journal entry CRUD, image URI handling
- **External:** Device camera and photo gallery access (for image items)
- **Cross-Module:** Philosophy quotes (JR-022) can be pulled into quote cards if available

## Functional Requirements

### User Stories
1. As a goal-oriented journaler, I want to create a visual collage of images, quotes, and goals on a vision board.
2. As a gratitude practitioner, I want multiple vision boards for different life areas (career, health, relationships).
3. As a privacy-conscious user, I want vision board images stored locally with the same encryption as journal entries.

### Behavior Specification

1. User navigates to Vision Boards (from Entries tab or Settings).
2. Board list shows existing boards as thumbnail grid (2 columns), max 10 boards.
3. User taps "+" to create a new board: enters title, selects orientation (portrait/landscape).
4. Canvas editor opens with empty canvas.
5. **Adding items:**
   a. User taps "Add Item" -- bottom toolbar shows 4 types: Image, Text, Quote, Goal.
   b. Image: opens image picker -> selected photo placed at canvas center.
   c. Text: text card placed at center -> double-tap to edit content (max 500 chars).
   d. Quote: opens quote picker (from philosophy library or manual entry) -> quote card placed.
   e. Goal: opens goal editor (title max 100 chars, target date, progress 0-100%) -> goal card placed.
6. **Positioning items:**
   a. Drag to move (snaps to 10px grid for alignment).
   b. Pinch to resize (min 5% of canvas, max 100%).
   c. Two-finger rotate or rotation handle.
   d. z-index: last-tapped item moves to front.
7. **Saving:** User taps "Done" -> all item positions, sizes, rotations saved.
8. **Daily Vision:** User sets a board as "Daily Vision" in board context menu. On app launch (if enabled), the board displays as a full-screen overlay for 5 seconds or until "Continue to Journal" tapped.
9. **Export:** "Export as Image" generates a PNG at 1200x1600 (portrait) or 1600x1200 (landscape).
10. Board items use normalized coordinates (0-1) for resolution independence.

### Edge Cases

- **10 boards already exist:** "+" button disabled with "Maximum 10 vision boards."
- **50 items on one board:** Block with "Maximum 50 items per board."
- **Image file deleted from device:** Placeholder with "Image not found" text.
- **Image larger than 10MB:** Block with "Image is too large."
- **Empty Daily Vision board:** Skip overlay on launch.
- **Multiple boards with is_daily_vision = 1:** Use most recently updated. Clear others.
- **Export fails (insufficient storage):** Toast with storage suggestion.
- **Canvas save fails:** Auto-retry, canvas state preserved in memory.
- **Item minimum size:** 5% of canvas dimension (prevents invisible items).

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Vision Board list shows boards as thumbnail grid with title and item count.
- [ ] **AC-2:** Creating a new board allows title entry and portrait/landscape selection.
- [ ] **AC-3:** Canvas editor supports adding 4 item types: Image, Text, Quote, Goal.
- [ ] **AC-4:** Items can be dragged, resized, and rotated on the canvas.
- [ ] **AC-5:** "Done" saves all item positions and content.
- [ ] **AC-6:** "Daily Vision" setting shows selected board on app launch for 5 seconds.
- [ ] **AC-7:** "Export as Image" generates a high-resolution PNG.
- [ ] **AC-8:** Maximum 10 boards enforced.
- [ ] **AC-9:** Maximum 50 items per board enforced.
- [ ] **AC-10:** Board deletion removes all items and associated images.

### Technical Criteria
- [ ] **TC-1:** Migration V4 creates `jn_vision_boards` and `jn_vision_board_items` tables with indexes.
- [ ] **TC-2:** Item positions use normalized coordinates (0.0-1.0) for resolution independence.
- [ ] **TC-3:** Portrait canvas: 1200x1600px export. Landscape: 1600x1200px.
- [ ] **TC-4:** Only one board can have is_daily_vision = 1 at a time (enforced on toggle).
- [ ] **TC-5:** Board linked to an entry via entry_id (entry_type = 'vision_board').
- [ ] **TC-6:** CASCADE delete: deleting entry deletes board and all items.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Vision board images must NEVER leave the device.
- [ ] **NC-2:** Deleting one item must NOT affect other items on the same board.
- [ ] **NC-3:** Setting a new Daily Vision board must NOT delete the previous one (only clears is_daily_vision flag).

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Board list: 2-column thumbnail grid, glass card style
- Canvas: full-screen, dark background (#1A1A2E default)
- Item selection: accent-colored border + corner resize handles
- Add Item toolbar: 4 icon buttons (camera, text, quote, target), glass dock style
- Toolbar auto-hides after 3s of inactivity
- Goal card: progress bar in accent color
- Module accent: `#A78BFA`

### Web (Next.js)

- Route: `/journal/vision-board` (list), `/journal/vision-board/[id]` (canvas)
- Wider canvas on desktop
- Mouse drag + scroll wheel resize + rotation handle

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Empty List | Illustration + "Create Your First Vision Board" | No boards created |
| Board List | Thumbnail grid of boards | 1+ boards exist |
| Empty Canvas | Dark canvas + "Tap + to add your first item" prompt | New board, no items |
| Editing | Items with selection handles, toolbar visible | User interacting with canvas |
| Viewing | Clean view, items only, toolbar hidden | 3s of inactivity |
| Daily Vision Overlay | Full-screen board display with "Continue" button | App launch, Daily Vision enabled |
| At Limit | "+" disabled with tooltip | 10 boards reached |

## Test Requirements

### Unit Tests
- [ ] `normalizedToPixels`: position_x=0.5, canvas_w=1200 -> 600
- [ ] `normalizedToPixels`: position_x=0.25, landscape canvas_w=1600 -> 400
- [ ] `enforceBoardLimit`: existing=10 -> creation blocked
- [ ] `enforceItemLimit`: existing=50 -> addition blocked
- [ ] `toggleDailyVision`: set board B -> board A's is_daily_vision cleared
- [ ] `validateMinItemSize`: width=0.03 -> validation error (min 0.05)
- [ ] `validateRotation`: rotation_deg=200 -> clamped to 180
- [ ] `renderZOrder`: items with z_index [0, 2, 1] -> rendered 0, 1, 2
- [ ] `handleMissingImage`: image_path points to deleted file -> returns placeholder flag
- [ ] `calculateExportDimensions`: portrait -> 1200x1600, landscape -> 1600x1200

### Integration Tests
- [ ] Full flow: create board -> add image, text, quote, goal -> position items -> save -> reopen -> items at correct positions
- [ ] Daily Vision: create board -> set as Daily Vision -> relaunch -> overlay shown
- [ ] Export: create board with items -> export PNG -> valid file at correct resolution
- [ ] Delete: create board -> add items -> delete board -> board and items gone

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyJournal > Vision Boards
3. Verify: empty state with "Create Your First Vision Board"
4. Tap "+"
5. Verify: title input and orientation selector shown -- corresponds to AC-2
6. Create "2026 Goals" board (portrait)
7. Verify: empty canvas with prompt -- corresponds to AC-3
8. Add an image from gallery
9. Verify: image placed on canvas
10. Add a text card "Launch my app"
11. Verify: text card on canvas
12. Add a goal card "Save $10K" with progress 25%
13. Verify: goal card with progress bar
14. Drag items to new positions
15. Verify: items move -- corresponds to AC-4
16. Tap "Done"
17. Verify: board saved, returns to list -- corresponds to AC-5
18. Verify: board thumbnail visible -- corresponds to AC-1
19. Long press board -> "Set as Daily Vision"
20. Relaunch app
21. Verify: board shown as overlay -> tap "Continue" -- corresponds to AC-6
22. Open board -> "Export as Image"
23. Verify: share sheet with PNG -- corresponds to AC-7
24. Create 10 total boards
25. Try to create 11th
26. Verify: blocked -- corresponds to AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to vision board list, create a board, add items, verify canvas

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Journal entries support text and image URI attachments. No visual canvas, no vision board concept, no Daily Vision overlay.

### After This Work
Two new tables: `jn_vision_boards` (board metadata) and `jn_vision_board_items` (items with positions, types, content). A `vision-board/` directory provides canvas position normalization, export preparation, and board/item limits. Board list and canvas editor screens on mobile and web. Daily Vision overlay on app launch.

### Files Changed
- `modules/journal/src/db/schema.ts` -- add CREATE_VISION_BOARDS, CREATE_VISION_BOARD_ITEMS, indexes, settings
- `modules/journal/src/definition.ts` -- add to JOURNAL_MIGRATION_V4
- `modules/journal/src/vision-board/types.ts` -- VisionBoard, VisionBoardItem, ItemType, Orientation types
- `modules/journal/src/vision-board/board-engine.ts` -- normalizedToPixels, validateItemSize, enforceLimit, exportDimensions
- `modules/journal/src/vision-board/index.ts` -- barrel export
- `modules/journal/src/vision-board/__tests__/board-engine.test.ts` -- 10+ unit tests
- `modules/journal/src/db/vision-board.ts` -- CRUD for boards and items
- `modules/journal/src/types.ts` -- add VisionBoard, VisionBoardItem Zod schemas, extend entry_type
- `modules/journal/src/index.ts` -- re-export vision-board module
- `apps/mobile/app/(journal)/vision-boards.tsx` -- board list
- `apps/mobile/app/(journal)/vision-canvas.tsx` -- canvas editor
- `apps/web/app/journal/vision-board/page.tsx` -- web board list
- `apps/web/app/journal/vision-board/[id]/page.tsx` -- web canvas editor

### Known Limitations
- No undo/redo on canvas (future polish).
- No layer panel (z-index only set by tap-to-front). Future: drag-to-reorder layers.
- Canvas rendering is purely visual; no accessibility for screen readers on canvas items.
- No print-on-demand integration. Export is PNG only.
- Web canvas interaction requires pointer events (no mobile-style gestures on desktop).

### Context for Next Agent
- Vision boards are stored as entries with `entry_type = 'vision_board'`. The V4 migration needs to extend the entry_type CHECK constraint (same as grid layout).
- Normalized coordinates (0.0-1.0) are used for all positions and sizes. This makes boards resolution-independent. On render, multiply by canvas pixel dimensions.
- The `entry_id` on `jn_vision_boards` links to a parent entry. The entry's `body` can store a text description of the board but is not the visual content.
- Daily Vision: on toggle, clear `is_daily_vision` from all boards first, then set it on the selected one.
- Image items store a local file path in `image_path`. Text/quote/goal items store content in `content`. Image items should have `content` = null and text items should have `image_path` = null.
- Export uses platform-specific rendering: expo-view-shot on mobile, canvas API on web.
