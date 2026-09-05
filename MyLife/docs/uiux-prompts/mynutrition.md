# MyNutrition -- UI/UX Design Prompts

**Tagline:** Eat smarter, your way
**Icon:** 🥗 | **Accent:** #65A30D | **Tier:** Premium
**Bottom Tabs (mobile):** Home | Diary | Search | Trends | Settings
**Total Screens:** 14 mobile + 8 web = 22

---

## Prompt 1: Mobile Screens 1--12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyNutrition
Accent color: #65A30D
Icon: 🥗
Bottom tabs: Home | Diary | Search | Trends | Settings

Design 12 mobile screens for a nutrition tracking app. Each screen should use the Cool Obsidian dark theme with glass morphism cards, #65A30D accent color, and smooth rounded corners.

1. HOME (index.tsx)
   - Today's calorie progress ring (large, centered): consumed / goal calories, remaining calories inside ring
   - Macro progress bars (horizontal, below ring): Protein (g and %), Carbs (g and %), Fat (g and %) -- each with colored fill and target label
   - Meal breakdown cards (glass surface): Breakfast, Lunch, Dinner, Snacks -- each showing calorie subtotal and item count
   - Tap meal card to jump to that section in diary
   - Water intake tracker: glass icon with fill level, "X of Y glasses" text, quick-add "+" button
   - Bottom tab bar: Home (active), Diary, Search, Trends, Settings

2. LOG FOOD (log.tsx)
   - Meal type selector at top: segmented control (Breakfast / Lunch / Dinner / Snack)
   - Food search bar with real-time results (1000+ item database)
   - Quick action buttons row: Barcode Scan (camera icon), AI Photo (camera + sparkle icon)
   - Recent items section: last 10 logged items for quick re-add
   - Favorites section: starred items
   - Search result cards: food name, calories per serving, serving size, source badge (USDA / Open Food Facts / FatSecret)
   - Tap result to go to portion selection: serving size dropdown, quantity stepper, "Add to [Meal]" button

3. DIARY (diary.tsx)
   - Date navigation header: left/right arrows, date display, "Today" quick button
   - Daily totals banner: calories consumed / goal, macro summary (P/C/F grams)
   - Meal sections (vertically stacked, collapsible):
     -- Breakfast: item list with name, calories, macros per item, "+" add button
     -- Lunch: same
     -- Dinner: same
     -- Snacks: same
   - Per-item swipe actions: edit portion, delete
   - Daily total row at bottom: all macros summed
   - Copy day button: duplicate today's log to another date

4. FOOD DETAIL ([id].tsx)
   - Food name as title
   - Nutrition facts label (styled like FDA label):
     -- Serving size selector (dropdown with multiple options)
     -- Calories (large)
     -- Total Fat, Saturated Fat, Trans Fat
     -- Cholesterol, Sodium
     -- Total Carbohydrate, Dietary Fiber, Total Sugars, Added Sugars
     -- Protein
     -- Vitamins and minerals section (200+ nutrients available)
   - Macro pie chart (visual breakdown)
   - "Add to Diary" button (accent colored, full width) with meal selector
   - Star/favorite toggle
   - Source badge (database origin)

5. SEARCH (search.tsx)
   - Search bar with FTS5 full-text search
   - Filter chips: All | Favorites | Recent | Custom Foods
   - Database source filter: USDA, Open Food Facts, FatSecret, Custom
   - Search results list: food name, brand (if applicable), calories per serving, serving size
   - Alphabetical section headers for browsing
   - "Create Custom Food" button at bottom
   - Custom food form: name, serving size, calories, protein, carbs, fat (required), optional extended nutrients

6. GOALS (goals.tsx)
   - Daily calorie target: large number display with edit button, adjustment slider (1000-5000 kcal)
   - Macro targets section:
     -- Protein: grams input + percentage display, slider
     -- Carbs: grams input + percentage display, slider
     -- Fat: grams input + percentage display, slider
     -- Macro percentages auto-adjust to total 100%
   - Additional targets (collapsible): fiber (g), sugar (g), sodium (mg), saturated fat (g), cholesterol (mg)
   - Preset profiles: Balanced, Low Carb, High Protein, Keto, Custom
   - "Calculate from body stats" option: weight, height, age, activity level, goal (lose/maintain/gain)

7. TRENDS (trends.tsx)
   - Time range toggle: 7 days | 30 days | 90 days
   - Calorie trend chart: line graph with daily values, rolling average line, goal line
   - Macro trend charts (stacked area or separate lines): protein, carbs, fat over time
   - Goal adherence card: percentage of days within calorie target, streak of on-target days
   - Averages summary: avg calories, avg protein, avg carbs, avg fat for selected period
   - Best/worst days highlight

8. WATER (water.tsx)
   - Daily water goal display: "X of Y glasses" (large, centered)
   - Visual glass/bottle fill animation
   - Quick-add buttons row: Glass (8oz), Bottle (16oz), Large Bottle (32oz), Custom
   - Today's log: timestamped entries of each water intake
   - Weekly totals chart: bar graph, one bar per day
   - Edit daily goal (glasses or oz/ml)
   - Streak counter: consecutive days meeting water goal

9. RESTAURANT (restaurant.tsx)
   - Search bar: search by restaurant name
   - Popular chains list: brand logos, restaurant names
   - Selected restaurant menu browser:
     -- Menu categories (Burgers, Salads, Drinks, etc.)
     -- Each item: name, calories, protein, carbs, fat
     -- Tap item for full nutrition detail
     -- "Add to Diary" button per item with meal selector
   - Sort menu items by: calories (low-high), protein (high-low), name
   - Comparison mode: select 2 items side-by-side

10. COMMUNITY (community.tsx)
    - Profile card at top: name, avatar, streak, level badge
    - Social feed: posts from connections (meal photos, milestone achievements, challenge updates)
    - Connections list: friends/following with their current streak
    - Nutrition challenges section: active challenges with progress bars (e.g., "7-Day Protein Challenge"), join button for new challenges
    - Leaderboards: weekly calorie accuracy, longest streak, challenge leaders
    - "Share Today's Summary" button: generates shareable card

11. FOOD NOTES (notes.tsx)
    - Section header "Food Notes" with "+" create button
    - Note list: title, date, preview text, tag badges
    - Tags filter: Recipes | Reactions | Tips | Goals | Other
    - Full-text search across notes
    - Note editor: title, body text area, tag multi-select, linked food items (optional)
    - Prompt suggestions: "How did this meal make you feel?", "Any digestive reactions?", "Meal prep ideas"

12. BARCODE (barcode.tsx)
    - Camera viewfinder (full screen, dark overlay with scan area cutout)
    - Scan area: animated corner brackets, scan line animation
    - "Position barcode in frame" instruction text
    - Flash/torch toggle button
    - On successful scan:
      -- Product lookup result card slides up from bottom
      -- Product name, brand, calories, serving size
      -- "Add to Diary" button with meal selector
      -- "View Full Nutrition" button
    - Manual entry fallback: "Enter barcode manually" text input
    - Scan history: recent scans for quick re-add
```

---

## Prompt 2: Mobile Screens 13--14 + Web Pages

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyNutrition
Accent color: #65A30D
Icon: 🥗

Design 2 remaining mobile screens and 8 web pages for a nutrition tracking app. Use Cool Obsidian dark theme throughout.

MOBILE SCREENS:

13. EXPORT (export.tsx)
    - Section header "Export Data"
    - Date range picker: start date, end date, or preset ranges (Last 7 days / Last 30 days / Last 90 days / All Time)
    - Data selection checkboxes: Diary entries, Custom foods, Goals history, Water log, Notes
    - Export format: CSV (default)
    - Preview: estimated row count and file size
    - "Export" button (generates and triggers share sheet)
    - Export history: recent exports with date and file name

14. SETTINGS (settings.tsx)
    - Units section: weight (lbs/kg), height (ft-in/cm), volume (oz/ml)
    - Macro display: show as grams / show as percentage / show both
    - Dietary preferences: multi-select chips (Vegan, Vegetarian, Pescatarian, Gluten-Free, Dairy-Free, Nut-Free, Keto, Paleo, None)
    - Meal names: customize names for Breakfast/Lunch/Dinner/Snacks (e.g., rename "Snacks" to "Pre-Workout")
    - Notifications: meal logging reminders per meal, water reminders (interval picker)
    - Data sources: enable/disable USDA, Open Food Facts, FatSecret databases
    - Privacy: community profile visibility toggle
    - Data management: Clear diary (date range), Delete custom foods, Reset goals, Clear all data (danger)
    - About: version, support, privacy policy

WEB PAGES:

15. DASHBOARD (/nutrition)
    - Desktop dashboard with sidebar navigation
    - Today's intake summary: calorie ring (large), macro bars
    - Meal section cards: breakfast, lunch, dinner, snacks with item lists and subtotals
    - Water tracker widget
    - Quick log panel: search + add food inline
    - Streak and goal adherence stats

16. DIARY (/nutrition/diary)
    - Calendar date picker (top bar or sidebar)
    - Full food diary table: time, meal, food name, serving, calories, protein, carbs, fat
    - Meal section groupings with subtotals
    - Inline edit: click to change serving size or quantity
    - Daily totals footer row
    - Drag-and-drop to move items between meals
    - Copy day / paste day functionality

17. SEARCH (/nutrition/search)
    - Full-width search bar with instant results
    - Advanced filters sidebar: database source, calorie range, macro ranges, dietary tags
    - Results table: food name, brand, serving, calories, P/C/F
    - Click item for full nutrition facts panel
    - "Add to Diary" inline action with meal + date selector
    - Custom food creation form (inline panel)

18. GOALS (/nutrition/goals)
    - Goal management dashboard
    - Calorie target with calculator (TDEE estimator based on body stats)
    - Macro ratio sliders with live percentage adjustment
    - Micro-nutrient targets (expanded view: fiber, sodium, vitamins, minerals)
    - Preset profiles selector with comparison
    - Goal history: past goal changes with dates

19. TRENDS (/nutrition/trends)
    - Multi-panel analytics dashboard
    - Calorie trend chart: daily values + rolling average + goal line, date range selector
    - Macro trends: individual line charts for protein, carbs, fat
    - Nutrient deep-dive: select any nutrient for its own trend chart
    - Goal adherence heatmap (calendar view)
    - Weekly and monthly averages tables
    - Comparison periods: this week vs last week, this month vs last month

20. WATER (/nutrition/water)
    - Water tracking dashboard
    - Daily intake chart: timeline of intake through the day
    - Weekly bar chart with goal line
    - Monthly calendar heatmap (colors by percentage of goal met)
    - Quick-add buttons
    - Goal adjustment
    - Hydration insights: average daily intake, best day, streak

21. RESTAURANTS (/nutrition/restaurants)
    - Restaurant browser: searchable list of chain restaurants with logos
    - Selected restaurant: full menu in sortable table
    - Columns: item name, category, calories, protein, carbs, fat, sodium
    - Filter by category, calorie range, dietary tags
    - Comparison panel: pin 2-3 items for side-by-side nutrition comparison
    - "Add to Diary" action per item

22. SETTINGS (/nutrition/settings)
    - All preferences in organized card sections
    - Units and display preferences
    - Dietary preferences with tag management
    - Notification preferences
    - Data source toggles
    - Community and privacy settings
    - Import/export panel with drag-and-drop CSV upload
    - Data management and account settings
```
