# MyMeds -- UI/UX Design Prompts

**Module:** MyMeds
**Tagline:** Your private health command center
**Icon:** 💊 | **Accent:** #06B6D4 | **Tier:** Premium
**Bottom Tabs:** Today | Medications | History | Reports | Settings
**Total Screens:** 38 mobile + 16 web = 54

---

## Prompt 1: Mobile Screens 1--12 (Today, Medications, Adherence, Vitals)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyMeds
Accent color: #06B6D4
Bottom tabs: Today | Medications | History | Reports | Settings

Design 12 mobile screens for a private medication and health tracking app. All screens use the Cool Obsidian dark theme with glass morphism cards, #06B6D4 cyan accent, and #12121A surface panels.

1. TODAY (index.tsx)
   - Active medications list with next dose times (sorted chronologically)
   - Each medication row: name, dosage, next dose time, "Take" button (#06B6D4)
   - Dose log for today: taken count / total doses, circular progress ring (#06B6D4 fill)
   - Low supply alerts section (red #FF453A background pills for meds with <7 days remaining)
   - Adherence summary percentage (large text, color-coded: green >90%, yellow 70-90%, red <70%)
   - Bottom tab bar with Today active (#06B6D4 accent)

2. MEDICATIONS (medications.tsx)
   - All medications scrollable list
   - Each card: medication name (bold), dosage (e.g., "50mg"), frequency text, status badge (active=green / inactive=gray / paused=yellow)
   - Quick log button per med (circular #06B6D4 checkmark)
   - Search bar at top
   - Floating "+" add button (#06B6D4)

3. ADD MED (add-med.tsx)
   - Medication name input (large, autocomplete)
   - Dosage section: amount number input + unit picker (mg/mcg/mL/tablet/capsule/patch/injection)
   - Frequency picker: daily/twice daily/three times daily/weekly/as needed/custom
   - Custom schedule builder (if custom selected): day-of-week checkboxes, time pickers
   - Prescriber name input
   - Pharmacy name input
   - Start date picker
   - Refill quantity number input
   - Photo upload area (pill photo for identification)
   - Save button (#06B6D4)

4. REFILLS (refills.tsx)
   - Burn rate calculation per medication
   - Each card: medication name, days remaining (large number), supply level bar (green >30 days / yellow 7-30 / red <7)
   - Reorder reminder date for each
   - Pharmacy contact button (tappable phone icon)
   - Sort by urgency (lowest supply first)

5. APPOINTMENTS (appointments.tsx)
   - Doctor visits and lab tests list (chronological)
   - Each card: date (prominent), provider name, type badge (checkup=blue / specialist=purple / lab=green / imaging=orange), notes preview
   - Linked medications pills row per appointment
   - Floating "+" add button
   - Filter toggle: upcoming / past

6. ADHERENCE (adherence.tsx)
   - Adherence rate percentage (large, centered, color-coded)
   - Current streak display (flame icon + "X days" text)
   - Calendar grid view: green cells = all taken, red cells = missed, gray cells = no doses scheduled
   - Daily breakdown expandable (tap a day to see which meds taken/missed)
   - Per-medication breakdown list: med name, individual adherence %, mini bar

7. DIARY (diary.tsx)
   - Timestamped medication journal (scrollable feed)
   - Each entry card: timestamp, entry text, linked medication pills (small colored badges), symptoms noted (tag pills), mood at time (emoji + number)
   - Floating "+" compose button
   - Date filter at top

8. HISTORY (history.tsx)
   - Historical dose log (table-style list)
   - Each row: date/time, medication name, dose amount, status badge (taken=green / missed=red / late=yellow)
   - Filter bar: medication dropdown, date range picker
   - Summary stats at top: total doses, taken %, missed count

9. MOOD CHECK-IN (mood-check-in.tsx)
   - Mood slider (1-10) with gradient background (red to green)
   - Current medications display (auto-populated, read-only list)
   - Note field (multiline, optional)
   - "Log Mood" button (#06B6D4)
   - Last mood entry preview at bottom

10. MOOD HISTORY (mood.tsx)
    - Mood trends line chart (#06B6D4 line) over time
    - Medication change markers on chart: vertical dashed lines at started/stopped/dosage changed events with labels
    - Date range picker (1 week / 1 month / 3 months / 6 months / 1 year)
    - Average mood display per period
    - Tap data point to see details

11. MEASUREMENT TRENDS (measurement-trends.tsx)
    - Vitals trend charts (selectable: BP/glucose/weight/temperature/heart rate)
    - Medication markers overlaid: vertical lines at medication start/stop dates with med name labels
    - Chart controls: metric selector tabs, date range picker
    - Current value vs baseline comparison card
    - Trend direction indicator (arrow up/down/flat with text)

12. LOG BP (log-bp.tsx)
    - Systolic number input (large, prominent)
    - Diastolic number input (large, below systolic)
    - Pulse/heart rate number input
    - Arm selector: left/right toggle
    - Position selector: sitting/standing/lying segmented control
    - AHA classification badge (auto-calculated): Normal (green) / Elevated (yellow) / Stage 1 (orange) / Stage 2 (red) / Crisis (dark red, pulsing)
    - Date/time picker (defaults to now)
    - Save button (#06B6D4)
```

---

## Prompt 2: Mobile Screens 13--24 (BP, Glucose, Insulin, Interactions, Correlations)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyMeds
Accent color: #06B6D4

Design 12 mobile screens continuing from the previous set. Same design language: dark theme, glass cards, cyan accent.

13. BP HISTORY (bp-history.tsx)
    - BP history list (chronological, newest first)
    - Each row: date/time, systolic/diastolic reading (large), pulse, AHA classification badge (color-coded pill)
    - Arm and position indicators (small icons)
    - Date range filter at top

14. BP TRENDS (bp-trends.tsx)
    - Period stats card: average systolic, average diastolic (large numbers)
    - Distribution by AHA category (pie/donut chart): Normal/Elevated/Stage 1/Stage 2/Crisis with color-coded segments
    - Trend direction indicator: improving (green arrow down) / stable (gray flat) / worsening (red arrow up)
    - Period-over-period comparison: this month vs last month (delta with arrow)
    - Date range selector tabs

15. LOG GLUCOSE (log-glucose.tsx)
    - Glucose value input (large number, prominent)
    - Unit display (mg/dL or mmol/L based on settings)
    - Meal context picker: fasting / before meal / after meal / bedtime (4 icon buttons)
    - Notes multiline input
    - In-range indicator (auto-calculated, green if in target)
    - Save button (#06B6D4)

16. GLUCOSE HISTORY (glucose-history.tsx)
    - Time-in-range analysis card: percentage in target (green) / above (orange) / below (red) as stacked horizontal bar
    - Histogram of glucose distribution (bell curve style)
    - Ambulatory glucose profile (AGP): median line with 25th-75th percentile shaded band, 10th-90th outer band
    - Per-meal-context breakdown table
    - Date range picker

17. LOG INSULIN (log-insulin.tsx)
    - Insulin type selector: rapid-acting / long-acting / mixed (segmented control)
    - Units input (large number)
    - Injection site picker: visual body map outline (front and back), tap to select zone, rotation tracking (color intensity shows recency of last injection per zone)
    - Carbs covered input (grams)
    - Date/time picker
    - Save button (#06B6D4)

18. INSULIN HISTORY (insulin-history.tsx)
    - Insulin-on-board (IOB) display: current IOB units (large), decay curve graph
    - Daily totals bar chart (rapid vs long-acting stacked bars)
    - Injection site rotation summary: body map with zone colors (green = rotate here next, red = recently used)
    - Date range filter

19. A1C (a1c.tsx)
    - Estimated A1c from glucose readings (large percentage display in circular gauge)
    - GMI (Glucose Management Indicator) value
    - Confidence level indicator (low/medium/high based on data volume)
    - Historical A1c line chart (data points over months)
    - Target range shaded band on chart (e.g., <7% green zone)
    - "Readings used" count

20. INTERACTIONS (interactions.tsx)
    - Drug interaction checker
    - Multi-select medication picker (select 2+ from active meds)
    - Results list per interaction pair: med A + med B
    - Severity badge per pair: minor (green) / moderate (yellow) / major (orange) / contraindicated (red)
    - Interaction description text (expandable)
    - 200+ known interaction pairs noted
    - "Check" button (#06B6D4)

21. CORRELATION (correlation.tsx)
    - Mood-medication correlation section: Pearson coefficient display, significance indicator (star if p<0.05)
    - Symptom-medication correlation table
    - Scatter plots: mood vs medication adherence, symptoms vs specific meds
    - Significance indicators: bold if statistically significant
    - Medication selector to focus on one med

22. PAIN MAP (pain-map.tsx)
    - Full-body zone heatmap (front and back view, anatomical outline)
    - Tap zones to set severity (0-10 slider appears)
    - Color gradient per zone: green (0-2) through yellow (3-5) to red (6-10)
    - Medication correlation panel below: which meds reduce which zone pain (based on history)
    - "Log Pain" save button
    - Historical view toggle (see average pain per zone over time)

23. WEATHER (weather.tsx)
    - Weather-symptom correlation dashboard
    - Current conditions card: barometric pressure, humidity, temperature
    - Correlation charts: pressure vs pain, humidity vs symptoms
    - Trigger profiles section: identified weather triggers (e.g., "Low pressure correlates with headache")
    - Forecast-based alerts: "Tomorrow: low pressure -- possible headache trigger"
    - Date range filter for analysis

24. FODMAP (fodmap.tsx)
    - Food tracking section: meal log with timestamp and food items
    - FODMAP classification per food item: low (green) / moderate (yellow) / high (red) badge
    - Trigger correlation analysis: identified food triggers linked to symptoms
    - Bristol stool scale log (1-7 visual scale with descriptions)
    - "Log Meal" and "Log Stool" buttons
    - Symptom timeline overlay
```

---

## Prompt 3: Mobile Screens 25--36 (CGM, Caregivers, Reports, Wellness, Settings)

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyMeds
Accent color: #06B6D4

Design 12 mobile screens completing the mobile set. Same design language.

25. CGM (cgm.tsx)
    - Current glucose reading (very large, centered, color-coded: green in range, red out of range)
    - Trend arrow icon: rising rapidly / rising / stable / falling / falling rapidly
    - Time-in-range donut chart: in range (green) / above (orange) / below (red) segments
    - Ambulatory glucose profile (AGP): 24-hour pattern with median and percentile bands
    - Daily pattern graph: overlay of recent days' glucose curves
    - Last updated timestamp

26. CAREGIVERS (caregivers.tsx)
    - Caregiver list
    - Each card: name, phone, email, relationship badge
    - Alert types per caregiver: missed dose / low supply / emergency (toggle switches)
    - Delay before alert picker (5 min / 15 min / 30 min / 1 hour)
    - Weekly summary delivery toggle per caregiver
    - "Add Caregiver" button (#06B6D4)

27. CONTACTS (contacts.tsx)
    - Healthcare directory list
    - Type categories: Doctors / Pharmacies / Emergency / Insurance / Clinics (filterable tabs)
    - Each card: name, phone (tappable), address, type badge (color-coded)
    - Search bar at top
    - "Add Contact" button

28. EXPORT (export.tsx)
    - Doctor/therapy report generator
    - Format selector: Markdown / PDF toggle
    - Date range picker (from -- to)
    - Data sections to include (checkboxes): medications, adherence, vitals, mood, symptoms, interactions
    - Preview button
    - Share via system share button (#06B6D4)
    - "Generate Report" button

29. REPORTS (reports.tsx)
    - Pre-generated report templates list
    - Template cards: Medication Summary, Adherence Report, Vitals Report, Mood Report, Comprehensive Visit Report
    - Each card: template name, description, icon, date range selector
    - "Generate" button per template
    - Generated reports list below (with share buttons)

30. WELLNESS (wellness.tsx)
    - Composite wellness score 0-100 (large circular gauge, gradient from red to green)
    - Contributing factors breakdown:
      - Adherence (weight + score)
      - Vitals stability (weight + score)
      - Mood trend (weight + score)
      - Symptom control (weight + score)
      - Activity (weight + score)
    - Breakdown horizontal bar chart per factor
    - Trend: wellness score over time (line chart)
    - Tips/recommendations based on lowest factor

31. NOTIFICATION SETTINGS (notification-settings.tsx)
    - Per-medication reminder configuration
    - Each medication section: med name header, reminder time(s) list with time pickers
    - Early/on-time/late windows: "Early" (minutes before), "Late" (minutes after) number inputs
    - Sound picker dropdown
    - Vibration toggle
    - Smart snooze toggle (auto-remind again in 10 min if not taken)

32. NOTIFICATION SETUP (notification-setup.tsx)
    - Initial reminder flow (wizard-style)
    - Step indicator (dots showing progress)
    - For each active medication: medication name, suggested time(s) based on frequency
    - Time picker per reminder
    - Preview notification card (shows what the notification will look like)
    - "Next" / "Done" buttons

33. ONBOARDING (onboarding.tsx)
    - 5-step wizard with progress dots
    - Step 1: Privacy promise (shield icon, "Your data never leaves your device" headline, bullet points)
    - Step 2: Add first medication (simplified add-med form)
    - Step 3: Set reminders (time pickers for added med)
    - Step 4: Emergency info (emergency contact, blood type, allergies)
    - Step 5: Optional caregiver setup (skip or add)
    - "Get Started" final button (#06B6D4)

34. PASSCODE LOCK (passcode-lock.tsx)
    - PIN entry screen: 4 or 6 digit circles, number pad
    - Face ID / Touch ID toggle button (biometric icon)
    - "Forgot PIN" link
    - Lockout message after 5 failed attempts (countdown timer)
    - Subtle MyMeds logo at top
    - Dark background with minimal UI

35. HOME STYLE (home-style.tsx)
    - Customizable Today screen layout editor
    - Card list with drag handles for reordering
    - Available cards: Active Meds, Dose Log, Low Supply, Adherence, Mood, Vitals, Appointments
    - Toggle switch per card (show/hide)
    - Card size selector per card: compact / expanded
    - Preview pane showing arrangement
    - "Save Layout" button

36. SETTINGS (settings.tsx)
    - Units section: glucose (mg/dL or mmol/L), temperature (F or C), weight (lb or kg)
    - Timezone selector
    - Export format default (Markdown/PDF)
    - Data retention picker (forever / 1 year / 2 years / 5 years)
    - Passcode lock toggle (links to passcode-lock)
    - About section: version, privacy policy link
```

---

## Prompt 4: Web Screens 37--52

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

Module: MyMeds (Web)
Accent color: #06B6D4
Layout: Persistent sidebar (from hub shell) with content area

Design 16 web pages for the MyMeds module. Desktop-optimized layouts with wider content areas, multi-column grids, data tables, and sidebar navigation. Same Cool Obsidian dark theme.

37. DASHBOARD (/meds)
    - Today's schedule: medication timeline (horizontal, hour-by-hour with dose markers)
    - 4-column stat cards: adherence rate %, active meds count, doses today (taken/total), supply alerts count
    - Active medications table: name, dosage, frequency, next dose, status badge, quick "Take" button
    - Low supply alerts banner (red background, medication names with days remaining)
    - Wellness score gauge (sidebar widget)

38. MEDICATION LIST (/meds/medications)
    - Full medication table: name, dosage, frequency, prescriber, pharmacy, status, start date, supply remaining
    - Sortable and filterable columns
    - Row click to expand detail panel (slide-in)
    - "Add Medication" button top right
    - Bulk actions: pause, archive, export selected

39. HISTORY (/meds/history)
    - Dose history table: date/time, medication, dose, status (taken/missed/late), notes
    - Calendar heatmap above table (green/red cells)
    - Filters: medication dropdown, date range, status
    - Export button (CSV/PDF)
    - Adherence statistics summary cards

40. BLOOD PRESSURE (/meds/bp)
    - BP trend chart (dual line: systolic and diastolic over time)
    - Log entry form (inline): systolic, diastolic, pulse, arm, position
    - Recent readings table with AHA classification badges
    - AHA distribution pie chart
    - Period comparison cards (this month vs last month)

41. BP TRENDS (/meds/bp/trends)
    - Extended analytics: moving average lines, standard deviation bands
    - Time-of-day analysis (morning vs evening readings)
    - Medication overlay toggle (show med start/stop dates on chart)
    - Exportable chart and data table
    - Goal tracking (user-set BP targets with progress)

42. GLUCOSE (/meds/glucose)
    - Glucose trend chart with time-in-range shading
    - Log entry form (inline): value, meal context
    - Time-in-range summary (horizontal stacked bar)
    - AGP chart (ambulatory glucose profile)
    - Meal context breakdown table (fasting/pre-meal/post-meal/bedtime averages)

43. INSULIN (/meds/insulin)
    - Insulin log table: date/time, type, units, site, carbs covered
    - IOB (insulin on board) real-time display with decay curve
    - Daily totals stacked bar chart (rapid vs long-acting)
    - Injection site rotation body map (interactive, larger desktop version)
    - Insulin-to-carb ratio analysis

44. A1C (/meds/a1c)
    - Estimated A1c large gauge display
    - GMI value and confidence level
    - Historical A1c chart (data points over months/years)
    - Target zone shading on chart
    - Data quality indicator (number of readings used, data gaps)
    - Comparison with lab results (manual entry for lab A1c values)

45. MEASUREMENTS (/meds/measurements)
    - Multi-metric dashboard: BP, glucose, weight, temperature, heart rate
    - Selectable metric tabs
    - Trend chart per metric with medication markers
    - Data table below chart
    - "Log" button per metric type
    - Correlation toggle (overlay multiple metrics)

46. MOOD (/meds/mood)
    - Mood trend chart (#06B6D4 line) with medication change markers
    - Mood-medication correlation panel: Pearson coefficients table
    - Mood log form (inline): slider 1-10, note, linked meds
    - Calendar heatmap (color-coded by mood score)
    - Average mood per medication period comparison

47. CAREGIVERS (/meds/caregivers)
    - Caregiver management table: name, contact, alert types (toggle switches per alert type)
    - Alert configuration panel per caregiver
    - Alert history log (sent alerts with timestamps and outcomes)
    - "Add Caregiver" button
    - Weekly summary preview and send button

48. CGM (/meds/cgm)
    - Real-time glucose display (large, centered) with trend arrow
    - 24-hour trace chart (live updating)
    - Time-in-range donut chart
    - AGP overlay (7/14/30 day)
    - Daily patterns grid (each day as a mini chart row)
    - Alert configuration (high/low thresholds)

49. FODMAP (/meds/fodmap)
    - Meal log table: date/time, foods, FODMAP levels (badge per food)
    - Trigger analysis panel: identified triggers ranked by confidence
    - Bristol stool scale log entries
    - Symptom correlation timeline (meals and symptoms on same timeline)
    - Food search with FODMAP classification database

50. PAIN MAP (/meds/pain)
    - Interactive body map (larger desktop version, front + back side by side)
    - Zone severity controls (click zone, adjust slider)
    - Historical heatmap animation (slider to scrub through dates)
    - Medication correlation table per zone
    - Pain log history table below map

51. WEATHER (/meds/weather)
    - Weather conditions panel: current + 7-day forecast
    - Correlation charts: pressure/humidity/temperature vs symptoms
    - Trigger profile cards (identified patterns)
    - Forecast alerts banner (upcoming potential triggers)
    - Data source and location settings

52. SETTINGS (/meds/settings)
    - Units configuration (glucose, temperature, weight)
    - Notification preferences
    - Export section: date range, format (CSV/PDF/Markdown), data sections checkboxes
    - Caregiver quick links
    - Passcode/biometric lock settings
    - Data retention policy
    - Privacy information
    - Danger zone: delete all MyMeds data (red button with confirmation modal)
```
