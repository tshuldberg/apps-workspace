# Feature Spec: Photo Journal & Milestones

## Metadata
- **Module:** pets
- **Priority Score:** 21 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 2 x3 + Complexity 3 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Pet profile CRUD (V1), Pet photos CRUD (V2 -- `pt_pet_photos` table + `createPetPhoto` + `listPetPhotosForPet`)
- **Blocks:** None

## Business Context

### Why This Feature Exists
Pet owners accumulate hundreds of photos but lack a structured way to browse them by life events or time periods. The existing `pt_pet_photos` table (V2) stores photos with optional captions and milestone tags, and basic create/list CRUD exists, but there is no timeline grouping, no milestone filtering, no photo editing or deletion, and no statistics. This feature transforms the flat photo list into an interactive photo journal with monthly timeline grouping, milestone filtering, caption editing, and photo stats -- turning raw storage into a meaningful visual record of the pet's life.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| 11pets | Yes | Premium ($20/yr) | Photo gallery per pet, milestone markers, timeline view, cloud backup |
| PetDesk | No | N/A | No photo features; focused on vet appointment management |
| Pawp | No | N/A | Vet telehealth only, no photo storage |
| FitBark | No | N/A | Activity tracker with no photo capabilities |
| Dogo | Partial | Premium ($200+/yr) | Training milestone photos only, no general photo journal |
| Pupford | No | N/A | Content-only platform, no personal photo tracking |

### Target User
Pet owners who document their pet's life through photos and want to look back on milestones (first day home, birthdays, adoption anniversaries). Typically 20-40 year old pet parents who take 5-20 pet photos per month and want to organize them without uploading to a cloud service. Currently these users rely on phone camera rolls with no pet-specific organization, or 11pets' premium photo gallery ($20/yr).

## Technical Context

### Where This Lives in MyLife

```
modules/pets/src/engine/photos.ts              -- NEW: timeline grouping, milestone filtering, stats
modules/pets/src/types.ts                      -- New types: MilestoneTag enum, PhotoTimelineGroup, PhotoStats
modules/pets/src/db/crud.ts                    -- Enhanced: updatePetPhoto, deletePetPhoto, getPhotosByMilestone
modules/pets/src/index.ts                      -- Re-export new public API
modules/pets/src/__tests__/photos.test.ts      -- Engine + CRUD tests
apps/mobile/app/(pets)/photos.tsx              -- Photo journal screen (timeline + grid view)
apps/mobile/app/(pets)/components/PhotoCard.tsx -- Photo card with caption overlay
apps/web/app/pets/[petId]/photos/page.tsx      -- Web photo journal page
```

### Wireframe Position

```
Hub Dashboard
  +-- MyPets card
       +-- Pets tab (pet list)
            +-- Pet Detail
                 +-- Photos tab <-- YOU ARE HERE
```

The photo journal is accessible from the pet detail screen via a "Photos" tab in the pet detail navigation. The milestone filter and view toggle (timeline vs grid) live within this screen.

### Data Model

No schema changes required. The V2 `pt_pet_photos` table already has all necessary columns:

```sql
-- Existing V2 table (no changes needed)
CREATE TABLE IF NOT EXISTS pt_pet_photos (
  id TEXT PRIMARY KEY,
  pet_id TEXT NOT NULL REFERENCES pt_pets(id) ON DELETE CASCADE,
  image_uri TEXT NOT NULL,
  caption TEXT,
  milestone_tag TEXT,
  taken_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Existing V2 index (no changes needed)
CREATE INDEX IF NOT EXISTS pt_pet_photos_pet_idx
  ON pt_pet_photos(pet_id, COALESCE(taken_at, created_at) DESC);
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/module-registry` (ModuleDefinition), `@mylife/ui` (Cool Obsidian tokens, glass card components)
- **External:** None. Photos are stored locally via `image_uri` pointing to the app's local file storage. No cloud upload, no image processing libraries.
- **Cross-Module:** None for this feature. Future: photos could surface in a hub-level "Memories" timeline aggregated across modules.

## Functional Requirements

### User Stories
1. As a pet owner, I want to browse my pet's photos grouped by month and year so that I can relive memories chronologically.
2. As a pet owner, I want to filter photos by milestone type (first day, birthday, adoption day, etc.) so that I can quickly find specific life events.
3. As a pet owner, I want to edit a photo's caption and milestone tag after the fact so that I can add context I forgot when uploading.
4. As a pet owner, I want to delete a photo I no longer want so that I can keep my journal curated.
5. As a pet owner, I want to see photo stats (total count, first photo date, most recent photo) so that I can see how well I have documented my pet's life.
6. As a pet owner, I want to toggle between timeline view (grouped by month) and grid view (compact thumbnails) so that I can browse in my preferred format.

### Behavior Specification

**Viewing the photo timeline:**
1. User navigates to a pet's detail screen and taps the "Photos" tab
2. System loads all photos for this pet, sorted by `COALESCE(taken_at, created_at) DESC`
3. Photos are grouped by month/year (e.g., "March 2026", "February 2026")
4. Each group header shows the month/year label and photo count for that month
5. Photos within each group display as cards with the image, caption (if any), and milestone badge (if any)
6. A stats bar at the top shows total photos, first photo date, and most recent photo date

**Filtering by milestone:**
1. User taps a milestone filter chip bar below the stats bar
2. Available chips: All, First Day, Birthday, Adoption Day, Vet Visit, Training, Grooming, Holiday, Silly, Custom
3. Tapping a chip filters the timeline to show only photos with that milestone tag
4. "All" chip clears the filter and shows all photos
5. Active chip is highlighted with the module accent color (#F59E0B)

**Editing a photo:**
1. User taps a photo card to open the photo detail view
2. Photo detail shows the full image, caption text, milestone tag, and date
3. User taps "Edit" to modify the caption (text field) and/or milestone tag (picker)
4. User taps "Save" to persist changes via `updatePetPhoto`
5. System validates: caption max 500 chars, milestone tag must be from the allowed set or null

**Deleting a photo:**
1. User long-presses a photo card (mobile) or clicks the delete icon (web)
2. Confirmation dialog: "Delete this photo? This cannot be undone."
3. On confirm, system calls `deletePetPhoto` and removes the card from the view
4. Note: this deletes the database record only. The actual image file at `image_uri` is not deleted by this operation (file cleanup is a separate concern).

**Toggling views:**
1. A segmented control at the top of the photo tab offers "Timeline" and "Grid" options
2. Timeline: photos grouped by month, larger cards with captions visible
3. Grid: compact 3-column thumbnail grid, no captions, tapping opens detail

### Edge Cases

- **Photo with no `taken_at`:** Use `created_at` as the display date and grouping key. The existing index already handles this with `COALESCE(taken_at, created_at)`.
- **Duplicate photos:** Allow duplicates. Two photos with the same `image_uri` are treated as separate entries. No deduplication logic.
- **Very many photos (100+):** Paginate at 50 photos per page. Load more on scroll. Timeline groups render incrementally.
- **Image not found at URI:** Show a placeholder image (paw print silhouette on dark surface) with "Image not found" label. Do not crash or hide the card.
- **No milestone tag set:** Photo appears in the "All" filter but not in any specific milestone filter. Milestone badge is hidden on the card.
- **All photos have same month:** Single group header with all photos underneath.
- **No photos exist:** Show empty state with camera illustration and "Add your first photo" CTA.
- **Pet is deleted:** CASCADE deletes all photo records (existing V2 behavior).
- **Module is disabled:** Routes removed, data preserved. Re-enabling restores everything.
- **Caption with very long text (500 chars):** Truncate with ellipsis on the card. Full caption visible in detail view.
- **Photo taken in a different timezone:** `taken_at` is stored as-is (ISO string). Grouping uses the date portion only.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Photo journal screen shows photos grouped by month/year with group headers displaying month name and photo count
- [ ] **AC-2:** Stats bar at the top shows total photo count, first photo date, and most recent photo date
- [ ] **AC-3:** Milestone filter chips allow filtering by milestone tag (first_day, birthday, adoption_day, vet_visit, training_milestone, grooming, holiday, silly, custom)
- [ ] **AC-4:** Active milestone filter chip is highlighted with the module accent color (#F59E0B)
- [ ] **AC-5:** Tapping a photo card opens a detail view with full image, caption, milestone tag, and date
- [ ] **AC-6:** User can edit a photo's caption and milestone tag from the detail view
- [ ] **AC-7:** User can delete a photo with a confirmation dialog
- [ ] **AC-8:** Segmented control toggles between timeline view (grouped, with captions) and grid view (3-column thumbnails)
- [ ] **AC-9:** Empty state shows camera illustration and "Add your first photo" CTA when no photos exist
- [ ] **AC-10:** Photos with no `taken_at` use `created_at` for display date and grouping

### Technical Criteria
- [ ] **TC-1:** `getPhotoTimeline()` groups photos by month/year using `COALESCE(taken_at, created_at)` and returns groups in reverse chronological order
- [ ] **TC-2:** `getMilestonePhotos()` filters photos by milestone tag and returns results sorted by date descending
- [ ] **TC-3:** `getPhotoStats()` returns correct total count, first photo date, and most recent photo date
- [ ] **TC-4:** `updatePetPhoto()` correctly updates caption and milestone_tag fields
- [ ] **TC-5:** `deletePetPhoto()` removes the photo record from the database
- [ ] **TC-6:** `getPhotosByMilestone()` returns empty array when no photos match the requested tag
- [ ] **TC-7:** Pagination works correctly at 50 photos per page with offset-based loading
- [ ] **TC-8:** All CRUD operations use the existing `pt_pet_photos_pet_idx` index

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Editing a photo must NOT modify photos belonging to other pets (data isolation)
- [ ] **NC-2:** Deleting a photo record must NOT delete the actual image file on disk (record-only deletion)
- [ ] **NC-3:** Deleting a pet must NOT leave orphaned photo records (CASCADE)
- [ ] **NC-4:** Disabling the Pets module must NOT delete any photo data
- [ ] **NC-5:** Photo operations must NOT send network requests (offline-first, local-only)
- [ ] **NC-6:** The milestone filter must NOT show tags that do not exist in the allowed set

## UI Specification

### Mobile (Expo)

- **Background:** `#0A0A0F` (background token)
- **Photo cards:** `rgba(255,255,255,0.04)` (glass token) fill with `rgba(255,255,255,0.10)` (glassBorder) border, 12px border radius
- **Module accent:** `#F59E0B` (amber) for active filter chips, milestone badges, and stats highlights
- **Group headers:** `#F0F0F5` (text token) month/year label, `rgba(240,240,245,0.65)` (textSecondary) photo count
- **Milestone badge:** Pill shape with `rgba(245,158,11,0.15)` background and `#F59E0B` text
- **Stats bar:** Glass card at top with 3 stats (total, first, most recent) using `rgba(255,255,255,0.04)` background
- **Filter chips:** Horizontal ScrollView. Inactive: `rgba(255,255,255,0.04)` fill, `rgba(240,240,245,0.65)` text. Active: `#F59E0B` fill, `#0A0A0F` text.
- **Grid view:** 3-column grid with 2px gap, rounded corners, no captions
- **Delete confirmation:** Bottom sheet with glass morphism background via expo-blur BlurView, `#FF453A` (danger) delete button
- **Layout:** ScrollView with sections: stats bar, filter chips, view toggle, photo groups/grid

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- Photo journal accessible via `/pets/[petId]/photos` route
- Sidebar navigation: "Photos" appears as a sub-nav item under the pet detail
- Photo cards use CSS `backdrop-filter: blur(12px)` for glass effect
- Grid view uses CSS Grid with `grid-template-columns: repeat(3, 1fr)` and `gap: 4px`
- Photo detail opens in a modal dialog with close button
- Delete confirmation uses a modal dialog instead of bottom sheet

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | 4 skeleton photo cards with pulsing animation | Initial data fetch |
| Empty | Camera illustration, "No photos yet", "Add your first photo" button | No photos for this pet |
| Populated (Timeline) | Month/year groups with photo cards, stats bar, filter chips | Photos exist, timeline view selected |
| Populated (Grid) | 3-column thumbnail grid with stats bar and filter chips | Photos exist, grid view selected |
| Filtered | Timeline/grid showing only photos matching selected milestone | Milestone filter chip tapped |
| Filtered Empty | "No [milestone] photos yet" message with illustration | Milestone filter active but no matching photos |
| Error | Toast: "Could not load photos." with retry action | Database read fails |

## Test Requirements

### Unit Tests (engine/photos.ts)
- [ ] `getPhotoTimeline`: groups 5 photos across 3 months into 3 groups in reverse chronological order
- [ ] `getPhotoTimeline`: returns single group when all photos are in the same month
- [ ] `getPhotoTimeline`: uses `created_at` when `taken_at` is null for grouping
- [ ] `getPhotoTimeline`: returns empty array when no photos exist
- [ ] `getPhotoTimeline`: handles photos with mixed null and non-null `taken_at`
- [ ] `getPhotoTimeline`: paginates at 50 photos per page
- [ ] `getMilestonePhotos`: returns only photos with matching milestone_tag
- [ ] `getMilestonePhotos`: returns empty array when no photos match
- [ ] `getMilestonePhotos`: returns all milestone types correctly (first_day, birthday, etc.)
- [ ] `getPhotoStats`: returns correct total count for 10 photos
- [ ] `getPhotoStats`: returns correct first and most recent dates
- [ ] `getPhotoStats`: returns null dates when no photos exist
- [ ] `getPhotoStats`: uses `created_at` fallback for photos with no `taken_at`

### Integration Tests (CRUD)
- [ ] `updatePetPhoto`: updates caption and milestone_tag, other fields unchanged
- [ ] `updatePetPhoto`: setting milestone_tag to null removes the tag
- [ ] `deletePetPhoto`: removes photo record from database
- [ ] `deletePetPhoto`: does not affect other photos for the same pet
- [ ] `getPhotosByMilestone`: returns correct photos filtered by tag
- [ ] `getPhotosByMilestone`: returns empty array for unused milestone tag
- [ ] Delete pet cascades to all photo records

### QA Verification Script

1. Open the app on mobile (iOS simulator or device)
2. Navigate to MyPets module from hub dashboard
3. Tap an existing pet (or create one: "Luna", dog, golden retriever)
4. Navigate to the "Photos" tab on the pet detail screen
5. **Verify empty state:** See camera illustration and "Add your first photo" button -- AC-9
6. Add 5 photos with varying dates and milestone tags (first_day, birthday, vet_visit, silly, none)
7. **Verify timeline view:** Photos grouped by month with group headers showing month/year and count -- AC-1
8. **Verify stats bar:** Shows "5 photos", first date, and most recent date -- AC-2
9. Tap the "Birthday" milestone filter chip
10. **Verify filtering:** Only the birthday-tagged photo appears -- AC-3
11. **Verify active chip:** Birthday chip is highlighted in amber -- AC-4
12. Tap the "All" chip to clear the filter
13. Tap the grid view toggle
14. **Verify grid view:** 3-column compact thumbnails without captions -- AC-8
15. Tap a photo to open detail view
16. **Verify detail view:** Full image, caption, milestone tag, and date visible -- AC-5
17. Tap "Edit", change caption to "Luna's first snow day", change milestone to "holiday", save
18. **Verify update:** Caption and milestone badge update on the card -- AC-6
19. Long-press a different photo
20. **Verify confirmation dialog:** "Delete this photo? This cannot be undone." appears -- AC-7
21. Confirm deletion
22. **Verify deletion:** Photo removed, stats bar updates to "4 photos" -- AC-7, AC-2
23. Create a second pet "Max" with photos
24. **Verify isolation:** Max's photos are completely independent from Luna's -- NC-1

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- pets module has no standalone counterpart (skip)
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- `pt_pet_photos` table exists (V2) with columns: id, pet_id, image_uri, caption, milestone_tag, taken_at, created_at
- `createPetPhoto()` and `listPetPhotosForPet()` CRUD exist in `crud.ts`
- `PetPhotoSchema` and `CreatePetPhotoInputSchema` Zod schemas exist in `types.ts`
- No photo timeline grouping by month/year
- No milestone filtering
- No photo update (caption/milestone editing)
- No photo deletion
- No photo stats
- No mobile or web UI screens for photo browsing

### After This Work
- New engine file `engine/photos.ts` with `getPhotoTimeline()`, `getMilestonePhotos()`, `getPhotoStats()`
- New Zod types: `MilestoneTagSchema` enum, `PhotoTimelineGroup`, `PhotoStats`
- Enhanced CRUD: `updatePetPhoto()`, `deletePetPhoto()`, `getPhotosByMilestone()`
- Mobile screen at `apps/mobile/app/(pets)/photos.tsx` with timeline/grid views, milestone filter, photo detail
- Web page at `apps/web/app/pets/[petId]/photos/page.tsx`
- 20+ new tests covering engine logic and CRUD operations

### Files Changed

- `modules/pets/src/engine/photos.ts` -- NEW: getPhotoTimeline, getMilestonePhotos, getPhotoStats
- `modules/pets/src/types.ts` -- New: MilestoneTagSchema enum, PhotoTimelineGroup type, PhotoStats type, UpdatePetPhotoInputSchema
- `modules/pets/src/db/crud.ts` -- New CRUD: updatePetPhoto, deletePetPhoto, getPhotosByMilestone
- `modules/pets/src/index.ts` -- Re-export new public API
- `modules/pets/src/__tests__/photos.test.ts` -- Unit + integration tests
- `apps/mobile/app/(pets)/photos.tsx` -- Photo journal screen
- `apps/mobile/app/(pets)/components/PhotoCard.tsx` -- Photo card component
- `apps/web/app/pets/[petId]/photos/page.tsx` -- Web photo journal page

### Known Limitations
- Deleting a photo record does not delete the image file on disk. File cleanup is a separate concern (manual or future garbage collection feature).
- No photo cropping, rotation, or editing beyond caption and milestone tag.
- No multi-select for batch operations (delete, tag).
- No photo sharing or export.
- No cloud backup of photos (privacy-first, local-only).
- Timeline grouping assumes the date portion of `taken_at` or `created_at` is reliable. No timezone normalization.

### Context for Next Agent
- The existing `listPetPhotosForPet()` in `crud.ts` already sorts by `COALESCE(taken_at, created_at) DESC`. The new `getPhotoTimeline()` engine function should receive the sorted list from CRUD and group by month/year in pure function logic, not in SQL.
- The `pt_pet_photos` table uses `milestone_tag TEXT` (nullable). The engine should define the allowed milestone tags as a TypeScript enum/union and validate on write (via Zod schema), but accept any string on read for forward compatibility.
- The `MilestoneTagSchema` should be a Zod enum with values: `first_day`, `birthday`, `adoption_day`, `vet_visit`, `training_milestone`, `grooming`, `holiday`, `silly`, `custom`. These map to display labels in the UI (e.g., "First Day" for `first_day`).
- For `updatePetPhoto`, create an `UpdatePetPhotoInputSchema` similar to the existing `UpdateFeedingScheduleInputSchema` pattern: a partial schema with optional caption and milestone_tag fields.
- The existing `PetPhotoSchema` already has all fields needed for read. No schema changes on the read side.
