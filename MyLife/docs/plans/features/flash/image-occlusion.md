# Feature Spec: Image Occlusion

## Metadata
- **Module:** flash
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 4 x3 + Switching 3 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 2 x1
- **Sprint:** Sprint 6+ (B+C Features)
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Rich media cards (A-tier, fl_media table and media infrastructure must exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Image occlusion is the killer feature for visual learners, especially medical students studying anatomy, geography students learning maps, and engineering students memorizing circuit diagrams. The user places rectangular masks over parts of an image, and during review each mask becomes a separate card: the occluded region is hidden and the student must recall what's underneath. This is Anki's signature advanced feature and the #1 reason Anki power users resist switching to simpler apps. Adding this to MyFlash closes the gap for the most valuable flashcard segment: students who pay for tools that help them pass high-stakes exams.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Anki | Yes | Free (desktop) / $29.99 (iOS) | "Image Occlusion Enhanced" add-on (now built-in on desktop). SVG mask editor with rectangle, ellipse, polygon shapes. Generates one card per mask. |
| Quizlet | No | N/A | No image occlusion. Images are static illustrations only. |
| Brainscape | No | N/A | No image occlusion. |
| StudyFetch | No | N/A | No image occlusion. AI focus instead. |

### Target User
Medical students (anatomy diagrams with labeled structures), geography students (blank maps), language learners (labeled scene images), and Anki power users who rely on the Image Occlusion Enhanced add-on. This is a narrow but extremely passionate segment: users who need this feature will not use an app that lacks it, regardless of how good everything else is.

## Technical Context

### Where This Lives in MyLife

```
modules/flash/src/occlusion/types.ts               -- OcclusionRegion, OcclusionCard types
modules/flash/src/occlusion/engine.ts               -- Region-to-card generation, mask rendering logic
modules/flash/src/occlusion/index.ts                -- Barrel export
modules/flash/src/occlusion/__tests__/              -- Tests
modules/flash/src/db/occlusion.ts                   -- SQLite CRUD for occlusion regions
modules/flash/src/db/schema.ts                      -- V4 migration: fl_occlusion_regions table
modules/flash/src/definition.ts                     -- Add V4 migration
apps/mobile/app/(flash)/components/OcclusionEditor.tsx  -- Touch-based mask drawing overlay
apps/mobile/app/(flash)/components/OcclusionReview.tsx  -- Review with reveal animation
apps/web/app/flash/components/OcclusionEditor.tsx       -- Mouse/touch mask drawing
apps/web/app/flash/components/OcclusionReview.tsx       -- Web review with reveal
```

### Wireframe Position

```
Hub Dashboard
  └── MyFlash card
       └── Decks tab -> [+] New Card -> Image Occlusion
            └── OcclusionEditor (draw masks on image) <- YOU ARE HERE
```

Also accessible from:
```
Study tab -> Review session (occlusion card type)
  └── OcclusionReview (masks shown, tap to reveal) <- AND HERE
```

### Data Model

One new table in V4 migration:

```sql
-- V4 migration: image occlusion regions
CREATE TABLE IF NOT EXISTS fl_occlusion_regions (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES fl_cards(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES fl_media(id) ON DELETE CASCADE,
  region_index INTEGER NOT NULL DEFAULT 0,
  shape TEXT NOT NULL DEFAULT 'rect' CHECK (shape IN ('rect', 'ellipse')),
  x REAL NOT NULL,
  y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  mask_color TEXT NOT NULL DEFAULT '#FBBF24',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS fl_occlusion_card_idx ON fl_occlusion_regions(card_id);
CREATE INDEX IF NOT EXISTS fl_occlusion_media_idx ON fl_occlusion_regions(media_id);
```

Coordinates are stored as percentages (0.0-1.0) relative to the image dimensions, ensuring resolution independence. The `card_id` links to a card in `fl_cards` where `card_type = 'occlusion'`. Each region generates one card: during review, all other regions are visible but the target region is masked.

Also add to V4 migration:
```sql
-- Extend card_type enum support (no ALTER needed, TEXT column already accepts any value)
-- Convention: occlusion cards have card_type = 'occlusion'
```

Update the `FlashCardTypeSchema` in `types.ts` to include `'occlusion'`.

### Dependencies
- **Internal:** `@mylife/flash` (fl_media table, media infrastructure from rich-media-cards feature), `@mylife/ui` (Cool Obsidian tokens)
- **External:** `expo-image-manipulator` (mobile image processing/resizing), `react-native-gesture-handler` (touch drawing), Canvas API (web drawing)
- **Cross-Module:** None. Self-contained within flash.

## Functional Requirements

### User Stories
1. As a medical student, I want to draw rectangles over parts of an anatomy diagram so that I can quiz myself on each labeled structure.
2. As a geography student, I want to occlude country names on a map so that I can practice identifying locations.
3. As a language learner, I want to mask labels on a scene image so that I can practice vocabulary in context.
4. As a reviewer, I want each occluded region to be a separate flashcard so that I learn each item independently through spaced repetition.
5. As a card creator, I want to edit masks after creation so that I can adjust regions without redoing the whole card.

### Behavior Specification

**Creating an occlusion card:**
1. User navigates to a deck and taps [+] New Card
2. User selects "Image Occlusion" from the card type picker (alongside Basic, Reversed, Cloze)
3. User selects an image from their photo library or camera, or picks an existing `fl_media` image
4. The OcclusionEditor opens full-screen with the image displayed
5. User draws rectangular regions by touch-dragging (mobile) or click-dragging (web)
6. Each drawn region appears as a semi-transparent colored rectangle with a number label (1, 2, 3...)
7. User can tap a region to select it, then: move it, resize it (corner handles), delete it, or change its label
8. User can also draw ellipse shapes by toggling the shape tool
9. User taps "Done" when all regions are placed
10. System generates N cards (one per region) all sharing the same `note_id`
11. Each card's `front` field stores a reference to the source image plus metadata: `[occlusion:media_hash:region_index]`
12. Each card's `back` field stores the label text for that region (user can edit labels before saving)
13. Cards are inserted into `fl_cards` with `card_type = 'occlusion'` and regions into `fl_occlusion_regions`

**Reviewing an occlusion card:**
1. During review, the system renders the source image with all regions drawn
2. The target region (the one being tested) is shown as a solid mask (accent color, fully opaque)
3. All other regions are shown as semi-transparent outlines (so the user can see them for context)
4. User thinks about what's under the target mask, then taps "Show Answer"
5. The target mask fades away (300ms animation) revealing the image underneath
6. The label text appears below the image
7. User rates the card (again/hard/good/easy) using the standard rating buttons
8. Scheduling follows the same FSRS-inspired algorithm as all other cards

**Editing an occlusion card:**
1. User navigates to the card in the browser
2. User taps "Edit Regions"
3. OcclusionEditor reopens with existing regions pre-loaded
4. User can add, move, resize, or delete regions
5. Adding a region creates a new card in the same note
6. Deleting a region marks that card as suspended (data preserved) or deletes it (user choice)
7. Changes save immediately to `fl_occlusion_regions`

### Edge Cases

- **Image deleted from device:** The `fl_media` entry still exists with `local_path`. Show a "Media not found" placeholder and allow the user to re-link the image.
- **Image with no regions drawn:** Block "Done" button. Show tooltip: "Draw at least one region to create cards."
- **Single region only:** Valid. Creates one card. Still useful for simple "what's hidden here?" cards.
- **Overlapping regions:** Allowed. During review, the target region's mask takes priority (solid), overlapping non-target regions stay semi-transparent.
- **Very small regions (< 3% of image area):** Show warning: "This region may be hard to see during review. Continue?" Allow user to proceed.
- **Very large image (> 2048px):** Auto-resize to MAX_IMAGE_DIMENSION (2048px) using existing media infrastructure.
- **Region coordinates after image resize:** Coordinates are stored as percentages (0.0-1.0), so they scale correctly regardless of display resolution.
- **Editing regions that have review history:** Moving or resizing a region does not reset scheduling. Deleting a region prompts: "Delete card and review history?" vs "Suspend card (keep history)".
- **Module disabled mid-edit:** In-memory state is lost. Saved regions persist in SQLite. Re-entering the module shows the last saved state.
- **Importing Anki .apkg with occlusion cards:** Future feature. This spec does not cover import, only native creation and review.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping [+] New Card shows "Image Occlusion" alongside Basic, Reversed, Cloze
- [ ] **AC-2:** After selecting an image, the OcclusionEditor opens full-screen with the image visible
- [ ] **AC-3:** Drawing a rectangle by touch-drag creates a numbered, colored region overlay
- [ ] **AC-4:** Tapping a region selects it with visible corner handles for resize
- [ ] **AC-5:** Dragging a selected region moves it to a new position
- [ ] **AC-6:** Tapping the delete button on a selected region removes it
- [ ] **AC-7:** Toggling the shape tool switches between rectangle and ellipse drawing
- [ ] **AC-8:** Tapping "Done" creates N flashcards (one per region) and returns to the deck view
- [ ] **AC-9:** During review, the target region is shown as a solid mask and all other regions are semi-transparent outlines
- [ ] **AC-10:** Tapping "Show Answer" reveals the masked region with a 300ms fade animation
- [ ] **AC-11:** The label text appears below the image after reveal
- [ ] **AC-12:** Rating buttons (again/hard/good/easy) appear after reveal and schedule the card normally

### Technical Criteria
- [ ] **TC-1:** Occlusion regions persist in `fl_occlusion_regions` with percentage-based coordinates (0.0-1.0)
- [ ] **TC-2:** Cards with `card_type = 'occlusion'` appear in due card queries and browser
- [ ] **TC-3:** Deleting a region deletes the corresponding `fl_cards` row (CASCADE) and its review logs
- [ ] **TC-4:** V4 migration runs cleanly on fresh and existing databases
- [ ] **TC-5:** Region rendering is resolution-independent (correct on iPhone SE through iPad Pro)
- [ ] **TC-6:** Image files are deduplicated via `fl_media.hash` (multiple occlusion sets from the same image share one media file)
- [ ] **TC-7:** `FlashCardTypeSchema` now includes `'occlusion'` and validates correctly

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Creating occlusion cards must NOT affect existing basic/reversed/cloze cards
- [ ] **NC-2:** Resizing/moving a region must NOT reset the card's scheduling (interval, ease, review count)
- [ ] **NC-3:** Deleting the source image from fl_media must NOT crash (show placeholder instead)
- [ ] **NC-4:** Drawing regions must NOT block the UI thread (use requestAnimationFrame for drawing)
- [ ] **NC-5:** Occlusion cards must NOT appear in multiple choice or match game modes (incompatible card type)

## UI Specification

### Mobile (Expo)

**OcclusionEditor (full-screen modal)**
- Background: `#0A0A0F` (background token)
- Image: centered, scaled to fit with aspect ratio preserved, max width 100% / max height 70%
- Region overlay: `rgba(251, 191, 36, 0.4)` fill (accent at 40% opacity) with `#FBBF24` 2px border
- Selected region: corner handles as 12x12 circles in `#FBBF24`
- Toolbar (bottom): shape toggle (rect/ellipse), undo, delete selected, label edit
- "Done" button: top-right, `#FBBF24` background, bold white text
- Region number labels: white text on dark pill, centered on each region

**OcclusionReview (within standard review session)**
- Image: centered, same scaling as editor
- Target mask: solid `#FBBF24` fill with slight rounded corners (4px)
- Other regions: `rgba(251, 191, 36, 0.15)` fill with dashed `#FBBF24` border
- Reveal animation: target mask opacity 1.0 -> 0.0 over 300ms, ease-out
- Label text: below image, `fontSize: 18`, `fontWeight: 600`, color `#F0F0F5`

### Web (Next.js)

- Same design tokens via CSS variables
- Editor: cursor changes to crosshair in drawing mode
- Region drawing via mouse events (mousedown -> mousemove -> mouseup)
- Touch support via pointer events for tablet users
- Route: `/flash/occlusion/new?deck=DECK_ID` (editor), integrated into review session at `/flash/review`

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton placeholder for image | Image loading from storage |
| Empty | Image displayed, no regions, "Draw regions on the image" prompt | First open after image selection |
| Drawing | Crosshair cursor, region preview following finger/mouse | Touch/click drag in progress |
| Editing | Selected region with handles, toolbar active | Region tapped/clicked |
| Review-masked | Image with solid mask on target, semi-transparent others | Occlusion card shown in review |
| Review-revealed | All regions visible, label text shown, rating buttons | "Show Answer" tapped |

## Test Requirements

### Unit Tests
- [ ] `generateOcclusionCards(mediaId, regions)`: creates N cards from N regions
- [ ] `generateOcclusionCards(mediaId, [])`: throws error (no regions)
- [ ] `generateOcclusionCards(mediaId, regions)`: all cards share same note_id
- [ ] `generateOcclusionCards(mediaId, regions)`: card_type is 'occlusion' for all
- [ ] `percentToPixel(0.5, 1000)`: returns 500
- [ ] `percentToPixel(0.0, 1000)`: returns 0
- [ ] `percentToPixel(1.0, 1000)`: returns 1000
- [ ] `regionContainsPoint(region, point)`: true for point inside rect
- [ ] `regionContainsPoint(region, point)`: false for point outside rect
- [ ] `regionContainsPoint(ellipseRegion, point)`: correct ellipse hit detection
- [ ] `clampRegion(region)`: clamps x/y/width/height to 0.0-1.0 range
- [ ] V4 migration: `fl_occlusion_regions` table created successfully
- [ ] V4 migration: existing V3 data unaffected

### Integration Tests
- [ ] Full flow: select image -> draw 3 regions -> save -> 3 cards appear in deck with correct types
- [ ] Review flow: occlusion card appears -> mask shown -> reveal -> rate -> scheduling updates
- [ ] Edit flow: open existing occlusion card -> add region -> new card created -> delete region -> card deleted

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyFlash via hub dashboard
3. Open a deck, tap [+] New Card
4. **Verify:** "Image Occlusion" option is visible (AC-1)
5. Tap "Image Occlusion"
6. Select an image from the photo library
7. **Verify:** OcclusionEditor opens full-screen with image displayed (AC-2)
8. Draw a rectangle by touch-dragging on the image
9. **Verify:** A numbered, colored rectangle appears (AC-3)
10. Draw two more rectangles on different parts of the image
11. Tap the first rectangle
12. **Verify:** Corner handles appear for resize (AC-4)
13. Drag the selected rectangle to a new position
14. **Verify:** Region moves smoothly (AC-5)
15. Tap the delete button in the toolbar
16. **Verify:** Selected region is removed (AC-6)
17. Toggle to ellipse shape tool, draw an ellipse
18. **Verify:** Ellipse region appears (AC-7)
19. Tap "Done"
20. **Verify:** Cards are created (one per region) and deck view shows them (AC-8)
21. Start a review session with the new occlusion cards
22. **Verify:** Target region is solid mask, others are semi-transparent (AC-9)
23. Tap "Show Answer"
24. **Verify:** Mask fades away with smooth animation (AC-10)
25. **Verify:** Label text appears below image (AC-11)
26. Tap "Good" to rate
27. **Verify:** Card is scheduled normally (AC-12)
28. Open the card browser, find an occlusion card, tap "Edit Regions"
29. Add a new region and save
30. **Verify:** A new card is created in the same note
31. Open web at /flash, repeat steps 5-27 using mouse
32. **Verify:** Mouse-based drawing works identically

## gstack Quality Gates

Based on this feature's complexity score (2 -- Large), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in flash module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for occlusion region engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
The flash module has V3 schema with `fl_media` table, media types, and media CRUD. Card types support basic, reversed, and cloze. There is no concept of image regions, no occlusion card type, and no visual mask editor.

### After This Work
- New `fl_occlusion_regions` table (V4 migration) stores mask rectangles/ellipses per card
- `FlashCardTypeSchema` includes `'occlusion'`
- OcclusionEditor component on mobile and web for drawing regions on images
- OcclusionReview component for masked review with reveal animation
- Occlusion cards participate in standard SRS scheduling

### Files Changed
- `modules/flash/src/occlusion/types.ts` -- New: OcclusionRegion, OcclusionCard types
- `modules/flash/src/occlusion/engine.ts` -- New: region-to-card generation, coordinate math
- `modules/flash/src/occlusion/index.ts` -- New: barrel export
- `modules/flash/src/occlusion/__tests__/engine.test.ts` -- New: unit tests
- `modules/flash/src/db/occlusion.ts` -- New: CRUD for fl_occlusion_regions
- `modules/flash/src/db/schema.ts` -- Add V4 migration SQL
- `modules/flash/src/definition.ts` -- Add FLASH_MIGRATION_V4
- `modules/flash/src/types.ts` -- Add 'occlusion' to FlashCardTypeSchema
- `modules/flash/src/index.ts` -- Export occlusion types and functions
- `apps/mobile/app/(flash)/components/OcclusionEditor.tsx` -- New: touch-based mask editor
- `apps/mobile/app/(flash)/components/OcclusionReview.tsx` -- New: review with mask reveal
- `apps/web/app/flash/components/OcclusionEditor.tsx` -- New: web mask editor
- `apps/web/app/flash/components/OcclusionReview.tsx` -- New: web review with reveal

### Known Limitations
- V1 does not support polygon shapes (Anki does). Rectangle and ellipse cover 95% of use cases.
- V1 does not import Anki Image Occlusion Enhanced `.apkg` files (future import feature).
- No AI-assisted region suggestion ("auto-detect labels on diagram"). Could be a future enhancement.
- No group masking mode (Anki supports "hide all, guess one" vs "hide one, guess one"). V1 is "hide one" only.

### Context for Next Agent
- The `fl_media` table and media infrastructure MUST exist before building this feature. The rich-media-cards spec (A-tier) is a hard dependency.
- Coordinates are percentages (0.0-1.0) for resolution independence. Do not store pixel values.
- Occlusion cards should be excluded from multiple choice and match game modes (those modes depend on text-based front/back content).
- The `note_id` on all cards from one occlusion set must be the same, so sibling burying works correctly (existing bury logic keys off note_id).
- The V4 migration must check that V3 tables exist (fl_media) since occlusion depends on them.
