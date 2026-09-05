# Feature Spec: AI Plant Identification

## Metadata
- **Module:** garden
- **Priority Score:** 28 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 5 x3 + Complexity 1 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2+
- **Estimated CC Time:** 4-6 hours
- **Depends On:** none (gd_plants table exists)
- **Blocks:** disease/pest diagnosis (shares camera + ML infrastructure)

## Business Context

### Why This Feature Exists
Plant identification is the #1 feature that drives downloads for garden apps. Users frequently encounter unknown plants (gifts, inherited gardens, nursery impulse buys, hiking finds) and want instant identification. PlantIn and PictureThis have built $100M+ businesses primarily on this single feature. For MyLife, this is the highest switching-motivation feature in the garden module (5/5 switching score) because users who already pay for PlantIn ($29.99/yr) would switch if MyLife offered comparable identification without uploading photos to external servers.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| PlantIn | Yes | Yes ($29.99/yr) | Cloud AI via photo upload, 90%+ accuracy, returns species + care info. Photos stored on their servers. |
| PictureThis | Yes | Yes ($29.99/yr) | Cloud AI via photo upload, supports 17,000+ species. Harvests EXIF GPS data from photos. |
| Planta | No | N/A | No identification feature. Relies on manual species lookup. |
| Seed to Spoon | No | N/A | Manual plant selection only. |

### Target User
PlantIn/PictureThis users paying $30/yr who are uncomfortable with cloud photo uploads. Also new plant owners who receive gifted plants and need identification. The privacy angle is key: competitor apps upload every plant photo to their servers, including EXIF metadata revealing home location and layout. MyLife runs identification entirely on-device.

## Technical Context

### Where This Lives in MyLife

```
modules/garden/src/engine/identification.ts    -- On-device ML inference wrapper
modules/garden/src/engine/species-db.ts        -- Bundled species database (top 500 houseplants + 200 common garden plants)
modules/garden/src/types.ts                    -- Add IdentificationResult, IdentificationSource types
modules/garden/src/db/crud.ts                  -- Add identification CRUD operations
modules/garden/src/db/schema.ts                -- Add gd_identifications table (V2 migration)
modules/garden/src/definition.ts               -- Add V2 migration
apps/mobile/app/(garden)/identify.tsx          -- Camera capture + results screen
apps/mobile/app/(garden)/components/IdentifyResultCard.tsx  -- Result display component
apps/web/app/garden/identify/page.tsx          -- Web: file upload + results
```

### Wireframe Position

```
Hub Dashboard
  └── MyGarden card
       └── Garden tab
            └── FAB menu or top-bar camera icon
                 └── Identify Plant ← YOU ARE HERE
```

Also accessible from:
- Add Plant screen: "Identify from Photo" option pre-fills species
- Plant Detail screen: "Re-identify" action in overflow menu

### Data Model

```sql
-- V2 migration: plant identification results
CREATE TABLE IF NOT EXISTS gd_identifications (
  id TEXT PRIMARY KEY,
  plant_id TEXT REFERENCES gd_plants(id) ON DELETE SET NULL,
  image_uri TEXT NOT NULL,
  top_species TEXT,
  top_common_name TEXT,
  top_confidence REAL,
  all_results_json TEXT,
  source TEXT NOT NULL DEFAULT 'on_device',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS gd_identifications_plant_idx ON gd_identifications(plant_id);
CREATE INDEX IF NOT EXISTS gd_identifications_date_idx ON gd_identifications(created_at DESC);
```

**Column notes:**
- `top_species`: Best-match botanical name (e.g., "Monstera deliciosa")
- `top_common_name`: Best-match common name (e.g., "Swiss Cheese Plant")
- `top_confidence`: 0.0-1.0 confidence score for the top match
- `all_results_json`: JSON array of top 5 matches, each with `{ species, commonName, confidence }`
- `source`: 'on_device' (Core ML / NNAPI) or 'manual' (user confirmed/corrected)

### Dependencies
- **Internal:** `@mylife/garden` (types, crud, schema), `@mylife/ui` (Cool Obsidian tokens)
- **External:** `expo-camera` (photo capture), `expo-image-picker` (gallery selection), platform ML APIs (Core ML on iOS via `react-native-vision-camera` frame processor, NNAPI on Android). For V1, use a pre-trained TFLite plant classification model (~30MB) via `@infinitered/react-native-mlkit` or equivalent.
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a plant owner, I want to take a photo of an unknown plant and get its species identified so that I can look up proper care instructions.
2. As a plant owner, I want to see multiple candidate matches ranked by confidence so that I can pick the correct one if the top match is wrong.
3. As a plant owner, I want to save an identification result to my plant record so that the species is automatically filled in.
4. As a privacy-conscious user, I want identification to happen entirely on my device so that my plant photos are never uploaded to any server.
5. As a plant owner, I want to correct a wrong identification so that my plant record has accurate species info.

### Behavior Specification

**Happy path: identify from camera**
1. User taps the camera/identify icon on the Garden tab (FAB or top-bar button)
2. Camera opens in a viewfinder mode with a centered frame guide and text: "Point at the plant"
3. User captures a photo (tap shutter button) or selects from gallery
4. Loading state: "Identifying..." with a plant-themed skeleton animation (1-3 seconds)
5. Results screen shows:
   - The captured photo at the top
   - Top match: species name, common name, confidence percentage (e.g., "95% match"), and a thumbnail from the bundled species database
   - "Other possibilities" section: next 4 matches with name + confidence
6. User taps "Use this result" on the top match (or taps another match to select it)
7. If user came from "Add Plant" flow: species, common name, and photo are pre-filled. User returns to Add Plant form.
8. If user came from standalone identify: prompt "Save to your garden?" with options "Add as New Plant" (goes to Add Plant with fields pre-filled) or "Link to Existing Plant" (shows plant picker) or "Just Viewing" (dismisses)
9. Identification result is saved to gd_identifications regardless of user choice

**Correction flow:**
1. User views identification result or plant detail with linked identification
2. User taps "Not correct?" or "Re-identify"
3. Options: "Try again with new photo" (re-opens camera) or "Set species manually" (opens species search from bundled DB)
4. If manual correction: new identification record saved with source='manual', plant species updated

### Edge Cases

- **Low confidence (<50%):** Show a warning banner: "Low confidence result. Try a clearer photo with better lighting." Still show results but with muted styling.
- **No match found:** Show "Could not identify this plant. Try a different angle or closer photo." Offer manual species search.
- **Photo of non-plant:** Model may return a result with very low confidence. Threshold at 20% -- below that, show "This doesn't appear to be a plant."
- **Camera permission denied:** Show permission explanation screen with "Open Settings" button.
- **Very large photo:** Resize to 640x640 before inference to keep memory usage reasonable.
- **Model not downloaded yet:** First launch shows "Downloading plant recognition model (30MB)..." with progress bar. Model cached locally after first download.
- **Offline with model cached:** Works fully offline. This is the primary use case.
- **Multiple plants in frame:** Model identifies the most prominent plant. Note: "For best results, photograph one plant at a time."
- **Module disabled mid-identification:** Discard result, return to hub.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping identify icon opens camera viewfinder with frame guide
- [ ] **AC-2:** Capturing a photo shows loading state, then results within 3 seconds on-device
- [ ] **AC-3:** Top result displays species name, common name, confidence percentage, and thumbnail
- [ ] **AC-4:** Up to 5 candidate matches shown, ranked by confidence
- [ ] **AC-5:** Selecting a result and tapping "Add as New Plant" pre-fills the Add Plant form with species, common name, and photo
- [ ] **AC-6:** Selecting "Link to Existing Plant" opens a plant picker and updates that plant's species
- [ ] **AC-7:** "Not correct?" flow allows re-identification or manual species selection
- [ ] **AC-8:** Gallery selection works as an alternative to camera capture
- [ ] **AC-9:** Results screen is scrollable and works for plants with long species names

### Technical Criteria
- [ ] **TC-1:** Identification results are persisted to gd_identifications table with all fields populated
- [ ] **TC-2:** On-device inference completes in <3 seconds on iPhone 12 / Pixel 6 equivalent
- [ ] **TC-3:** Model file is <50MB and cached locally after first download
- [ ] **TC-4:** No network calls during identification (after model is cached)
- [ ] **TC-5:** Photo is resized to 640x640 before inference
- [ ] **TC-6:** Confidence below 20% shows "not a plant" message
- [ ] **TC-7:** All identification CRUD operations handle null plant_id correctly

### Negative Criteria
- [ ] **NC-1:** Photos must NOT be transmitted to any external server
- [ ] **NC-2:** EXIF metadata must NOT be stored or transmitted
- [ ] **NC-3:** Identification must NOT require network connectivity (after model download)
- [ ] **NC-4:** Feature must NOT crash if camera hardware is unavailable (simulator, web)
- [ ] **NC-5:** Deleting a plant must NOT delete unlinked identification records
- [ ] **NC-6:** Identification must NOT modify any plant data until user explicitly confirms

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#22C55E` (garden green)
- Camera viewfinder: full-screen with semi-transparent overlay, centered square frame guide with rounded corners in accent color
- Results cards: glass morphism, species name in accent color, confidence as a horizontal progress bar
- Top match card: slightly larger with accent border glow
- Shutter button: 64px circle with accent color ring

### Web (Next.js)

- Same tokens via CSS variables in `globals.css`
- No camera access -- file upload only: drag-and-drop zone + "Choose File" button
- Results displayed in a 2-column layout: uploaded image left, results list right
- Accessible via `/garden/identify` route

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Identifying..." with animated plant icon | Photo captured/selected |
| Empty | Camera viewfinder with guide | Screen opened |
| Error | "Could not identify. Try a different photo." + retry button | ML inference fails |
| Success | Top match + alternatives list | Inference completes with confidence >= 20% |
| Partial | "Low confidence" warning banner above results | Top confidence 20-50% |
| No Match | "Doesn't appear to be a plant" message | Top confidence < 20% |
| Model Download | Progress bar: "Downloading plant model (30MB)..." | First launch, model not cached |

## Test Requirements

### Unit Tests
- [ ] `identifyPlant()`: returns sorted results array with confidence scores
- [ ] `identifyPlant()`: handles empty/null image input gracefully
- [ ] `saveIdentification()`: persists record with all fields
- [ ] `getIdentificationsForPlant()`: returns records ordered by date DESC
- [ ] `linkIdentificationToPlant()`: updates plant species fields
- [ ] Image resize utility: correctly scales to 640x640
- [ ] Confidence threshold logic: <20% returns no-match, 20-50% returns low-confidence

### Integration Tests
- [ ] Full flow: capture photo -> identify -> save result -> verify in DB
- [ ] Correction flow: identify -> mark incorrect -> re-identify -> verify updated record
- [ ] Link flow: identify -> link to existing plant -> verify plant species updated

### QA Verification Script

1. Open the app on iOS/Android
2. Navigate to MyGarden module
3. Tap the identify/camera icon
4. Verify: camera opens with frame guide and "Point at the plant" text -- AC-1
5. Point at a plant (or use a photo of a Monstera from gallery)
6. Tap shutter button
7. Verify: loading state appears ("Identifying...") -- AC-2
8. Verify: results appear within 3 seconds -- AC-2, TC-2
9. Verify: top result shows species, common name, confidence % -- AC-3
10. Verify: up to 5 alternatives shown below top result -- AC-4
11. Tap "Add as New Plant"
12. Verify: Add Plant form has species, name, and photo pre-filled -- AC-5
13. Go back, re-identify
14. Tap "Link to Existing Plant"
15. Verify: plant picker appears, selecting a plant updates its species -- AC-6
16. On results screen, tap "Not correct?"
17. Verify: correction options appear (re-identify or manual search) -- AC-7
18. Test gallery selection: tap gallery icon instead of shutter
19. Verify: gallery opens and selected photo is identified -- AC-8
20. Open airplane mode (after model is cached)
21. Identify a plant
22. Verify: identification works offline -- TC-4, NC-3
23. Check SQLite: verify gd_identifications has the new record -- TC-1
24. On web: navigate to /garden/identify
25. Verify: file upload zone appears (no camera)
26. Upload a plant photo
27. Verify: identification results display in 2-column layout

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for confidence thresholding logic

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
Garden module has 5 tables (gd_plants, gd_entries, gd_zones, gd_seeds, gd_settings) at schema version 1. No identification capability exists. Users must manually enter species names.

### After This Work
- New gd_identifications table (V2 migration)
- On-device ML identification engine with bundled TFLite model
- Camera-based identification flow on mobile
- File-upload identification on web
- Identification results linkable to plant records
- Bundled species database with top 700 plants

### Files Changed
- `modules/garden/src/engine/identification.ts` -- ML inference wrapper, confidence thresholding
- `modules/garden/src/engine/species-db.ts` -- Bundled species lookup database
- `modules/garden/src/types.ts` -- IdentificationResult, IdentificationSource types
- `modules/garden/src/db/crud.ts` -- Identification CRUD operations
- `modules/garden/src/db/schema.ts` -- gd_identifications CREATE TABLE
- `modules/garden/src/definition.ts` -- V2 migration added
- `apps/mobile/app/(garden)/identify.tsx` -- Camera + results screen
- `apps/mobile/app/(garden)/components/IdentifyResultCard.tsx` -- Result card component
- `apps/web/app/garden/identify/page.tsx` -- Web upload + results page

### Known Limitations
- V1 model covers ~700 species (top houseplants + common garden plants). Rare or regional species may not be recognized.
- Web version uses file upload only (no live camera).
- Model accuracy depends heavily on photo quality -- poor lighting or distant shots reduce confidence.

### Context for Next Agent
- The ML model file should be hosted as a static asset and downloaded on first use, not bundled in the app binary (keeps app size down).
- The disease/pest diagnosis feature (separate spec) reuses the same camera infrastructure and can share the viewfinder component.
- The `source` field in gd_identifications distinguishes AI results from manual corrections, which matters for accuracy analytics later.
