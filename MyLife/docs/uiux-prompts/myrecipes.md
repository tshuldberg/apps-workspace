# MyRecipes -- UI/UX Design Prompts

**Tagline:** Your kitchen, completely private
**Icon:** 🍳 | **Accent:** #22C55E | **Tier:** Premium
**Bottom Tabs:** Home | Recipes | Meal Plan | Shopping | Settings
**Total Screens:** 15 mobile + 12 web = 27

---

## Prompt 1 -- Mobile Screens 1-12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyRecipes
Platform: iOS (React Native / Expo)
Accent color: #22C55E
Bottom tab bar: Home | Recipes | Meal Plan | Shopping | Settings

Design 12 mobile screens:

1. HOME (index.tsx)
- Bottom tab bar with Home tab active, #22C55E accent highlight
- Recipe count stat: large number, "recipes" label, book icon
- Favorites count stat: heart icon, count, "favorites" label
- Stats row on glass cards: rgba(255,255,255,0.04) fill
- Recent recipes section (3 cards): horizontal scroll
  - Each card: cover photo (rounded corners), recipe title below, cook time badge
- Today's meal plan preview card on #12121A surface:
  - Breakfast / Lunch / Dinner slots with assigned recipe names or "Not planned"
  - "View Meal Plan" link in #22C55E
- Shopping list preview card on #12121A surface:
  - Items needed count, "3 items unchecked"
  - "View List" link in #22C55E
- Quick action buttons: "Add Recipe" (#22C55E FAB), "Import Recipe" (outlined)

2. RECIPES TAB (recipes-tab.tsx)
- Bottom tab bar with Recipes tab active
- Search bar at top: magnifying glass icon, #1A1A24 background, rgba(255,255,255,0.10) border
- View toggle: grid (2-column) / list, top-right icons
- Filter chips below search: horizontal scroll
  - Difficulty: Easy | Medium | Hard
  - Cuisine: Italian | Mexican | Asian | American | etc.
  - Dietary: Vegetarian | Vegan | Gluten-Free | Dairy-Free | Keto | etc.
  - Favorites toggle (heart icon, #22C55E when active)
- Grid view cards:
  - Cover photo (square, rounded corners)
  - Recipe title (bold, 1 line)
  - Cook time badge (clock icon + minutes)
  - Difficulty dot (green/yellow/red)
  - Favorite heart icon overlay on photo
- List view rows: thumbnail, title, time, difficulty, cuisine tag
- Sort: Newest | Alphabetical | Cook Time | Rating
- Pull-to-refresh, infinite scroll

3. RECIPE DETAIL (recipe/[id].tsx)
- Full-screen scrollable
- Cover photo at top: full-width hero image, parallax scroll effect
- Action bar overlay on photo: back arrow, heart (favorite), share, print, overflow menu
- Title (large, bold, #F0F0F5) below photo
- Info row: servings (adjustable +/- stepper), prep time, cook time, total time
  - Each with icon: people, knife, flame, clock
- Rating: 1-5 stars in #22C55E, tap to rate
- Tags: cuisine, difficulty, dietary labels as pills
- Collections: collection badges the recipe belongs to

- Ingredients section header with #22C55E accent line
  - Ingredient list: scaled by current servings
  - Each ingredient: checkbox (for tracking during cooking), quantity, unit, ingredient name
  - Quantity auto-scales when servings adjusted (e.g., 2 cups becomes 4 cups for doubled servings)

- Steps section header with #22C55E accent line
  - Numbered steps: step number in #22C55E circle, instruction text
  - Optional timer badge per step if time mentioned (e.g., "15 min" pill)
  - Step photos inline if attached

- Nutrition summary card on #12121A surface:
  - Calories, protein, carbs, fat per serving
  - Horizontal bar visualization

- "Start Cooking" button at bottom, #22C55E fill, full-width -- launches cooking mode

4. ADD RECIPE (add-recipe.tsx)
- Full-screen modal: "Cancel" (left), "Save" (right, #22C55E)
- Photo upload section: large + icon placeholder, tap to add cover photo
- Form fields on #0A0A0F background with section dividers:
  - Title input (large font)
  - Servings stepper (default 4)
  - Prep time input (minutes)
  - Cook time input (minutes)
  - Difficulty selector: Easy | Medium | Hard radio buttons
  - Cuisine dropdown
  - Dietary labels: multi-select toggle chips
- Ingredients section:
  - Each ingredient row: quantity input, unit dropdown, ingredient name input, delete button (X)
  - NLP unit parser: type "2 cups flour" and it auto-parses into quantity=2, unit=cups, name=flour
  - "Add Ingredient" button with + icon
  - Drag-to-reorder handles
- Steps section:
  - Each step: numbered, text area, optional timer input (minutes), optional photo
  - "Add Step" button with + icon
  - Drag-to-reorder
- Tags section: add tags as chips

5. COOKING MODE (cooking-mode.tsx)
- Full-screen immersive mode, keep-awake screen lock active
- Step-by-step view: one step at a time, large readable text on #0A0A0F background
- Step counter: "Step 3 of 8" at top, progress bar in #22C55E
- Current step text: large font, high contrast
- Ingredient checklist for current step: relevant ingredients shown with checkboxes, check off as used
- Auto-timer: if step text mentions time ("bake for 20 minutes"), timer button appears
  - Tap to start countdown timer
  - Timer display: large MM:SS, circular progress ring in #22C55E
  - Alert sound + vibration when timer completes
- Navigation: large prev/next buttons at bottom, swipe left/right
- Voice commands hint: microphone icon, "Say 'next step' or 'start timer'"
- "Exit Cooking Mode" X button in top corner
- All ingredients button (top-right): slide-up sheet with full ingredient list + checkboxes

6. COLLECTIONS (collections.tsx)
- Nav bar: back arrow, "Collections" title
- Collection grid: 2-column layout
  - Each collection card on #12121A surface:
    - Cover: 2x2 thumbnail grid from first 4 recipes
    - Collection name (bold)
    - Recipe count
  - Tap to view collection contents
- "New Collection" button at top with + icon
- Collection detail view: collection name header, recipe grid below
- Long-press context menu per collection: Rename, Delete
- Add recipe to collection: from recipe detail overflow menu

7. MEAL PLANNER (meal-plan.tsx)
- Bottom tab bar with Meal Plan tab active
- Weekly grid view: 7 columns (Mon-Sun), 3 rows (Breakfast, Lunch, Dinner)
- Each cell on #12121A surface:
  - Assigned recipe: thumbnail + name (truncated)
  - Empty cell: "+" placeholder, tap to assign
  - Tap filled cell to view recipe or change assignment
- Assign flow: opens recipe picker modal with search + filter
- Drag-to-assign: drag recipe from list onto meal slot
- Week navigation: prev/next week arrows at top, "This Week" button
- Nutrition totals per day: calorie sum shown at column bottom
- "Generate Shopping List" button at bottom, #22C55E fill
  - Aggregates ingredients from all planned recipes for the week

8. SHOPPING LIST (shopping-list.tsx)
- Bottom tab bar with Shopping tab active
- Items grouped by aisle section headers:
  - Produce, Dairy, Meat, Bakery, Pantry, Frozen, Other
  - Each section: collapsible, item count badge
- Each item row:
  - Checkbox (tap to mark purchased, #22C55E checkmark)
  - Item name, quantity, unit
  - Source recipe name in rgba(240,240,245,0.65) small text
- Checked items: strikethrough, pushed to bottom of section
- "Add Custom Item" input field at bottom with + button
- Quantities auto-aggregated: if 2 recipes need flour, quantities combined
- Clear completed items button in nav bar

9. SHOPPING LISTS (shopping-lists.tsx)
- Nav bar: back arrow, "Shopping Lists" title
- Tab toggle: "Active" | "Archived"
- Active lists: each card on #12121A surface
  - List name (or date range: "Apr 4-10")
  - Item count, checked count, progress bar
  - Date created
- Archived lists: same format, grayed out, "Restore" action on swipe
- "New List" button at top: create from meal plan or empty list
- Swipe-to-archive on active lists
- Tap to open list (navigates to shopping-list.tsx)

10. IMPORT SOURCE (import-source.tsx)
- Nav bar: back arrow, "Import Recipe" title
- Import method cards on #12121A surface, each with icon + description:
  - URL Import: link icon, "Paste a recipe URL from any website"
    - URL input field with "Import" button
  - Barcode Scanner: barcode icon, "Scan a product or cookbook barcode"
    - Opens camera with barcode overlay
  - Video Import: play icon, "Import from YouTube, TikTok, or Instagram"
    - URL input for video link
  - Photo OCR: camera icon, "Take a photo of a printed recipe"
    - Opens camera with document frame guide
- Processing indicator per method: spinner + "Extracting recipe..."
- Error handling: "Could not parse recipe" with retry and manual entry options

11. IMPORT REVIEW (import-review.tsx)
- Nav bar: "Cancel" (left), "Save Recipe" (right, #22C55E)
- Review and edit parsed recipe before saving
- Source attribution at top: original URL or import method badge
- Editable sections on #12121A surfaces:
  - Title: pre-filled, editable
  - Cover photo: extracted image or placeholder
  - Servings, prep time, cook time: pre-filled, editable
  - Ingredients list: parsed items, each editable, delete/add
  - Steps list: parsed steps, each editable, reorder/delete/add
- Parsing confidence indicators: green check if high confidence, yellow warning if uncertain
- "Looks Good" quick-save shortcut vs "Edit" to modify
- Manual override for any field

12. PANTRY (pantry.tsx)
- Nav bar: back arrow, "Pantry" title
- Pantry inventory list grouped by category: Produce, Dairy, Meat, Grains, Spices, Canned, Other
- Each item card on #12121A surface:
  - Item name, quantity, unit
  - Expiration date: color coded (green = fresh, yellow = expiring soon, red = expired or #FF453A)
  - Category badge
  - Last updated date in rgba(240,240,245,0.65)
- "Add Item" button at top: name input, quantity, expiration date picker, category selector
- Barcode lookup: scan barcode to auto-fill item details
- Food photo recognition: camera button to identify food item
- Low stock alerts section: items below threshold highlighted with warning icon
- Sort: Alphabetical | Expiration Date | Category
- Search bar to filter pantry items
```

---

## Prompt 2 -- Mobile Screens 13-15 + Web Pages

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyRecipes
Accent color: #22C55E

Design 15 screens (3 remaining mobile + 12 web):

--- MOBILE (iOS, React Native / Expo) ---

1. SETTINGS (settings.tsx)
- Bottom tab bar with Settings tab active
- Settings sections on #12121A surface cards:
  - Defaults:
    - Default servings stepper (1-12)
    - Preferred units toggle: Metric | Imperial
    - Default cuisine dropdown
  - Dietary Restrictions: multi-select toggle list
    - Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, Keto, Paleo
    - Active restrictions shown as green toggles (#22C55E)
    - Used to filter and flag incompatible recipes
  - Cooking Preferences:
    - Cooking skill level: Beginner | Intermediate | Advanced
    - Timer sound selector
    - Keep screen on during cooking toggle
  - Data:
    - Recipe count, total cooking time logged
    - Storage used
- Export section: "Export All Recipes" button (JSON/PDF), last export date
- Import section: "Import from URL" shortcut
- Danger zone: "Delete All Recipes" in #FF453A

2. IMPORT VIDEO DETAIL (import-video.tsx)
- Nav bar: back arrow, "Video Import" title
- Video preview: thumbnail from source (YouTube/TikTok/Instagram)
- Processing steps with status indicators:
  - Extracting audio: spinner or checkmark
  - Transcribing: spinner or checkmark
  - Parsing recipe: spinner or checkmark
- Parsed result preview: same format as import-review.tsx
  - Title, ingredients, steps extracted from video transcript
- Confidence warnings for low-confidence parsed items
- "Review & Edit" button to go to import-review.tsx
- "Try Different Source" link to go back

3. IMPORT PHOTO DETAIL (import-photo.tsx)
- Nav bar: back arrow, "Photo Import" title
- Captured photo displayed at top (zoomable)
- OCR processing indicator: "Reading text from photo..."
- Extracted text preview: raw OCR text in monospace on #1A1A24 surface
- Parsed recipe sections below: title, ingredients, steps -- auto-parsed from OCR text
- Parsing accuracy indicators per section
- "Review & Edit" button to go to import-review.tsx
- "Retake Photo" button if results are poor

--- WEB (Next.js 15, desktop layout with persistent MyLife hub sidebar) ---

4. HUB (/recipes)
- Content area, max-width 1080px centered
- Hero stats section: recipe count, favorites, total cook time, pantry items
- Recent recipes: 4-column card grid with cover photos
- Quick actions: "Add Recipe", "Import Recipe", "Meal Plan" buttons
- Today's meal plan sidebar card
- Collections preview: horizontal scroll of collection cards

5. RECIPE LIBRARY (/recipes/library)
- Two-panel layout: filter sidebar (left, 260px) + recipe grid (right)
- Filter sidebar: search input, cuisine checkboxes, difficulty, dietary tags, rating, time range slider
- Recipe grid: 3-column cards with cover photo, title, time, difficulty, rating
- View toggle: grid / list
- Sort dropdown: Newest | Rating | Cook Time | Alphabetical
- Pagination at bottom
- Bulk actions: select multiple, add to collection, delete

6. RECIPE DETAIL (/recipes/[id])
- Two-column layout: recipe content (left, 60%) + sidebar (right, 40%)
- Left: cover photo (large), title, description, info row (servings adjuster, times)
- Ingredients list with checkboxes, scalable quantities
- Numbered steps with timer buttons
- Right sidebar: nutrition card, collections, tags, related recipes, "Start Cooking" button
- Rating section with star display
- Print button in toolbar -- opens print-optimized layout
- Share button, edit button

7. COOKING MODE (/recipes/[id]/cook)
- Full-viewport immersive cooking mode
- Centered step display: step number, instruction text (large font), timer
- Ingredient sidebar (collapsible left): full checklist
- Step navigation: large prev/next buttons, step progress bar
- Timer: overlay when active, large countdown, pause/reset controls
- "Exit" button top-left
- Keyboard navigation: left/right arrows for steps, space for timer

8. PRINT PREVIEW (/recipes/[id]/print)
- Print-optimized layout: white background, black text, clean typography
- Recipe title, servings, times, ingredients in two columns, steps numbered
- Nutrition summary table
- No navigation chrome -- print button triggers browser print dialog
- QR code linking back to digital recipe (optional)

9. CREATE RECIPE (/recipes/new)
- Form layout, max-width 800px centered
- Same fields as mobile add-recipe but with more space:
  - Side-by-side: photo upload (left) + basic info (right)
  - Ingredients: table-style input with columns for quantity, unit, name
  - Steps: numbered text areas with timer and photo upload per step
- NLP ingredient parser: type full string, auto-parsed into structured fields
- Preview panel toggle: see how recipe will look while editing
- "Save" button (#22C55E) and "Save as Draft" option

10. IMPORT + REVIEW (/recipes/import)
- Two-step layout: import source selection (step 1) and review (step 2)
- Import sources: URL input, file upload (JSON/text), paste text
- Review: side-by-side original source (left) and parsed result (right)
- Inline editing of all parsed fields
- Confidence highlighting on parsed items
- "Save Recipe" button

11. MEAL PLANNER (/recipes/meal-plan)
- Full-width weekly grid: 7 columns x 3 rows
- Each cell: recipe card or empty "+" slot
- Drag-and-drop from recipe sidebar (right panel) to calendar cells
- Recipe sidebar: searchable recipe list for assigning
- Week navigation with date display
- Nutrition summary row at bottom: daily calorie totals
- "Generate Shopping List" button
- Month overview toggle: see 4 weeks at a glance

12. PANTRY (/recipes/pantry)
- Two-column layout: category sidebar (left) + item list (right)
- Category sidebar: Produce, Dairy, Meat, etc. with counts
- Item list: table with columns for name, quantity, expiration, status
- Expiration color coding: green, yellow, #FF453A
- Add item form at top: name, quantity, expiration date picker, category
- Low stock alerts section: highlighted items
- Barcode lookup input field
- Sort and filter controls

13. GROCERY LIST (/recipes/grocery)
- Shopping list view, max-width 640px centered
- Grouped by aisle with collapsible sections
- Checkboxes per item, quantities, source recipe linked
- "Add Custom Item" input
- Multiple lists: tab bar to switch between active lists
- "Generate from Meal Plan" button
- Print-friendly version button
- Archive completed lists

14. COLLECTIONS (/recipes/collections)
- Collection grid: 3-column cards with cover thumbnails, name, count
- Click collection to view recipes within
- Create/rename/delete collection controls
- Drag recipes between collections
- "All Recipes" link back to library

15. SETTINGS (/recipes/settings)
- Form layout, max-width 640px centered
- Same sections as mobile: defaults, dietary restrictions, cooking preferences
- Import/export section with file download buttons
- Data statistics cards
- Account preferences
```
