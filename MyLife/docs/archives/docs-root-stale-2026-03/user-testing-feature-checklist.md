# User Testing Feature Checklist

Generated from app routes plus README/DESIGN feature sections.

## Regression QA - MyBooks iOS Session (2026-03-01)

Mandatory checks for every mobile regression pass:

1. MyLife launch route:
- App opens to Hub selector (`MyLife` + “Choose an app to open.”), not directly into a module.

2. Hub back-navigation from module:
- Tapping `< Apps` from MyBooks returns to Hub selector.

3. Settings - default shelf:
- Changing “Default shelf for new books” persists and newly added books land in that shelf.

4. Settings - cover quality:
- Changing “Cover image quality” persists and search/add cover URLs use the selected size.

5. Settings - default sort:
- Changing “Default sort” persists and Library initializes with that sort.

6. Settings - page goal:
- “Page goal” prompt saves/updates yearly page target and reflects on Settings row.

7. Settings - import flows:
- “Import from Goodreads” and “Import from StoryGraph” both accept CSV and create books.

8. Settings - library export flows:
- CSV, JSON, and Markdown export actions each create shareable files.

9. Year in Review export actions:
- “Save as Image” opens a share flow with an image capture.
- “Export Data (CSV)” exports and shares CSV.

10. Search/Add duplicate protection + library clarity:
- Result row tap does not duplicate-add (Add button is the single add action).
- After add, empty shelf state explains books may exist in other shelves and offers “Show all books.”

## Runnable Apps (Current Testing Queue)

### MyFast

**Sections (Web Routes)**
- apps/web/app/history/page.tsx
- apps/web/app/layout.tsx
- apps/web/app/page.tsx
- apps/web/app/settings/page.tsx
- apps/web/app/stats/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/(tabs)/_layout.tsx
- apps/mobile/app/(tabs)/history.tsx
- apps/mobile/app/(tabs)/index.tsx
- apps/mobile/app/(tabs)/settings.tsx
- apps/mobile/app/(tabs)/stats.tsx
- apps/mobile/app/_layout.tsx
- apps/mobile/app/onboarding/_layout.tsx
- apps/mobile/app/onboarding/done.tsx
- apps/mobile/app/onboarding/index.tsx
- apps/mobile/app/onboarding/protocol.tsx
- apps/mobile/app/onboarding/widget.tsx

**README Feature List**
- ## Features
- 
- - **Fast timer** - Start/stop with a single tap. Background-persistent (computed from timestamp, not a foreground counter).
- - **Preset protocols** - 16:8, 18:6, 20:4, OMAD, 36h, 48h, or custom.
- - **Fasting history** - Chronological log of all fasts with duration, protocol, and target status.
- - **Streak tracking** - Current streak, longest streak, total fasts.
- - **Stats** - Average duration, adherence rate, weekly/monthly charts.
- - **Home screen widget** - Glance at your fast status without opening the app.
- - **Optional weight log** - Track weight alongside fasts. Off by default.
- - **CSV export** - Your data, portable.
- - **Zero network permissions** - No analytics, no accounts, no cloud. Everything stays on your device.
- 

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### Core Timer
- 1. **Fast timer** - Start/stop fasting timer with a single tap. Large, clear countdown/countup display. Shows elapsed time, remaining time (based on target), and end time.
- 2. **Preset fasting protocols** - 16:8, 18:6, 20:4, OMAD (23:1), 36-hour, 48-hour, custom. User selects their default protocol. Can override per-fast.
- 3. **Fasting state indicator** - Clear visual state: "Fasting" (with elapsed time) or "Eating" (with window remaining). Color-coded: teal when fasting, coral when eating.
- 
- ### History & Stats
- 4. **Fasting history log** - Chronological list of completed fasts with start time, end time, duration, target hit (yes/no), and optional notes.
- 5. **Streak tracking** - Current streak (consecutive days hitting target), longest streak, total fasts completed.
- 6. **Daily/weekly stats** - Average fasting duration, target adherence rate (% of fasts that hit goal), total fasting hours this week/month.
- 7. **Weight log (optional)** - Log weight alongside fasts. Simple line chart over time. Completely optional - hidden by default, enable in settings.
- 
- ### Widget & Notifications
- 8. **Home screen widget** - Shows current fast status (fasting/eating), elapsed time, target progress as a circular ring. Tap to open app.
- 9. **Optional notifications** - "Fast complete" notification when target reached. "Eating window closing" reminder. All optional, all off by default.
- 
- ### Simplicity
- 10. **No accounts** - Data stored locally in SQLite. No email, no password, no sign-up flow.
- 11. **No social features** - No leaderboards, no friends, no sharing prompts.
- 12. **No pseudo-science** - No "autophagy zone" claims, no "fat burning phase" indicators, no "fasting coach." Just a timer and data.
- 13. **Export** - Export fasting history as CSV. Your data, portable.
- 
- ---
- 

### MyBooks

**Sections (Web Routes)**
- apps/web/app/books/[id]/page.tsx
- apps/web/app/books/import/page.tsx
- apps/web/app/books/layout.tsx
- apps/web/app/books/page.tsx
- apps/web/app/books/reader/[id]/page.tsx
- apps/web/app/books/reader/page.tsx
- apps/web/app/books/search/page.tsx
- apps/web/app/books/stats/page.tsx
- apps/web/app/layout.tsx
- apps/web/app/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/(onboarding)/_layout.tsx
- apps/mobile/app/(onboarding)/goal.tsx
- apps/mobile/app/(onboarding)/import.tsx
- apps/mobile/app/(onboarding)/welcome.tsx
- apps/mobile/app/(tabs)/_layout.tsx
- apps/mobile/app/(tabs)/index.tsx
- apps/mobile/app/(tabs)/library.tsx
- apps/mobile/app/(tabs)/reader.tsx
- apps/mobile/app/(tabs)/search.tsx
- apps/mobile/app/(tabs)/settings.tsx
- apps/mobile/app/(tabs)/stats.tsx
- apps/mobile/app/_layout.tsx
- apps/mobile/app/book/[id].tsx
- apps/mobile/app/book/add.tsx
- apps/mobile/app/reader/[id].tsx
- apps/mobile/app/scan.tsx
- apps/mobile/app/shelf/[id].tsx
- apps/mobile/app/year-review.tsx

**README Feature List**
- ## Features
- 
- - **Personal library** - Add books via search, barcode scan, or manual entry
- - **Smart shelves** - Want to Read, Currently Reading, Finished, plus custom shelves
- - **Half-star ratings** - 0.5 to 5.0 in half-star increments (the #1 Goodreads complaint, fixed)
- - **Private reviews & notes** - Write honest thoughts. They never leave your device.
- - **Barcode scanning** - Point your camera at any ISBN barcode to instantly add a book
- - **Reading stats & goals** - Annual goals, monthly charts, rating distribution, pace tracking
- - **Year-in-review** - Beautiful summary cards of your reading year
- - **Import from Goodreads/StoryGraph** - Bring your existing library. One-time import, no ongoing connection.
- - **Export to CSV/JSON/Markdown** - Your data in open formats. No lock-in.
- - **Tags** - Organize books your way with custom labels
- - **Offline-first** - Browse your library, write reviews, track progress - all without internet
- 

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### Library Management
- 1. **Personal library** - Add books via search, barcode scan, or manual entry. Every book in your library shows cover, title, author, page count, ISBN, publisher, and publication year.
- 2. **Shelves** - Three default shelves: "Want to Read" (TBR), "Currently Reading", "Finished". Custom shelves for any purpose (e.g., "Lent to Sarah", "Favorites", "Book Club 2026").
- 3. **Book detail view** - Cover image, metadata, personal rating, review/notes, reading dates, shelf assignment, tags. Clean, book-cover-forward layout.
- 4. **Barcode scanner** - Camera-based ISBN barcode scanning. Point at any book, auto-detect ISBN, fetch metadata from Open Library. Works in bookstores, libraries, at home. Batch scanning mode for cataloging entire shelves.
- 5. **Manual entry** - For books not in Open Library's database. Title, author, page count, cover photo (camera or gallery).
- 6. **Import from Goodreads** - Parse Goodreads CSV export. Map shelves, ratings, dates, reviews. One-time import, no ongoing connection.
- 7. **Import from StoryGraph** - Parse StoryGraph export format similarly.
- 
- ### Ratings & Reviews (Private)
- 8. **Half-star ratings** - 0.5 to 5.0 in half-star increments. The #1 Goodreads complaint finally addressed.
- 9. **Private reviews/notes** - Free-text notes per book. These never leave the device. Write honest reviews without social pressure.
- 10. **Tags** - Custom tags per book (e.g., "sci-fi", "beach read", "mind-blowing", "DNF"). Filter and browse by tag.
- 
- ### Reading Stats & Goals
- 11. **Annual reading goal** - Set a target (e.g., "Read 30 books in 2026"). Progress bar on home screen. Adjustable mid-year.
- 12. **Reading stats dashboard** - Books read by month/year, pages read, average rating, genre distribution, author diversity, average book length.
- 13. **Year-in-review** - Beautiful, shareable summary card at year end: total books, top-rated, favorite genre, fastest read, longest book, reading streak, monthly breakdown. Exportable as image.
- 14. **Reading timeline** - Visual timeline showing when you started and finished each book. See overlapping reads and reading pace patterns.
- 
- ### Book Search & Discovery
- 15. **Open Library search** - Search 30M+ titles by title, author, or ISBN. Results show cover, title, author, first publish year, edition count. Powered by Internet Archive's free API.
- 16. **Offline metadata cache** - Book metadata is cached locally after first fetch. Browse your library and search your shelves entirely offline.
- 17. **No recommendations algorithm** - Deliberately no "you might also like" engine. No behavioral tracking. Your library is curated by you, not an algorithm.
- 
- ### Data Ownership
- 18. **Export to CSV/JSON** - Full library export in open formats. Move to any other app or build your own analysis.
- 19. **Export to Markdown** - Each book as a markdown file with all metadata and notes. Perfect for Obsidian integration.
- 20. **No account required** - Open the app and start adding books. No email, no sign-up, no verification.
- 
- ---
- 

### MyWords

**Sections (Web Routes)**
- apps/web/app/layout.tsx
- apps/web/app/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/_layout.tsx
- apps/mobile/app/index.tsx

**README Feature List**

**Derived Runtime Feature List**
- Search tab: direct word lookup by language.
- Dictionary A-Z tab: alphabetical browse by letter with pagination.
- Thesaurus A-Z tab: browse words, then open synonyms and antonyms.
- Word Helper tab: sentence-based replacement suggestions for a selected word.
- Lookup detail sections: pronunciations, word forms, word history, chronology, first known use, did-you-know, rhymes, word family, nearby words.
- Definition coverage: part of speech entries, senses, subsenses, examples, citations, sense-level synonyms, sense-level antonyms.
- Language switching: load supported language list and re-run search/browse/helper per language.
- Error and empty states: no results, unsupported browse language, helper with no suggestions.

### MyBudget

**Sections (Web Routes)**
- apps/web/app/accounts/connect/page.tsx
- apps/web/app/accounts/page.tsx
- apps/web/app/budget/page.tsx
- apps/web/app/debt-payoff/page.tsx
- apps/web/app/goals/page.tsx
- apps/web/app/layout.tsx
- apps/web/app/page.tsx
- apps/web/app/reports/income-vs-expense/page.tsx
- apps/web/app/reports/net-worth/page.tsx
- apps/web/app/reports/page.tsx
- apps/web/app/reports/spending/[categoryId]/page.tsx
- apps/web/app/reports/spending/page.tsx
- apps/web/app/settings/alerts/page.tsx
- apps/web/app/settings/currencies/page.tsx
- apps/web/app/settings/page.tsx
- apps/web/app/subscriptions/[subscriptionId]/page.tsx
- apps/web/app/subscriptions/add/page.tsx
- apps/web/app/subscriptions/calendar/page.tsx
- apps/web/app/subscriptions/page.tsx
- apps/web/app/transactions/import/page.tsx
- apps/web/app/transactions/page.tsx
- apps/web/app/upcoming/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/(tabs)/_layout.tsx
- apps/mobile/app/(tabs)/accounts.tsx
- apps/mobile/app/(tabs)/budget.tsx
- apps/mobile/app/(tabs)/reports.tsx
- apps/mobile/app/(tabs)/subscriptions.tsx
- apps/mobile/app/(tabs)/transactions.tsx
- apps/mobile/app/_layout.tsx
- apps/mobile/app/add-subscription.tsx
- apps/mobile/app/add-transaction.tsx
- apps/mobile/app/goals 2.tsx
- apps/mobile/app/goals.tsx
- apps/mobile/app/import-csv.tsx
- apps/mobile/app/onboarding.tsx
- apps/mobile/app/renewal-calendar.tsx
- apps/mobile/app/settings.tsx
- apps/mobile/app/subscription-detail.tsx

**README Feature List**
- ## Features
- 
- - **Envelope Budgeting** - Assign every dollar a job. Categories carry forward monthly.
- - **Subscription Tracking** - 200+ pre-populated services, renewal calendar, cost dashboard.
- - **CSV Import** - Import bank statements with saved column mapping profiles.
- - **Smart Autocomplete** - Learns payee-to-category mappings after 3+ entries.
- - **Reports** - Budget vs Actual, spending by category, income vs expenses trends.
- - **Optional Bank Sync** - Stay fully local/manual, or connect accounts with secure consent-based sync.
- 

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### 1. Envelope System (Budget Categories)
- 
- - Create unlimited budget categories ("envelopes"): Groceries, Rent, Dining Out, etc.
- - Group categories into sections: Fixed Expenses, Variable Expenses, Savings Goals, Debt Payments
- - Set monthly budget amounts per category
- - "Ready to Assign" balance shows unallocated income - the core YNAB concept
- - Move money between envelopes with drag-and-drop
- - Overspent categories highlighted in coral; underspent in teal
- - Category emoji/icon picker for visual identification
- 
- ### 2. Transaction Entry with Smart Autocomplete
- 
- - Quick-add transaction: amount, payee, category, date, memo
- - Smart autocomplete learns from previous entries (payee -> category mapping)
- - After 3 entries to "Trader Joe's" categorized as "Groceries," future entries auto-suggest the category
- - Split transactions across multiple categories (e.g., Target receipt: $50 groceries + $30 clothing)
- - Cleared/uncleared status for reconciliation
- - Swipe actions: swipe left to delete, swipe right to toggle cleared
- 
- ### 3. Recurring Transactions
- 
- - Set up recurring income (paychecks) and expenses (rent, utilities, subscriptions)
- - Frequency options: weekly, bi-weekly, monthly, quarterly, annually, custom
- - Auto-generates pending transactions on schedule
- - User confirms/adjusts amount when each recurrence posts
- - Visual calendar showing upcoming recurring items
- 
- ### 4. CSV Import from Bank Statements
- 
- - Import CSV files downloaded from any bank's website
- - Column mapping UI: match CSV columns to Amount, Date, Payee, Memo
- - Save column mappings per bank for one-tap future imports
- - Preview imported transactions before committing
- - Duplicate detection: flag transactions that match existing entries (date + amount + payee)
- - Supported date formats: MM/DD/YYYY, YYYY-MM-DD, DD/MM/YYYY, M/D/YY
- - Handle negative amounts (debits) and positive amounts (credits) with configurable sign convention
- 
- ### 5. Monthly Reports
- 
- - Budget vs. Actual by category (bar chart)
- - Spending by category (pie/donut chart)
- - Income vs. Expenses trend (line chart, 6-month rolling)
- - Net worth tracking (manual account balances)
- - Monthly summary card: total income, total expenses, net savings, top 3 spending categories
- 
- ### 6. Account Management
- 
- - Multiple accounts: Checking, Savings, Credit Card, Cash
- - Account balances updated automatically from transactions
- - Transfer between accounts (shows as outflow from one, inflow to another)
- - Reconciliation workflow: compare app balance to bank statement balance
- - Credit card payment tracking: category spending → credit card debt → payment from checking
- 
- ### 7. Search and Filter
- 
- - Full-text search across payees, memos, and categories
- - Filter by: date range, category, account, amount range, cleared status
- - Sort by: date, amount, payee, category
- 
- ---
- 

### MyRecipes

**Sections (Web Routes)**
- apps/web/app/add/page.tsx
- apps/web/app/events/invite/[token]/page.tsx
- apps/web/app/events/page.tsx
- apps/web/app/garden/page.tsx
- apps/web/app/grocery/page.tsx
- apps/web/app/import/page.tsx
- apps/web/app/import/review/page.tsx
- apps/web/app/layout.tsx
- apps/web/app/meal-planner/page.tsx
- apps/web/app/page.tsx
- apps/web/app/pantry/page.tsx
- apps/web/app/recipes/[id]/cook/page.tsx
- apps/web/app/recipes/[id]/page.tsx
- apps/web/app/recipes/[id]/print/page.tsx
- apps/web/app/recipes/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/(tabs)/_layout.tsx
- apps/mobile/app/(tabs)/grocery.tsx
- apps/mobile/app/(tabs)/index.tsx
- apps/mobile/app/(tabs)/pantry.tsx
- apps/mobile/app/(tabs)/search.tsx
- apps/mobile/app/_layout.tsx
- apps/mobile/app/add.tsx
- apps/mobile/app/pantry/[id].tsx
- apps/mobile/app/pantry/add.tsx
- apps/mobile/app/pantry/cooked.tsx
- apps/mobile/app/pantry/match.tsx
- apps/mobile/app/pantry/nutrition-edit.tsx
- apps/mobile/app/pantry/photo.tsx
- apps/mobile/app/pantry/scan.tsx
- apps/mobile/app/recipe/[id].tsx
- apps/mobile/app/recipe/[id]/cook.tsx
- apps/mobile/app/settings.tsx

**README Feature List**
- ## Features
- 
- - **URL Import** - Paste any recipe blog URL. The app extracts ingredients, steps, and cooking times from schema.org/Recipe markup. One network call, then the recipe works offline forever.
- - **Step-by-Step Cooking Mode** - Full-screen, large text, keep-awake, tappable timers, ingredient overlay. Designed for kitchen use with greasy hands.
- - **Grocery List** - Select recipes for the week, generate a merged shopping list. Same ingredients from different recipes combine automatically. Grouped by store section.
- - **Recipe Scaling** - Adjust servings up or down, ingredient quantities update in real-time.
- - **Tags & Collections** - Organize by cuisine, meal type, dietary needs, or custom tags. Create collections like "Weeknight Dinners" or "Holiday Baking."
- - **Full Offline** - Everything works without internet. Only URL import needs connectivity.
- 

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### 1. Recipe Management
- 
- - Add recipes manually: title, description, prep time, cook time, servings, ingredients, steps, tags, photo
- - Structured ingredient entry: quantity, unit, item, prep notes (e.g., "2 cups flour, sifted")
- - Structured step entry: numbered steps with optional step-level timers
- - Recipe photo: take a photo or pick from camera roll (stored on-device)
- - Tags for organization: cuisine (Italian, Mexican, Thai...), meal type (breakfast, lunch, dinner, snack, dessert), dietary (vegetarian, vegan, gluten-free...), custom tags
- - Favorites system: star recipes for quick access
- - Recipe scaling: adjust servings up/down, ingredients auto-recalculate
- - Duplicate recipe (for creating variations)
- 
- ### 2. URL Import (Recipe Schema Parser)
- 
- - Paste a URL from any recipe blog
- - Parser extracts recipe data from:
-   1. **schema.org/Recipe JSON-LD** (primary - most food blogs use this for SEO)
-   2. **schema.org/Recipe microdata** (fallback)
-   3. **hRecipe microformat** (legacy fallback)
-   4. **Meta tags** (og:title, og:image as last resort)
- - Extracted fields: title, ingredients, steps, prep time, cook time, servings, yield, image URL, source URL, description
- - Preview screen shows extracted data - user can edit before saving
- - Import quality indicator: "Extracted 8/9 fields" with checkmarks
- - If extraction fails, offer manual entry pre-filled with whatever was found
- - Downloaded recipe image stored locally (not hotlinked)
- - Source URL preserved for attribution (but recipe is fully usable offline)
- 
- **Privacy note on URL import:** This is the ONE feature that requires a network call - fetching the HTML from the recipe URL. The fetch happens once at import time. No tracking headers are sent. The HTML is parsed locally, the recipe data is extracted and stored in SQLite, and the raw HTML is discarded. After import, the recipe works fully offline.
- 
- ### 3. Step-by-Step Cooking Mode
- 
- Full-screen, distraction-free mode designed for kitchen use:
- 
- - Large text (24px+ for ingredients, 20px+ for steps) - readable from 3 feet away
- - One step at a time, swipe to advance
- - Keep-awake: screen stays on during cooking mode (no auto-lock)
- - Ingredients reference: swipe up from bottom to peek at full ingredient list without leaving current step
- - Step timers: tap a time mentioned in a step to start a countdown timer
- - Multiple concurrent timers (e.g., "cook pasta 8 min" and "roast veggies 25 min")
- - Timer completion: haptic feedback + sound alert
- - Progress indicator: "Step 3 of 12"
- - Voice-friendly: large tap targets for greasy/wet hands
- 
- ### 4. Search and Filter
- 
- - Full-text search across recipe titles, ingredients, tags, and descriptions
- - Filter by tag (multiple tags with AND logic)
- - Filter by prep time (under 15 min, under 30 min, under 60 min)
- - Filter by favorites
- - Sort by: recently added, alphabetical, prep time, cook time
- - Quick access: "Favorites," "Recently Added," "Quick Meals (<30 min)"
- 
- ### 5. Grocery List Generation
- 
- - Select multiple recipes for the week
- - Generate combined grocery list automatically
- - Intelligent ingredient merging: "2 cups flour" + "1 cup flour" = "3 cups flour"
- - Group by grocery section: Produce, Dairy, Meat, Pantry, Frozen, Bakery, Other
- - Check off items while shopping
- - Add custom items to the list (things not from recipes)
- - Ingredient unit normalization: 4 tbsp butter → 1/4 cup butter where applicable
- - Pantry items: mark common pantry staples (salt, pepper, oil) to auto-exclude or dim in grocery list
- - Share grocery list as text (for sending to a partner)
- - Clear completed items / clear all
- 
- ### 6. Collections
- 
- - Organize recipes into collections: "Weeknight Dinners," "Holiday Baking," "Meal Prep Sunday"
- - A recipe can belong to multiple collections
- - Default collections: All Recipes, Favorites, Recently Added
- - Custom collections with cover photo (from a recipe in the collection)
- 
- ### 7. Import/Export
- 
- - Export individual recipe as text (formatted for sharing via Messages, email, etc.)
- - Export all recipes as JSON (full backup)
- - Import from JSON backup (restore on new device)
- - Share recipe as a nicely formatted card image (for social media)
- 
- ---
- 

### MyCar

**Sections (Web Routes)**
- apps/web/app/analytics/page.tsx
- apps/web/app/checklist/page.tsx
- apps/web/app/expenses/page.tsx
- apps/web/app/fuel-stats/page.tsx
- apps/web/app/garage/[id]/page.tsx
- apps/web/app/garage/page.tsx
- apps/web/app/layout.tsx
- apps/web/app/page.tsx
- apps/web/app/recalls/page.tsx
- apps/web/app/reminders/page.tsx
- apps/web/app/settings/page.tsx
- apps/web/app/trips/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/(tabs)/_layout.tsx
- apps/mobile/app/(tabs)/expenses/index.tsx
- apps/mobile/app/(tabs)/garage/index.tsx
- apps/mobile/app/(tabs)/reminders/index.tsx
- apps/mobile/app/(tabs)/settings/index.tsx
- apps/mobile/app/_layout.tsx
- apps/mobile/app/vehicle/[id].tsx

**README Feature List**

**DESIGN Feature List**
- ## 5. Key Features (MVP)
- 
- ### 5.1 Vehicle Profiles
- - Add multiple vehicles with: year, make, model, trim, color, VIN (optional), license plate, photo
- - Per-vehicle odometer tracking (current mileage, updated with each log entry)
- - Vehicle nickname for quick identification ("Mom's Civic", "The Truck")
- - Quick-switch between vehicles via horizontal scroll or dropdown
- - Vehicle summary card: next service due, last fill-up MPG, total expenses
- 
- ### 5.2 Maintenance Log
- - Log service events: date, odometer, service type, cost, location (free text, no GPS), notes
- - Pre-defined service types with suggested intervals:
-   - Oil change (every 5,000-7,500 mi or 6 months)
-   - Tire rotation (every 5,000-7,500 mi)
-   - Brake pad replacement (every 25,000-70,000 mi)
-   - Air filter (every 15,000-30,000 mi)
-   - Transmission fluid (every 30,000-60,000 mi)
-   - Coolant flush (every 30,000-50,000 mi)
-   - Spark plugs (every 30,000-100,000 mi)
-   - Timing belt (every 60,000-100,000 mi)
-   - Battery replacement (every 3-5 years)
-   - Wiper blades (every 6-12 months)
-   - Cabin air filter (every 15,000-25,000 mi)
-   - Custom service type (user-defined)
- - Attach photos to entries (service receipts, before/after photos, damage documentation)
- - Sort and filter by: date, service type, cost
- - Edit and delete entries
- 
- ### 5.3 Maintenance Reminders
- - Create reminders by mileage interval OR date interval (or both)
- - Reminders auto-calculate from last logged service + interval
- - Local push notifications when a reminder comes due
- - Reminder states: upcoming (green), due soon (amber), overdue (red)
- - Dashboard shows next 5 upcoming services across all vehicles
- - Snooze or dismiss reminders
- - Pre-configured reminder templates based on manufacturer recommendations (generic)
- 
- ### 5.4 Fuel Tracking
- - Log fill-ups: date, odometer, gallons/liters, price per unit, total cost, full tank (Y/N), station (free text)
- - Automatic MPG/L-per-100km calculation between fill-ups (requires consecutive full-tank fills)
- - Fuel economy trend chart (line, last 20 fill-ups)
- - Average cost per mile/km
- - Monthly fuel expense summary
- - Support for both US (MPG, gallons) and metric (L/100km, liters) units
- 
- ### 5.5 Expense Tracking
- - Aggregate all costs: maintenance + fuel + other (insurance, parking, tolls, registration, car wash)
- - Monthly and yearly expense summaries
- - Cost breakdown by category (pie chart)
- - Per-vehicle total cost of ownership
- - Export expense report (CSV)
- 
- ### 5.6 Document Storage
- - Store vehicle documents as photos: insurance cards, registration, VIN sticker, title
- - Document types with expiration tracking: insurance (expiry date), registration (renewal date)
- - Reminders for document renewals
- - Quick-access document viewer (flip through stored cards)
- 
- ### 5.7 Service History Export (PDF)
- - Generate a professional PDF of complete maintenance history for a vehicle
- - Includes: vehicle info, chronological service log, mileage at each service, costs
- - Clean, printable layout suitable for car buyers
- - Share via system share sheet (email, AirDrop, Messages, etc.)
- - "Maintenance Record" branding - looks professional, not app-branded
- 
- ### 5.8 Settings
- - Units: US (miles, gallons, MPG) or Metric (km, liters, L/100km)
- - Currency: USD, EUR, GBP, CAD, AUD (symbol + formatting)
- - Appearance: dark mode (default), light mode, system
- - Data: export all data (JSON backup), import backup, clear all data
- - Reminders: notification preferences, default intervals
- 
- ---
- 

### MyHomes

**Sections (Web Routes)**
- apps/web/src/app/(app)/discover/page.tsx
- apps/web/src/app/(app)/layout.tsx
- apps/web/src/app/(app)/messages/page.tsx
- apps/web/src/app/(app)/profile/page.tsx
- apps/web/src/app/(app)/sell/page.tsx
- apps/web/src/app/about/page.tsx
- apps/web/src/app/dev-login/page.tsx
- apps/web/src/app/how-it-works/page.tsx
- apps/web/src/app/layout.tsx
- apps/web/src/app/page.tsx
- apps/web/src/app/privacy/page.tsx
- apps/web/src/app/sign-in/[[...sign-in]]/page.tsx
- apps/web/src/app/sign-up/[[...sign-up]]/page.tsx
- apps/web/src/app/terms/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/(auth)/_layout.tsx
- apps/mobile/app/(auth)/sign-in.tsx
- apps/mobile/app/(auth)/sign-up.tsx
- apps/mobile/app/(tabs)/_layout.tsx
- apps/mobile/app/(tabs)/index.tsx
- apps/mobile/app/(tabs)/messages.tsx
- apps/mobile/app/(tabs)/profile/_layout.tsx
- apps/mobile/app/(tabs)/profile/edit.tsx
- apps/mobile/app/(tabs)/profile/index.tsx
- apps/mobile/app/_layout.tsx

**README Feature List**
- ## Features
- 
- - Home listings with rich stories and history
- - Buyer and seller profiles (about people, not just properties)
- - Multi-layer verification (identity + neighborly vouching + intent pledge)
- - Market intelligence from public records (no MLS dependency)
- - Direct buyer-seller messaging and video calls
- - Offer management and counteroffer workflows
- - State-specific disclosure and document builder
- - Showing scheduler with seller control
- - Guided closing coordination
- - Community and neighborhood discovery
- 

### MySurf

**Sections (Web Routes)**
- apps/web/app/account/page.tsx
- apps/web/app/favorites/page.tsx
- apps/web/app/layout.tsx
- apps/web/app/login/page.tsx
- apps/web/app/map/page.tsx
- apps/web/app/page.tsx
- apps/web/app/sessions/page.tsx
- apps/web/app/spot/[slug]/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/(tabs)/_layout.tsx
- apps/mobile/app/(tabs)/account.tsx
- apps/mobile/app/(tabs)/favorites.tsx
- apps/mobile/app/(tabs)/index.tsx
- apps/mobile/app/(tabs)/map.tsx
- apps/mobile/app/(tabs)/sessions.tsx
- apps/mobile/app/(tabs)/trails.tsx
- apps/mobile/app/+not-found.tsx
- apps/mobile/app/_layout.tsx
- apps/mobile/app/spot/[slug].tsx
- apps/mobile/app/trail/[id].tsx

**README Feature List**
- ## MVP Scope
- 
- - California coastline (~200 curated surf spots)
- - Interactive swell map with tap-anywhere model data
- - 7-day spot forecast with hourly surf, wind, tide charts
- - AI-generated surf narratives
- - Community spot creation
- - $5/year premium (16-day forecast, advanced data, ad-free)
- 

### MyWorkouts

**Sections (Web Routes)**
- apps/web/app/auth/forgot-password/page.tsx
- apps/web/app/auth/sign-in/page.tsx
- apps/web/app/auth/sign-up/page.tsx
- apps/web/app/exercise/[id]/history/page.tsx
- apps/web/app/exercise/[id]/page.tsx
- apps/web/app/explore/page.tsx
- apps/web/app/layout.tsx
- apps/web/app/measurements/page.tsx
- apps/web/app/page.tsx
- apps/web/app/photos/page.tsx
- apps/web/app/plans/[id]/page.tsx
- apps/web/app/plans/builder/page.tsx
- apps/web/app/plans/page.tsx
- apps/web/app/pricing/page.tsx
- apps/web/app/profile/page.tsx
- apps/web/app/progress/page.tsx
- apps/web/app/recordings/[id]/page.tsx
- apps/web/app/recordings/page.tsx
- apps/web/app/social/[id]/page.tsx
- apps/web/app/social/followers/page.tsx
- apps/web/app/social/page.tsx
- apps/web/app/templates/[id]/page.tsx
- apps/web/app/templates/page.tsx
- apps/web/app/tools/plate-calculator/page.tsx
- apps/web/app/tools/warmup/page.tsx
- apps/web/app/workout/[id]/page.tsx
- apps/web/app/workouts/builder/page.tsx
- apps/web/app/workouts/page.tsx

**Sections (Mobile Routes)**
- apps/mobile/app/(tabs)/_layout.tsx
- apps/mobile/app/(tabs)/explore.tsx
- apps/mobile/app/(tabs)/index.tsx
- apps/mobile/app/(tabs)/profile.tsx
- apps/mobile/app/(tabs)/progress.tsx
- apps/mobile/app/(tabs)/workouts.tsx
- apps/mobile/app/__tests__/auth-pages.test.tsx
- apps/mobile/app/__tests__/explore-and-exercise-pages.test.tsx
- apps/mobile/app/__tests__/home-page.test.tsx
- apps/mobile/app/__tests__/plans-and-subscription-pages.test.tsx
- apps/mobile/app/__tests__/progress-page.test.tsx
- apps/mobile/app/__tests__/workout-player-page.test.tsx
- apps/mobile/app/__tests__/workouts-and-builder-pages.test.tsx
- apps/mobile/app/_layout.tsx
- apps/mobile/app/auth/_layout.tsx
- apps/mobile/app/auth/forgot-password.tsx
- apps/mobile/app/auth/sign-in.tsx
- apps/mobile/app/auth/sign-up.tsx
- apps/mobile/app/exercise/[id].tsx
- apps/mobile/app/plans/[id].tsx
- apps/mobile/app/plans/index.tsx
- apps/mobile/app/subscription/index.tsx
- apps/mobile/app/workout/[id].tsx
- apps/mobile/app/workouts/builder.tsx

**README Feature List**
- ## Features
- 
- - **Interactive Body Map** - Tap muscle groups to discover targeted exercises
- - **Voice Commands** - Hands-free workout control (pause, resume, faster, slower, skip)
- - **Coach-Paced Video** - Professional workout videos with audio cues
- - **Form Recording** - Camera records you during workouts for coach review
- - **Workout Builder** - Create custom routines from the exercise library
- - **Progress Tracking** - Workout history, streaks, volume tracking
- 

### MyVoice

**Sections (Web Routes)**
- (no web routes)

**Sections (Mobile Routes)**
- (no mobile routes)

**README Feature List**

**Derived Runtime Feature List**
- Trigger dictation with double-press fn.
- Overlay status while listening and transcribing.
- Auto-stop on silence and type output into focused field.
- Auto-Stop Pause setting in tray menu.
- Escape key cancel behavior during dictation.
- End-to-end offline dictation after one-time setup.
- First-run setup path: whisper-cpp install, model download, microphone and accessibility permissions.
- Cross-app typing compatibility in common macOS text inputs.

## Design-Only / Deferred Apps (Spec Checklist)

### MyCloset

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### 1. Wardrobe Catalog
- 
- - Add clothing items by taking a photo or selecting from camera roll
- - **On-device background removal** automatically isolates the garment from the background (iOS Vision framework / Android ML Kit Subject Segmentation)
- - Manual crop/adjust if auto-removal isn't perfect
- - Categorize by type: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Activewear, Swimwear, Sleepwear, Formalwear, Custom
- - Tag with attributes: Color (primary + secondary), Pattern (solid, striped, floral, plaid, etc.), Season (spring, summer, fall, winter, all-season), Occasion (work, casual, formal, active, going-out), Brand, Size
- - Add purchase info: price, date acquired, store/source
- - Favorite items for quick access
- - Bulk import mode: rapid-fire photo capture for initial wardrobe setup (take photos of many items quickly, tag later)
- 
- ### 2. Outfit Builder
- 
- - Visual outfit composer: select items from wardrobe to create outfit combinations
- - Layered preview: items stack visually (top over bottom, shoes below, accessories around)
- - Save outfits with name, occasion tags, and season tags
- - Browse saved outfits in a visual grid
- - "Surprise me" random outfit generator from compatible items
- - Outfit templates: "Work outfit" (top + bottom + shoes), "Full look" (top + bottom + shoes + outerwear + accessory)
- 
- ### 3. Outfit Calendar (Wear Tracking)
- 
- - Calendar view showing what you wore each day
- - Log today's outfit by selecting a saved outfit or picking individual items
- - View wear history for any item (date list + total count)
- - "Last worn" badge on each item in the wardrobe grid
- - Streak tracking: "You've logged 14 days in a row" (gentle encouragement, not gamification)
- 
- ### 4. Weather Integration
- 
- - Show local weather on the outfit planning screen
- - Temperature-based filtering: "Show me items suitable for 45F/7C"
- - Season tags auto-filter based on current weather
- - Weather data fetched via IP-based geolocation (no GPS permissions needed - uses ipapi.co for approximate location + Open-Meteo free API for weather data, both over HTTPS)
- - Weather fetched once per day, cached locally
- - Privacy note: IP-based weather lookup reveals approximate city location (same as any website visit). No GPS coordinates sent. No location history stored.
- 
- ### 5. Wardrobe Analytics
- 
- - **Cost per wear:** Purchase price / number of times worn. Updated automatically as wear logs accumulate.
- - **Wear frequency:** Items ranked by times worn (most to least). Highlights "never worn" items.
- - **Category breakdown:** Pie chart of wardrobe by type (tops: 35%, bottoms: 20%, etc.)
- - **Season distribution:** How balanced is your wardrobe across seasons?
- - **Color palette:** Visual grid of your wardrobe's dominant colors
- - **Wardrobe value:** Total estimated value based on purchase prices entered
- - **"Closet insights":** Simple text summaries - "Your most-worn item is the Navy Blazer (47 wears). Your least-worn category is Formalwear (2 items, 0 wears in 6 months)."
- - **Donation candidates:** Items worn 0 times in 6+ months, ranked by value (helps identify what to let go)
- 
- ### 6. Search and Filter
- 
- - Full-text search across item names, brands, tags
- - Filter by: type, color, pattern, season, occasion, brand
- - Multi-filter with AND logic
- - Sort by: recently added, most worn, least worn, cost per wear, price
- - Quick access views: "Favorites," "Never Worn," "Recently Added"
- 
- ### 7. Import/Export
- 
- - Export wardrobe as JSON (full backup including photo file paths)
- - Import from JSON backup (restore on new device)
- - Share individual outfit as a composed image card (for texting to a friend)
- - Export wardrobe summary as text (item count, category breakdown, total value)
- 
- ---
- 

### MyCycle

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### Core Tracking
- - **Period logging:** Tap a date to mark period start. Tap again to mark end. Support multi-day selection by dragging. Log flow intensity (light / medium / heavy / spotting) per day
- - **Cycle calendar:** Month view showing period days (filled), predicted period days (outlined), fertile window estimate (subtle highlight), and today marker
- - **Cycle prediction:** On-device moving-average algorithm predicts next period start date, cycle length, and period duration based on the user's historical data. Minimum 2 cycles for first prediction, improves with more data
- - **Fertile window estimate:** Simple calculation based on predicted ovulation (cycle length minus 14 days, +/- 2 day window). Clearly labeled as an estimate, not medical advice
- 
- ### Symptom Logging
- - **Daily symptom entry:** Tap any date to log symptoms. Categories: Physical (cramps, headache, bloating, breast tenderness, fatigue, acne, backache), Mood (happy, anxious, irritable, sad, energetic, calm), Flow (light, medium, heavy, spotting), Other (custom text note)
- - **Symptom icons:** Simple, non-clinical iconography. Tap to toggle on/off. No sliders, no numeric scales - binary present/absent with optional intensity (mild / moderate / severe)
- 
- ### Insights
- - **Cycle statistics:** Average cycle length, average period duration, cycle length variation, longest/shortest cycle. Updates in real-time as data accumulates
- - **Cycle history list:** Scrollable list of past cycles with start date, length, period duration, and logged symptoms
- - **Symptom patterns:** Simple frequency chart showing which symptoms appear most often and in which cycle phase (follicular, ovulatory, luteal, menstrual)
- 
- ### Reminders
- - **Period reminder:** Local push notification X days before predicted period start (user-configurable, default: 2 days)
- - **Daily log reminder:** Optional daily notification at user-chosen time to log symptoms
- - **All reminders use local notifications** - no server, no push notification service, no APNs/FCM tokens
- 
- ### Data Management
- - **Export:** Export all data as CSV or JSON to Files app / share sheet
- - **Import:** Import from CSV (documented format) for users migrating from other apps
- - **No backup to cloud** - if the user loses their phone, the data is gone (by design). Documented clearly during onboarding
- - **Wipe all data:** Single button to permanently delete all local data
- 
- ### Onboarding
- - **First launch:** 3-screen onboarding: (1) "Your data never leaves this device" with technical explanation, (2) "Log your last period to get started", (3) "Set up reminders (optional)"
- - **No account creation.** No email. No name. App launches directly into the calendar
- - **No analytics, no crash reporting, no network requests whatsoever** on first launch or ever
- 
- ---
- 

### MyFlash

**DESIGN Feature List**
- ## 5. Key Features (MVP)
- 
- ### 5.1 Deck & Card Management
- - Create, edit, delete decks with name, description, and color tag
- - Create cards within decks: Basic (front/back), Cloze deletion (fill-in-the-blank), Image occlusion
- - Rich card editor with Markdown support (bold, italic, lists, code blocks, LaTeX math via KaTeX)
- - Image attachments on cards (stored locally, referenced by path)
- - Audio attachments for pronunciation (language learning use case)
- - Deck folders for organization (nested one level deep)
- - Card search across all decks (full-text search on local SQLite FTS5)
- - Card tags for cross-deck filtering
- 
- ### 5.2 Spaced Repetition Engine (FSRS)
- - FSRS v4 algorithm implementation (Free Spaced Repetition Scheduler)
- - Four review ratings: Again, Hard, Good, Easy
- - Per-card difficulty, stability, and retrievability tracking
- - Automatic interval scheduling based on desired retention rate (default 90%)
- - User-configurable target retention (80%-99%)
- - New card introduction limits (default 20/day, configurable)
- - Review card daily limits (configurable or unlimited)
- - Learning steps for new cards (1min, 10min configurable)
- - Re-learning steps for lapsed cards
- 
- ### 5.3 Study Sessions
- - Study screen with card flip animation
- - Session types: Review due cards, Learn new cards, Custom study (filtered deck)
- - Session summary with cards reviewed, accuracy, time spent
- - Undo last review (within session)
- - Study timer (optional Pomodoro mode)
- - End-of-session stats: retention rate, cards mature/young/new breakdown
- 
- ### 5.4 Anki Import
- - Import .apkg files (Anki package format - ZIP containing SQLite + media)
- - Parse Anki's `collection.anki2` SQLite database for notes, cards, decks, and models
- - Map Anki note types to MyFlash card types (Basic, Cloze, Image Occlusion)
- - Import media files (images, audio) from the package
- - Preserve deck hierarchy
- - Handle Anki's HTML card templates by rendering to clean markdown
- - Import progress: show deck count, card count, media count during import
- - Conflict resolution: skip duplicates by note GUID
- 
- ### 5.5 Statistics & Progress
- - Daily review count chart (bar chart, last 30 days)
- - Card maturity pie chart (new / young / mature)
- - Retention rate over time (line chart, last 30 days)
- - Current and longest streak (consecutive days studied)
- - Forecast: predicted reviews for next 30 days
- - Per-deck statistics breakdown
- - Heatmap calendar (GitHub-style contribution graph for study days)
- 
- ### 5.6 Settings & Preferences
- - FSRS parameters: target retention, new cards/day, max reviews/day
- - Appearance: dark mode (default), light mode, system
- - Card display: font size, flip animation speed
- - Study: auto-play audio, show timer, Pomodoro duration
- - Data: export all decks (.apkg format), import backup, clear all data
- - About: version, licenses, privacy policy (local link)
- 
- ---
- 

### MyGarden

**DESIGN Feature List**
- ## 5. Key Features (MVP)
- 
- ### P0 - Must Have (Launch)
- 
- - [ ] **Plant Profiles** - Name, species, photo (from camera or library), location (room/zone), acquisition date
- - [ ] **Watering Schedule & Reminders** - Per-plant watering frequency with local push notifications
- - [ ] **Care Instructions Database** - 500+ pre-loaded species with light, water, soil, temperature, humidity, and toxicity info
- - [ ] **Plant Health Log** - Timestamped entries per plant: watered, fertilized, repotted, pruned, pest treatment, photo update
- - [ ] **On-Device Plant Identification** - Camera photo analyzed by Core ML (iOS) / TensorFlow Lite (Android) model. Photo never leaves device.
- - [ ] **Garden Journal** - Free-form daily/weekly entries with optional photos. Markdown-like formatting.
- - [ ] **Dashboard** - Today's tasks (what needs watering), upcoming schedule, plant health overview
- - [ ] **Dark mode** - Default, matching My* brand (warm amber/coral/teal on dark background)
- 
- ### P1 - Should Have (v1.1)
- 
- - [ ] Sunlight tracker - Log which rooms get direct/indirect/low light
- - [ ] Seasonal planting calendar (outdoor gardens)
- - [ ] Batch watering - Water all plants in a room/zone at once
- - [ ] Widget - iOS/Android home screen widget showing today's watering tasks
- - [ ] Quick capture - Long-press app icon to log a watering or take a plant photo
- 
- ### P2 - Nice to Have (v2.0)
- 
- - [ ] Export data as JSON/CSV
- - [ ] iCloud Drive backup (encrypted SQLite file, user-initiated only)
- - [ ] Garden map - Drag-and-drop visual layout of garden beds
- - [ ] Pest/disease identification (on-device ML model)
- - [ ] Harvest tracking for vegetable gardens
- 
- ---
- 

### MyHabits

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### Habit Management
- - **Create habit:** Name, emoji icon (picker from system emoji), frequency (daily, specific days of week, X times per week), optional target time of day (morning / afternoon / evening - for sorting, not reminders in MVP)
- - **Edit habit:** Modify name, icon, frequency, time of day, color
- - **Archive habit:** Remove from daily view without deleting data. Archived habits and their history remain in the database. Can be unarchived.
- - **Delete habit:** Permanent deletion with confirmation. Removes all associated completion data.
- - **Reorder habits:** Drag-and-drop to reorder habits in the daily checklist
- - **Habit limit:** None. Track as many habits as you want (no artificial cap like Streaks' 24-habit limit)
- 
- ### Daily Check-In
- - **Today view (default screen):** List of today's active habits. Each row: emoji icon, habit name, streak count, and a circular checkbox. Tap the checkbox to mark complete - satisfying haptic feedback + fill animation
- - **Completion is binary:** Done or not done. No percentages, no half-completions, no "almost did it" states. Simplicity is the feature.
- - **Undo:** Tap a completed habit to un-complete it (toggle). No confirmation needed - it's a checkbox.
- - **Quick entry:** The entire daily check-in should take <10 seconds for a user with 5 habits. One tap per habit, no modals, no extra screens.
- 
- ### Streaks
- - **Current streak:** Consecutive days the habit was completed (respecting the habit's frequency - a M/W/F habit doesn't break its streak on Tuesday)
- - **Best streak:** All-time longest streak for each habit
- - **Streak display:** Current streak number shown inline on the Today view next to each habit. Best streak shown on the habit detail screen.
- 
- ### Heatmap Visualization
- - **GitHub-style contribution heatmap** - the signature feature. Grid of squares, one per day, colored by completion ratio:
-   - Empty (dark gray): No habits completed
-   - Light: 1-33% of habits completed
-   - Medium: 34-66% completed
-   - Full (vibrant amber): 67-100% completed
- - **Per-habit heatmap:** Each habit has its own heatmap on its detail screen (binary: completed = amber, not completed = dark)
- - **Global heatmap:** Insights screen shows an aggregate heatmap across all habits
- - **Time range:** Shows last 12 months by default (scrollable for older data)
- - **Inspired by:** GitHub contribution graph, r/theXeffect's "don't break the chain" index cards
- 
- ### Weekly & Monthly Views
- - **Week view:** Bar chart showing completion percentage per day for the current week
- - **Month view:** Calendar grid with completion dots (similar to the heatmap but in calendar layout)
- 
- ### Widget
- - **iOS widget (Small, 2x2):** Shows today's habits with completion status. Tap a habit in the widget to mark it complete without opening the app (via App Intent)
- - **iOS widget (Medium, 4x2):** Shows today's habits + current streaks
- - **Android widget:** Same as iOS small widget - today's habits with tap-to-complete
- 
- ### Data Management
- - **Export:** CSV or JSON export of all habit data (habits + completions + streaks)
- - **Import:** CSV import for users migrating from other trackers
- - **Wipe all data:** Single button with confirmation to permanently delete everything
- 
- ---
- 

### MyJournal

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### Core Journaling
- 1. **Rich markdown editor** - Full markdown support with live preview. Bold, italic, headers, lists, blockquotes, code blocks, horizontal rules. WYSIWYG toolbar for non-technical users.
- 2. **Daily entries with date-based navigation** - Calendar view to browse entries by date. Today button for quick access. Visual indicators for days with entries.
- 3. **Full-text search** - FTS5-powered search across all entries. Search by content, tags, or date range. Results highlighted in context.
- 4. **Tags/labels** - Organize entries with custom tags. Tag suggestions based on usage frequency. Filter entries by tag.
- 5. **Photo attachments** - Embed photos inline within entries. Photos stored locally alongside the database. Thumbnail grid view in the gallery.
- 
- ### Privacy & Security
- 6. **Encrypted local storage** - SQLite database encrypted with SQLCipher (AES-256). User sets a passphrase on first launch. Database is unreadable without the passphrase.
- 7. **Biometric unlock** - Face ID / Touch ID / fingerprint to unlock the app. Passphrase required on first launch per device.
- 8. **No network access** - The app requests zero network permissions. No analytics, no crash reporting, no phone-home.
- 9. **Export to Markdown/PDF** - Export individual entries or full journal to Markdown files or a formatted PDF. Your data, your format, no lock-in.
- 
- ### Voice & Mood
- 10. **Voice-to-journal** - Tap the microphone icon to record. Whisper.cpp transcribes on-device. Review and edit the transcription before saving. Audio recording optionally attached to the entry.
- 11. **Mood tag per entry** - Select a mood from a simple 5-point scale (1-5 with emoji faces). Mood trends visible in a monthly chart.
- 12. **Writing prompts** - Optional daily prompt shown on the new entry screen. Curated list of 365+ prompts (gratitude, reflection, goals, creative). Prompts can be disabled.
- 
- ### UX Polish
- 13. **Night mode optimized** - Dark theme with warm amber tones designed for bedtime journaling. Reduced blue light. Dimmed interface for late-night use.
- 14. **Streak tracking** - Visual streak counter on the home screen. Gentle encouragement, not gamification. No notifications unless opted in.
- 15. **Word count & stats** - Per-entry word count. Monthly/yearly writing stats (total entries, total words, longest streak, most common tags, mood average).
- 
- ---
- 

### MyMeds

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### Medication Management
- - **Add medication:** Name (with autocomplete from a local drug name database), dosage (amount + unit: mg, mcg, mL, etc.), form (tablet, capsule, liquid, injection, patch, inhaler, drops, cream, other), frequency (once daily, twice daily, three times daily, every X hours, specific days of week, as needed), schedule times, prescriber name (optional), pharmacy (optional), notes (optional)
- - **Photo scan prescription label:** Use the device camera to photograph a prescription label. On-device OCR (Apple Vision framework on iOS, ML Kit on Android) extracts medication name, dosage, and quantity. User confirms/edits before saving. All processing happens on-device - the photo is never uploaded anywhere.
- - **Edit medication:** Modify any field. History of changes is preserved (important for "what dose was I on last month?")
- - **Discontinue medication:** Mark as discontinued with a date. Removed from active schedule but preserved in history with full adherence data.
- - **Delete medication:** Permanent removal with confirmation.
- - **Medication list view:** All active medications in a clean list. Tap for detail. Useful as a reference when visiting a doctor - "show your phone" replaces "I forget the name."
- 
- ### Dosage Reminders
- - **Scheduled notifications:** Local push notification at each scheduled dose time. Notification shows medication name and dosage (configurable - users with privacy concerns can set notifications to show "Time for your medication" without the specific name)
- - **Notification actions:** "Taken" and "Snooze 15min" directly from the notification (no app launch needed)
- - **Snooze cascade:** Snooze once (15min), twice (30min), three times (1hr). After 3 snoozes, marked as missed. Configurable snooze duration.
- - **Flexible scheduling:** Support for complex medication schedules - "take with food," "take on empty stomach," "take 30 minutes before breakfast." These are stored as notes/tags on the reminder, not enforced by the app.
- - **Do Not Disturb awareness:** Reminders respect the user's DND schedule but queue for delivery when DND ends (using local notification scheduling)
- 
- ### Adherence Tracking
- - **Daily adherence log:** For each day, show which doses were taken, missed, or skipped (user can manually mark "skipped" for intentional misses like doctor-advised hold)
- - **Adherence history:** Calendar view showing adherence per day (green = all taken, yellow = partial, red = missed, gray = no data). Similar to MyCycle's calendar but for medication adherence.
- - **Adherence statistics:** Per-medication adherence rate (% of scheduled doses taken over 7/30/90 days), overall adherence rate, streak (consecutive days with 100% adherence)
- - **Medication log:** Timestamped list of every dose taken/missed/skipped - exportable for sharing with a doctor
- 
- ### Refill Alerts
- - **Pill count tracking:** When adding a medication, optionally enter the quantity dispensed (e.g., "90 tablets"). The app counts down as doses are logged.
- - **Refill reminder:** Local notification when supply drops below a configurable threshold (default: 7 days' supply remaining)
- - **Refill history:** Log when a refill was picked up (tap "Refilled" and optionally enter new quantity)
- 
- ### Interaction Warnings
- - **Local interaction database:** A bundled SQLite database of ~500 common clinically significant drug-drug interactions (sourced from public FDA data and open-source interaction databases). Covers the most dangerous combinations: MAOIs + SSRIs, warfarin + NSAIDs, methotrexate + trimethoprim, etc.
- - **Passive checking:** When a user adds a new medication, the app checks it against all current active medications. If an interaction is found, display a warning banner with severity (major/moderate/minor) and a brief description.
- - **Not a substitute for professional advice:** Every interaction warning includes a disclaimer: "This is not medical advice. Consult your pharmacist or doctor." The database covers common interactions but is not comprehensive.
- - **Database updates:** Interaction database is bundled with the app and updated via app store updates (no network fetch). Version-stamped so users know the recency of their interaction data.
- 
- ### Data Management
- - **Export:** Full medication list + adherence history as CSV, JSON, or PDF (formatted medication list suitable for printing and bringing to a doctor's appointment)
- - **Import:** CSV import for medication list
- - **Wipe all data:** Permanent deletion with confirmation
- 
- ### Onboarding
- - **First launch:** 3 screens: (1) "Your medications stay on your device - always" with privacy explanation, (2) "Add your first medication" (with photo scan option), (3) "Set up reminders"
- - **No account. No email. No name.** App launches directly into the medication list.
- - **Quick-add flow:** Medication name → dosage → schedule → done. Under 30 seconds for a simple daily medication.
- 
- ---
- 

### MyMood

**DESIGN Feature List**
- ## 5. Key Features (MVP)
- 
- ### P0 - Must Have (Launch)
- 
- - [ ] **Mood Check-In** - 5-point scale (1=Very Low, 2=Low, 3=Neutral, 4=Good, 5=Great) with warm, non-clinical icons (not emojis - custom illustrations)
- - [ ] **Activity Tags** - Pre-defined + custom tags: exercise, sleep, social, work, family, outdoors, creative, reading, meditation, cooking, alcohol, caffeine, medication, therapy, travel
- - [ ] **Brief Note** - Optional free-text note per entry (1-3 sentences, not a full journal)
- - [ ] **Mood Trends** - Daily, weekly, monthly, yearly charts showing mood over time
- - [ ] **Correlation Insights** - "You tend to rate higher on days with Exercise and Outdoors" - simple statistical correlation, not AI
- - [ ] **Therapy Export** - Generate a PDF summary of mood trends, activity correlations, and notable entries for a date range. Formatted for a therapist to review in a session.
- - [ ] **Multiple Check-Ins Per Day** - Morning, afternoon, evening (optional - user can check in once or multiple times)
- - [ ] **Dark mode** - Default, matching My* brand
- 
- ### P1 - Should Have (v1.1)
- 
- - [ ] Sleep quality tracking (1-5 scale, duration)
- - [ ] Custom mood scales (allow 3-point, 5-point, or 10-point)
- - [ ] Widget - iOS/Android home screen widget for quick check-in
- - [ ] Reminder notifications ("How are you feeling?" at user-set times)
- - [ ] Year-in-pixels view (color grid calendar)
- - [ ] Streaks (optional - can be disabled, not gamified)
- 
- ### P2 - Nice to Have (v2.0)
- 
- - [ ] Export raw data as JSON/CSV
- - [ ] iCloud Drive backup (encrypted SQLite file, user-initiated only)
- - [ ] Apple Health integration (read sleep/exercise data to auto-suggest activity tags)
- - [ ] Seasonal pattern detection ("Your mood tends to dip in November-February")
- - [ ] Medication tracking with mood correlation
- - [ ] Menstrual cycle correlation (opt-in, locally stored)
- 
- ---
- 

### MyNotes

**DESIGN Feature List**
- ## 5. Key Features (MVP)
- 
- ### P0 - Must Have (Launch)
- 
- - [ ] **Markdown Editor** - Full Markdown support with syntax highlighting in the editor
- - [ ] **Live Preview** - Split-pane or toggle between edit and rendered preview
- - [ ] **Folder Organization** - Nested folders mirroring filesystem directories
- - [ ] **Full-Text Search** - Instant search across all notes (title and content)
- - [ ] **Tags** - Inline tags via #hashtag syntax, tag browser/filter
- - [ ] **Note Linking** - [[wikilink]] syntax for linking between notes. Tap to navigate.
- - [ ] **Quick Capture** - Widget and share extension for capturing text/URLs into a note fast
- - [ ] **Dark Mode** - Default, matching My* brand
- - [ ] **Export** - Notes are already .md files. "Export" just means accessing them in the filesystem or sharing via share sheet.
- 
- ### P1 - Should Have (v1.1)
- 
- - [ ] iCloud Drive sync (notes are just files - iCloud syncs them automatically)
- - [ ] Pin notes to top
- - [ ] Note templates (daily note, meeting note, etc.)
- - [ ] Keyboard shortcuts (desktop/web)
- - [ ] Markdown table support
- - [ ] Code block syntax highlighting
- - [ ] Image embed (copy/paste and drag-drop, stored alongside the .md file)
- 
- ### P2 - Nice to Have (v2.0)
- 
- - [ ] Backlinks panel ("Notes that link to this note")
- - [ ] PDF export (rendered Markdown)
- - [ ] Drag-and-drop folder reorganization
- - [ ] Note versioning (local git-like history)
- - [ ] Custom CSS themes
- - [ ] Vim keybindings option
- - [ ] Mermaid diagram rendering
- - [ ] Math (KaTeX/LaTeX) rendering
- 
- ---
- 

### MyPets

**DESIGN Feature List**
- ## 5. Key Features (MVP)
- 
- ### 5.1 Pet Profiles
- - Add pets with: name, species (dog, cat, bird, rabbit, fish, reptile, horse, other), breed, birthday/adoption date, sex, spay/neuter status, weight (current), color/markings, microchip ID (optional), photo
- - Per-pet health dashboard: next vet visit, upcoming vaccines, medication schedule, weight trend
- - Quick-switch between pets via horizontal scroll or tab bar
- - Pet avatar with photo or species-based default icon
- 
- ### 5.2 Vet Visit Log
- - Log visits: date, vet clinic name, vet doctor name, visit type (wellness, sick, emergency, dental, surgery, other), weight at visit, diagnosis, treatment, cost, notes
- - Attach photos to visit entries (receipts, lab results, X-rays, discharge papers)
- - Chronological visit history per pet
- - Visit reminders: schedule next check-up with push notification
- - Sort and filter by: date, visit type, vet clinic
- 
- ### 5.3 Vaccination Tracker
- - Log vaccinations: vaccine name, date administered, next due date, vet who administered, lot number (optional), notes
- - Pre-defined vaccine schedules by species:
-   - **Dogs:** Rabies (1yr then 3yr), DHPP/DA2PP (annual or 3yr), Bordetella (annual), Leptospirosis (annual), Canine Influenza (annual), Lyme (annual)
-   - **Cats:** Rabies (1yr then 3yr), FVRCP (annual or 3yr), FeLV (annual for at-risk)
-   - **Other species:** Custom vaccine entries
- - Color-coded status: current (green), due soon (amber, within 30 days), expired (red)
- - Push notification reminders before vaccines are due
- - Vaccination certificate export (PDF) for boarding, travel, grooming
- 
- ### 5.4 Medication Reminders
- - Add medications: name, dosage, frequency (daily, twice daily, weekly, monthly, every N days), start date, end date (or ongoing), prescribing vet, notes
- - Common pet medications pre-populated for easy entry:
-   - Monthly: heartworm prevention, flea/tick prevention
-   - Daily: thyroid medication, insulin, pain management
-   - As needed: antibiotics (course with end date), ear drops
- - Push notification at scheduled times
- - "Mark as given" with timestamp
- - Medication adherence tracking (% doses given on time)
- - Medication history log
- - Snooze reminder (15min, 30min, 1hr)
- - Multi-pet medication dashboard: see all pets' med schedules at a glance
- 
- ### 5.5 Feeding Schedule
- - Set feeding times per pet: breakfast, lunch, dinner, or custom times
- - Food details: brand, type (dry, wet, raw), amount per feeding
- - Dietary restrictions and allergies (free text notes)
- - Feeding reminders (local push notifications)
- - Track food changes over time (useful for identifying allergy triggers)
- 
- ### 5.6 Weight & Health Trends
- - Log weight entries with date
- - Weight trend chart (line chart, last 12 months)
- - Target weight range (set by user, based on vet recommendation)
- - Visual indicator if weight is above/below target range
- - BMI-equivalent body condition score (1-9 scale, standard vet scale)
- - Growth chart for puppies/kittens (compare to breed averages)
- 
- ### 5.7 Emergency Contacts
- - Store emergency vet contact: clinic name, phone, address, hours
- - Regular vet contact info
- - Pet poison control hotline (pre-populated: ASPCA 888-426-4435)
- - One-tap call from the app
- - Per-pet emergency info: allergies, medical conditions, medications (quick reference card for pet sitters)
- 
- ### 5.8 Document Storage
- - Store vet records as photos: lab results, X-rays, prescriptions, discharge summaries
- - Adoption papers, microchip registration, insurance policy
- - Organized by pet and document type
- - Quick-access viewer
- 
- ### 5.9 Health Record Export (PDF)
- - Generate comprehensive health record PDF per pet
- - Includes: pet info, vaccination history, medication list, vet visit history, weight log
- - Clean, professional layout suitable for boarding facilities, new vets, or travel
- - Share via system share sheet
- 
- ### 5.10 Settings
- - Appearance: dark mode (default), light mode, system
- - Weight units: lbs or kg
- - Temperature units: F or C
- - Notification preferences: reminder timing, sound
- - Data: export (JSON backup), import backup, clear all data
- - About: version, privacy policy
- 
- ---
- 

### MyRSVP

**README Feature List**
- ## Scope
- 
- - Event creation and scheduling
- - Invite approvals, waitlist, plus-ones
- - RSVP tracking and check-in
- - Polls, custom questions, announcements, comments
- - Photo album and event links (chip-in, registry, playlist)
- 

- No DESIGN.md found.

### MyStars

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### Birth Chart Generation (On-Device)
- 
- - **Natal chart calculation:** Full birth chart computed locally using Swiss Ephemeris WebAssembly (astro-sweph). Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto positions. All 12 houses computed using Placidus system (with Whole Sign and Koch available in settings). Ascendant, Midheaven, North Node, Chiron included
- - **Chart visualization:** Traditional circular chart wheel rendered with react-native-svg. Zodiac signs on outer ring, house cusps as dividing lines, planet glyphs positioned at their degree. Aspect lines drawn between planets (conjunction, sextile, square, trine, opposition)
- - **Birth data input:** Date picker, time picker (with "I don't know my birth time" option - generates a solar chart using noon), and location search. Location search uses a bundled city database (~40K cities with lat/lng/timezone) - no geocoding API call needed
- - **Interpretations:** Each planet-in-sign, planet-in-house, and major aspect has a locally-stored interpretation text. ~200 interpretation entries bundled with the app (~500KB of text). Written in a warm, reflective tone - not Co-Star's "brutal honesty"
- 
- ### Daily Horoscope & Transit Tracking
- 
- - **Daily transits:** Each morning, compute current planetary positions and compare against the user's natal chart. Highlight active transits (e.g., "Transiting Mars conjunct your natal Venus") with interpretations
- - **Transit timeline:** Week and month views showing upcoming transits with significance ratings (major/moderate/minor). Helps users plan around meaningful astrological events
- - **Daily summary:** A locally-generated 3-4 sentence daily reading synthesized from active transits. No AI API call - template-based generation from transit data + interpretation library
- - **Push notifications:** Optional daily local notification with the day's key transit (e.g., "Full Moon in your 7th house today"). All local - no APNs/FCM server
- 
- ### Compatibility
- 
- - **Synastry chart:** Compare two birth charts. Compute inter-chart aspects (e.g., "Their Moon conjunct your Sun"). Both charts stored locally
- - **Compatibility score:** Weighted score based on inter-chart aspects. Displayed as a percentage with breakdown by category (emotional, intellectual, physical, communication)
- - **Multiple profiles:** Store up to 20 birth chart profiles locally (self, partner, friends, family). Each profile has name, birth data, and computed chart cached in SQLite
- 
- ### Moon Phases & Calendar
- 
- - **Moon phase display:** Current moon phase computed from ephemeris. Visual representation (illumination percentage rendered as filled circle). Phase name (New, Waxing Crescent, First Quarter, Waxing Gibbous, Full, Waning Gibbous, Last Quarter, Waning Crescent)
- - **Moon sign:** Current moon sign computed in real-time. "Moon in Scorpio" with brief interpretation
- - **Lunar calendar:** Month view showing moon phase for each day, with full/new moon dates highlighted
- - **Void-of-course Moon:** Computed from last aspect before Moon sign change. Important for planning-oriented astrology users
- 
- ### Retrograde Tracker
- 
- - **Current retrogrades:** Dashboard showing which planets are currently retrograde, with start/end dates
- - **Retrograde calendar:** Forward-looking view of upcoming retrograde periods (Mercury, Venus, Mars - the most impactful)
- - **Retrograde impact:** How each retrograde transits the user's natal chart specifically
- 
- ---
- 

### MySubs

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### 1. Subscription Management
- 
- - Add subscriptions manually: name, price, billing cycle, category, start date, notes
- - Pre-populated catalog of 200+ common subscriptions with logos, default prices, and categories
- - Custom subscriptions for anything not in the catalog
- - Billing cycle options: weekly, monthly, quarterly, semi-annual, annual, custom (every N days)
- - Track subscription status: active, paused, cancelled, free trial
- - Free trial tracking with expiration date and countdown
- - Edit, pause, resume, or cancel (mark as cancelled) any subscription
- - Duplicate detection when adding from catalog
- 
- ### 2. Cost Dashboard
- 
- - Monthly total at the top of the home screen - big, bold, impossible to miss
- - Annual total projection
- - Breakdown by category (Entertainment, Productivity, Health, Shopping, Finance, Utilities, Other)
- - "Cost per day" calculation (monthly total / 30) - makes the number feel real
- - Month-over-month change indicator ("+$12 vs last month")
- - Currency formatting based on locale
- 
- ### 3. Renewal Calendar
- 
- - Calendar view showing upcoming renewal dates
- - List view sorted by next renewal date
- - Visual timeline of renewals for the current month
- - Tap a date to see all subscriptions renewing that day
- - "This week" / "This month" / "Next month" quick filters
- 
- ### 4. Smart Notifications
- 
- - Configurable reminder before renewal: 1 day, 3 days, 7 days, or custom
- - Per-subscription reminder settings (important for free trials vs regular subscriptions)
- - Free trial expiration alerts with countdown: "Disney+ trial expires in 3 days"
- - Monthly summary notification on the 1st: "Your subscriptions this month: $187.42"
- - Price increase detection: if user updates a subscription price, note the change
- 
- ### 5. Spending by Category Chart
- 
- - Donut chart showing subscription spending by category
- - Tap a category to see the subscriptions in it
- - Bar chart comparing category spending month over month
- - "Top 3 most expensive subscriptions" callout
- 
- ### 6. Widget
- 
- - Home screen widget (iOS 17+ / Android 12+) showing:
-   - Monthly total
-   - Next 3 upcoming renewals
-   - "Cost per day" figure
- - Small widget: just the monthly total
- - Medium widget: monthly total + next 3 renewals
- - Widget updates daily
- 
- ### 7. Export
- 
- - Export subscription list as CSV (name, price, cycle, category, status, next renewal)
- - Share as formatted text (for sending to a partner or roommate)
- - Copy monthly summary to clipboard
- 
- ### 8. Pre-Populated Catalog
- 
- 200+ common subscriptions organized by category:
- 
- **Entertainment (50+):** Netflix, Spotify, Apple Music, YouTube Premium, Disney+, Hulu, HBO Max, Amazon Prime, Paramount+, Peacock, Apple TV+, Crunchyroll, Audible, Kindle Unlimited, Xbox Game Pass, PlayStation Plus, Nintendo Switch Online, Twitch Turbo, etc.
- 
- **Productivity (40+):** Microsoft 365, Google Workspace, Notion, Slack, Zoom, Dropbox, iCloud+, Adobe Creative Cloud, Figma, GitHub Copilot, ChatGPT Plus, Claude Pro, Todoist, 1Password, Grammarly, Canva Pro, etc.
- 
- **Health & Fitness (20+):** Gym membership (generic), Peloton, Strava, MyFitnessPal, Headspace, Calm, Noom, Apple Fitness+, Whoop, etc.
- 
- **Shopping & Delivery (15+):** Amazon Prime, Costco, Walmart+, Instacart+, DoorDash DashPass, Uber One, Shipt, etc.
- 
- **News & Media (20+):** NYT, Washington Post, Wall Street Journal, The Athletic, Substack (generic), Medium, etc.
- 
- **Finance & Insurance (15+):** Credit monitoring, identity theft protection, car insurance, renters insurance, etc.
- 
- **Utilities (15+):** Phone plan, internet, cloud storage, VPN, domain registration, web hosting, etc.
- 
- **Other (25+):** Parking, pet insurance, meal kit, wine club, etc.
- 
- Each catalog entry includes:
- - Service name
- - Default logo/icon (bundled, not fetched from network)
- - Default price (user can override)
- - Default billing cycle
- - Category
- - URL (for the user's reference, not opened automatically)
- 
- ---
- 

### MyTrails

**DESIGN Feature List**
- ## Key Features (MVP)
- 
- ### Maps & Navigation
- 1. **Offline trail maps** - OpenStreetMap tiles rendered with outdoor/topo styling. Download rectangular regions for offline use. Tiles stored in local SQLite cache.
- 2. **Trail search & browse** - Search trails by name, location, difficulty, distance, elevation gain. Filter by dog-friendly, kid-friendly, wheelchair-accessible.
- 3. **Trail detail view** - Elevation profile, distance, estimated time, difficulty rating, trailhead directions, photos (user-submitted, stored locally).
- 4. **Map layers** - Toggle between topo, satellite (offline-capable), and standard views. Contour lines overlay.
- 
- ### GPS Recording
- 5. **Trail recording** - Start/stop GPS recording. Real-time position on map, distance counter, elapsed time, current elevation, pace.
- 6. **Elevation profile** - Live elevation profile built during recording. Shows gain/loss, current elevation, min/max.
- 7. **Recording stats** - Distance, elevation gain, elapsed time, moving time, average pace, max speed.
- 8. **GPX export** - Export any recorded trail as a GPX file. Compatible with every mapping tool.
- 
- ### Trail Management
- 9. **Save favorite trails** - Bookmark trails for quick access. Organize into custom lists (e.g., "Weekend day hikes", "Dog-friendly", "Bucket list").
- 10. **Recording history** - Browse past recordings with stats. View on map. Compare stats over time.
- 11. **Trail notes** - Add personal notes to any trail or recording. "Parking was full by 9am", "Muddy after mile 3".
- 
- ### Offline & Privacy
- 12. **Region downloads** - Download rectangular map regions. Shows estimated storage size before download. Manage downloaded regions (view on map, delete).
- 13. **GPS privacy** - GPS is ONLY activated when user taps "Start Recording". No background location access requested. Clear indicator when GPS is active.
- 14. **Zero telemetry** - No analytics, no crash reporting, no usage tracking. The app never phones home.
- 
- ---
- 

## Notes

- Use this as a checkbox-style runbook: mark each bullet as pass/fail/blocked.
- For parity-sensitive modules, compare standalone and hub behavior on matching flows.
