# Medisafe vs MyMeds: Competitor Feature Comparison

**Date:** 2026-03-29
**Source:** Hands-on app walkthrough (11 min screen recording, 337 frames extracted)
**Reviewer:** Claude Code
**Module:** MyMeds (`modules/meds/`, `apps/mobile/app/(meds)/`)
**Competitor:** Medisafe iOS app (free tier)

## Summary

Medisafe is a polished medication management app with 5M+ users, focused on medication reminders, adherence tracking, and caregiver coordination. Its core UX centers on a **unified daily timeline** that intermixes medications, appointments, and health tracker entries chronologically. The onboarding is a guided 10-step wizard that captures user profile, goals, and first medication before showing the home screen. MyMeds already has extensive feature coverage (29 mobile screens, 13+ database tables), but the hands-on review reveals UX-level gaps in onboarding polish, daily workflow efficiency, and data export/sharing flows that theoretical analysis missed.

## Feature-by-Feature Comparison

### Onboarding & Setup

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 1 | Welcome screen with branding + trust signals | HIPAA badge, hero image | Basic module entry | PARTIAL |
| 2 | Multi-step profile wizard (name, gender, DOB) | 10-step guided flow with progress bar | No guided onboarding | NO |
| 3 | Goals selection (multi-select: reminders, tracking, interactions, etc.) | 7 goal options, multi-select | No goals capture | NO |
| 4 | Account creation (skippable, email/password) | Skippable with backup framing | N/A (MyLife handles auth) | N/A |
| 5 | "Add my med" vs "Import meds" fork | Both options on welcome complete | Has add-med screen | PARTIAL |
| 6 | Age verification (18+ required) | Enforced during onboarding | Not present | NO |

### Medication Management

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 7 | Drug database search with autocomplete | Extensive DB with brand names, chemical variants | Has add-med but likely simpler | PARTIAL |
| 8 | Medication form selection (tablet, chew, solution, injection, spray, etc.) | 10+ form types | Need to verify | PARTIAL |
| 9 | Route of administration (oral, injection, topical, inhaled, etc.) | 6 route options | Need to verify | PARTIAL |
| 10 | Brand name selection with known brands per drug | Brand suggestions per generic | Need to verify | PARTIAL |
| 11 | Condition assignment per med ("What are you taking it for?") | Searchable conditions list | Need to verify | PARTIAL |
| 12 | Treatment duration (5d/1w/10d/30d/custom/end date/ongoing) | Full duration options | Need to verify | PARTIAL |
| 13 | Rx Number (prescription number) field | Optional field with explanation | Need to verify | PARTIAL |
| 14 | Custom med appearance/icon | Visual med icons (powder, pill, etc.) | Need to verify | PARTIAL |
| 15 | Dose scheduling with multi-dose support | Per-dose time picker, "second dose" flow | Has scheduling in add-med | YES |
| 16 | Dosage units (packet, tablet, ml, etc.) with editability | Editable units | Need to verify | PARTIAL |
| 17 | Import meds from health records | "Import My Meds" feature | Not present | NO |

### Daily Workflow (Home Screen)

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 18 | Week calendar strip with day selection | Sun-Sat strip, today highlighted in teal | Has some calendar | PARTIAL |
| 19 | Unified daily timeline (meds + appointments + trackers) | Chronological view mixing all event types | Separate screens per feature | NO |
| 20 | Dose quick actions (Skip / Take / Reschedule) | 3-button modal from tapping any dose | Need to verify | PARTIAL |
| 21 | Dose status indicators (taken with green check, pending, missed) | Visual icons per dose | Need to verify | PARTIAL |
| 22 | Home screen style selection (Timeline / Square pillbox / Round pillbox) | 3 layouts with preview | Single layout | NO |
| 23 | "Suggested for you" personalized section | Contextual tips and suggestions | Not present | NO |
| 24 | Dose progress summary ("1 out of 2 dose(s) marked for today") | Progress ring with count | Need to verify | PARTIAL |

### Refills & Stock

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 25 | Medication stock count ("4 packets left") | Shown on med cards and dose modal | Has refills screen | YES |
| 26 | Add-stock dialog (update refill count) | Numeric input to add packets | Need to verify | PARTIAL |
| 27 | Refill reminder with configurable threshold | "Remind me when I have 5 packets left" | Has refills screen | YES |
| 28 | Refills feature intro screen | "Stay on Top of Your Meds" value prop | Not present | NO |

### Health Trackers

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 29 | Configurable health trackers (Weight, Body Fat, Calories, etc.) | Searchable tracker catalog, recommended list | Has measurement-trends | PARTIAL |
| 30 | Health tracker reminder frequency (daily/weekly/monthly) | Per-tracker configurable | Need to verify | PARTIAL |
| 31 | Tracker cards with "More info" and "Track" buttons | Card-based UI with last-tracked timestamp | Need to verify | PARTIAL |
| 32 | Calories Consumed tracker | Dedicated tracker with "Add entry" | Not present (use MyNutrition) | N/A |
| 33 | Weight tracker with value display (200 Pounds) | Shows current value + timestamp | Need to verify | PARTIAL |
| 34 | "Add more trackers" CTA on Updates tab | Prominent add button | Need to verify | PARTIAL |

### Appointments

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 35 | Appointment scheduling (title + date picker) | Multi-step add appointment flow | Not present | NO |
| 36 | Appointments in home timeline | Mixed with med doses chronologically | Not present | NO |
| 37 | Calendar sync with iOS Calendar | "Sync with Calendar" prompt | Not present | NO |
| 38 | Appointment intro screen with value prop | "Manage all your healthcare appointments" | Not present | NO |

### Interactions

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 39 | Drug interaction search | Search any drug + select from your meds | Has interactions screen | YES |
| 40 | Brand-specific interaction results | Walgreens Zinc 13.3mg, GNP Zinc 50mg, etc. | Need to verify | PARTIAL |
| 41 | Legal disclaimer for interaction info | Full disclaimer dialog | Need to verify | PARTIAL |

### Reports & Export

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 42 | Weekly adherence ring (percentage) | Visual ring with % and date range | Has adherence screen | YES |
| 43 | Day-by-day MISSED/TAKEN breakdown | Per-day counts with med icons | Need to verify | PARTIAL |
| 44 | CSV export via email (ExcelReport.csv) | "Send status report" button | Need to verify | PARTIAL |
| 45 | Medication list export via email | Formatted email with active meds + dosage | Need to verify | PARTIAL |
| 46 | "Last Week" / "All Meds" report tabs | Tabbed report views | Has reports screen | YES |

### Diary & Notes

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 47 | Notes/Diary feature | Simple text notes with timestamps | Not present as standalone | NO |
| 48 | Diary list with green dot indicator | Chronological list with date | Not present | NO |

### Contacts

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 49 | Healthcare contacts directory | Doctor, Pharmacy, Emergency, Insurance, Clinic, Other | Has caregivers screen only | PARTIAL |
| 50 | Contact type categorization with icons | 6 types with distinct icons | Caregivers only | PARTIAL |

### Notifications & Alerts

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 51 | Critical Alerts (bypass DND/mute) | iOS Critical Alerts for missed doses | Not present (needs expo-notifications) | DEFERRED |
| 52 | Custom notification sounds (Medtones) | 10+ themed sounds (Star Wars, Dr Evil, etc.) | Not present (needs expo-notifications) | DEFERRED |
| 53 | Customize notification message text | Custom message template | Not present | DEFERRED |
| 54 | Snooze time configuration | Configurable snooze duration | Not present | DEFERRED |
| 55 | Show Med Names on notification | Toggle for privacy | Not present | DEFERRED |
| 56 | Morning Reminder toggle | Daily morning medication summary | Not present | DEFERRED |
| 57 | Notification permission prompt with explanation | Bell animation + value prop | Not present | DEFERRED |

### Settings & Account

| # | Feature | Medisafe | MyMeds | Gap |
|---|---------|----------|--------|-----|
| 58 | Manage Users (family profiles) | Multi-user support | Has caregivers screen | PARTIAL |
| 59 | Passcode lock | Toggle for app lock | Not present | NO |
| 60 | Language selection | Multi-language support | N/A (MyLife handles) | N/A |
| 61 | Premium upgrade screen | Premium features upsell | N/A (MyLife subscription) | N/A |
| 62 | Share app | "Share Medisafe" | N/A | N/A |
| 63 | Help Center | In-app help | Not present | NO |
| 64 | Notification tutorial (3 methods) | Visual guide with device screenshots | Not present | NO |

## Where MyMeds EXCEEDS Medisafe

| Feature | MyMeds | Medisafe |
|---------|--------|----------|
| Blood pressure logging with AHA classification | Full BP suite (log, history, trends) | Basic measurement only |
| Blood glucose + insulin tracking | Dedicated glucose + insulin screens | Measurement tracker only |
| A1c calculator/estimator | Dedicated a1c screen | Not present |
| Mood tracking + check-in | Full mood suite with check-in flow | Not present |
| Symptom-medication correlation engine | Pearson correlation analytics | Not present |
| FODMAP tracking | Dedicated fodmap screen | Not present |
| Pain location body map | Interactive pain-map screen | Not present |
| Weather-barometric pressure correlation | Dedicated weather screen | Not present |
| CGM integration screen | Dedicated cgm screen | Premium measurement only |
| Wellness dashboard | Dedicated wellness screen | Not present |
| Privacy-first (zero telemetry) | All data local, no pharma sharing | Partners with pharma companies |
| 29 screens total | Comprehensive health suite | 4-tab focused app |

## Gap Prioritization

### P0 - Retention Critical (users notice immediately)

| Gap | Description | Effort | Deferred? |
|-----|-------------|--------|-----------|
| Unified daily timeline | Mix meds + appointments + trackers chronologically on home screen | Large | No |
| Dose quick actions (Skip/Take/Reschedule) | 3-button modal when tapping a scheduled dose | Medium | No |
| Appointments scheduling | Add appointment with title + date, show in timeline | Medium | No |

### P1 - Competitive Parity (users expect from a med app)

| Gap | Description | Effort | Deferred? |
|-----|-------------|--------|-----------|
| Healthcare contacts directory | Doctor/Pharmacy/Emergency/Insurance/Clinic contacts | Small | No |
| Notes/Diary feature | Simple timestamped notes for medication journal | Small | No |
| Medication list email export | Format and share active meds list via email/share sheet | Small | No |
| Help/FAQ screen | Basic in-app help content | Small | No |
| Home screen style selection | Timeline vs pillbox layouts | Large | Yes (polish) |
| Passcode lock | App-level passcode for privacy | Medium | Yes (needs biometrics) |

### P2 - Nice to Have

| Gap | Description | Effort | Deferred? |
|-----|-------------|--------|-----------|
| Guided onboarding wizard | Multi-step profile + goals + first med setup | Large | Yes |
| Import meds feature | Import from health records or other apps | Large | Yes (needs HealthKit) |
| CSV adherence export | Export adherence data as CSV file | Small | No |
| Calendar sync | Sync appointments with iOS Calendar | Medium | Yes (needs calendar API) |

### Out of Scope

| Feature | Reason |
|---------|--------|
| Critical Alerts (bypass DND) | Requires expo-notifications with specific iOS entitlement |
| Custom notification sounds (Medtones) | Requires expo-notifications custom sound support |
| Notification customization settings | Requires expo-notifications |
| Morning Reminder | Requires expo-notifications |
| Drug database search | Would need external API (FDA/RxNorm) |
| Premium/subscription features | Handled by MyLife hub subscription |

## Resolution Status (2026-03-29)

| Gap | Priority | Status | Screen |
|-----|----------|--------|--------|
| Appointments scheduling | P0 | BUILT | `appointments.tsx` |
| Healthcare contacts directory | P0 | BUILT | `contacts.tsx` |
| Notes/Diary feature | P0 | BUILT | `diary.tsx` |
| Medication list export | P1 | BUILT | `export.tsx` |
| Report sharing (Share button) | P1 | BUILT | `reports.tsx` (wired Share) |
| Guided onboarding wizard | P2 | Deferred | Large effort, polish feature |
| Import meds | P2 | Deferred | Needs HealthKit |
| Calendar sync | P2 | Deferred | Needs calendar API |
| Home screen styles | P1 | Deferred | Polish feature |
| Passcode lock | P1 | Deferred | Needs biometrics |
| Notifications (Critical, Medtones, etc.) | Out of scope | Deferred | Needs expo-notifications |
| Drug database search | Out of scope | Deferred | Needs external API |

**Total: 5 built, 4 deferred (polish/dependency), 3 out of scope**

## Screenshot Reference

Labeled screenshots organized by feature category:
```
docs/competitor-analysis/medisafe-screens/labeled/
  onboarding/       - Welcome, profile, goals screens
  home/              - Home timeline with meds + appointments
  medications/       - Medications tab, med cards
  updates/           - Updates tab with dose progress
  manage/            - Manage tab with settings access
  settings/          - Settings, notification sounds, home style
  med-setup/         - Drug search, form, route, duration, Rx number
  dose-actions/      - Skip/Take/Reschedule modal
  health-trackers/   - Weight, calories, tracker search
  appointments/      - Add appointment, calendar sync
  interactions/      - Interactions checker with search
  reports/           - Adherence ring, day-by-day breakdown
  diary-notes/       - Add note, diary list
  contacts/          - Contact type selection
  refills/           - Refill intro, stock management
```
