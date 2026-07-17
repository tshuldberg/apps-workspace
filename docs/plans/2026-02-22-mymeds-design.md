# MyMeds — Design Document

**Date:** 2026-02-22
**Status:** Draft
**Author:** MyApps Product Team

---

## Overview

**MyMeds** is a privacy-first medication tracker and reminder app that stores your entire medication list, dosage schedule, and adherence history exclusively on your device. For users taking sensitive medications — psychiatric drugs, HIV antiretrovirals, addiction treatment, hormones — the privacy guarantee isn't a feature, it's a requirement. MyMeds delivers reliable reminders, refill alerts, and a local interaction-checking database without ever transmitting what you take to anyone.

---

## Problem Statement

Medication tracking is a healthcare necessity with a deeply flawed app market:

1. **Medication data is the most sensitive health data that exists.** Your medication list reveals your diagnoses — psychiatric conditions, HIV status, addiction history, chronic illness, reproductive choices. Medisafe, the market leader, partners with pharmaceutical companies and health plans, sharing anonymized (but potentially re-identifiable) adherence data. MyTherapy is operated by a pharma company (Smartpatient GmbH, backed by pharma investors). Users taking stigmatized medications face real consequences if their medication list is exposed — employment discrimination, insurance complications, social stigma, and in some jurisdictions, legal risk.

2. **Pharma monetization corrupts the user relationship.** Medisafe's business model is B2B: pharmaceutical companies pay to send "medication support" messages (read: drug marketing) to patients through the app. The user is the product, not the customer. This creates a fundamental conflict: the app benefits from users taking (and being reminded about) specific branded medications, not from users' actual health outcomes. When your medication reminder app is funded by the companies selling you the medications, the incentives are broken.

3. **Missed doses are a $500B problem.** The WHO estimates that medication non-adherence costs the US healthcare system $290-528 billion annually. 50% of patients with chronic conditions don't take medications as prescribed. The primary reason isn't forgetfulness — it's that existing reminder tools are either too annoying (notification fatigue), too complex (medical-grade UI that intimidates users), or too untrustworthy (users don't want to enter their medications into an app that might share the data). A tool that users actually trust with their medication list is a tool they'll actually use.

4. **Interaction warnings are locked behind expensive services.** Drug interaction databases (Lexicomp, Clinical Pharmacology, Micromedex) cost $300-1,000/year and are designed for healthcare professionals. Consumer apps either don't offer interaction checking or require cloud lookups that expose the user's medication list. A local interaction database — even a simplified one covering the most common dangerous interactions — would be genuinely useful and completely private.

---

## Target User Persona

**Primary: Maria, 45, Chronic Condition Manager**

- Takes 3-5 daily medications for a combination of conditions (e.g., hypertension, anxiety, thyroid)
- Has tried Medisafe but felt uncomfortable entering all her medications after reading about their pharma partnerships
- Currently uses iPhone alarms for reminders — works for timing but provides no adherence history, no refill tracking, no interaction awareness
- Wants a single place to manage her medication schedule without feeling like her health data is being monetized
- Checks her medication list occasionally when visiting a new doctor or urgent care ("What medications are you on?")
- Not highly technical — needs an app that's straightforward, not a medical dashboard
- Age range: 30-65
- Willing to pay a one-time fee for a well-designed, trustworthy app
- Platforms: Primarily iOS (older demographic skews Apple)

**Secondary personas:**
- **Young adults on psychiatric medications** (antidepressants, ADHD meds, mood stabilizers) — high privacy sensitivity, don't want parents/roommates seeing notifications that reveal medication names
- **Caregivers** tracking medications for elderly parents — need a simple, reliable tool they can set up and hand off
- **People with HIV** on antiretroviral therapy — adherence is critical (missed doses can enable resistance), and medication privacy is a safety issue in many contexts

---

## Competitive Landscape

| Competitor | Price | Est. Users | Est. Revenue | Privacy Stance | Key Weakness |
|---|---|---|---|---|---|
| **Medisafe** | Free / Premium $4.99/mo | 10M+ downloads | ~$50M ARR (B2B pharma + consumer premium) | Cloud-synced, account required. B2B pharma partnerships — shares adherence data with health plans and pharma companies | User is the product. Pharma-funded "support" messages. Cloud-dependent. Account required |
| **MyTherapy** | Free | 5M+ downloads | ~$10M (pharma-funded) | Operated by Smartpatient GmbH (pharma-backed). Cloud-synced, account required | Pharma company operated. Data stored on servers. EU-focused, US experience is secondary |
| **Pill Reminder** (various) | Free with ads / $2.99-9.99 | Fragmented (dozens of apps, 1-5M each) | Small | Varies — most are ad-supported with basic privacy policies | Ad-supported = data collection for ad targeting. Low quality. Unreliable reminders |
| **Apple Health** | Free (built-in) | ~100M+ (iOS only) | N/A | On-device, encrypted | No reminder notifications for medications. Limited medication tracking (added in iOS 16 but minimal). iOS only |
| **Round Health** | Free | ~1M downloads | ~$1M (acquired/sunset) | Cloud-synced | Acquired and effectively abandoned. Beautiful UI but no longer maintained |
| **CareZone** | Free | ~2M downloads | ~$5M (acquired by Walmart) | Acquired by Walmart Health. Data now under Walmart's privacy policy | Walmart-owned. Not independent. Data policy changed post-acquisition |

**Market opportunity:** Medication non-adherence is one of the most expensive problems in healthcare. 131 million Americans take prescription medications. 66% of US adults take at least one prescription drug. Yet the app market is dominated by either pharma-funded "free" apps (Medisafe, MyTherapy) or low-quality ad-supported alarm clocks. No commercial medication tracker offers verifiable local-only data storage. The privacy angle is uniquely powerful here — medication lists are more sensitive than period data, exercise data, or habit data. Users who refused to enter their medications into Medisafe will enter them into an app they can verify doesn't transmit data.

---

## Key Features (MVP)

### Medication Management
- **Add medication:** Name (with autocomplete from a local drug name database), dosage (amount + unit: mg, mcg, mL, etc.), form (tablet, capsule, liquid, injection, patch, inhaler, drops, cream, other), frequency (once daily, twice daily, three times daily, every X hours, specific days of week, as needed), schedule times, prescriber name (optional), pharmacy (optional), notes (optional)
- **Photo scan prescription label:** Use the device camera to photograph a prescription label. On-device OCR (Apple Vision framework on iOS, ML Kit on Android) extracts medication name, dosage, and quantity. User confirms/edits before saving. All processing happens on-device — the photo is never uploaded anywhere.
- **Edit medication:** Modify any field. History of changes is preserved (important for "what dose was I on last month?")
- **Discontinue medication:** Mark as discontinued with a date. Removed from active schedule but preserved in history with full adherence data.
- **Delete medication:** Permanent removal with confirmation.
- **Medication list view:** All active medications in a clean list. Tap for detail. Useful as a reference when visiting a doctor — "show your phone" replaces "I forget the name."

### Dosage Reminders
- **Scheduled notifications:** Local push notification at each scheduled dose time. Notification shows medication name and dosage (configurable — users with privacy concerns can set notifications to show "Time for your medication" without the specific name)
- **Notification actions:** "Taken" and "Snooze 15min" directly from the notification (no app launch needed)
- **Snooze cascade:** Snooze once (15min), twice (30min), three times (1hr). After 3 snoozes, marked as missed. Configurable snooze duration.
- **Flexible scheduling:** Support for complex medication schedules — "take with food," "take on empty stomach," "take 30 minutes before breakfast." These are stored as notes/tags on the reminder, not enforced by the app.
- **Do Not Disturb awareness:** Reminders respect the user's DND schedule but queue for delivery when DND ends (using local notification scheduling)

### Adherence Tracking
- **Daily adherence log:** For each day, show which doses were taken, missed, or skipped (user can manually mark "skipped" for intentional misses like doctor-advised hold)
- **Adherence history:** Calendar view showing adherence per day (green = all taken, yellow = partial, red = missed, gray = no data). Similar to MyCycle's calendar but for medication adherence.
- **Adherence statistics:** Per-medication adherence rate (% of scheduled doses taken over 7/30/90 days), overall adherence rate, streak (consecutive days with 100% adherence)
- **Medication log:** Timestamped list of every dose taken/missed/skipped — exportable for sharing with a doctor

### Refill Alerts
- **Pill count tracking:** When adding a medication, optionally enter the quantity dispensed (e.g., "90 tablets"). The app counts down as doses are logged.
- **Refill reminder:** Local notification when supply drops below a configurable threshold (default: 7 days' supply remaining)
- **Refill history:** Log when a refill was picked up (tap "Refilled" and optionally enter new quantity)

### Interaction Warnings
- **Local interaction database:** A bundled SQLite database of ~500 common clinically significant drug-drug interactions (sourced from public FDA data and open-source interaction databases). Covers the most dangerous combinations: MAOIs + SSRIs, warfarin + NSAIDs, methotrexate + trimethoprim, etc.
- **Passive checking:** When a user adds a new medication, the app checks it against all current active medications. If an interaction is found, display a warning banner with severity (major/moderate/minor) and a brief description.
- **Not a substitute for professional advice:** Every interaction warning includes a disclaimer: "This is not medical advice. Consult your pharmacist or doctor." The database covers common interactions but is not comprehensive.
- **Database updates:** Interaction database is bundled with the app and updated via app store updates (no network fetch). Version-stamped so users know the recency of their interaction data.

### Data Management
- **Export:** Full medication list + adherence history as CSV, JSON, or PDF (formatted medication list suitable for printing and bringing to a doctor's appointment)
- **Import:** CSV import for medication list
- **Wipe all data:** Permanent deletion with confirmation

### Onboarding
- **First launch:** 3 screens: (1) "Your medications stay on your device — always" with privacy explanation, (2) "Add your first medication" (with photo scan option), (3) "Set up reminders"
- **No account. No email. No name.** App launches directly into the medication list.
- **Quick-add flow:** Medication name → dosage → schedule → done. Under 30 seconds for a simple daily medication.

---

## Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Mobile framework | Expo (React Native) with Expo Router |
| Web framework | Next.js 15 (App Router) |
| Local database | expo-sqlite (mobile) / IndexedDB via Dexie.js (web) |
| State management | Zustand with SQLite persistence layer |
| UI components | Custom component library, dark mode native |
| Notifications | expo-notifications (local only) |
| OCR (iOS) | Apple Vision framework via native module |
| OCR (Android) | ML Kit Text Recognition (on-device, no cloud) |
| Camera | expo-camera |
| Date handling | date-fns |
| PDF export | react-native-pdf-lib or expo-print |
| Monorepo | Turborepo |
| Package manager | pnpm |
| Language | TypeScript 5.9 everywhere |
| Testing | Vitest (shared logic), Jest (React Native) |

### Data Model (SQLite)

```sql
-- Medication definitions
CREATE TABLE medications (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name            TEXT NOT NULL,
  generic_name    TEXT,                    -- For interaction lookups
  dosage_amount   REAL NOT NULL,           -- e.g., 10 (for 10mg)
  dosage_unit     TEXT NOT NULL,           -- 'mg' | 'mcg' | 'mL' | 'units' | etc.
  form            TEXT NOT NULL DEFAULT 'tablet', -- 'tablet' | 'capsule' | 'liquid' | 'injection' | 'patch' | 'inhaler' | 'drops' | 'cream' | 'other'
  frequency       TEXT NOT NULL,           -- 'once_daily' | 'twice_daily' | 'three_daily' | 'every_x_hours' | 'specific_days' | 'as_needed'
  frequency_hours INTEGER,                 -- For 'every_x_hours'
  days_of_week    TEXT,                    -- JSON array for 'specific_days'
  instructions    TEXT,                    -- 'with food', 'on empty stomach', etc.
  prescriber      TEXT,
  pharmacy        TEXT,
  color           TEXT DEFAULT '#F5A623',  -- Visual identifier color
  shape           TEXT DEFAULT 'circle',   -- Pill shape for visual ID: 'circle' | 'oval' | 'rectangle' | 'diamond'
  active          INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = discontinued
  discontinued_at TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_medications_active ON medications(active);

-- Scheduled dose times for each medication
CREATE TABLE dose_schedules (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  time            TEXT NOT NULL,           -- HH:MM (24-hour format)
  label           TEXT,                    -- 'Morning', 'Evening', 'Bedtime', etc.
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_dose_schedules_medication ON dose_schedules(medication_id);

-- Dose log (one row per scheduled dose per day)
CREATE TABLE dose_logs (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  schedule_id     TEXT REFERENCES dose_schedules(id) ON DELETE SET NULL,
  scheduled_date  TEXT NOT NULL,           -- ISO 8601 date (YYYY-MM-DD)
  scheduled_time  TEXT NOT NULL,           -- HH:MM
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'taken' | 'missed' | 'skipped'
  taken_at        TEXT,                    -- ISO 8601 datetime when user confirmed taking
  snoozed_count   INTEGER DEFAULT 0,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_dose_logs_medication_date ON dose_logs(medication_id, scheduled_date);
CREATE INDEX idx_dose_logs_date ON dose_logs(scheduled_date);
CREATE INDEX idx_dose_logs_status ON dose_logs(status);

-- Refill tracking
CREATE TABLE refills (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  quantity        INTEGER NOT NULL,        -- Number of doses/pills in this refill
  remaining       INTEGER NOT NULL,        -- Current remaining count (decremented on each 'taken')
  refilled_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_refills_medication ON refills(medication_id);

-- Drug interaction database (bundled, read-only)
CREATE TABLE interactions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  drug_a          TEXT NOT NULL,           -- Normalized generic drug name
  drug_b          TEXT NOT NULL,           -- Normalized generic drug name
  severity        TEXT NOT NULL,           -- 'major' | 'moderate' | 'minor'
  description     TEXT NOT NULL,           -- Brief clinical description
  mechanism       TEXT,                    -- Brief mechanism explanation
  recommendation  TEXT,                    -- What to do (e.g., "Avoid combination" or "Monitor closely")
  source          TEXT                     -- 'FDA' | 'DrugBank' | 'OpenFDA'
);

CREATE INDEX idx_interactions_drug_a ON interactions(drug_a);
CREATE INDEX idx_interactions_drug_b ON interactions(drug_b);

-- Drug name autocomplete database (bundled, read-only)
CREATE TABLE drug_names (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_name      TEXT,
  generic_name    TEXT NOT NULL,
  common_dosages  TEXT,                    -- JSON array of common dosages
  common_forms    TEXT                     -- JSON array of common forms
);

CREATE INDEX idx_drug_names_brand ON drug_names(brand_name);
CREATE INDEX idx_drug_names_generic ON drug_names(generic_name);

-- Medication change history (audit trail)
CREATE TABLE medication_history (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  medication_id   TEXT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  field_changed   TEXT NOT NULL,           -- 'dosage_amount', 'frequency', etc.
  old_value       TEXT,
  new_value       TEXT,
  changed_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_medication_history_medication ON medication_history(medication_id);

-- App settings
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Schema version
CREATE TABLE schema_version (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Reminder Engine Architecture

The reminder engine is designed to be reusable across future MyApps (MyPets medication reminders, MyGarden watering reminders, etc.):

```
Reminder Engine (packages/shared/src/reminders/)
─────────────────────────────────────────────────

Core Interface:
  ReminderSchedule {
    id: string
    entityId: string          // medication_id, pet_id, plant_id, etc.
    entityType: string        // 'medication' | 'pet' | 'plant' | etc.
    time: string              // HH:MM
    days: number[]            // ISO weekdays [1-7], empty = daily
    repeatInterval?: number   // hours between repeats (for 'every X hours')
    label: string
    notificationTitle: string
    notificationBody: string
    snoozeMax: number         // max snooze count before marking missed
    snoozeDuration: number    // minutes per snooze
  }

Scheduling Logic:
  1. On app launch + after any schedule change:
     - Cancel all existing local notifications
     - Recompute next 64 notification instances (iOS limit)
     - Schedule via expo-notifications
  2. Each notification carries a payload: { scheduleId, entityId, entityType, dosageInfo }
  3. Notification action "Taken" → log dose, decrement refill count, reschedule
  4. Notification action "Snooze" → schedule follow-up notification in snoozeDuration minutes
  5. After snoozeMax reached → auto-mark as missed

Platform Considerations:
  - iOS: Maximum 64 pending local notifications. For a user with 5 meds, 3x daily each = 15/day.
    64 notifications = ~4 days of lookahead. Reschedule on each app foreground event.
  - Android: No hard limit on pending notifications, but battery optimization can delay delivery.
    Use expo-notifications' exact alarm scheduling where available.
  - Web: Use the Notifications API with service worker for background delivery.

Privacy-Safe Notifications:
  - Default: Notification shows medication name ("Time for Lisinopril 10mg")
  - Privacy mode (user toggle): Notification shows "Time for your medication" — no drug name visible
    on lock screen. User opens the app to see which medication is due.
  - This is critical for users whose lock screen is visible to roommates, coworkers, or family members.
```

### Photo Scan Architecture

```
Prescription Label OCR Pipeline (on-device only)
─────────────────────────────────────────────────

1. User taps "Scan Label" → camera opens in a guided frame mode
   ("Center the prescription label in the frame")
2. Capture image → stored temporarily in app memory (never saved to photo library or disk)
3. Pass image to on-device OCR:
   - iOS: VNRecognizeTextRequest (Apple Vision framework) — runs on Neural Engine, no network
   - Android: ML Kit Text Recognition v2 (on-device model, bundled with app, no network)
4. Extract text blocks → run regex patterns to identify:
   - Drug name (matched against local drug_names database)
   - Dosage (pattern: number + unit, e.g., "10 MG", "500MCG")
   - Quantity dispensed (pattern: "QTY: 90" or "QUANTITY: 90")
   - Prescriber name (pattern: "DR." or "PRESCRIBER:" prefix)
   - Pharmacy name (pattern: known pharmacy chains or "PHARMACY:" prefix)
5. Present extracted data in an editable form → user confirms or corrects
6. Delete the captured image from memory immediately after extraction
7. No image is ever persisted, transmitted, or stored

Accuracy expectations:
  - Drug name: ~90% accuracy on printed US prescription labels (standard pharmacy formatting)
  - Dosage: ~85% accuracy (numeric + unit patterns are reliable)
  - Quantity: ~80% accuracy (varies by pharmacy label format)
  - User always confirms — the scan is a convenience accelerator, not a trusted source
```

### Interaction Database

The interaction database is a bundled SQLite file (~2MB) containing approximately 500 clinically significant drug-drug interactions. Source data:

1. **FDA Drug Interactions Table** (public domain) — Major interactions flagged by FDA
2. **DrugBank Open Data** (CC BY-NC 4.0) — Pharmacological interaction data
3. **OpenFDA API** (public domain) — Adverse event reports correlated with drug combinations

The database is curated to prioritize:
- **Major severity interactions** (combinations that can cause serious harm or death)
- **Common medications** (top 200 prescribed drugs in the US cover ~80% of prescriptions)
- **Well-documented interactions** (established evidence, not theoretical)

Interactions NOT included (out of scope for MVP):
- Drug-food interactions
- Drug-supplement interactions
- Drug-condition contraindications
- Dosage-dependent interactions
- Interactions involving rare/specialty medications

The database is updated with each app release (not via network). A `db_version` field tracks the recency. If the database is >6 months old, a subtle banner suggests the user check for app updates.

### Privacy Architecture

**Network isolation:** Identical to MyCycle — zero network requests, no analytics, no crash reporting, no remote config. Verified by lack of network permissions in app manifest.

**Enhanced privacy considerations for MyMeds:**

1. **Notification privacy mode:** User can toggle between "Show medication name" and "Show generic reminder" in settings. When enabled, all notifications display "Time for your medication" without revealing the specific drug name. This prevents lock screen exposure.

2. **Screen recording protection (iOS):** Use `UIScreen.isCaptured` to detect screen recording and optionally blur the medication list. Configurable — some users want screenshots for their doctor.

3. **No Face ID / biometric by default:** The app does not require biometric authentication to open (adds friction to an already-low-frequency task). Optional app lock (Face ID / fingerprint) available in settings for users who want it.

4. **Export is explicit and manual:** Data only leaves the device when the user taps Export and selects a destination. The export file format (CSV, JSON, PDF) is clearly labeled with the data it contains.

5. **OCR image lifecycle:** Prescription label photos exist only in volatile memory during the scan process. They are never written to disk, never saved to the photo library, and never transmitted. The camera session is destroyed immediately after text extraction.

6. **Interaction database is read-only and bundled:** The drug interaction database ships with the app binary. No network request is made to check interactions. The user's medication list is never sent to a server for interaction checking.

---

## UI/UX Direction

### Design Language

- **Color palette:** Dark background (#0A0A0F), warm teal primary (#4ECDC4), coral for alerts/warnings (#FF6B6B), amber for taken/success (#F5A623), muted grays for secondary UI. Teal distinguishes MyMeds from the amber-primary MyCycle and MyHabits.
- **Typography:** Inter — clean, highly legible at all sizes. Medication names and dosages use medium weight for scanability.
- **Shape language:** Rounded rectangles (12px radius), pill-shaped chips for medications (fitting metaphor), soft iconography
- **Visual medication identifiers:** Each medication gets a user-assigned color and shape (circle, oval, rectangle, diamond) that appears as a small pill icon throughout the app. Helps users quickly identify medications in a list without reading names.
- **Motion:** Subtle — check animation on dose confirmation, smooth sheet presentations, no excessive celebration (this is a medical tool, not a game)

### Navigation Structure

Bottom tab bar with 4 tabs:

```
[Today]     [Meds]     [History]     [Settings]
```

1. **Today tab (default):** Timeline view of today's medication schedule. Organized by time:

```
┌──────────────────────────────────────┐
│  Good morning, here's your schedule  │
│                                      │
│  8:00 AM — Morning                   │
│  ┌────────────────────────────────┐  │
│  │ ● Lisinopril 10mg      [✓ Taken] │
│  │   tablet · taken at 8:03 AM   │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ ● Levothyroxine 50mcg  [✓ Taken] │
│  │   tablet · taken at 8:03 AM   │  │
│  └────────────────────────────────┘  │
│                                      │
│  12:00 PM — Afternoon                │
│  ┌────────────────────────────────┐  │
│  │ ◐ Metformin 500mg       [ Take ] │
│  │   tablet · with lunch         │  │
│  └────────────────────────────────┘  │
│                                      │
│  9:00 PM — Evening                   │
│  ┌────────────────────────────────┐  │
│  │ ○ Sertraline 50mg       [ Take ] │
│  │   capsule · due in 4 hrs     │  │
│  └────────────────────────────────┘  │
│                                      │
│  Today: 2/4 doses taken              │
└──────────────────────────────────────┘
```

Each medication card shows: color dot (medication's visual identifier), name + dosage, form, status (taken with timestamp / upcoming with countdown / missed), and an action button (Take / Taken / Missed).

2. **Meds tab:** List of all active medications. Each row shows name, dosage, frequency summary, and refill status (if tracked). Tap for medication detail screen. "+" button to add new medication. "Discontinued" section collapsed at bottom showing past medications.

3. **History tab:** Calendar view (month grid) with color-coded days:
   - Green: All doses taken
   - Yellow: Some doses missed
   - Red: Multiple doses missed
   - Gray: No medications scheduled

   Tap a day to see the detailed dose log for that date. Below the calendar: adherence statistics (7-day, 30-day, 90-day rates per medication and overall).

4. **Settings tab:**
   - Notification preferences (privacy mode toggle, snooze duration)
   - App lock (Face ID / fingerprint, optional)
   - Refill alert threshold (days of supply)
   - Export data (CSV / JSON / PDF)
   - Import data
   - Interaction database version + last updated date
   - Wipe all data
   - About MyMeds

### Key Screen Flows

**Adding a medication:**
```
Screen 1: Add Medication
┌──────────────────────────────────────┐
│  Medication Name                     │
│  [Lisinop_______________]            │
│  ┌─────────────────────────────┐     │
│  │ Lisinopril (10mg, 20mg, 40mg)│    │
│  │ Lisinopril-HCTZ             │     │
│  └─────────────────────────────┘     │
│  (autocomplete from local database)  │
│                                      │
│  — or —                              │
│  [📸 Scan Prescription Label]        │
│                                      │
│  Dosage                              │
│  [10    ] [mg ▼]                     │
│                                      │
│  Form                                │
│  [Tablet ▼]                          │
│                                      │
│  [Next]                              │
└──────────────────────────────────────┘

Screen 2: Schedule
┌──────────────────────────────────────┐
│  How often?                          │
│  [Once daily]  [Twice]  [3x daily]   │
│  [Every X hrs] [Specific days]       │
│  [As needed]                         │
│                                      │
│  (If Once daily:)                    │
│  What time?                          │
│  [08:00 AM]                          │
│                                      │
│  (If Twice daily:)                   │
│  Morning: [08:00 AM]                 │
│  Evening: [08:00 PM]                 │
│                                      │
│  Special instructions (optional)     │
│  [Take with food_____________]       │
│                                      │
│  [Next]                              │
└──────────────────────────────────────┘

Screen 3: Refill (optional)
┌──────────────────────────────────────┐
│  Track refills? (optional)           │
│                                      │
│  Quantity dispensed                   │
│  [90   ] tablets                     │
│                                      │
│  Remind me when I have              │
│  [7    ] days supply left            │
│                                      │
│  Prescriber (optional)               │
│  [Dr. Smith_________________]        │
│                                      │
│  Pharmacy (optional)                 │
│  [CVS Pharmacy_____________]         │
│                                      │
│  [Save Medication]                   │
└──────────────────────────────────────┘
```

**Interaction warning (appears after saving a new medication if conflict detected):**
```
┌──────────────────────────────────────┐
│  ⚠️  Interaction Warning             │
│                                      │
│  MAJOR: Lisinopril + Spironolactone  │
│                                      │
│  Risk of hyperkalemia (elevated      │
│  potassium levels). Both drugs can   │
│  increase potassium, and the         │
│  combination requires monitoring.    │
│                                      │
│  Recommendation: Consult your doctor │
│  or pharmacist about this            │
│  combination.                        │
│                                      │
│  ⓘ This is informational only, not   │
│  medical advice. Your doctor may     │
│  have prescribed this intentionally. │
│                                      │
│  [I Understand]   [Learn More]       │
└──────────────────────────────────────┘
```

**Notification flow:**
```
Lock screen notification:
┌──────────────────────────────────────┐
│ MyMeds · 8:00 AM                     │
│ Time for Lisinopril 10mg             │
│ (or "Time for your medication" in    │
│  privacy mode)                       │
│                                      │
│ [Taken ✓]        [Snooze 15min]      │
└──────────────────────────────────────┘
```

### PDF Export Design

The PDF medication list is formatted for printing and bringing to a doctor:

```
┌──────────────────────────────────────┐
│  My Medications                      │
│  Generated: February 22, 2026        │
│  via MyMeds app                      │
│                                      │
│  ACTIVE MEDICATIONS                  │
│  ─────────────────────────────────── │
│  1. Lisinopril 10mg                  │
│     Form: Tablet                     │
│     Schedule: Once daily, 8:00 AM    │
│     Instructions: —                  │
│     Prescriber: Dr. Smith            │
│     Adherence (30 day): 96%          │
│                                      │
│  2. Levothyroxine 50mcg              │
│     Form: Tablet                     │
│     Schedule: Once daily, 8:00 AM    │
│     Instructions: Take on empty      │
│                   stomach, 30 min    │
│                   before food        │
│     Prescriber: Dr. Jones            │
│     Adherence (30 day): 100%         │
│                                      │
│  DISCONTINUED                        │
│  ─────────────────────────────────── │
│  3. Amoxicillin 500mg                │
│     Discontinued: Jan 15, 2026       │
│     Reason: Course completed         │
└──────────────────────────────────────┘
```

---

## Monetization

### Pricing

- **$4.99 one-time purchase** via App Store / Google Play (RevenueCat)
- **$4.99 one-time purchase** via direct sale (Lemon Squeezy)
- **No free tier, no subscription, no ads**
- All MyApps share the same $4.99 price point — simple, consistent pricing across the entire suite while remaining far cheaper than subscription alternatives

### Revenue Model

- Target: 75,000 paid downloads in year 1 = ~$318,000 gross (after App Store cut via Small Business Program)
- Medication tracking has high retention — users with chronic conditions use the app daily for years
- Word-of-mouth in chronic illness communities is exceptionally strong (patients share tools with other patients)
- Zero ongoing server costs — all data local, all processing on-device
- Interaction database maintenance cost is minimal (curated list, updated with app releases)

### Why $4.99

- Consistent with all MyApps at the same $4.99 price point — simple, memorable pricing across the suite
- Massively cheaper than Medisafe Premium ($4.99/month = $59.88/year)
- One-time purchase aligns with user trust — "I paid once, the app works for me, not for pharma companies"

---

## Marketing Angle

### One-Sentence Pitch

**"Nobody needs to know what you take."**

### Expanded Pitch

MyMeds is a $5 medication tracker that stores your entire medication list, dosage history, and adherence data on your device only. No accounts, no pharma partnerships, no data sharing — ever. Built for people who take medications they'd rather keep private: psychiatric drugs, HIV treatment, addiction therapy, or anything else that's nobody's business but yours and your doctor's.

### Target Communities

1. **r/pharmacy** (350K members) — Pharmacists and pharmacy workers understand medication privacy better than anyone. They know which apps share data and which don't. Credible endorsement from this community is worth more than any ad campaign.
2. **Chronic illness communities** — r/ChronicPain (130K), r/diabetes (250K), r/epilepsy (35K), r/rheumatoid (25K). These users take multiple daily medications and have the highest need for a reliable tracker. They also have the most to gain from a privacy-first approach.
3. **Mental health communities** — r/depression (950K), r/anxiety (650K), r/ADHD (2M), r/bipolar (150K). Psychiatric medication carries significant stigma. An app that guarantees medication privacy directly addresses these users' #1 concern about digital tracking.
4. **r/privacy** (1.7M members) — Same audience as MyCycle. Medication data is even more sensitive than period data.
5. **HIV advocacy organizations** — Antiretroviral adherence is clinically critical, and HIV medication privacy is a safety issue in many contexts. Partner with organizations like GLAAD, The Trevor Project, or local AIDS service organizations for credibility.
6. **Caregiver communities** — r/AgingParents, r/CaregiverSupport. Adult children managing parents' medications need a simple, trustworthy tool.

### Press-Worthy Elements

- **"Your medication list reveals your diagnoses"** — This framing turns a medication tracker into a privacy story. In a world of data breaches, your medication list is more sensitive than your browsing history or your location data.
- **Pharma industry contrast:** Medisafe's pharma partnerships are documented and controversial. "We built the medication tracker that pharma can't monetize" is a compelling narrative.
- **Source-available:** Code audit proves zero data exfiltration.
- **Interaction warnings without the cloud:** First consumer app to offer drug interaction checking that runs entirely on-device.
- **OCR without upload:** Prescription label scanning that never sends the image to a server — a concrete, demonstrable privacy feature.

---

## MVP Timeline

### Pre-Development (Week 0)
- Finalize design document
- Curate interaction database: source FDA interaction data, DrugBank open data, compile into SQLite
- Curate drug name autocomplete database: source from FDA NDC directory (public domain)
- Set up Turborepo monorepo (shared with other MyApps)
- Configure pnpm, TypeScript, ESLint, Prettier, CI

### Week 1: Data Layer + Reminder Engine
- Implement SQLite schema and migration system
- Build the shared reminder engine in `packages/shared/src/reminders/` (generic, not medication-specific)
- Implement local notification scheduling via expo-notifications
- Test notification delivery, snooze logic, and missed-dose auto-marking
- Build Zustand store with SQLite persistence
- Implement data export/import utilities

### Week 2: Medication Management
- Build medication list screen (Meds tab)
- Build add-medication flow (3-step: name+dosage → schedule → refill)
- Implement drug name autocomplete from bundled database
- Build medication detail/edit screen
- Implement discontinue and delete flows
- Build medication change history logging

### Week 3: Today View + Adherence
- Build Today tab timeline view (dose cards organized by time)
- Implement dose logging (Taken / Missed / Skipped) with notification integration
- Build notification action handlers (Taken and Snooze from notification)
- Build History tab calendar view with color-coded adherence
- Build adherence statistics (per-medication and overall, 7/30/90 day)
- Implement refill count tracking and refill alert notifications

### Week 4: Interaction Checking + OCR
- Integrate bundled interaction database
- Build interaction checking logic (triggered on medication add/edit)
- Build interaction warning UI (modal with severity, description, recommendation)
- Implement prescription label OCR:
  - iOS: Apple Vision framework native module
  - Android: ML Kit on-device text recognition
- Build camera capture UI with guided frame
- Build OCR result review/edit screen
- Test OCR accuracy across common pharmacy label formats

### Week 5: Privacy Features + PDF Export
- Implement notification privacy mode (hide medication names on lock screen)
- Implement optional app lock (Face ID / fingerprint via expo-local-authentication)
- Build PDF export (formatted medication list for doctor visits)
- Implement "Wipe All Data" with confirmation
- Exclude database from iCloud/Google backup
- Build onboarding flow (3 screens)

### Week 6: Web + Cross-Platform
- Port core UI to Next.js web app
- Cross-platform testing (iOS simulator, Android emulator, web)
- Accessibility pass (VoiceOver, TalkBack, dynamic type)
- Performance profiling (reminder scheduling with 10+ medications, interaction checking performance)
- Widget: simple "next dose" display on home screen

### Week 7: Polish + Distribution
- Notification reliability testing across iOS and Android
- Interaction database validation (spot-check 50 random interactions against clinical references)
- App Store screenshots and metadata
- Privacy policy and medical disclaimer pages
- RevenueCat IAP configuration
- Lemon Squeezy storefront
- Source-available repository setup (FSL license)
- Landing page

### Week 8: Launch
- Submit to App Store review
- Prepare launch content for target communities
- Draft press pitches (privacy + health angle)
- Outreach to pharmacy and chronic illness community moderators
- Launch day: community posts, press emails
- Monitor notification delivery reliability, crash-free rate, reviews

---

## Acceptance Criteria

The MVP is complete when ALL of the following are true:

### Functional — Medication Management
- [ ] User can add a medication with name, dosage, form, and frequency
- [ ] Drug name autocomplete works from the bundled database (top 200 US prescriptions minimum)
- [ ] User can set up complex schedules: once daily, twice daily, 3x daily, every X hours, specific days
- [ ] User can add special instructions (free text)
- [ ] User can edit any medication field; change is logged in medication history
- [ ] User can discontinue a medication (removed from schedule, preserved in history)
- [ ] User can delete a medication permanently (with confirmation)
- [ ] Medication list view shows all active medications with key info at a glance

### Functional — Reminders
- [ ] Local push notifications fire at scheduled dose times (tested on both iOS and Android)
- [ ] Notification shows medication name and dosage (or generic message in privacy mode)
- [ ] "Taken" action from notification logs the dose without opening the app
- [ ] "Snooze" action reschedules notification for configured snooze duration
- [ ] After max snoozes, dose is auto-marked as missed
- [ ] Notifications survive app kill and device restart
- [ ] User can manually mark a dose as taken, missed, or skipped from the Today view

### Functional — Adherence & History
- [ ] Today view shows all scheduled doses organized by time
- [ ] History calendar view color-codes days by adherence level
- [ ] Tapping a history day shows the detailed dose log
- [ ] Adherence statistics are computed correctly for 7, 30, and 90-day windows
- [ ] Per-medication and overall adherence rates are displayed

### Functional — Refills
- [ ] User can enter quantity dispensed when adding a medication
- [ ] Remaining count decrements automatically when a dose is logged as taken
- [ ] Refill alert notification fires when supply drops below threshold
- [ ] User can log a refill (resets remaining count)

### Functional — Interactions
- [ ] Bundled interaction database contains 500+ clinically significant drug-drug interactions
- [ ] When a new medication is added, it is checked against all active medications
- [ ] Interaction warnings display severity, description, and recommendation
- [ ] Interaction warnings include a medical disclaimer
- [ ] Interaction database version and date are visible in Settings

### Functional — OCR
- [ ] Camera opens in guided frame mode for prescription label scanning
- [ ] On-device OCR extracts medication name, dosage, and quantity from standard US pharmacy labels
- [ ] Extracted data is presented in an editable form for user confirmation
- [ ] No image is persisted to disk or transmitted over the network
- [ ] OCR works on both iOS (Vision framework) and Android (ML Kit)

### Functional — Data Management
- [ ] Export all data as CSV
- [ ] Export all data as JSON
- [ ] Export medication list as formatted PDF (printable for doctor visits)
- [ ] Import medication list from CSV
- [ ] Wipe all data with destructive confirmation

### Privacy
- [ ] Zero network requests confirmed via packet capture during full test session
- [ ] No analytics, crash reporting, or remote config SDKs in dependency tree
- [ ] SQLite database excluded from iCloud and Google backup
- [ ] No account creation, no email, no identifiers
- [ ] Notification privacy mode hides medication names on lock screen when enabled
- [ ] OCR images never written to disk or transmitted
- [ ] Interaction checking runs entirely on-device against bundled database
- [ ] Source code published under FSL license

### Quality
- [ ] App launches in <2 seconds
- [ ] Notifications are reliable across iOS and Android (tested over 7-day period)
- [ ] Drug name autocomplete responds in <100ms
- [ ] Interaction checking completes in <500ms for 10 medications
- [ ] VoiceOver and TalkBack fully navigate all screens
- [ ] Dynamic type / font scaling doesn't break layouts
- [ ] PDF export renders correctly and is readable when printed

### Distribution
- [ ] Available on iOS App Store
- [ ] Available on Google Play Store
- [ ] Web version functional (Next.js)
- [ ] RevenueCat IAP configured and tested
- [ ] Lemon Squeezy storefront live
- [ ] Landing page live with privacy statement and download links
- [ ] Medical disclaimer and privacy policy published
