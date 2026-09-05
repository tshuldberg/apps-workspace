# Feature Spec: Video Recipe Import (YouTube/TikTok)

## Metadata
- **Module:** recipes
- **Priority Score:** 24 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [4] x3 + Complexity [1] x2 + CrossModule [1] x1 + PaidUser [3] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (social media detection and AI text extraction already exist)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Video recipe content on TikTok and YouTube has exploded. Users discover recipes while scrolling, but saving a video link is not the same as having a structured recipe with ingredients and steps. Video recipe import extracts the recipe from a video's metadata (title, description, captions) and creates a structured recipe the user can cook from. The switching cost score is highest (4) because users accumulate large "saved videos" collections on these platforms and need a way to migrate that knowledge into their recipe app.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Recipe One | Yes | Subscription | Paste YouTube/TikTok URL, extracts recipe from description, saves video thumbnail |
| Forkee | Yes | Free | TikTok/YouTube import, AI extraction from captions, social sharing |
| Paprika | No | N/A | URL import only for blog recipes, not video platforms |
| AnyList | No | N/A | No video import |

### Target User
Gen Z and Millennial home cooks (18-35) who discover recipes primarily through TikTok and YouTube. They save dozens of recipe videos but never cook them because opening the video, pausing, and scrubbing to find ingredients is too much friction. They want to paste a URL and get a structured recipe they can follow step-by-step.

## Technical Context

### Where This Lives in MyLife

```
modules/recipes/src/
  import/
    social-media.ts                  -- ALREADY EXISTS: detectPlatform(), fetchSocialMetadata()
    ai-recipe-extract.ts             -- ALREADY EXISTS: extractRecipeFromText()
    video-import.ts                  -- NEW: orchestrates social fetch + AI extraction pipeline
    video-import.test.ts             -- NEW: unit tests
  index.ts                           -- ADD exports for importRecipeFromVideo

apps/mobile/app/(recipes)/
  import-video.tsx                   -- NEW: URL paste screen with platform detection + preview
  components/VideoPreview.tsx        -- NEW: shows thumbnail, title, author before import

apps/web/app/recipes/
  import-video/page.tsx              -- NEW: web URL paste + import flow
  components/VideoPreview.tsx        -- NEW: web video preview
```

### Wireframe Position

```
Hub Dashboard
  └── MyRecipes card
       └── Recipes tab
            └── [+] Add Recipe button
                 └── Import from Video ← YOU ARE HERE
                      ├── URL Paste input
                      ├── Platform detection badge (YouTube/TikTok)
                      ├── Video Preview (thumbnail + title + author)
                      ├── "Extract Recipe" button
                      └── Review & Edit Form (same as OCR flow)
                           └── Save Recipe
```

### Data Model

No new tables required. The video import pipeline produces a standard `CreateRecipe` + `CreateIngredient[]` via existing CRUD functions.

The `rc_recipes.source_url` column stores the original video URL for attribution.
The `rc_recipes.image_uri` column can store the video thumbnail URL.

Pipeline:
1. User pastes a YouTube/TikTok URL.
2. `detectPlatform(url)` identifies the platform (already exists).
3. `fetchSocialMetadata(url)` gets title, author, thumbnail, and caption text (already exists).
4. `extractRecipeFromText(captionText, apiKey, { sourceUrl, author })` parses the caption/description into a `ParsedRecipe` (already exists).
5. User reviews and edits the extracted recipe.
6. Save via existing `createRecipe` + `addIngredient` CRUD.

### Dependencies
- **Internal:** `@mylife/recipes` (detectPlatform, fetchSocialMetadata, extractRecipeFromText, createRecipe, addIngredient, parseIngredientText)
- **External:** Claude API (Haiku 4.5) for text extraction (already integrated), oEmbed APIs for metadata (already integrated)
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a TikTok user, I want to paste a TikTok recipe video URL and get a structured recipe so that I can actually cook it.
2. As a YouTube viewer, I want to import a cooking video's recipe without rewatching the whole video.
3. As a recipe collector, I want the video thumbnail and source URL saved with the recipe so I can reference the original video later.

### Behavior Specification

1. User taps [+] Add Recipe on the Recipes tab.
2. User selects "Import from Video" from the add menu.
3. URL paste screen appears with a text input and "Paste from Clipboard" button.
4. User pastes a URL. System calls `detectPlatform(url)`.
5. If platform detected (YouTube/TikTok/Instagram): platform badge appears (e.g., YouTube icon in red).
6. System calls `fetchSocialMetadata(url)` to get title, author, thumbnail, and caption.
7. VideoPreview card appears showing: thumbnail image, video title, author name, platform badge.
8. User taps "Extract Recipe."
9. Loading state: "Extracting recipe from video description..."
10. System calls `extractRecipeFromText(captionText, apiKey, { sourceUrl: url, author })`.
11. On success: Review form (same component as Paper Recipe OCR) pre-fills with extracted recipe data. `source_url` is set to the video URL. `image_uri` is set to the thumbnail URL.
12. User reviews, edits, and saves.
13. On failure (no recipe in description): error state with "Couldn't find a recipe in this video's description. The video may show the recipe visually without listing ingredients."
14. If the URL is not a recognized platform: show "Unsupported URL. Try a YouTube, TikTok, or Instagram link."

**Clipboard Detection (Mobile):**
1. When the import-video screen opens, system calls `detectClipboardRecipeUrl()` (already exists).
2. If a video URL is on the clipboard, a banner appears: "Paste from clipboard: [truncated URL]?"
3. Tapping the banner auto-fills the URL input.

### Edge Cases

- Video description has no recipe (just commentary): extractRecipeFromText returns null. Show error state.
- Video is a recipe compilation (multiple recipes): AI extracts the most prominent recipe. User can re-import for others.
- Private or age-restricted video: oEmbed returns empty/error. Show "Couldn't access this video. Make sure it's public."
- Very short description (<20 chars): likely not enough for extraction. Show error suggesting manual entry.
- Instagram Reel: supported via existing detectPlatform (returns 'instagram'). Same flow.
- URL with tracking parameters (UTM, etc.): clean URL before display, but pass original to oEmbed.
- Slow network: 15-second timeout on oEmbed fetch, 30-second timeout on AI extraction. Show timeout-specific error.
- No API key configured: show "API key required for recipe extraction" with Settings link.
- Duplicate URL import: warn "A recipe from this URL already exists" if `source_url` matches an existing recipe.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Import from Video" option appears in the Add Recipe menu.
- [ ] **AC-2:** Pasting a YouTube URL shows the YouTube platform badge.
- [ ] **AC-3:** Pasting a TikTok URL shows the TikTok platform badge.
- [ ] **AC-4:** VideoPreview displays thumbnail, title, and author from the video.
- [ ] **AC-5:** Tapping "Extract Recipe" triggers AI extraction with a loading state.
- [ ] **AC-6:** Successful extraction populates the review form with recipe data.
- [ ] **AC-7:** Saved recipe includes the original video URL in source_url.
- [ ] **AC-8:** Saved recipe includes the video thumbnail in image_uri.
- [ ] **AC-9:** Failed extraction shows a descriptive error message.
- [ ] **AC-10:** Unsupported URLs show an "unsupported" message.
- [ ] **AC-11:** Clipboard detection suggests auto-pasting a video URL on mobile.
- [ ] **AC-12:** Duplicate URL detection warns before creating a duplicate recipe.

### Technical Criteria
- [ ] **TC-1:** `detectPlatform` correctly identifies YouTube, TikTok, and Instagram URLs.
- [ ] **TC-2:** `fetchSocialMetadata` retrieves title, author, and thumbnail via oEmbed.
- [ ] **TC-3:** `extractRecipeFromText` processes the caption/description through Claude API.
- [ ] **TC-4:** Pipeline handles oEmbed failure gracefully (proceeds with HTML fallback).
- [ ] **TC-5:** `source_url` is stored in `rc_recipes.source_url` after save.
- [ ] **TC-6:** Duplicate detection queries `rc_recipes` by `source_url` before import.
- [ ] **TC-7:** oEmbed fetch has a 15-second timeout. AI extraction has a 30-second timeout.

### Negative Criteria
- [ ] **NC-1:** The app must NOT download or store the actual video file.
- [ ] **NC-2:** The app must NOT play the video inline (thumbnail only).
- [ ] **NC-3:** This feature must NOT auto-import without user review.
- [ ] **NC-4:** This feature must NOT work offline (requires oEmbed + Claude API calls).

## UI Specification

### Mobile (Expo)
- URL input: glass card background, large text input with placeholder "Paste YouTube or TikTok URL", "Paste from Clipboard" button below.
- Platform badge: 24x24 platform icon (YouTube red play, TikTok music note, Instagram gradient camera) with platform name.
- VideoPreview: glass card with thumbnail (16:9 aspect ratio, rounded corners), title (16px, bold), author (14px, textSecondary), platform badge inline.
- "Extract Recipe" button: full-width, accent green (#22C55E), appears only after preview loads.
- Loading: "Extracting recipe..." with spinner inside the button.
- Error: red text below preview card, with retry option.
- Review form: same OcrReviewForm component from Paper Recipe OCR spec.

### Web (Next.js)
- Same layout, centered max-width 600px.
- URL input with paste button.
- VideoPreview at wider dimensions.
- Same review form.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Input | URL text field + clipboard suggestion | Screen opened |
| Detecting | Platform badge appears, preview loading | URL pasted |
| Preview | Video thumbnail + title + author + Extract button | Metadata fetched |
| Extracting | Loading spinner in Extract button | Extract Recipe tapped |
| Review | Pre-filled recipe form | Extraction succeeded |
| Error | Error message + retry | Extraction failed or video inaccessible |
| Unsupported | "Unsupported URL" message | Non-video URL pasted |

## Test Requirements

### Unit Tests
- [ ] `importRecipeFromVideo`: returns ParsedRecipe for YouTube URL with recipe in description
- [ ] `importRecipeFromVideo`: returns null for video without recipe content
- [ ] `importRecipeFromVideo`: attaches source_url and thumbnail to result metadata
- [ ] `importRecipeFromVideo`: handles oEmbed timeout gracefully
- [ ] `importRecipeFromVideo`: handles AI extraction timeout gracefully
- [ ] Platform detection: YouTube URL formats (watch, shorts, youtu.be)
- [ ] Platform detection: TikTok URL formats (@user/video, v/, item_id)
- [ ] Platform detection: Instagram URL formats (reel, p, tv)
- [ ] Duplicate detection: finds existing recipe with matching source_url

### Integration Tests
- [ ] Full flow: paste URL -> detect platform -> fetch metadata -> extract -> review -> save -> recipe in DB with source_url
- [ ] Error flow: paste URL -> extraction fails -> error shown -> retry with different URL

### QA Verification Script

1. Open the app on iOS simulator.
2. Navigate to MyRecipes > Recipes tab.
3. Tap [+] Add Recipe.
4. Tap "Import from Video."
5. Paste a YouTube cooking video URL.
6. Verify: YouTube platform badge appears -- corresponds to AC-2.
7. Verify: VideoPreview shows thumbnail, title, and author -- corresponds to AC-4.
8. Tap "Extract Recipe."
9. Verify: Loading state appears -- corresponds to AC-5.
10. Wait for extraction.
11. Verify: Review form is populated with recipe data -- corresponds to AC-6.
12. Tap "Save Recipe."
13. Open the saved recipe.
14. Verify: source_url contains the YouTube URL -- corresponds to AC-7.
15. Verify: image_uri contains the video thumbnail -- corresponds to AC-8.
16. Go back, tap Import from Video again.
17. Paste the same YouTube URL.
18. Verify: Duplicate warning appears -- corresponds to AC-12.
19. Paste a TikTok cooking video URL.
20. Verify: TikTok badge appears -- corresponds to AC-3.
21. Complete the import flow.
22. Paste a non-video URL (e.g., google.com).
23. Verify: "Unsupported URL" message appears -- corresponds to AC-10.
24. Paste a YouTube URL for a non-recipe video (music video).
25. Tap Extract Recipe.
26. Verify: Error message appears -- corresponds to AC-9.
27. Open web app at `/recipes/import-video`.
28. Verify: Same flow works on web -- corresponds to AC-1.

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate import-video flow, test all states

### Post-merge:
- [ ] `/parity-check` -- recipes module has archived standalone

## Handoff State

### Before This Work
- `detectPlatform(url)` exists in `import/social-media.ts`, handles YouTube/TikTok/Instagram.
- `fetchSocialMetadata(url)` exists, fetches oEmbed data + HTML meta tags for title/author/thumbnail/caption.
- `extractRecipeFromText(text, apiKey, context)` exists in `import/ai-recipe-extract.ts`.
- `detectClipboardRecipeUrl()` exists in `import/clipboard.ts`.
- No UI for video URL import exists.

### After This Work
- `importRecipeFromVideo(url, apiKey)` orchestration function that chains detect -> fetch -> extract.
- Mobile import-video screen with URL paste, clipboard detection, platform badge, video preview, and review form.
- Web import-video page with same flow.
- Saved recipes include source_url and thumbnail.
- Duplicate URL detection.

### Files Changed
- `modules/recipes/src/import/video-import.ts` -- NEW: orchestration function
- `modules/recipes/src/import/video-import.test.ts` -- NEW: unit tests
- `modules/recipes/src/import/index.ts` -- MODIFIED: export importRecipeFromVideo
- `modules/recipes/src/index.ts` -- MODIFIED: export importRecipeFromVideo
- `apps/mobile/app/(recipes)/import-video.tsx` -- NEW: URL paste + import screen
- `apps/mobile/app/(recipes)/components/VideoPreview.tsx` -- NEW: preview card
- `apps/web/app/recipes/import-video/page.tsx` -- NEW: web import page
- `apps/web/app/recipes/components/VideoPreview.tsx` -- NEW: web preview card
- `modules/recipes/src/definition.ts` -- MODIFIED: add import-video screen to navigation

### Known Limitations
- Extraction quality depends on the video description. Videos that show recipes visually without listing ingredients/steps in text will fail.
- No transcript/caption extraction from the actual video audio (would require a separate speech-to-text service).
- Instagram Reels often have minimal descriptions, leading to lower extraction success rates.
- YouTube Shorts descriptions are often truncated.

### Context for Next Agent
- All three pipeline functions already exist and are tested. The main work is: (1) a thin orchestration function in `import/video-import.ts`, (2) UI screens for paste/preview/review on both platforms.
- The review form (OcrReviewForm) from the Paper Recipe OCR spec should be reused here. If that spec isn't built yet, create a shared ReviewForm component.
- `fetchSocialMetadata` can fail on private videos or rate-limited APIs. The orchestration function should handle this gracefully and still attempt extraction if partial data is available (e.g., caption from HTML even if oEmbed failed).
- The `detectClipboardRecipeUrl` function checks the clipboard for recipe-like URLs. It already handles YouTube/TikTok patterns.
