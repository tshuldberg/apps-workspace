# MyHomes -- UI/UX Design Prompts

**Module:** MyHomes
**Tagline:** Real estate, reimagined
**Icon:** 🏠 | **Accent:** #F59E0B | **Tier:** Premium
**Bottom Tabs:** Home | Properties | Maintenance | Costs | Settings
**Total Screens:** 38 mobile + 10 web = 48

---

## Prompt 1: Mobile Screens 1--12 (Core Property, Maintenance, Costs)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyHomes
Accent color: #F59E0B
Bottom tabs: Home | Properties | Maintenance | Costs | Settings

Design 12 mobile screens for a real estate and home management app. All screens use the Cool Obsidian dark theme with glass morphism cards, #F59E0B amber accent, and #12121A surface panels.

1. HOME (index.tsx)
   - Property selector dropdown at top (current property name + chevron)
   - Overdue maintenance count badge (red #FF453A background)
   - Due-soon maintenance count badge (yellow #F59E0B background)
   - Monthly cost summary card (glass fill, total amount in large text)
   - Property quick stats row: bedrooms, bathrooms, sqft, year built
   - Bottom tab bar with Home tab active (#F59E0B accent)

2. PROPERTIES (properties.tsx)
   - Scrollable property list
   - Each card: type icon (house/condo/apartment/townhouse), address line, ownership badge (own/rent), year built, sqft
   - Glass morphism card per property with rgba(255,255,255,0.04) fill
   - Floating "+" add button (#F59E0B)

3. ADD PROPERTY (property/add.tsx)
   - Form fields: name, address (multiline), type picker (house/condo/apartment/townhouse), ownership toggle (own/rent)
   - Year built number input, square footage, bedrooms stepper, bathrooms stepper
   - Lot size input, photo upload area with dashed border
   - Save button (#F59E0B filled) at bottom

4. PROPERTY DETAIL (property/[id].tsx)
   - Address header with property type icon
   - Full specs grid: bedrooms, bathrooms, sqft, lot size, year built, ownership
   - Linked listings/notes section (expandable)
   - Cost history graph (line chart, monthly totals, #F59E0B line color)
   - Total costs to date (large text)
   - Edit and Delete action buttons

5. MAINTENANCE (maintenance.tsx)
   - Section headers by status: "Overdue" (red), "Due Soon" (yellow), "Upcoming" (green)
   - Each task card: task name, property name, due date, urgency indicator dot
   - Urgency sort toggle
   - Filter by property dropdown at top
   - Empty state: house icon with "All caught up!" text

6. ADD MAINTENANCE (maintenance/add.tsx)
   - Task type picker with 50+ presets (HVAC filter, gutter clean, roof inspect, water heater flush, etc.)
   - Interval picker (months) with stepper
   - Preferred season picker (spring/summer/fall/winter/any)
   - Reminder toggle switch
   - Linked property selector dropdown
   - Estimated cost currency input
   - Save button (#F59E0B)

7. MAINTENANCE DETAIL (maintenance/[id].tsx)
   - Task name header with status badge (overdue/due soon/upcoming/complete)
   - Next due date (large, color-coded)
   - Last completed date
   - Interval display (e.g., "Every 3 months")
   - Snooze options: "Push 1 week" / "Push 1 month" buttons (outlined)
   - "Mark Complete" button (#F59E0B filled, prominent)
   - Completion history list (dates with checkmarks)

8. COST INDEX (cost/index.tsx)
   - Cost history list (scrollable)
   - Each row: amount (bold), category badge (color-coded pill), date, linked maintenance schedule name (if any)
   - Property filter dropdown at top
   - Total at top in summary card
   - Floating "+" add button

9. ADD COST (cost/add.tsx)
   - Amount currency input (large)
   - Category picker: maintenance/utility/insurance/tax/mortgage/repair/improvement/other (grid of pill buttons)
   - Date picker
   - Linked schedule selector (optional, dropdown)
   - Notes multiline input
   - Receipt photo upload area
   - Save button (#F59E0B)

10. COST DETAIL (cost/[id].tsx)
    - Full cost record in glass card
    - Date, amount (large), category badge
    - Linked schedule name (tappable link)
    - Notes section
    - Edit button (outlined), Delete button (red outlined)

11. COST PREDICTOR (cost-predictor.tsx)
    - "Next Month Estimate" card with projected amount
    - "Next Year Estimate" card with projected amount
    - Projected vs actual line chart (dual lines: #F59E0B projected, rgba(255,255,255,0.3) actual)
    - Based-on explanation text ("Based on 12 months of schedule patterns")
    - Per-category breakdown bar chart

12. CONTRACTORS (contractor/index.tsx)
    - Contractor directory list
    - Each card: name, specialty badges (pill shapes, e.g., "HVAC", "Plumbing"), phone number, rating stars (1-5, #F59E0B fill), job count
    - Search bar at top
    - Floating "+" add button
```

---

## Prompt 2: Mobile Screens 13--24 (Contractors, Documents, Insurance, Inventory)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyHomes
Accent color: #F59E0B

Design 12 mobile screens continuing from the previous set. Same design language: dark theme, glass cards, amber accent.

13. ADD CONTRACTOR (contractor/add.tsx)
    - Name text input
    - Phone input with phone keyboard
    - Email input
    - Specialties multi-select picker (HVAC/plumbing/electrical/roofing/painting/landscaping/general/other) as toggleable pill buttons
    - Hourly rate currency input
    - Notes multiline input
    - Save button (#F59E0B)

14. CONTRACTOR DETAIL (contractor/[id].tsx)
    - Contact info header: name (large), phone (tappable), email (tappable)
    - Specialties row (pill badges)
    - Rating stars display (#F59E0B)
    - Past jobs linked list (job name, date, cost, linked property)
    - Notes section
    - Edit and Delete buttons

15. DOCUMENTS (document/index.tsx)
    - Document vault list grouped by type
    - Type badges: mortgage, deed, insurance, permit, inspection (color-coded pills)
    - Each row: document name, type badge, date, expiry date (red if expired)
    - Property filter dropdown at top
    - Floating "+" upload button

16. ADD DOCUMENT (document/add.tsx)
    - Upload area: tap to select file or take photo (dashed border box with upload icon)
    - Type picker (mortgage/deed/insurance/permit/inspection/warranty/other)
    - Linked property selector
    - Date picker
    - Expiry date picker (optional, toggle to show)
    - Notes input
    - Save button (#F59E0B)

17. DOCUMENT VIEWER (document/[id].tsx)
    - Full-screen document viewer
    - Pinch-to-zoom support indicator
    - Document name header overlay (semi-transparent)
    - Share button in top right
    - Close/back button in top left

18. INSURANCE (insurance/index.tsx)
    - Active policies list
    - Each card: type badge (homeowners/liability/flood/umbrella), coverage amount (large), premium display, renewal date, linked property name
    - Renewal date color-coded (red if within 30 days, yellow within 60)
    - Floating "+" add button

19. ADD INSURANCE (insurance/add.tsx)
    - Type picker (homeowners/liability/flood/umbrella/other)
    - Provider name input
    - Policy number input
    - Coverage amount currency input
    - Deductible currency input
    - Premium currency input with frequency toggle (monthly/annual)
    - Renewal date picker
    - Linked property selector
    - Save button (#F59E0B)

20. INSURANCE DETAIL (insurance/[id].tsx)
    - Policy header: type badge, provider name
    - Coverage limits display (large text)
    - Deductible amount
    - Premium with frequency
    - Renewal date (color-coded urgency)
    - Provider contact info (phone/email tappable)
    - Linked property name (tappable)
    - Edit and Delete buttons

21. INVENTORY (inventory/index.tsx)
    - Room-based inventory browser
    - Room list: room name, item count badge, total value per room
    - Glass cards per room with icon (bedroom/kitchen/living room/garage/bathroom/office/other)
    - "Add Room" button at bottom

22. ROOM DETAIL (inventory/room/[id].tsx)
    - Room name header with total value
    - Items in room as grid or list (toggle)
    - Each item: name, category badge, condition badge (excellent=green/good=blue/fair=yellow/poor=red), value, photo thumbnail
    - Floating "+" add item button

23. ADD ITEM (inventory/item/add.tsx)
    - Room picker dropdown
    - Category picker (furniture/electronics/appliance/decor/other)
    - Item name input
    - Condition selector (excellent/good/fair/poor) as segmented control
    - Purchase date picker
    - Value currency input
    - Warranty end date (optional)
    - Serial number input
    - Photo upload area
    - Save button (#F59E0B)

24. ITEM DETAIL (inventory/item/[id].tsx)
    - Full item display in glass card
    - Photo (large, top)
    - Room name, category badge, condition badge
    - Value (large text)
    - Warranty expiry (red if expired, green if active)
    - Serial number (monospace)
    - Purchase receipt link (if attached)
    - Edit and Delete buttons
```

---

## Prompt 3: Mobile Screens 25--31 (Appliances, Renovations, Settings)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyHomes
Accent color: #F59E0B

Design 7 mobile screens to complete the mobile set. Same design language.

25. APPLIANCES (appliance/index.tsx)
    - Appliance list
    - Each card: name, model, brand, linked room name, warranty status badge (active=green / expired=red), manual available indicator (book icon if yes)
    - Search bar at top
    - Floating "+" add button

26. ADD APPLIANCE (appliance/add.tsx)
    - Name input
    - Brand input
    - Model number input
    - Serial number input
    - Purchase date picker
    - Warranty end date picker
    - Linked room selector dropdown
    - Manual upload area (file picker)
    - Save button (#F59E0B)

27. APPLIANCE DETAIL (appliance/[id].tsx)
    - Full specs in glass card: name, brand, model, serial number
    - Manual viewer button (opens PDF/image)
    - Maintenance history for this appliance (list of completed tasks with dates)
    - Warranty info: status badge, end date, coverage details
    - Edit and Delete buttons

28. RENOVATION PROJECTS (renovation/index.tsx)
    - Project list
    - Each card: project name, status badge (planning=blue / in-progress=#F59E0B / complete=green), budget amount, timeline (start-end dates), contractor name
    - Filter by status toggle pills at top
    - Floating "+" add button

29. ADD PROJECT (renovation/add.tsx)
    - Project name input
    - Description multiline input
    - Budget currency input
    - Start date picker
    - End date picker
    - Linked property selector
    - Contractor picker dropdown (from contractor directory)
    - Phases section: add phase name + checkbox for each phase
    - Save button (#F59E0B)

30. PROJECT DETAIL (renovation/[id].tsx)
    - Project name header with status badge
    - Phase progress checklist (checkboxes with phase names, completion percentage bar)
    - Budget tracking: spent vs budget (progress bar, green if under, red if over)
    - Photos section: before/during/after grid with upload buttons per category
    - Contractor info card (name, phone, tappable)
    - Timeline: start date, end date, days remaining
    - Edit and Delete buttons

31. SETTINGS (settings.tsx)
    - Default property selector dropdown
    - Notification preferences section:
      - Maintenance reminders toggle
      - Insurance renewal reminders toggle
      - Cost alerts toggle
    - Default currency display
    - Data export button
    - Section dividers with rgba(255,255,255,0.06) borders
```

---

## Prompt 4: Web Screens 32--41

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyHomes (Web)
Accent color: #F59E0B
Layout: Persistent sidebar (from hub shell) with content area

Design 10 web pages for the MyHomes module. Desktop-optimized layouts with wider content areas, multi-column grids, and sidebar navigation. Same Cool Obsidian dark theme.

32. DASHBOARD (/homes)
    - Property overview header with property selector dropdown
    - 4-column stat cards: total properties, overdue maintenance, monthly costs, active policies
    - Recent activity feed (latest costs, completed maintenance, new documents)
    - Upcoming maintenance table (next 5 tasks with due dates)
    - Cost trend chart (last 6 months, line chart, #F59E0B)

33. PROPERTIES (/homes/properties)
    - Property grid (2-3 columns): each card with photo, address, type badge, ownership badge, specs row (bed/bath/sqft)
    - "Add Property" button top right
    - Click card to open detail panel (slide-in from right or modal)
    - Search and filter bar at top

34. MAINTENANCE (/homes/maintenance)
    - Kanban-style columns: Overdue | Due Soon | Upcoming | Completed
    - Each task card: name, property, due date, urgency color bar on left edge
    - Drag-and-drop between columns (or click to update status)
    - "Add Task" button, property filter dropdown, date range filter

35. COSTS (/homes/costs)
    - Cost table with sortable columns: date, amount, category, property, linked schedule, notes
    - Summary cards above table: total this month, total this year, average monthly
    - Cost predictor panel (right sidebar or expandable section): next month/year projections
    - Category breakdown pie chart
    - "Add Cost" button, date range and category filters

36. CONTRACTORS (/homes/contractors)
    - Contractor table: name, specialties (badge pills), phone, email, rating stars, job count
    - Click row to expand detail panel with past jobs and notes
    - "Add Contractor" button
    - Search and specialty filter

37. DOCUMENTS (/homes/documents)
    - Document grid with type filter tabs (All/Mortgage/Deed/Insurance/Permit/Inspection)
    - Each card: document thumbnail (preview), name, type badge, date, expiry
    - Click to open in-page document viewer (modal with zoom)
    - "Upload Document" button, property filter

38. INSURANCE (/homes/insurance)
    - Insurance policy table: type badge, provider, coverage, deductible, premium, renewal date, property
    - Renewal calendar view (toggle between table and calendar)
    - Renewal urgency highlighting (red/yellow rows)
    - "Add Policy" button

39. INVENTORY (/homes/inventory)
    - Two-panel layout: room list on left, items grid on right
    - Room list: room name, item count, total value
    - Items grid: photo thumbnail, name, category, condition badge, value
    - "Add Room" and "Add Item" buttons
    - Bulk actions: select multiple items, update category/condition

40. PROJECTS (/homes/projects)
    - Project cards (2 columns): name, status badge, budget bar (spent/total), timeline bar, contractor
    - Click to expand: phase checklist, photos (before/during/after carousel), budget breakdown
    - "New Project" button
    - Filter by status

41. SETTINGS (/homes/settings)
    - Default property selector
    - Notification preferences (toggles): maintenance reminders, insurance renewals, cost alerts
    - Default currency picker
    - Data export section: export all data as CSV/JSON
    - Danger zone: delete all MyHomes data (red button with confirmation)
```
