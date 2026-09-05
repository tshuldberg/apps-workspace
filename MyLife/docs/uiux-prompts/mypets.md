# MyPets -- UI/UX Design Prompts

**Tagline:** Every paw, feather, and fin, cared for
**Icon:** 🐾 | **Accent:** #F97316 | **Tier:** Premium
**Bottom Tabs (mobile):** Home | Pets | Health | Settings
**Total Screens:** 13 mobile + 4 web = 17

---

## Prompt 1: Mobile Screens 1--12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyPets
Accent color: #F97316
Icon: 🐾
Bottom tabs: Home | Pets | Health | Settings

Design 12 mobile screens for a pet care management app supporting 9 species. Each screen should use the Cool Obsidian dark theme with glass morphism cards, #F97316 accent color, and smooth rounded corners.

1. HOME (index.tsx)
   - Pet cards carousel: photo, name, species icon, breed (one card per pet, horizontally scrollable)
   - Next due items section: upcoming vaccines, vet visits, medication doses -- each with pet name, item description, due date, urgency color
   - Quick stats row: total pets count, upcoming reminders count, this month's expenses
   - Quick action buttons: Add Pet, Log Vet Visit, Add Medication
   - Bottom tab bar: Home (active), Pets, Health, Settings

2. PETS LIST (pets.tsx)
   - Section header "My Pets" with "+" add button
   - Pet list cards: photo thumbnail (circle crop), name, species badge with icon (dog/cat/bird/fish/reptile/rabbit/hamster/horse/other), breed, age
   - 9 species support with distinct icons per species
   - Each card tappable with right chevron
   - Empty state: illustration + "Add your first pet" CTA button

3. ADD PET (pet/add.tsx)
   - Nav bar with "Cancel" and "Save"
   - Photo upload area: circle frame with camera icon, "Add Photo"
   - Name (text input)
   - Species picker: visual icon grid (Dog, Cat, Bird, Fish, Reptile, Rabbit, Hamster, Horse, Other)
   - Breed (text input, contextual to selected species)
   - Birthday picker OR age input toggle (exact date vs approximate age)
   - Weight input with unit toggle (lbs/kg)
   - Color/markings (text input)
   - Microchip ID (text input, optional)
   - Gender picker: Male / Female / Unknown

4. PET DETAIL (pet/[id].tsx)
   - Hero photo (full width, rounded bottom)
   - Pet name as title, species + breed badges
   - Age display (calculated from birthday)
   - Weight chart card: current weight (large number), mini trend line, healthy range indicator bar
   - Upcoming reminders list: next vaccine, next vet visit, next medication
   - Recent vet visits (last 3)
   - Action buttons: Edit Profile, Add Vet Visit, Add Vaccine, Log Weight
   - Delete button (bottom, danger red with confirmation)

5. VACCINATIONS (vaccinations.tsx)
   - Pet selector at top (if multiple pets)
   - Vaccination records list (newest first): vaccine name, date given, next due date, vet name, status badge (Up to Date -- green / Due Soon -- yellow / Overdue -- red)
   - Batch number (secondary text)
   - "Add Vaccination" floating action button
   - Add form: vaccine name (common presets + custom), date given, next due date, vet name, batch number, notes
   - Empty state: "No vaccinations recorded"

6. VET VISITS (vet-visits.tsx)
   - Pet selector at top
   - Vet visit log (newest first): date, reason (brief), vet name, cost ($)
   - Each entry expandable to show: full diagnosis, treatment details, prescriptions, notes
   - Cost summary at top: total vet costs this year
   - "Add Visit" floating action button
   - Add form: date, reason, vet clinic/name, diagnosis, treatment, cost, follow-up date, notes

7. MEDICATIONS (medications.tsx)
   - Pet selector at top
   - Active medications section: medication name, dosage, frequency badge (daily/twice daily/weekly/monthly/as needed), next dose time
   - Visual schedule: today's doses timeline with check-off toggles
   - Reminder status indicator per medication
   - Completed/past medications section (collapsible)
   - "Add Medication" floating action button
   - Add form: medication name, dosage, frequency picker, start date, end date (optional), reminder toggle, notes

8. WEIGHT (weight.tsx)
   - Pet selector at top
   - Current weight (large display) with unit toggle (lbs / kg)
   - Weight trend chart: line graph over time with data points
   - Healthy weight range indicator: colored band on chart (green = healthy, yellow = watch, red = concern)
   - Weight entries list: date, weight, change from previous (+ or -)
   - "Log Weight" button
   - Add form: weight value, date, notes (optional)

9. EXPENSES (expenses.tsx)
   - Pet selector at top (or "All Pets")
   - Total expenses (large number, current year)
   - Category breakdown chart (horizontal bar or pie): Food, Vet, Grooming, Supplies, Insurance, Toys, Training, Other
   - Monthly trend line chart
   - Recent expenses list: date, description, category badge, amount ($), pet name
   - "Add Expense" floating action button
   - Add form: amount, category picker, description, date, pet selector

10. HEALTH (health.tsx)
    - Pet selector at top
    - Dietary info card: food brand, feeding schedule (times + amounts), allergies list (red badges)
    - Medical conditions card: condition name, diagnosis date, status (active/managed/resolved), notes
    - 7 empty state cards for sections with no data yet:
      -- "No allergies recorded" + Add button
      -- "No medical conditions" + Add button
      -- "No dietary info" + Add button
      -- "No insurance info" + Add button
      -- "No microchip info" + Add button
      -- "No spay/neuter info" + Add button
      -- "No dental records" + Add button
    - Each section expandable with "Add" action

11. EMERGENCY (emergency.tsx)
    - Bold header: "Emergency Contacts"
    - Primary emergency vet card: clinic name, phone (tap to call), address (tap for maps), hours of operation
    - After-hours/emergency clinic card: same fields
    - Poison control hotline: ASPCA (888-426-4435) with tap-to-call
    - "Add Emergency Contact" button
    - Pet-specific emergency info: per-pet allergies, current medications, microchip ID, blood type (if known)
    - Quick share button: compile emergency info into shareable text

12. LOST PET POSTER (poster.tsx)
    - Pet selector at top
    - Poster preview (live-updating):
      -- "LOST" header in large bold text (danger red)
      -- Pet photo (large, centered)
      -- Pet name, species, breed, color/markings
      -- Description text area (distinguishing features)
      -- Last seen location input (text + map pin option)
      -- Last seen date/time
      -- Contact info: phone number, email
      -- Reward amount (optional)
    - "Generate Poster" button: creates shareable image
    - Share options: save to photos, share via system sheet
    - Print-friendly layout option
```

---

## Prompt 2: Mobile Screen 13 + Web Pages

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyPets
Accent color: #F97316
Icon: 🐾

Design 1 remaining mobile screen and 4 web pages for a pet care management app. Use Cool Obsidian dark theme throughout.

MOBILE SCREEN:

13. SETTINGS (settings.tsx)
    - Default pet selector (for views that show one pet at a time)
    - Units section: weight (lbs / kg toggle)
    - Notifications section:
      -- Vaccination reminders toggle + advance notice picker (1 day / 3 days / 1 week)
      -- Vet visit reminders toggle
      -- Medication dose reminders toggle
      -- Grooming reminders toggle
    - Data management: Export data (CSV/JSON), Import data
    - Clear all data (danger button with confirmation dialog)
    - About: app version, support link, privacy policy

WEB PAGES:

14. DASHBOARD (/pets)
    - Desktop dashboard layout with sidebar navigation
    - Pet cards row: photo, name, species, next due item per pet
    - Upcoming alerts panel: all pets' due vaccines, vet visits, medications in chronological order
    - Recent activity feed: last added records across all pets
    - Quick action buttons: Add Pet, Log Visit, Add Vaccine
    - Monthly expense summary card

15. PETS (/pets/pets)
    - Pet management grid: large photo cards with name, species, breed, age
    - Click card to expand full pet profile in detail panel
    - Add/edit/delete pet via modal forms
    - Per-pet tabs in detail view: Profile, Vaccinations, Vet Visits, Medications, Weight, Expenses
    - Pet comparison view (optional): side-by-side stats for multi-pet households

16. HEALTH (/pets/health)
    - Health records dashboard: pet selector tabs across top
    - Vaccination schedule table: vaccine name, date given, next due, status badge
    - Vet visit history table: date, reason, vet, cost, notes (expandable rows)
    - Medication management panel: active medications with schedule
    - Weight chart (larger format than mobile): trend line with data points, healthy range band
    - Dietary and allergy info panel
    - Print-friendly health summary export

17. SETTINGS (/pets/settings)
    - All preferences in organized sections
    - Default pet selector
    - Unit preferences
    - Notification management with granular toggles per pet
    - Data import/export panel with drag-and-drop
    - Emergency contacts management (add/edit/delete)
    - Account and data management
```
