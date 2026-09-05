# Feature Spec: Progress Photos

## Metadata
- **Module:** workouts
- **Feature ID:** WO-020
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market [4] x3 + Switching [2] x3 + Complexity [3] x2 + CrossModule [2] x1 + PaidUser [2] x1
- **Sprint:** S9+
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none
- **Blocks:** none (but Workout Sharing WO-021 can optionally include progress photo milestones)

## Business Context

### Why This Feature Exists
Body transformation tracking is one of the most emotionally compelling features in fitness apps. Users want visual proof of their progress over weeks and months. Progress photos are a top retention driver because they give users a reason to keep opening the app long after the initial motivation fades. Competitors like Hevy and JEFIT offer this as a standard feature, and users switching from those apps expect it.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Hevy | Yes | Free | Camera capture, timeline grid, front/side/back tags, side-by-side comparison |
| JEFIT | Yes | Free | Photo timeline, body part tags, overlay comparison slider |
| Sweat | Yes | Paid ($120/yr) | Guided photo prompts, weekly reminders, before/after pairs |
| Strong | No | N/A | No progress photos |
| Fitbod | No | N/A | No progress photos |

### Target User
Strength lifters and fitness beginners tracking body recomposition over months. Users who want visual evidence of progress beyond just numbers on a scale. Privacy-conscious users who want photos stored locally and never uploaded.

## Technical Context

### Where This Lives in MyLife
```
modules/workouts/src/types.ts                  -- ProgressPhoto types + Zod schemas
modules/workouts/src/db/schema.ts              -- wk_progress_photos table
modules/workouts/src/db/crud.ts                -- Progress photo CRUD operations
apps/mobile/app/(workouts)/photos.tsx          -- Photo timeline screen
apps/mobile/app/(workouts)/photo-compare.tsx   -- Side-by-side comparison screen
apps/web/app/workouts/photos/page.tsx          -- Web photo timeline
apps/web/app/workouts/photos/compare/page.tsx  -- Web comparison view
```

### Wireframe Position
```
Hub Dashboard
  └── MyWorkouts card
       └── Progress tab
            └── Progress Photos ← YOU ARE HERE
                 ├── Photo Timeline (grid by month)
                 ├── Add Photo (camera / picker)
                 └── Compare (side-by-side slider)
```

### Data Model

```sql
CREATE TABLE IF NOT EXISTS wk_progress_photos (
  id TEXT PRIMARY KEY,
  photo_uri TEXT NOT NULL,
  view_type TEXT NOT NULL DEFAULT 'front' CHECK (view_type IN ('front', 'side_left', 'side_right', 'back')),
  notes TEXT NOT NULL DEFAULT '',
  taken_at TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS wk_progress_photos_taken_idx ON wk_progress_photos(taken_at DESC);
CREATE INDEX IF NOT EXISTS wk_progress_photos_view_idx ON wk_progress_photos(view_type);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens)
- **External:** `expo-camera` (camera capture on mobile), `expo-image-picker` (photo library import), `expo-file-system` (local storage management)
- **Cross-Module:** Optional integration with Body Measurements (WO-026) to show weight alongside photo timeline

## Functional Requirements

### User Stories
1. As a user tracking my body transformation, I want to take a photo with the in-app camera and tag it with a view type (front, side, back), so I build a consistent photo history.
2. As a user, I want to import an existing photo from my camera roll, so I can add older photos to my timeline.
3. As a user, I want to compare two photos side-by-side with a slider overlay, so I can see visual changes over time.
4. As a user, I want to filter my photos by view type (front only, side only, back only), so I can compare the same angle across time.
5. As a privacy-conscious user, I want my progress photos to stay on my device and never be uploaded anywhere.

### Behavior Specification

**Adding a Photo:**
1. User navigates to MyWorkouts > Progress tab > Progress Photos.
2. User taps the "+" floating action button.
3. System presents options: "Take Photo" or "Choose from Library".
4. If "Take Photo": camera opens. User takes a photo. System asks for view type (front, side left, side right, back) and optional notes.
5. If "Choose from Library": photo picker opens. User selects a photo. System prompts for view type and notes.
6. System copies the photo to the app's documents directory (`{documentsDir}/workouts/progress-photos/{id}.jpg`).
7. System creates a `wk_progress_photos` record with the local URI, view type, notes, and timestamp.
8. Photo appears in the timeline grid.

**Viewing Photos:**
1. User sees a grid of photos grouped by month (newest first).
2. Filter chips at the top: All, Front, Side Left, Side Right, Back.
3. Tapping a filter shows only photos of that view type.
4. Tapping a photo opens full-screen view with date, view type badge, and notes overlay.
5. Swiping left/right navigates between photos in the filtered set.

**Comparing Photos:**
1. User taps "Compare" button in the toolbar.
2. System enters selection mode. User taps exactly 2 photos.
3. System opens the comparison screen with both photos side-by-side.
4. A vertical slider divides the two photos. User drags the slider to reveal more of either photo.
5. Date labels shown on each photo.
6. Pinch-to-zoom supported for both photos simultaneously.

### Edge Cases
- Camera permission denied: show explanation dialog with link to Settings.
- Photo library permission denied: show explanation dialog with link to Settings.
- Storage full on device: show toast "Not enough storage for photo" and do not save.
- Photo file deleted externally (user deletes from Files app): show placeholder "Photo unavailable" with option to delete the entry.
- Extremely large photo (> 20 MB): resize to max 2048px on longest side before saving.
- User tries to compare photos of different view types: allow it (user may want front vs. side).
- Zero photos: show empty state with CTA "Take your first progress photo".
- Module disabled while photos exist: data preserved, not deleted.
- Photo taken_at in the future: clamp to current timestamp.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping "+" opens a choice between "Take Photo" and "Choose from Library".
- [ ] **AC-2:** After capturing/selecting a photo, user is prompted for view type (front, side left, side right, back) and optional notes.
- [ ] **AC-3:** Saved photos appear in the timeline grid grouped by month with the newest month first.
- [ ] **AC-4:** Filter chips (All, Front, Side Left, Side Right, Back) correctly filter the grid.
- [ ] **AC-5:** Tapping a photo opens full-screen view with date, view type badge, and notes.
- [ ] **AC-6:** "Compare" mode allows selecting exactly 2 photos and opens the comparison screen.
- [ ] **AC-7:** The comparison screen shows a draggable slider between two photos.
- [ ] **AC-8:** Pinch-to-zoom works on the comparison screen.
- [ ] **AC-9:** Empty state shows "Take your first progress photo" with camera icon.
- [ ] **AC-10:** Deleting a photo removes both the database record and the file from disk.

### Technical Criteria
- [ ] **TC-1:** Photos are stored in `{documentsDir}/workouts/progress-photos/` and never in a cloud service.
- [ ] **TC-2:** `wk_progress_photos` table is created via migration.
- [ ] **TC-3:** Photo files > 20 MB are resized to max 2048px before saving.
- [ ] **TC-4:** CRUD operations (create, list, filter, delete) work correctly.
- [ ] **TC-5:** Photo metadata (width, height, file_size_bytes) is recorded accurately.
- [ ] **TC-6:** Listing photos with view_type filter returns only matching records.

### Negative Criteria
- [ ] **NC-1:** Photos must NEVER be uploaded to Supabase or any cloud service.
- [ ] **NC-2:** Photos must NOT appear in the device's camera roll unless the user explicitly exports them.
- [ ] **NC-3:** Deleting the module's data must delete all photo files from disk.

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Photo grid: 3 columns, square thumbnails with rounded corners
- Month headers: `textSecondary` color, sticky
- Filter chips: glass card style, active chip uses module accent `#EF4444`
- FAB: `#EF4444` with white "+" icon
- Full-screen viewer: dark overlay, swipe to navigate, tap to show/hide controls
- Comparison: two images with a vertical divider line, draggable handle

### Web (Next.js)
- Same tokens via CSS variables
- Photo grid: responsive 3-4-5 columns based on viewport
- Comparison: CSS slider using `clip-path` or `overflow: hidden` with drag handle
- Route: `/workouts/photos` and `/workouts/photos/compare`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton grid with shimmer | Initial data fetch |
| Empty | Illustration + "Take your first progress photo" + camera CTA | No photos exist |
| Success | Grid of photos grouped by month | Photos loaded |
| Filtered Empty | "No [view type] photos yet" | Filter active but no matching photos |
| Error | "Could not load photos" + retry | File system read failure |

## Test Requirements

### Unit Tests
- [ ] `createProgressPhoto`: saves record with correct fields and copies file
- [ ] `getProgressPhotos`: returns all photos sorted by taken_at DESC
- [ ] `getProgressPhotos` with viewType filter: returns only matching photos
- [ ] `deleteProgressPhoto`: removes record and file from disk
- [ ] Photo file path generation: produces valid path with UUID filename
- [ ] Large photo detection: identifies photos > 20 MB

### Integration Tests
- [ ] Full flow: take photo -> save with view type -> appears in grid -> tap to view full-screen
- [ ] Compare flow: select 2 photos -> comparison screen opens -> slider works
- [ ] Delete flow: delete photo -> record removed -> file removed -> grid updates

### QA Verification Script
1. Open the app on mobile
2. Navigate to MyWorkouts > Progress tab > Progress Photos
3. Verify: empty state shows "Take your first progress photo" -- corresponds to AC-9
4. Tap "+" button, verify two options appear -- corresponds to AC-1
5. Tap "Take Photo", take a photo
6. Select "Front" view type, add a note "Week 1", save
7. Verify: photo appears in grid with current month header -- corresponds to AC-3
8. Repeat: add a "Back" photo and a "Side Left" photo
9. Tap "Back" filter chip, verify only the back photo shows -- corresponds to AC-4
10. Tap "All" to show all photos
11. Tap any photo, verify full-screen view with date and view type badge -- corresponds to AC-5
12. Tap "Compare" button, select 2 photos
13. Verify: comparison screen opens with slider -- corresponds to AC-6, AC-7
14. Drag slider left and right, verify smooth transition -- corresponds to AC-7
15. Pinch to zoom on comparison screen -- corresponds to AC-8
16. Return to grid, long-press a photo, tap "Delete"
17. Verify: photo removed from grid and file deleted from disk -- corresponds to AC-10

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to progress photos, test capture, compare, and all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
No progress photo functionality exists. The `wk_exercises` table has `video_url` and `thumbnail_url` fields for exercise demos, but nothing for user body photos. The SPEC (WO-020) describes the feature but no code has been written.

### After This Work
- `wk_progress_photos` table with CRUD
- Photo capture and import from library
- Timeline grid with view type filtering
- Side-by-side comparison with slider
- All photos stored locally, never uploaded

### Files Changed
- `modules/workouts/src/types.ts` -- add ProgressPhoto types, ViewType enum, Zod schemas
- `modules/workouts/src/db/schema.ts` -- add CREATE_PROGRESS_PHOTOS table
- `modules/workouts/src/db/crud.ts` -- add progress photo CRUD (create, list, filter, delete)
- `modules/workouts/src/definition.ts` -- add wk_progress_photos to V5 migration
- `modules/workouts/src/index.ts` -- export new types and CRUD functions
- `apps/mobile/app/(workouts)/photos.tsx` -- photo timeline screen
- `apps/mobile/app/(workouts)/photo-compare.tsx` -- comparison screen
- `apps/web/app/workouts/photos/page.tsx` -- web timeline
- `apps/web/app/workouts/photos/compare/page.tsx` -- web comparison

### Known Limitations
- No cloud backup for photos (intentional privacy decision).
- No automatic photo reminders (e.g., "Take your weekly progress photo"). Could be a future enhancement.
- No body composition overlay (e.g., pose estimation to highlight muscle definition). Pure photo comparison only.
- No video progress (e.g., before/after video clips). Photos only.

### Context for Next Agent
Photos use the app's documents directory, not the cache directory, so they persist across app updates. The `photo_uri` field stores a relative path from the documents directory root, not an absolute path, so it survives directory relocations. Use `expo-file-system` for all file operations on mobile and Node.js `fs` for web/tests. The view_type enum uses `side_left` and `side_right` (not just `side`) to allow left/right comparison.
