# MyMeds Feature Set

## Problem Statement

You are working in the MyLife monorepo at `/Users/trey/Desktop/Apps/MyLife/`. MyLife is a unified hub app consolidating 10+ privacy-first personal app modules into a single cross-platform application. Each module implements a `ModuleDefinition` contract from `@mylife/module-registry` and stores data in a shared SQLite database using table-name prefixes (`md_` for meds).

**MyMeds** is a privacy-first medication and health tracking app. It currently has **no runtime code**. A DESIGN.md exists specifying the intended schema (9 SQLite tables), and a hub scaffold exists at `modules/meds/` with 7 boilerplate files. The standalone directory does not yet have a repository. This is a ground-up build.

**Consolidation context:** MyMeds absorbs **MyMood** (a planned mood and symptom tracking app that also has no runtime code). The combined app becomes the single destination for medication management, mood tracking, and health correlation. The unique value proposition is that medication adherence and mood data live side-by-side, enabling users to see how their medications affect how they feel over time. This is a post-Dobbs privacy play: all health data stays on-device with zero cloud dependency.

**What needs to be built (3 feature sets):**

### Feature Set 1: Medication Management (MVP Foundation)

Core medication tracking that competes with Medisafe and Round Health. Users add their medications, set reminders, and track whether they took their doses.

**Features:**
- Medication CRUD: name, dosage, frequency (daily/weekly/as-needed), time of day, instructions (with food/empty stomach), start date, end date (optional)
- Dosage reminders with push notifications at scheduled times
- Adherence tracking: mark doses as taken/skipped/late with timestamp
- Adherence calendar: month view showing green (taken), red (missed), yellow (late) per day per medication
- Adherence statistics: percentage by medication, by week/month, streak tracking
- Refill tracking: pill count, daily burn rate calculation, low-supply alerts (e.g., "5 days of Metformin remaining")

### Feature Set 2: Drug Safety and Health Measurements

Safety features that differentiate from basic pill reminder apps.

**Features:**
- Local drug interaction database: bundled SQLite lookup of common interaction pairs (no network required), warn when adding a new medication that interacts with existing ones
- Health measurement logging: blood pressure, blood sugar, weight, temperature, custom measurements with units
- Measurement trends: line charts showing measurements over time, with medication start/stop dates overlaid as markers
- Export reports for doctor visits: PDF or Markdown summary of medication list, adherence rates, measurements, and mood trends for a selected date range

### Feature Set 3: Mood and Symptom Tracking (MyMood Consolidation)

MyMood features integrate as a "Mood" tab within MyMeds. The power feature is correlation: users can see how their mood patterns relate to their medication changes.

**Features:**
- Daily mood check-ins: select an emotion from a structured vocabulary (How We Feel's 144-descriptor Mood Meter organized by energy and pleasantness)
- Activity tagging: what were you doing when you felt this way (exercise, work, socializing, etc.)
- Mood calendar visualization: year-in-pixels style grid where each day is colored by dominant mood
- Symptom logging per day: headache, nausea, fatigue, insomnia, etc. (predefined list + custom symptoms)
- Correlation analysis: show mood averages and symptom frequency before/after medication start dates or dosage changes
- Therapy-ready exports: combined report with mood trends, medication adherence, symptom patterns, and measurement data for a selected date range

---

## Acceptance Criteria

### Feature Set 1: Medication Management

1. User opens MyMeds for the first time and taps "Add Medication" -> fills in name ("Metformin"), dosage ("500mg"), frequency ("twice daily" at 8 AM and 8 PM), pill count (60) -> medication appears on the home screen with next dose time and pill count
2. User receives a push notification at 8 AM saying "Time for Metformin 500mg" -> taps it -> opens the app with a "Take" / "Skip" / "Snooze 15 min" prompt; tapping "Take" logs the dose with timestamp and decrements pill count
3. User opens the adherence calendar -> sees a month grid where each day shows colored dots per medication (green = all taken, red = missed, yellow = late); tapping a day shows the dose-by-dose detail
4. User sees a banner "5 days of Metformin remaining" -> taps "Refill" -> enters new pill count (90) -> the supply indicator resets

### Feature Set 2: Drug Safety and Health Measurements

5. User adds a new medication ("Warfarin") while already taking "Aspirin" -> a warning dialog appears: "Potential interaction: Warfarin + Aspirin may increase bleeding risk" with a "Learn More" link and option to proceed or cancel
6. User logs a blood pressure reading (120/80) -> it appears on a measurement timeline; after logging 10+ readings over a month, a trend chart shows readings over time with their Metformin start date marked as a vertical line

### Feature Set 3: Mood and Symptom Tracking

7. User navigates to the Mood tab and taps "Check In" -> sees a 4-quadrant mood picker (high energy/pleasant, high energy/unpleasant, low energy/pleasant, low energy/unpleasant) with emotion words in each quadrant; selects "content" -> optionally tags activities ("reading", "walking") -> check-in is saved with timestamp
8. User opens the mood calendar -> sees a year-in-pixels grid where each day is colored by mood valence (green = pleasant, red = unpleasant, gray = no data); tapping a day shows the specific emotions and activities logged
9. User opens Correlation view -> sees a chart overlay: mood average line and medication adherence line for the past 3 months; a callout highlights "Mood improved 15% in the 2 weeks after starting Sertraline"
10. User taps "Export for Doctor" and selects a 3-month date range -> a PDF is generated showing: medication list with adherence %, measurement trends, mood pattern summary, and symptom frequency table

---

## Constraint Architecture

**Musts:**
- All data stored in local SQLite with `md_` prefix (tables: `md_medications`, `md_doses`, `md_dose_logs`, `md_reminders`, `md_refills`, `md_interactions`, `md_measurements`, `md_mood_entries`, `md_mood_activities`, `md_symptoms`, `md_symptom_logs`)
- Zero network calls (drug interaction database bundled as a local SQLite table, not an API)
- Push notifications via Expo Notifications (mobile) and browser Notification API (web) for dose reminders
- Mood vocabulary based on the How We Feel Mood Meter framework (144 descriptors organized by energy level and pleasantness)
- All health data encrypted at rest (SQLite encryption or application-level AES-256)
- Export generates a self-contained PDF or Markdown file with no external dependencies

**Must-nots:**
- Do not add cloud sync, accounts, or any network-dependent features
- Do not store health data in plaintext SQLite without encryption
- Do not use third-party health tracking SDKs (no Apple HealthKit or Google Fit integration in MVP)
- Do not modify `packages/module-registry/` or other modules
- Do not collect, transmit, or log any health data outside the device

**Preferences:**
- Use the DESIGN.md schema as the starting point but extend it for mood/symptom tables
- Correlation analysis should use simple statistical methods (moving averages, before/after comparisons) rather than ML
- Mood check-in should take under 10 seconds for the common case (tap quadrant, tap emotion, done)
- Drug interaction database should cover the top 200 most commonly prescribed medications and their known interactions

**Escalation triggers:**
- If bundling a drug interaction database exceeds 20MB, consider a compressed format or top-200-only subset
- If PDF generation requires native modules not in the Expo ecosystem, fall back to Markdown export only
- If the 144-descriptor mood vocabulary is too complex for a mobile UI, simplify to a 36-descriptor subset (9 per quadrant)

---

## Subtask Decomposition

**Subtask 1: Medication Schema and CRUD (90 min)**
Implement the full medication SQLite schema with `md_` prefix. Build medication CRUD operations: create, read, update, delete, list. Include dosage frequency parsing (daily, twice daily, weekly, as-needed) and pill count tracking.

**Subtask 2: Reminder and Adherence Engine (90 min)**
Build the dose reminder scheduler that creates push notifications at scheduled times. Implement dose logging (taken/skipped/late) with timestamps. Build adherence calculator (percentage by medication, by time period). Build the adherence calendar data queries.

**Subtask 3: Drug Interaction Database (60 min)**
Bundle a local SQLite table of common drug interactions (top 200 medications). Build lookup logic that checks new medications against existing ones and surfaces warnings. Source data from FDA open datasets or curated open-source interaction lists.

**Subtask 4: Health Measurements (60 min)**
Add measurement tables. Build CRUD for blood pressure, blood sugar, weight, temperature, and custom measurements. Build trend queries that return time-series data with medication milestone markers.

**Subtask 5: Mood Check-In and Calendar (90 min)**
Add mood and activity tables. Build the mood check-in flow with the 4-quadrant picker and emotion vocabulary. Build activity tagging. Implement the year-in-pixels calendar visualization.

**Subtask 6: Correlation Analysis and Export (90 min)**
Build correlation engine that overlays mood averages with medication adherence and symptom frequency. Implement before/after analysis for medication start dates. Build PDF/Markdown export with all health data for a date range.

---

## Evaluation Design

1. **Reminder accuracy:** Create a medication with a daily 8 AM reminder -> verify a scheduled notification exists for tomorrow at 8 AM; log the dose as taken -> verify the next reminder advances to the following day
2. **Adherence calculation:** Log 28 doses taken and 2 missed for a 30-day period -> `getAdherence(medId, {days: 30})` returns 93.3%
3. **Drug interaction:** Insert "Warfarin" and "Aspirin" interaction into the database -> add Warfarin while Aspirin is active -> `checkInteractions('Warfarin', activeMeds)` returns a warning object with severity and description
4. **Mood correlation:** Log daily mood check-ins for 30 days, start a new medication on day 15 -> `getCorrelation(medId, 'mood')` returns before-average and after-average mood scores with the medication start date as the divider
5. **Type safety:** `pnpm typecheck` exits 0; `pnpm check:parity` exits 0
