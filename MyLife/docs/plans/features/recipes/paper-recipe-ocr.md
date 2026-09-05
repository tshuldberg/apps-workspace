# Feature Spec: Paper Recipe OCR

## Metadata
- **Module:** recipes
- **Priority Score:** 26 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [4] x3 + Complexity [2] x2 + CrossModule [1] x1 + PaidUser [3] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (extractRecipeFromImage already exists in import/ai-recipe-extract.ts)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Millions of home cooks have recipe collections on paper: handwritten family recipes, magazine clippings, printed recipe cards, and cookbook pages. These users want to digitize their collection but the manual effort of typing each recipe is prohibitive. OCR import lets users snap a photo and get a structured recipe in seconds. This feature has the highest switching cost score (4) of all Recipes B-tier features because it solves a migration problem that competitors barely address: getting your grandmother's recipe box into an app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Paprika | Yes | No ($4.99 one-time) | Camera capture, basic OCR, manual correction step |
| AnyList | No | N/A | No OCR support |
| Recipe One | No | N/A | No OCR support |
| Forkee | No | N/A | No OCR support |

### Target User
Home cooks with physical recipe collections (handwritten cards, cookbook pages, magazine clippings) who want to go digital. Primary audience is 35-65 year-olds who inherited family recipes and fear losing them. Also targets Paprika users ($4.99) who find its OCR quality lacking, especially on handwritten text. MyLife uses Claude Vision which significantly outperforms traditional OCR on handwriting.

## Technical Context

### Where This Lives in MyLife

```
modules/recipes/src/
  import/
    ai-recipe-extract.ts            -- ALREADY EXISTS: extractRecipeFromImage() handles the AI call
    index.ts                         -- ALREADY EXPORTS extractRecipeFromImage

apps/mobile/app/(recipes)/
  scan-recipe.tsx                    -- NEW: camera capture screen with preview + confirm flow
  components/ScanPreview.tsx         -- NEW: image preview with crop/rotate before OCR
  components/OcrReviewForm.tsx       -- NEW: editable form showing extracted recipe for correction

apps/web/app/recipes/
  scan/page.tsx                      -- NEW: file upload + drag-and-drop OCR flow
  components/OcrReviewForm.tsx       -- NEW: web version of review form
```

### Wireframe Position

```
Hub Dashboard
  └── MyRecipes card
       └── Recipes tab
            └── [+] Add Recipe button
                 └── Import from Photo ← YOU ARE HERE
                      ├── Camera Capture (mobile)
                      │   └── Preview + Crop
                      │        └── OCR Processing (loading)
                      │             └── Review & Edit Form
                      │                  └── Save Recipe
                      └── File Upload (web)
                           └── Preview
                                └── OCR Processing
                                     └── Review & Edit Form
                                          └── Save Recipe
```

### Data Model

No new tables required. The feature produces a standard `CreateRecipe` + `CreateIngredient[]` that feeds into existing `createRecipe` and `addIngredient` CRUD functions.

The OCR pipeline:
1. Capture/upload image -> base64 encode
2. Call `extractRecipeFromImage(base64, apiKey)` (already exists)
3. Returns `ParsedRecipe | null`
4. User reviews and edits in form
5. Save via existing `createRecipe` + `addIngredient` + `addTag`

### Dependencies
- **Internal:** `@mylife/recipes` (extractRecipeFromImage, createRecipe, addIngredient, parseIngredientText)
- **External:** Claude API (Haiku 4.5) for vision-based extraction (already integrated), expo-camera (mobile), expo-image-manipulator (crop/resize)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a home cook with a recipe box, I want to photograph a recipe card and have it digitized so that I can search and use it from my phone.
2. As a cookbook owner, I want to scan a cookbook page and extract just the recipe so that I don't have to type it manually.
3. As a user reviewing OCR results, I want to correct any extraction errors before saving so that my recipe is accurate.

### Behavior Specification

**Mobile Flow:**
1. User taps [+] Add Recipe on the Recipes tab.
2. User selects "Import from Photo" from the add menu.
3. Camera opens in photo mode (not video). User frames the recipe and taps capture.
4. Preview screen shows the captured image with crop handles and a rotate button.
5. User adjusts crop to frame just the recipe content, taps "Scan Recipe."
6. Loading state: "Reading your recipe..." with a subtle scanning animation.
7. `extractRecipeFromImage` is called with the cropped image as base64.
8. On success: OcrReviewForm appears, pre-filled with title, description, ingredients (one per line, editable), steps (numbered, editable), prep/cook time, servings.
9. User reviews and edits any field. Ingredients use the same text input that `parseIngredientText` will process on save.
10. User taps "Save Recipe." System calls `createRecipe`, then `addIngredient` for each ingredient line (after parsing), then adds any detected tags.
11. User lands on the new recipe detail screen.
12. On failure (null returned): error state with "Couldn't read this recipe. Try a clearer photo or better lighting." + retry button.

**Web Flow:**
1. User navigates to Add Recipe and selects "Import from Photo."
2. Drag-and-drop zone or file picker appears (accepts .jpg, .png, .heic, .webp).
3. Preview shows the uploaded image. User clicks "Scan Recipe."
4. Same OCR + review + save flow as mobile (steps 6-12).

**Gallery Import (Mobile):**
1. Alternative to camera: user can tap "Choose from Gallery" to pick an existing photo.
2. Same preview/crop/scan flow follows.

### Edge Cases

- Blurry or low-contrast photo: Claude Vision handles gracefully, returns null if unreadable. Show retry prompt.
- Handwritten recipe in cursive: Claude Vision handles handwriting well. May need more user corrections.
- Multiple recipes on one page: AI extracts the most prominent recipe. User can re-scan for others.
- Very long recipe (>30 ingredients, >20 steps): form scrolls. No artificial limits.
- Non-English recipe: Claude Vision supports multilingual OCR. Recipe saved as-is.
- No API key configured: show "API key required" message with link to Settings.
- Network failure during API call: show offline error with retry button.
- Image > 5MB: resize to max 1920px on longest edge before encoding (expo-image-manipulator).
- User cancels mid-OCR: abort the API call, return to camera/upload screen.
- Module disabled mid-scan: in-progress scan completes but recipe is not saved.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping "Import from Photo" on mobile opens the camera.
- [ ] **AC-2:** Camera capture produces a preview with crop and rotate controls.
- [ ] **AC-3:** Tapping "Scan Recipe" shows a loading state while OCR processes.
- [ ] **AC-4:** Successful OCR populates the review form with title, ingredients, and steps.
- [ ] **AC-5:** User can edit every field in the review form before saving.
- [ ] **AC-6:** Saving the reviewed recipe creates a complete recipe with ingredients and steps.
- [ ] **AC-7:** Failed OCR shows an error message with a retry button.
- [ ] **AC-8:** Web version accepts drag-and-drop or file picker for image upload.
- [ ] **AC-9:** Gallery import works as an alternative to camera capture on mobile.
- [ ] **AC-10:** Large images are resized before sending to the API.

### Technical Criteria
- [ ] **TC-1:** `extractRecipeFromImage` is called with base64-encoded image data and returns a ParsedRecipe.
- [ ] **TC-2:** Image is resized to max 1920px longest edge before base64 encoding.
- [ ] **TC-3:** API call has a 30-second timeout with AbortController.
- [ ] **TC-4:** Each ingredient line from OCR is processed through `parseIngredientText` before saving.
- [ ] **TC-5:** Recipe is created via existing `createRecipe` + `addIngredient` CRUD (no new DB operations).
- [ ] **TC-6:** Supported image formats: JPEG, PNG, HEIC, WebP.

### Negative Criteria
- [ ] **NC-1:** Camera must NOT record video, only capture still photos.
- [ ] **NC-2:** Original photo must NOT be stored permanently (only the recipe data is saved).
- [ ] **NC-3:** OCR must NOT auto-save without user review. The review form is mandatory.
- [ ] **NC-4:** This feature must NOT work offline (requires Claude API call).

## UI Specification

### Mobile (Expo)
- Camera screen: full-screen camera view with capture button (centered bottom), gallery button (bottom-left), close button (top-left).
- Preview screen: image fills top 60%, crop handles overlay, rotate button top-right. "Scan Recipe" button at bottom (accent green #22C55E).
- Loading: centered spinner with "Reading your recipe..." text on `#0A0A0F` background.
- Review form: glass card (`rgba(255,255,255,0.04)`) with labeled text inputs. Title (large), ingredients (multiline, one per line), steps (numbered, multiline), prep/cook time (number inputs), servings (number input). "Save Recipe" button at bottom.
- Error state: centered icon (camera with X), error message, "Try Again" button.

### Web (Next.js)
- Upload zone: dashed border area (`rgba(255,255,255,0.10)`) with drag-and-drop + "Choose File" button.
- Preview: image displayed at max 600px width with "Scan Recipe" button below.
- Same review form layout as mobile, adapted to wider screen (2-column for time/servings).
- Same error state with retry.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Camera/Upload | Camera viewfinder (mobile) or upload zone (web) | Screen opened |
| Preview | Captured/uploaded image with crop controls | Photo taken/file selected |
| Loading | Spinner + "Reading your recipe..." | Scan initiated |
| Success | Pre-filled review form | OCR returned ParsedRecipe |
| Error | Error message + retry button | OCR returned null or API failure |

## Test Requirements

### Unit Tests
- [ ] Image resize function: correctly constrains to max 1920px
- [ ] Image resize function: preserves aspect ratio
- [ ] Image resize function: no-ops on images already under limit
- [ ] Review form: pre-fills all fields from ParsedRecipe
- [ ] Review form: allows editing all fields
- [ ] Save handler: calls createRecipe with form data
- [ ] Save handler: calls addIngredient for each ingredient line
- [ ] Save handler: parses ingredient text through parseIngredientText

### Integration Tests
- [ ] Full flow: capture image -> OCR -> review -> save -> recipe exists in DB
- [ ] Error flow: API returns null -> error screen -> retry -> success

### QA Verification Script

1. Open the app on iOS simulator.
2. Navigate to MyRecipes > Recipes tab.
3. Tap [+] Add Recipe.
4. Tap "Import from Photo."
5. Verify: Camera opens -- corresponds to AC-1.
6. Take a photo of a printed recipe (use a test image).
7. Verify: Preview shows with crop handles and rotate -- corresponds to AC-2.
8. Tap "Scan Recipe."
9. Verify: Loading state with "Reading your recipe..." appears -- corresponds to AC-3.
10. Wait for OCR to complete.
11. Verify: Review form is populated with recipe title, ingredients, and steps -- corresponds to AC-4.
12. Edit the recipe title to append " (edited)."
13. Verify: Title field accepts edits -- corresponds to AC-5.
14. Tap "Save Recipe."
15. Verify: Recipe detail screen opens with the saved recipe including all ingredients and steps -- corresponds to AC-6.
16. Go back to Add Recipe > Import from Photo.
17. Take a photo of a blank surface.
18. Tap "Scan Recipe."
19. Verify: Error message appears with retry button -- corresponds to AC-7.
20. Open the web app at `/recipes`.
21. Navigate to Add Recipe > Import from Photo.
22. Verify: Drag-and-drop upload zone appears -- corresponds to AC-8.
23. Upload a recipe image.
24. Complete the scan + review + save flow.
25. Verify: Recipe saved successfully.

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate through camera/upload -> preview -> OCR -> review -> save flow

### Post-merge:
- [ ] `/parity-check` -- recipes module has archived standalone

## Handoff State

### Before This Work
- `extractRecipeFromImage(base64, apiKey)` exists in `import/ai-recipe-extract.ts` and works.
- `parseIngredientText(text)` exists in `parser/index.ts` for structured ingredient parsing.
- No UI exists for camera-based recipe import.
- The "Add Recipe" flow currently supports manual entry and URL import only.

### After This Work
- Mobile camera capture screen with crop/rotate preview.
- Web file upload with drag-and-drop.
- OCR review form for user correction before saving.
- Complete photo-to-recipe pipeline using existing AI extraction.

### Files Changed
- `apps/mobile/app/(recipes)/scan-recipe.tsx` -- NEW: camera capture screen
- `apps/mobile/app/(recipes)/components/ScanPreview.tsx` -- NEW: image preview with crop
- `apps/mobile/app/(recipes)/components/OcrReviewForm.tsx` -- NEW: editable review form
- `apps/web/app/recipes/scan/page.tsx` -- NEW: web upload + OCR flow
- `apps/web/app/recipes/components/OcrReviewForm.tsx` -- NEW: web review form
- `modules/recipes/src/definition.ts` -- MODIFIED: add scan-recipe screen to navigation

### Known Limitations
- Multi-recipe page scanning extracts only one recipe per scan.
- No batch scanning (scan 10 pages at once) in this version.
- Handwriting quality heavily depends on legibility; very messy handwriting may need full manual entry.
- Original photo is not retained after OCR (no image attached to recipe).

### Context for Next Agent
- `extractRecipeFromImage` in `import/ai-recipe-extract.ts` already handles the Claude API call. Do NOT create a new extraction function; use the existing one.
- The function returns `ParsedRecipe | null`. Null means extraction failed.
- `parseIngredientText` in `parser/index.ts` converts free-text ingredient lines to structured `ParsedIngredient` objects. Run each OCR ingredient line through it before calling `addIngredient`.
- expo-camera and expo-image-manipulator are not yet in package.json; add them as dependencies.
- ANTHROPIC_API_KEY is stored in app settings via `getSetting(db, 'api_key')`.
