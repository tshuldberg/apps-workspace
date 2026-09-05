# SPEC-mylife-simple.md

## MyLife Hub - MVP Module Interface Specification

**Purpose:** This spec defines the minimum viable interface for all 22 MyLife app modules. A developer has already built the iPhone-style hub home screen with tappable app icon buttons. This document tells them:

1. What to label each app icon (name, emoji, color)
2. What screen to load when the user taps an icon (the module home page)
3. One core feature page accessible from that home page

Each module's full specification lives in its own `SPEC-my<name>.md` file and will be handed to individual developers separately. This spec only covers the hub icon grid and the first two screens per module.

---

## 1. Hub Home Screen - App Icon Grid

The hub displays a scrollable grid of module icons. Each icon is a tappable button that navigates to that module's home page.

### 1.1 Icon Registry (22 Modules)

| # | Module ID | Display Name | Icon | Accent Color | Tier |
|---|-----------|-------------|------|-------------|------|
| 1 | `books` | MyBooks | 📚 | `#C9894D` | Premium |
| 2 | `budget` | MyBudget | 💰 | `#22C55E` | Premium |
| 3 | `car` | MyCar | 🚗 | `#6366F1` | Premium |
| 4 | `closet` | MyCloset | 👗 | `#E879A8` | Premium |
| 5 | `fast` | MyFast | ⏱️ | `#14B8A6` | Free |
| 6 | `flash` | MyFlash | ⚡ | `#FBBF24` | Premium |
| 7 | `garden` | MyGarden | 🌱 | `#22C55E` | Premium |
| 8 | `habits` | MyHabits | ✅ | `#8B5CF6` | Premium |
| 9 | `health` | MyHealth | 🩺 | `#10B981` | Premium |
| 10 | `journal` | MyJournal | 📓 | `#A78BFA` | Free |
| 11 | `meds` | MyMeds | 💊 | `#06B6D4` | Premium |
| 12 | `mood` | MyMood | 🎭 | `#FB923C` | Free |
| 13 | `notes` | MyNotes | 📝 | `#64748B` | Free |
| 14 | `nutrition` | MyNutrition | 🥗 | `#F97316` | Premium |
| 15 | `pets` | MyPets | 🐾 | `#F59E0B` | Premium |
| 16 | `recipes` | MyRecipes | 🍳 | `#F59E0B` | Premium |
| 17 | `rsvp` | MyRSVP | 💌 | `#FB7185` | Premium |
| 18 | `stars` | MyStars | ✨ | `#8B5CF6` | Premium |
| 19 | `trails` | MyTrails | 🥾 | `#65A30D` | Premium |
| 20 | `workouts` | MyWorkouts | 💪 | `#EF4444` | Premium |
| 21 | `baby` | MyBaby | 👶 | `#F9A8D4` | Premium |
| 22 | `films` | MyFilms | 🎬 | `#A855F7` | Premium |

### 1.2 Icon Grid Layout

- Grid: 4 columns on phone, 6 columns on tablet/web
- Each cell: emoji icon (48x48) centered above display name (13pt, medium weight)
- Icon background: circle (64x64) filled with accent color at 15% opacity, border 1px accent color at 40% opacity
- Tapping an icon navigates to that module's home page (Section 2)
- Long-press shows tagline tooltip
- Premium modules show a small lock badge in the corner if the user is on the free tier

### 1.3 Taglines (shown on long-press or in Discover screen)

| Module | Tagline |
|--------|---------|
| MyBooks | Track your reading life |
| MyBudget | Envelope budgeting made simple |
| MyCar | Vehicle maintenance tracker |
| MyCloset | Your wardrobe, fully private |
| MyFast | Intermittent fasting timer |
| MyFlash | Spaced repetition flashcards |
| MyGarden | Plant care and garden planner |
| MyHabits | Build habits that stick |
| MyHealth | Your complete health companion |
| MyJournal | Private daily journal |
| MyMeds | Never miss a dose |
| MyMood | Track your emotional wellness |
| MyNotes | Plain markdown notes, no lock-in |
| MyNutrition | Track calories, macros, and 84+ nutrients |
| MyPets | Pet health records and care tracker |
| MyRecipes | Your kitchen companion |
| MyRSVP | Events, invites, and RSVP tracking |
| MyStars | Private astrology and birth charts |
| MyTrails | Offline hiking and trail guide |
| MyWorkouts | Body-map guided workouts and builder |
| MyBaby | Track every precious moment |
| MyFilms | Your private film diary |

---

## 2. Module Home Pages

When a user taps a module icon, they land on that module's home page. Below is the exact layout for each module's landing screen.

Every module home page includes:
- A top navigation bar showing the module name and accent color
- A "Back to Hub" button (left arrow or house icon) to return to the hub grid
- The module's tab bar at the bottom (the first tab is the home page)

---

### 2.1 MyBooks - Home Page

**Route:** `/books` | **Default Tab:** Home

**Layout:**
- **Header:** "MyBooks" title, search icon (right), add button (right)
- **Currently Reading section:** Horizontal scroll of book cover cards (40x60 thumbnail, title, author, progress percentage). Tap opens book detail.
- **Recently Added section:** Vertical list of last 5 books added (cover, title, author, date added, shelf badge)
- **Reading Stats strip:** 3 inline stats - "Books This Year: N", "Pages This Year: N", "Current Streak: N days"
- **Empty state:** Centered book illustration, "Start your library" heading, "Add your first book" button

**Tab Bar:** Home | Library | Search | Stats | Settings

---

### 2.2 MyBudget - Home Page

**Route:** `/budget` | **Default Tab:** Budget

**Layout:**
- **Header:** "MyBudget" title with month selector (left/right arrows, e.g., "March 2026")
- **Ready to Assign card:** Large text showing unallocated income amount, green if positive, red if negative
- **Envelope Groups:** Scrollable vertical list of collapsible envelope groups. Each group has a header (group name, group total). Each envelope row shows: emoji icon, envelope name, budgeted amount, spent amount, available amount (green/yellow/red based on remaining percentage)
- **Floating action button:** "+" to add an envelope or log a transaction
- **Empty state:** Wallet illustration, "Create your first envelope" heading

**Tab Bar:** Budget | Transactions | Subscriptions | Reports | Accounts

---

### 2.3 MyCar - Home Page

**Route:** `/car` | **Default Tab:** Dashboard

**Layout:**
- **Header:** "MyCar" title, vehicle selector dropdown (if multiple vehicles)
- **Vehicle card:** Large card showing vehicle photo (or placeholder car silhouette), year/make/model text, current odometer reading in large font
- **Quick stats row:** 3 stat pills - "Total Spent: $X", "Avg MPG: X", "Next Service: X mi"
- **Upcoming Maintenance card:** List of next 3 due maintenance items (item name, due date or mileage, status badge: due soon/overdue/ok)
- **Recent Fuel Logs card:** Last 3 fuel entries (date, gallons, cost, MPG)
- **Empty state:** Car outline illustration, "Add your first vehicle" button

**Tab Bar:** Dashboard | Maintenance | Fuel | Settings

---

### 2.4 MyCloset - Home Page

**Route:** `/closet` | **Default Tab:** Wardrobe

**Layout:**
- **Header:** "MyCloset" title, view toggle (grid/list), filter icon, "+" add button
- **Summary strip:** "127 items | $4,280 value" (total count and total purchase value)
- **Item grid:** 2-3 column grid of clothing item cards. Each card: square photo thumbnail, item name below, primary color dot indicator
- **Filter chips:** Horizontal scroll of category filters (Tops, Bottoms, Dresses, Shoes, Accessories, All)
- **Empty state:** Empty closet illustration, "Add your first item" heading

**Tab Bar:** Wardrobe | Outfits | Calendar | Stats | Settings

---

### 2.5 MyFast - Home Page

**Route:** `/fast` | **Default Tab:** Timer

**Layout:**
- **Header:** "MyFast" title
- **Protocol label:** Current fasting protocol name and target (e.g., "16:8 - 16 hours")
- **Timer ring:** Large circular progress ring (250px+ diameter), elapsed time in center (HH:MM:SS format), ring fills clockwise with accent color as fast progresses
- **Zone indicator:** Below ring, shows current fasting zone name and description (e.g., "Fat Burning Zone - 12+ hours")
- **Action button:** Large button - "Start Fast" (when idle) or "End Fast" (when active), full width, accent color
- **Secondary link:** "Change Protocol" text button below action button
- **Streak badge:** Small badge in top-right showing current streak count
- **Empty state:** Timer ring at 0%, "Choose a protocol to begin" text

**Tab Bar:** Timer | History | Stats | Settings

---

### 2.6 MyFlash - Home Page

**Route:** `/flash` | **Default Tab:** Decks

**Layout:**
- **Header:** "MyFlash" title, "+" add deck button
- **Due Today card:** Prominent card showing total cards due for review today (e.g., "42 cards due"), "Study Now" button
- **Deck list:** Scrollable vertical list of deck cards. Each deck shows: deck name, card count (e.g., "150 cards"), due count badge, last studied date, progress bar (mastered/learning/new proportions)
- **Quick stats strip:** "Streak: N days", "Cards Reviewed Today: N", "Total Cards: N"
- **Empty state:** Flashcard illustration, "Create your first deck" heading, "Create Deck" and "Import from Anki" buttons

**Tab Bar:** Decks | Study | Stats | Settings

---

### 2.7 MyGarden - Home Page

**Route:** `/garden` | **Default Tab:** Garden

**Layout:**
- **Header:** "MyGarden" title, "+" add plant button
- **Care Alerts banner:** If any plants need attention today, show a colored banner (e.g., "3 plants need watering today") with tap to view
- **Plant grid:** 2-column card grid of plants. Each card: plant photo (square), plant name, species/variety badge, days since last watered indicator, health status dot (green/yellow/red)
- **Filter chips:** Horizontal scroll - All, Indoor, Outdoor, Vegetables, Herbs, Flowers
- **Empty state:** Seedling illustration, "Add your first plant" heading

**Tab Bar:** Garden | Tasks | Journal | Settings

---

### 2.8 MyHabits - Home Page

**Route:** `/habits` | **Default Tab:** Today

**Layout:**
- **Header:** "MyHabits" title with today's date, "+" add habit button
- **Daily progress ring:** Small ring showing X/Y habits completed today
- **Habit list:** Scrollable vertical list of today's habits. Each row: emoji icon (left), habit name, frequency label (e.g., "Daily"), completion checkbox or status indicator (right). Completed habits show checkmark with strikethrough styling.
- **Sorting:** User-defined drag order
- **Empty state:** Checkmark illustration, "Add your first habit" heading, suggested starter habits below

**Tab Bar:** Today | Habits | Stats | Settings

---

### 2.9 MyHealth - Home Page

**Route:** `/health` | **Default Tab:** Today

**Layout:**
- **Header:** "MyHealth" title, quick-log button (right)
- **Domain cards (scrollable vertical):**
  - **Sleep card:** Last night's sleep duration, quality score ring (0-100), bedtime and wake time
  - **Activity card:** Steps count with goal progress bar, active minutes
  - **Vitals card:** Latest heart rate, weight, blood pressure readings with timestamps
  - **Medications card:** Today's dose schedule with taken/pending/missed indicators
- **Floating action button:** Quick-log menu (Log Sleep, Log Vital, Log Mood)
- **Empty state:** Heart illustration, "Start tracking your health" heading

**Tab Bar:** Today | Fasting | Vitals | Insights | Vault

---

### 2.10 MyJournal - Home Page

**Route:** `/journal` | **Default Tab:** Today

**Layout:**
- **Header:** "MyJournal" title with today's date
- **Editor area:** Full-screen rich text editor for today's entry. Markdown formatting toolbar at bottom (bold, italic, headers, lists, quote). Word count in bottom-right corner.
- **Prompt suggestion:** If entry is empty, show a writing prompt in placeholder text (e.g., "What are you grateful for today?")
- **Streak badge:** Top-right showing current writing streak (e.g., "7-day streak")
- **Empty state:** The editor itself is the empty state - just start typing

**Tab Bar:** Today | Entries | Search | Settings

---

### 2.11 MyMeds - Home Page

**Route:** `/meds` | **Default Tab:** Today

**Layout:**
- **Header:** "MyMeds" title, "+" add medication button
- **Time-of-day sections:** Grouped cards for Morning, Afternoon, Evening, Bedtime. Each medication card shows: medication name, dosage (e.g., "500mg"), scheduled time, status indicator (checkmark/clock/X for taken/pending/missed). Tap the card to mark dose as taken.
- **Adherence strip:** "Today: 3/5 doses taken" with small progress bar
- **Empty state:** Pill illustration, "Add your first medication" heading

**Tab Bar:** Today | Medications | History | Settings

---

### 2.12 MyMood - Home Page

**Route:** `/mood` | **Default Tab:** Today

**Layout:**
- **Header:** "MyMood" title with today's date
- **Mood scale:** Large emoji face (120x120) reflecting current selection. Below it, a horizontal row of 10 tappable mood buttons (1-10) with color gradient (red to green). Tapping a number updates the emoji face.
- **"Log Mood" button:** Full-width accent-colored button below the scale
- **Today so far section:** Horizontal row of small colored dots representing mood entries logged today, with timestamps
- **Optional note field:** Expandable text input "Add a note..." below the log button
- **Empty state:** The mood scale itself is the empty state - just tap and log

**Tab Bar:** Today | History | Insights | Settings

---

### 2.13 MyNotes - Home Page

**Route:** `/notes` | **Default Tab:** Notes

**Layout:**
- **Header:** "MyNotes" title, "+" new note button, view toggle (list/grid)
- **Search bar:** Full-width search input at top with "Search notes..." placeholder
- **Sort selector:** Dropdown or chips - Date Modified, Date Created, Alphabetical, Manual
- **Note list:** Scrollable list of notes. Each item: note title (bold), first line preview (gray), last modified date (right-aligned). Pinned notes appear first with a pin indicator.
- **Empty state:** Notepad illustration, "Create your first note" heading

**Tab Bar:** Notes | Folders | Search | Settings

---

### 2.14 MyNutrition - Home Page

**Route:** `/nutrition` | **Default Tab:** Diary

**Layout:**
- **Header:** "MyNutrition" title with date selector (left/right arrows for day navigation)
- **Calorie summary ring:** Circular progress showing consumed vs. target calories (e.g., "1,450 / 2,200 kcal")
- **Macro bars:** 3 horizontal progress bars for Protein, Carbs, Fat (each showing grams consumed / target, color-coded)
- **Meal sections:** Vertical list of meals - Breakfast, Lunch, Dinner, Snacks. Each section header shows meal name and calorie subtotal. Each food item row shows: food name, serving size, calories. "+" button per meal section to add food.
- **Empty state:** Plate illustration, "Log your first meal" heading

**Tab Bar:** Diary | Search | Dashboard | Trends | Settings

---

### 2.15 MyPets - Home Page

**Route:** `/pets` | **Default Tab:** Pets

**Layout:**
- **Header:** "MyPets" title, "+" add pet button
- **Pet grid:** 2-column grid of pet cards. Each card: circular pet photo (80px), pet name, species badge (Dog/Cat/Bird/etc.), breed, age. Status indicator dot (green = all good, yellow = care due, red = overdue)
- **Today's Tasks banner:** If any tasks are due, show "3 tasks due today" banner at top
- **Empty state:** Paw print illustration, "Add your first pet" heading

**Tab Bar:** Pets | Health | Reminders | Settings

---

### 2.16 MyRecipes - Home Page

**Route:** `/recipes` | **Default Tab:** Home

**Layout:**
- **Header:** "MyRecipes" title, "+" add recipe button
- **Search bar:** Full-width search with filter toggle
- **Recipe grid:** 2-column grid of recipe cards. Each card: recipe photo (landscape aspect), title below, difficulty badge (Easy/Medium/Hard), total time (e.g., "45 min"), favorite heart icon
- **Filter chips:** Horizontal scroll - All, Favorites, Quick (<30 min), Vegetarian, tagged categories
- **Empty state:** Cookbook illustration, "Add your first recipe" heading, "Add Recipe" and "Import from URL" buttons

**Tab Bar:** Home | Recipes | Meal Planner | Garden | Events | Settings

---

### 2.17 MyRSVP - Home Page

**Route:** `/rsvp` | **Default Tab:** Events

**Layout:**
- **Header:** "MyRSVP" title, "+" create event button
- **Upcoming Events list:** Scrollable vertical list of event cards sorted by date (nearest first). Each card: cover image (or gradient placeholder), event title, date and time, location name, guest count badge (e.g., "12 attending"), RSVP status indicator
- **Past Events section:** Collapsible section below upcoming events
- **Empty state:** Calendar illustration, "Create your first event" heading

**Tab Bar:** Events | Guests | Polls | Feed | Settings

---

### 2.18 MyStars - Home Page

**Route:** `/stars` | **Default Tab:** Chart

**Layout:**
- **Header:** "MyStars" title, profile selector (if multiple birth profiles)
- **Birth chart wheel:** Large circular natal chart visualization (centered, 280px+ diameter) showing zodiac signs, house divisions, planet glyphs positioned by degree
- **Big Three summary:** Below the chart - Sun sign, Moon sign, Rising sign with emoji and sign name
- **Today's transits strip:** Horizontal scroll of active planetary transits (e.g., "Mercury in Pisces", "Venus trine Jupiter")
- **Empty state:** Star constellation illustration, "Enter your birth details" heading with date/time/location input form

**Tab Bar:** Chart | Transits | Match | Settings

---

### 2.19 MyTrails - Home Page

**Route:** `/trails` | **Default Tab:** Map

**Layout:**
- **Header:** "MyTrails" title (semi-transparent overlay on map)
- **Full-screen map:** Interactive map centered on user's current location, with trail polylines for previously recorded routes
- **Record button:** Large floating circular button at bottom center - "Record" (red circle icon). Tap to start GPS tracking.
- **Stats overlay (during recording):** Floating panel showing elapsed time, distance, elevation gain, current pace
- **Recent trails strip:** Collapsible bottom sheet showing last 3 recorded trails (name, date, distance, duration)
- **Empty state:** Map with current location dot, "Record your first trail" prompt near the record button

**Tab Bar:** Map | Trails | Recordings | Settings

---

### 2.20 MyWorkouts - Home Page

**Route:** `/workouts` | **Default Tab:** Home

**Layout:**
- **Header:** "MyWorkouts" title
- **Today's Workout card:** If a workout is planned for today, show it prominently (workout name, exercise count, estimated duration, "Start" button)
- **Recent Workouts section:** Last 3-5 completed workouts (name, date, duration, volume)
- **Body Map widget:** Small interactive body silhouette showing muscle groups worked this week (colored by intensity)
- **Floating action button:** "Start Workout" or "New Workout"
- **Empty state:** Dumbbell illustration, "Start your first workout" heading

**Tab Bar:** Home | Explore | Workouts | Progress | Profile

---

### 2.21 MyBaby - Home Page

**Route:** `/baby` | **Default Tab:** Dashboard

**Layout:**
- **Header:** "MyBaby" title, child selector (if multiple children), child age display (e.g., "4 months, 12 days")
- **Daily Summary cards (scrollable vertical):**
  - **Feeding card:** Last feeding time, type (breast/bottle/solid), daily total count and volume
  - **Sleep card:** Last sleep session, total hours today, next nap prediction based on wake windows
  - **Diaper card:** Today's diaper count (wet/dirty breakdown)
  - **Growth card:** Latest weight and length with percentile badge
- **Quick-log buttons:** Row of large tappable icons - Feed, Sleep, Diaper, Growth (each opens the corresponding log form)
- **Empty state:** Baby illustration, "Add your baby's profile" heading with name/birthdate form

**Tab Bar:** Dashboard | Track | Growth | Milestones | More

---

### 2.22 MyFilms - Home Page

**Route:** `/films` | **Default Tab:** Films

**Layout:**
- **Header:** "MyFilms" title, "+" log film button, view toggle (list/grid)
- **Search bar:** Full-width search with filter icon
- **Film list/grid:** Scrollable display of logged films. Each item: movie poster thumbnail, title, year, user rating (half-star display, e.g., 4.5 stars), watched date. Sort by: date watched, rating, title, year.
- **Stats strip:** "Total: N films | Avg Rating: N.N | Hours Watched: N"
- **Empty state:** Film reel illustration, "Log your first film" heading, "Search" and "Import from Letterboxd" buttons

**Tab Bar:** Films | Diary | Stats | Search | Settings

---

## 3. One Core Feature Per Module

For the MVP, each module needs exactly one functional feature beyond the home page. This is the primary action the user takes after landing on the home page.

### 3.1 MyBooks - Add Book Screen

**Trigger:** Tap "+" on home page header
**Route:** `/books/add`

**Screen Layout:**
- Action sheet with 3 options: "Search by Title", "Scan Barcode", "Add Manually"
- **Search by Title (default):** Text input field, search button, scrollable results list from Open Library API (cover thumbnail, title, author, year). Tap a result to select it.
- **Confirmation form:** Pre-filled from search - title, author, ISBN, page count, cover image. User selects shelf (Want to Read / Currently Reading / Finished). "Save" button.
- **Validation:** Title is required (max 500 characters). At least one of title or ISBN must be provided.

---

### 3.2 MyBudget - Add Transaction Screen

**Trigger:** Tap floating "+" button or "Add Transaction" from envelope detail
**Route:** `/budget/transactions/add`

**Screen Layout:**
- **Amount input:** Large number pad at bottom, amount displayed prominently at top (auto-formats with currency symbol)
- **Payee field:** Text input with autocomplete from previous payees
- **Envelope selector:** Tappable field that opens envelope picker (grouped by category, search bar at top)
- **Account selector:** Dropdown of user's accounts (Checking, Credit Card, Cash, etc.)
- **Date picker:** Defaults to today, tappable to change
- **Inflow/Outflow toggle:** Segmented control (Outflow is default)
- **"Save" button:** Full-width at bottom, disabled until amount > 0 and envelope is selected

---

### 3.3 MyCar - Add Vehicle Screen

**Trigger:** Tap "Add Vehicle" on empty state or "+" on dashboard
**Route:** `/car/vehicles/add`

**Screen Layout:**
- **Photo area:** Tappable placeholder to add vehicle photo (camera or library)
- **Year field:** Numeric input (4 digits, 1900 - current year + 1)
- **Make field:** Text input with autocomplete (Ford, Toyota, Honda, etc.)
- **Model field:** Text input with autocomplete filtered by selected make
- **Trim field:** Optional text input
- **VIN field:** Optional, 17-character alphanumeric input with check digit validation
- **Current Odometer:** Numeric input (required, in miles or km based on user preference)
- **Color selector:** Optional, color picker or text input
- **"Save Vehicle" button:** Disabled until year, make, model, and odometer are filled

---

### 3.4 MyCloset - Add Item Screen

**Trigger:** Tap "+" on wardrobe header
**Route:** `/closet/items/add`

**Screen Layout:**
- **Photo area:** Large tappable area to capture item photo (camera or library). Shows photo preview after selection.
- **Name field:** Text input (required, max 100 characters)
- **Category selector:** Tappable picker - Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Activewear, Swimwear, Other
- **Brand field:** Optional text input with autocomplete
- **Color picker:** Tappable color circles (12 standard colors + "Other" with custom picker)
- **Size field:** Text input (varies by category)
- **Purchase Price:** Currency input (optional)
- **Condition selector:** New, Excellent, Good, Fair, Poor
- **Season tags:** Multi-select chips - Spring, Summer, Fall, Winter, All Seasons
- **"Save Item" button:** Disabled until name, category, and photo are provided

---

### 3.5 MyFast - Start Fast Flow

**Trigger:** Tap "Start Fast" button on timer screen
**Route:** `/fast/active` (same screen, state change)

**Behavior:**
- Tapping "Start Fast" records the current timestamp as `fast_start_time`
- Timer ring begins animating clockwise, elapsed time counts up in HH:MM:SS
- Button changes to "End Fast" (red/destructive style)
- Zone indicator updates as milestones are reached: Anabolic (0-4h), Catabolic (4-8h), Fat Burning (8-12h), Ketosis (12-18h), Deep Ketosis (18-24h), Autophagy (24h+)
- If user navigates away, timer continues in background
- Tapping "End Fast" shows confirmation dialog: "End your fast? Duration: HH:MM:SS" with "End Fast" and "Keep Going" buttons
- On confirm, fast is saved with start time, end time, duration, and achieved zone

---

### 3.6 MyFlash - Create Deck Screen

**Trigger:** Tap "+" on decks list or "Create Deck" on empty state
**Route:** `/flash/decks/create`

**Screen Layout:**
- **Deck name field:** Text input (required, max 100 characters)
- **Description field:** Multi-line text input (optional, max 500 characters)
- **Add Cards section:** List of cards being added. Each card has a front field and back field (both support text). "Add Card" button appends a new blank card pair.
- **Card count indicator:** "N cards" label
- **"Create Deck" button:** Disabled until deck name is entered and at least 1 card has both front and back filled
- Minimum 1 card required, no maximum enforced at creation time

---

### 3.7 MyGarden - Add Plant Screen

**Trigger:** Tap "+" on garden header
**Route:** `/garden/plants/add`

**Screen Layout:**
- **Photo area:** Tappable placeholder to add plant photo
- **Plant name field:** Text input (required, max 100 characters, e.g., "Kitchen Basil")
- **Species/variety field:** Text input with autocomplete from built-in plant database (optional)
- **Location selector:** Indoor / Outdoor toggle, then text input for specific location (e.g., "Kitchen windowsill", "Backyard raised bed")
- **Date acquired:** Date picker, defaults to today
- **Watering frequency:** Selector - Every 1/2/3/4/5/6/7/10/14/21/30 days
- **Sunlight needs:** Low / Medium / High / Full Sun
- **Notes field:** Optional multi-line text
- **"Add Plant" button:** Disabled until plant name is provided

---

### 3.8 MyHabits - Check Off Habit

**Trigger:** Tap checkbox on any habit row in the Today list
**Route:** `/habits` (same screen, inline action)

**Behavior:**
- Tapping the checkbox on a habit row marks it complete for today
- Checkbox animates to filled checkmark with accent color
- Habit name gets subtle strikethrough styling
- Daily progress ring at top increments (e.g., 3/5 becomes 4/5)
- If the habit is the last one for the day, show a brief celebration animation (confetti or checkmark burst)
- Streak counter updates if this completes a consecutive day
- Tapping a completed checkbox undoes the completion (toggle behavior)
- For measurable habits (e.g., "Drink 8 glasses of water"), tapping opens a small input to log the value instead of a simple checkbox

---

### 3.9 MyHealth - Log Vital Sign Screen

**Trigger:** Tap floating action button then "Log Vital" or tap a vital card
**Route:** `/health/vitals/log`

**Screen Layout:**
- **Vital type selector:** Segmented control or tab strip - Weight, Blood Pressure, Heart Rate, Temperature, Blood Glucose, SpO2
- **Value input (varies by type):**
  - Weight: single numeric field with unit toggle (lbs/kg)
  - Blood Pressure: two fields - systolic / diastolic (mmHg), color-coded category label appears (Normal/Elevated/Stage 1/Stage 2)
  - Heart Rate: single numeric field (bpm)
  - Temperature: single numeric field with unit toggle (F/C)
  - Blood Glucose: single numeric field (mg/dL or mmol/L)
  - SpO2: single numeric field (percentage, 0-100)
- **Timestamp:** Defaults to now, tappable to edit
- **Notes field:** Optional text input
- **"Save" button:** Disabled until required value field(s) are filled

---

### 3.10 MyJournal - Write Entry

**Trigger:** Automatic on app open (Today tab loads directly into editor)
**Route:** `/journal/today`

**Behavior:**
- Editor loads today's entry if one exists, or creates a new blank entry
- Full-screen text area with markdown support
- **Formatting toolbar** (bottom of screen): Bold, Italic, Heading, Bulleted List, Numbered List, Quote, Divider
- Word count updates live in bottom-right corner
- Auto-saves every 5 seconds after the user stops typing (no manual save button needed)
- **Writing prompt:** If the entry is empty, display a rotating daily prompt in placeholder text (e.g., "What made today meaningful?"). Prompt disappears when the user starts typing.
- Encryption: entry content is encrypted at rest with the user's passphrase (if encryption is enabled in settings)

---

### 3.11 MyMeds - Mark Dose as Taken

**Trigger:** Tap a medication card in the Today schedule
**Route:** `/meds` (same screen, inline action)

**Behavior:**
- Tapping a pending medication card shows a quick confirmation: medication name, dosage, "Mark as Taken" button, "Skip" button, "Snooze 30 min" button
- On "Mark as Taken": card status changes from clock (pending) to checkmark (taken), card moves to "Taken" section, timestamp is recorded
- On "Skip": card shows X icon (missed), card moves to "Skipped" section
- On "Snooze": a local notification is scheduled for 30 minutes from now, card remains in pending state
- Adherence strip at top updates (e.g., "4/5 doses taken")
- Action is reversible: tapping a taken/skipped dose shows "Undo" option

---

### 3.12 MyMood - Log Mood Entry

**Trigger:** Tap a mood score (1-10) then tap "Log Mood" button
**Route:** `/mood` (same screen flow)

**Behavior:**
- User taps a number (1-10) on the color gradient scale. The large emoji face updates to reflect the selection (1 = very sad, 5 = neutral, 10 = very happy).
- Optional: user taps "Add a note..." to expand a text input field (max 500 characters)
- User taps "Log Mood" button
- Entry is saved with: mood score (1-10), timestamp, optional note text
- A new colored dot appears in the "Today so far" section
- Mood scale resets to unselected state, ready for next entry
- Multiple entries per day are allowed (the app tracks mood over the course of a day)

---

### 3.13 MyNotes - Create Note Screen

**Trigger:** Tap "+" on notes list header
**Route:** `/notes/new`

**Screen Layout:**
- **Title field:** Large text input at top (placeholder: "Note title", max 200 characters)
- **Editor area:** Full-screen markdown text editor below title. Supports headings, bold, italic, lists, code blocks, links, and [[backlinks]] to other notes.
- **Formatting toolbar:** Bottom toolbar with markdown shortcuts (Bold, Italic, Heading, List, Code, Link, Checkbox)
- **Auto-save:** Saves automatically after 3 seconds of inactivity. No manual save button.
- **Folder assignment:** Tappable "Folder: None" label at top that opens folder picker
- **Tag input:** Below title, tappable "Add tags..." that opens tag picker or creates new tags
- **Back button:** Returns to notes list. Note is automatically saved.

---

### 3.14 MyNutrition - Add Food to Meal

**Trigger:** Tap "+" button on a meal section (Breakfast, Lunch, Dinner, or Snacks)
**Route:** `/nutrition/add-food`

**Screen Layout:**
- **Search bar:** Auto-focused text input, "Search foods..." placeholder, 300ms debounce
- **Recent foods section:** Horizontal scroll of recently logged foods for quick re-add (tap to add with last-used serving size)
- **Search results list:** Vertical list of food items from local database. Each result shows: food name, serving size, calories per serving, protein/carbs/fat in small text
- **Tap a result:** Opens serving size picker - numeric input with unit selector (g, oz, cup, tbsp, serving). Calorie and macro values update live as serving size changes.
- **"Add" button:** Adds the food item to the selected meal with the chosen serving size
- **"Create Custom Food" link:** At bottom of search results, opens a form to manually enter a food with all nutritional values

---

### 3.15 MyPets - Add Pet Profile Screen

**Trigger:** Tap "+" on pets header or "Add your first pet" on empty state
**Route:** `/pets/add`

**Screen Layout:**
- **Photo area:** Circular tappable placeholder (80px) to add pet photo
- **Pet name field:** Text input (required, max 50 characters)
- **Species selector:** Dog, Cat, Bird, Fish, Reptile, Small Animal, Horse, Other
- **Breed field:** Text input with autocomplete filtered by species (optional)
- **Date of birth:** Date picker (optional, used for age calculation)
- **Gender selector:** Male / Female / Unknown
- **Weight field:** Numeric input with unit toggle (lbs/kg)
- **Microchip ID:** Optional text input
- **Veterinarian field:** Optional text input for primary vet name and phone
- **"Add Pet" button:** Disabled until name and species are provided

---

### 3.16 MyRecipes - Add Recipe Screen

**Trigger:** Tap "+" on recipes header
**Route:** `/recipes/add`

**Screen Layout:**
- **Photo area:** Tappable placeholder for recipe photo
- **Title field:** Text input (required, max 200 characters)
- **Description field:** Optional multi-line text
- **Prep time / Cook time:** Two numeric inputs with unit selector (minutes/hours)
- **Servings:** Numeric input (default: 4)
- **Difficulty selector:** Easy / Medium / Hard
- **Ingredients section:** Dynamic list. Each row: quantity input, unit selector (cup, tbsp, tsp, oz, g, whole, pinch), ingredient name. "Add Ingredient" button appends a new row.
- **Instructions section:** Numbered step list. Each step: multi-line text input. "Add Step" button appends a new step.
- **Tags field:** Multi-select chips (Vegetarian, Vegan, Gluten-Free, Dairy-Free, Quick, etc.) or custom tags
- **"Save Recipe" button:** Disabled until title and at least 1 ingredient and 1 step are provided

---

### 3.17 MyRSVP - Create Event Screen

**Trigger:** Tap "+" on events header
**Route:** `/rsvp/events/create`

**Screen Layout:**
- **Cover image area:** Tappable placeholder for event cover photo
- **Event title field:** Text input (required, max 200 characters)
- **Date and time:** Date picker + time picker for start and end (end is optional)
- **Location field:** Text input for venue name / address
- **Description field:** Multi-line text input (optional)
- **Privacy selector:** Public (shareable link) / Private (invite-only)
- **RSVP Options toggle:** Enable/disable RSVP collection. If enabled, options are: Going / Maybe / Not Going
- **"Create Event" button:** Disabled until title and start date are provided

---

### 3.18 MyStars - Enter Birth Details Screen

**Trigger:** "Enter your birth details" on empty state, or "+" to add a profile
**Route:** `/stars/profiles/add`

**Screen Layout:**
- **Profile name field:** Text input (e.g., "Me", "Partner", max 50 characters)
- **Birth date:** Date picker (required)
- **Birth time:** Time picker with hour and minute (required for accurate chart - show note: "Check your birth certificate for exact time")
- **Birth location:** Text input with autocomplete for city name, resolves to latitude/longitude coordinates
- **"Calculate Chart" button:** Disabled until date, time, and location are provided. On tap, computes natal chart positions and navigates to the chart view.
- **"I don't know my birth time" link:** Sets time to 12:00 noon and shows a disclaimer that house positions and rising sign will be approximate

---

### 3.19 MyTrails - Start Recording Flow

**Trigger:** Tap the "Record" floating button on the map screen
**Route:** `/trails/recording` (map screen transitions to recording mode)

**Behavior:**
- Tapping "Record" requests location permission if not already granted
- GPS tracking begins at 1-5 second intervals (adaptive based on movement speed)
- Map centers on user's location with a blue polyline drawing the route in real-time
- **Stats panel** appears at bottom: elapsed time (HH:MM:SS), distance (mi/km), elevation gain (ft/m), current pace (min/mi or min/km)
- "Record" button changes to "Pause" (tap to pause tracking) and a "Stop" button appears
- On "Stop": confirmation dialog - "Save this trail?" with name input field (auto-generated default like "Morning Hike"), "Save" and "Discard" buttons
- Route is saved with all GPS points, total distance, duration, elevation profile, and activity type

---

### 3.20 MyWorkouts - Start Workout Screen

**Trigger:** Tap "Start Workout" floating action button
**Route:** `/workouts/active`

**Screen Layout:**
- **Workout picker:** Choose from: "Empty Workout" (start logging freestyle), or select a saved template/program workout
- **Active workout view:** Shows current exercise name, set number (e.g., "Set 2 of 4"), input fields for weight and reps (or time for timed exercises)
- **Set log table:** Shows completed sets for the current exercise (Set #, Weight, Reps, checkmark)
- **"Complete Set" button:** Logs the current set and advances to next. Rest timer starts automatically between sets.
- **Exercise navigation:** "Next Exercise" / "Previous Exercise" buttons, or tap exercise list to jump
- **"Finish Workout" button:** Shows workout summary (total duration, total volume, exercises completed) with "Save" button

---

### 3.21 MyBaby - Log Feeding Screen

**Trigger:** Tap "Feed" quick-log button on dashboard, or tap feeding card
**Route:** `/baby/log/feeding`

**Screen Layout:**
- **Feeding type selector:** Three large tappable buttons - Breast, Bottle, Solid
- **Breast mode:** Left/Right toggle, timer with start/pause/stop, or manual duration entry (minutes)
- **Bottle mode:** Amount input (oz or mL with unit toggle), milk type selector (Breast Milk, Formula, Cow's Milk, Other)
- **Solid mode:** Food name text input, amount selector (A little / Some / A lot), food type tags (Fruit, Vegetable, Grain, Protein, Dairy)
- **Timestamp:** Defaults to now, tappable to edit
- **Notes field:** Optional text input
- **"Save" button:** Disabled until the required fields for the selected feeding type are filled

---

### 3.22 MyFilms - Log Film Screen

**Trigger:** Tap "+" on films header
**Route:** `/films/log`

**Screen Layout:**
- **Search bar:** Auto-focused text input, "Search films..." placeholder. Searches local database first, then TMDb API for results.
- **Search results list:** Film poster thumbnail, title, year, director name. Tap to select.
- **Log form (after selection):** Pre-filled title, year, poster. User adds:
  - **Rating:** Tappable half-star row (0.5 to 5.0 in 0.5 increments), 10 star positions
  - **Date watched:** Date picker, defaults to today
  - **Rewatch toggle:** "Is this a rewatch?" switch
  - **Review field:** Optional multi-line text input
  - **Tags field:** Optional tag chips (add existing or create new)
- **"Save" button:** Disabled until a film is selected and a date is set (rating is optional)

---

## 4. Navigation Architecture

### 4.1 Hub to Module Flow

```
Hub Home Grid
  |
  +-- Tap module icon
  |     |
  |     +-- Module Home Page (default tab)
  |           |
  |           +-- Tab Bar navigation within module
  |           |
  |           +-- Core feature (accessible from home page)
  |
  +-- Back to Hub (always available via back button or hub icon)
```

### 4.2 Back Navigation

- Every module screen includes a "Back to Hub" affordance (house icon in top-left, or swipe-right gesture)
- Within a module, standard back navigation returns to the previous screen within that module
- The hub icon is always visible in the module's navigation bar (distinguishable from the intra-module back button)

### 4.3 Module State Persistence

- When a user leaves a module and returns, the module restores to its last-viewed screen and scroll position
- Module data persists in the shared local database (each module uses its own table prefix)
- Switching between modules does not reset state

---

## 5. Shared UI Patterns

These patterns apply consistently across all 22 modules.

### 5.1 Empty States

Every module home page has an empty state with:
- Centered illustration relevant to the module theme
- Heading text describing what to do (e.g., "Add your first book")
- Primary action button matching the module's core feature
- No secondary actions or overwhelming text in empty states

### 5.2 Floating Action Buttons

- 56x56 circle, module accent color fill, white icon
- Positioned bottom-right, 16px from edges
- Primary action for the module (add item, start recording, log entry, etc.)
- Single tap action (no long-press menus in MVP)

### 5.3 Cards

- Rounded corners (12px radius)
- Subtle shadow (0 2px 8px rgba(0,0,0,0.1))
- Padding: 16px
- Background: surface color (adapts to light/dark theme)

### 5.4 Color Coding

- Each module uses its accent color for: active tab indicator, floating action button, primary buttons, progress rings, header accents
- Neutral grays for secondary text and borders
- Semantic colors: green for success/positive, red for error/overdue, yellow for warning/due soon

### 5.5 Typography

- Module name in header: 20pt, semibold
- Card titles: 16pt, semibold
- Body text: 14pt, regular
- Secondary/metadata: 12pt, regular, gray

---

## Appendix A: Module ID to Display Name Quick Reference

For the developer wiring up the icon grid buttons:

```
books      -> MyBooks
budget     -> MyBudget
car        -> MyCar
closet     -> MyCloset
fast       -> MyFast
flash      -> MyFlash
garden     -> MyGarden
habits     -> MyHabits
health     -> MyHealth
journal    -> MyJournal
meds       -> MyMeds
mood       -> MyMood
notes      -> MyNotes
nutrition  -> MyNutrition
pets       -> MyPets
recipes    -> MyRecipes
rsvp       -> MyRSVP
stars      -> MyStars
trails     -> MyTrails
workouts   -> MyWorkouts
baby       -> MyBaby
films      -> MyFilms
```

## Appendix B: Full Spec References

Each module has a comprehensive spec (4,000-9,000+ lines) with complete feature specifications, data architecture, screen maps, acceptance criteria, and test specifications. Hand these to individual developers for full implementation:

| Module | Full Spec File | Lines | Features |
|--------|---------------|-------|----------|
| MyBooks | `SPEC-mybooks.md` | 5,498 | 32 |
| MyBudget | `SPEC-mybudget.md` | 5,565 | 32 |
| MyCar | `SPEC-mycar.md` | 5,797 | 20 |
| MyCloset | `SPEC-mycloset.md` | 7,516 | 19 |
| MyFast | `SPEC-myfast.md` | 4,048 | 23 |
| MyFlash | `SPEC-myflash.md` | 7,869 | 27 |
| MyGarden | `SPEC-mygarden.md` | 9,312 | 25 |
| MyHabits | `SPEC-myhabits.md` | 4,931 | 30 |
| MyHealth | `SPEC-myhealth.md` | 7,808 | 30 |
| MyJournal | `SPEC-myjournal.md` | 8,487 | 27 |
| MyMeds | `SPEC-mymeds.md` | 5,232 | 30 |
| MyMood | `SPEC-mymood.md` | 8,206 | 24 |
| MyNotes | `SPEC-mynotes.md` | 8,869 | 24 |
| MyNutrition | `SPEC-mynutrition.md` | 8,733 | 31 |
| MyPets | `SPEC-mypets.md` | 6,629 | 18 |
| MyRecipes | `SPEC-myrecipes.md` | 5,450 | 39 |
| MyRSVP | `SPEC-myrsvp.md` | 5,039 | 26 |
| MyStars | `SPEC-mystars.md` | 7,567 | 22 |
| MyTrails | `SPEC-mytrails.md` | 7,031 | 20 |
| MyWorkouts | `SPEC-myworkouts.md` | 4,618 | 30 |
| MyBaby | `SPEC-mybaby.md` | 7,592 | 22 |
| MyFilms | `SPEC-myfilms.md` | 6,816 | 21 |
| **Total** | **22 specs** | **148,613** | **557** |
