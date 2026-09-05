# Feature Spec: Print Recipes

## Metadata
- **Module:** recipes
- **Priority Score:** 23 / 50 (B-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [2] x3 + Complexity [4] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none
- **Blocks:** none

## Business Context

### Why This Feature Exists
Despite digital recipe apps, many cooks still print recipes to use in the kitchen. A printed recipe doesn't need a charged phone, doesn't go to sleep mid-stir, and can be splattered with sauce without guilt. Print is also essential for sharing: users print recipes as gifts, for potlucks, or for family cookbooks. The complexity score is highest (4) of all Recipes B-tier features because the core logic (HTML template generation) requires no external dependencies or new data models.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Paprika | Yes | No ($4.99 one-time) | Print-optimized layout, configurable font size, optional photo |
| AnyList | Yes | No (free tier) | Basic print with ingredients and steps, clean formatting |
| Recipe One | No | N/A | No print support |
| Forkee | No | N/A | No print support |

### Target User
Home cooks who want a paper copy for kitchen use, or who share printed recipes with family and friends. Also useful for potluck coordinators who need to print recipes for event attendees. Targets the 40+ demographic who still prefer paper in the kitchen, and anyone who wants to compile a physical recipe binder.

## Technical Context

### Where This Lives in MyLife

```
modules/recipes/src/
  print/
    recipe-template.ts               -- NEW: generates print-ready HTML from recipe data
    recipe-template.test.ts          -- NEW: unit tests
  index.ts                           -- ADD exports

apps/mobile/app/(recipes)/
  recipe-detail.tsx                  -- MODIFIED: add "Print" button to action bar
  print-preview.tsx                  -- NEW: WebView showing print-ready HTML

apps/web/app/recipes/
  [id]/page.tsx                      -- MODIFIED: add "Print" button
  [id]/print/page.tsx                -- NEW: print-optimized page (CSS @media print)
```

### Wireframe Position

```
Hub Dashboard
  └── MyRecipes card
       └── Recipes tab
            └── Recipe Detail
                 └── Action bar (Share, Edit, Delete)
                      └── Print ← YOU ARE HERE
                           ├── Print Preview (WebView on mobile, new tab on web)
                           └── System Print Dialog
```

### Data Model

No new tables required. The feature reads existing recipe data:
- `rc_recipes` -- title, description, servings, prep/cook/total time, difficulty, notes, image_uri
- `rc_ingredients` -- structured ingredient list
- `rc_steps` -- ordered step instructions
- `rc_recipe_tags` -- tags for categorization

### Dependencies
- **Internal:** `@mylife/recipes` (getRecipeById, getStructuredIngredients, getSteps, getTags), `@mylife/recipes` utility functions (formatQuantity, formatDuration)
- **External:**
  - Mobile: `expo-print` for native print dialog, `expo-sharing` for PDF share
  - Web: `window.print()` with `@media print` CSS
- **Cross-Module:** None

## Functional Requirements

### User Stories
1. As a home cook, I want to print a recipe so I can use it in the kitchen without my phone.
2. As a potluck host, I want to print a recipe to share with guests who ask for it.
3. As a recipe organizer, I want print-friendly formatting that looks good on paper (not a screen dump).

### Behavior Specification

**Mobile Flow:**
1. User opens a recipe detail screen.
2. User taps the "Print" icon in the action bar (printer icon).
3. System generates print-ready HTML from the recipe data using `generatePrintHtml(recipe, ingredients, steps, tags)`.
4. Print preview screen opens showing the HTML in a WebView.
5. Preview shows: recipe title, metadata (time, servings, difficulty), ingredients in a two-column layout, numbered steps, notes (if any). Clean black-on-white design optimized for paper.
6. User taps "Print" button. System opens the native print dialog via `expo-print`.
7. Alternatively, user taps "Share as PDF" to generate a PDF and open the system share sheet.

**Web Flow:**
1. User opens a recipe detail page.
2. User clicks the "Print" button in the action bar.
3. A new tab opens with the print-optimized page (`/recipes/[id]/print`).
4. `@media print` CSS hides the navigation, sidebar, and non-recipe elements.
5. Browser print dialog opens automatically via `window.print()` on page load.
6. User prints or saves as PDF from the browser dialog.

**Print Layout:**
- Title: large, bold, centered.
- Source: "From MyRecipes" subtitle (or source_url if imported).
- Metadata row: prep time | cook time | total time | servings | difficulty.
- Ingredients: left column (40% width), in section groups if sections exist.
- Steps: right column (60% width) or full-width below ingredients, numbered.
- Notes: italic, at the bottom.
- Footer: "Printed from MyLife" with print date.
- No images by default (saves ink). Optional toggle to include recipe photo.

### Edge Cases

- Recipe with no ingredients: print steps only, with a note "No ingredients listed."
- Recipe with no steps: print ingredients only, with a note "No steps listed."
- Recipe with very long ingredient list (30+): ingredients flow to a second column or page.
- Recipe with very long steps: natural page breaks between steps.
- Recipe with sections (e.g., "For the sauce", "For the dough"): render section headers in bold.
- Recipe with null/empty fields (no description, no notes, no times): omit those sections cleanly.
- Recipe with image_uri: optionally include if user toggles "Include photo" (default: off to save ink).
- Printer not available (mobile): expo-print handles gracefully with system error.
- Web: user may have print-blocking browser extensions. No workaround needed.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** "Print" button appears in the recipe detail action bar on mobile.
- [ ] **AC-2:** "Print" button appears in the recipe detail page on web.
- [ ] **AC-3:** Tapping Print on mobile shows a WebView print preview.
- [ ] **AC-4:** Print preview displays title, metadata, ingredients, and steps in a clean layout.
- [ ] **AC-5:** Tapping "Print" in preview opens the native print dialog.
- [ ] **AC-6:** "Share as PDF" option generates and shares a PDF on mobile.
- [ ] **AC-7:** Web print page uses `@media print` CSS to hide non-recipe UI.
- [ ] **AC-8:** Web print page auto-triggers `window.print()` on load.
- [ ] **AC-9:** Ingredient sections render with bold section headers.
- [ ] **AC-10:** Print footer shows "Printed from MyLife" and the current date.
- [ ] **AC-11:** Optional "Include photo" toggle controls whether recipe image appears in print.

### Technical Criteria
- [ ] **TC-1:** `generatePrintHtml(recipe, ingredients, steps, tags)` returns valid HTML string.
- [ ] **TC-2:** Generated HTML uses inline styles only (no external CSS, for WebView/print compatibility).
- [ ] **TC-3:** Generated HTML renders correctly at 8.5x11" and A4 paper sizes.
- [ ] **TC-4:** `formatQuantity` and `formatDuration` are used for ingredient quantities and time display.
- [ ] **TC-5:** expo-print successfully sends HTML to the native print dialog.
- [ ] **TC-6:** PDF generation produces a valid PDF file that can be shared.

### Negative Criteria
- [ ] **NC-1:** Print layout must NOT include the app's navigation, sidebar, or non-recipe UI.
- [ ] **NC-2:** Print layout must NOT use colored backgrounds (wastes ink).
- [ ] **NC-3:** Print must NOT require network access (all data is local).
- [ ] **NC-4:** Print feature must NOT modify the recipe data.

## UI Specification

### Mobile (Expo)
- Print icon: printer icon (Feather `printer`), in the recipe detail action bar alongside edit/delete/share.
- Print preview: full-screen WebView with the generated HTML. Bottom bar with "Print" and "Share as PDF" buttons.
- "Include photo" toggle: small switch above the preview, default off.
- Print HTML layout:
  - Font: system serif (Georgia/Times) for recipe content, 14pt body text, 24pt title.
  - Colors: black text on white background only.
  - Margins: 0.75in all sides.
  - Ingredients: bullet list, grouped by section.
  - Steps: numbered list with 1.5 line spacing.

### Web (Next.js)
- Print button: in action bar, same position as mobile.
- Print page (`/recipes/[id]/print`): minimal page with recipe content only.
- `@media print` CSS: hides header, sidebar, footer. Sets body background to white, text to black.
- `@media screen` CSS on print page: shows a "Close" button and recipe content in centered layout.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Default | Print button in action bar | Recipe detail loaded |
| Preview | WebView with formatted recipe | Print button tapped (mobile) |
| Printing | System print dialog | Print button in preview |
| PDF Share | System share sheet | "Share as PDF" tapped |
| Error | System print error (rare) | Printer unavailable |

## Test Requirements

### Unit Tests
- [ ] `generatePrintHtml`: includes recipe title in output
- [ ] `generatePrintHtml`: includes all ingredients with formatted quantities
- [ ] `generatePrintHtml`: includes numbered steps
- [ ] `generatePrintHtml`: omits description section when description is null
- [ ] `generatePrintHtml`: omits notes section when notes is null
- [ ] `generatePrintHtml`: renders section headers when ingredients have sections
- [ ] `generatePrintHtml`: includes recipe photo when includePhoto option is true
- [ ] `generatePrintHtml`: omits recipe photo when includePhoto option is false (default)
- [ ] `generatePrintHtml`: includes metadata row (times, servings, difficulty)
- [ ] `generatePrintHtml`: handles empty ingredients array
- [ ] `generatePrintHtml`: handles empty steps array
- [ ] `generatePrintHtml`: includes print date in footer

### Integration Tests
- [ ] Full flow: open recipe -> print preview -> verify HTML content matches recipe data
- [ ] PDF flow: generate PDF -> verify file is valid and shareable

### QA Verification Script

1. Open the app on iOS simulator.
2. Navigate to MyRecipes > open a recipe with ingredients, steps, and notes.
3. Verify: Print icon appears in the action bar -- corresponds to AC-1.
4. Tap the Print icon.
5. Verify: Print preview opens in a WebView -- corresponds to AC-3.
6. Verify: Preview shows title, times, ingredients, and steps in a clean black-on-white layout -- corresponds to AC-4.
7. Verify: Ingredient sections have bold headers -- corresponds to AC-9.
8. Verify: Footer shows "Printed from MyLife" and today's date -- corresponds to AC-10.
9. Toggle "Include photo" on.
10. Verify: Recipe photo appears in preview -- corresponds to AC-11.
11. Tap "Print."
12. Verify: Native print dialog opens -- corresponds to AC-5.
13. Cancel print dialog. Tap "Share as PDF."
14. Verify: Share sheet opens with PDF -- corresponds to AC-6.
15. Open a recipe with no notes and no description.
16. Verify: Preview omits those sections cleanly.
17. Open web app. Navigate to a recipe.
18. Verify: Print button appears -- corresponds to AC-2.
19. Click Print.
20. Verify: New tab opens with print-optimized layout -- corresponds to AC-7.
21. Verify: Print dialog opens automatically -- corresponds to AC-8.

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to recipe detail, tap print, verify preview

### Post-merge:
- [ ] `/parity-check` -- recipes module has archived standalone

## Handoff State

### Before This Work
- Recipe detail screens exist on both mobile and web.
- `getRecipeById`, `getStructuredIngredients`, `getTags` provide full recipe data.
- `formatQuantity` and `formatDuration` format display values.
- No print functionality exists.

### After This Work
- `generatePrintHtml(recipe, ingredients, steps, tags, options)` generates print-ready HTML.
- Mobile print preview with WebView and expo-print integration.
- Web print page with `@media print` CSS.
- PDF sharing on mobile via expo-sharing.

### Files Changed
- `modules/recipes/src/print/recipe-template.ts` -- NEW: HTML template generator
- `modules/recipes/src/print/recipe-template.test.ts` -- NEW: unit tests
- `modules/recipes/src/index.ts` -- ADD export for generatePrintHtml
- `apps/mobile/app/(recipes)/recipe-detail.tsx` -- MODIFIED: add Print button
- `apps/mobile/app/(recipes)/print-preview.tsx` -- NEW: WebView preview screen
- `apps/web/app/recipes/[id]/page.tsx` -- MODIFIED: add Print button
- `apps/web/app/recipes/[id]/print/page.tsx` -- NEW: print-optimized page
- `modules/recipes/src/definition.ts` -- MODIFIED: add print-preview screen to navigation

### Known Limitations
- No batch print (print multiple recipes at once) in V1.
- No custom template themes (e.g., "cookbook style", "index card style") in V1.
- Photo print quality depends on image_uri resolution.
- No print scaling options (always targets standard letter/A4 paper).

### Context for Next Agent
- `getStructuredIngredients` returns ingredients with section grouping. Use the `section` field to group ingredients under bold headers in the print template.
- `formatQuantity` converts decimal quantities to fractions (e.g., 0.5 -> "1/2"). Always use this for print display.
- `formatDuration` converts minutes to "Xh Ym" format. Use for prep/cook times.
- expo-print takes an HTML string and opens the native print dialog. No WebView needed for the actual printing, only for the preview.
- The print HTML must use inline styles because WebView/print contexts don't load external CSS files.
