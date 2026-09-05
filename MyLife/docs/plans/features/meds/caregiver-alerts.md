# Feature Spec: Caregiver Alerts

## Metadata
- **Module:** meds
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 1 x1 + PaidUser 4 x1
- **Sprint:** Sprint 3
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Reminders engine (built), adherence engine (built)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Caregiver alerts let a trusted family member or friend receive notifications when critical medications are missed. Medisafe's "Medfriend" feature is one of their top-3 paid differentiators ($39.99/yr) and drives 30%+ of premium conversions because caregivers (often adult children managing elderly parents' meds) are highly motivated payers. CareClinic ($119.88/yr) also positions caregiver access as a premium feature. MyLife can match this without cloud dependency by using on-device local notifications paired with a simple sharing mechanism (SMS/iMessage alert or shared device access).

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Medisafe | Yes | Yes ($39.99/yr) | "Medfriend" system: invite contacts via phone number, they get push notifications for missed doses. Cloud-based. |
| CareClinic | Yes | Yes ($119.88/yr) | Caregiver access: full dashboard view of patient's adherence, measurements, and reports. Cloud-based. |
| MyTherapy | Partial | Free | Can share adherence report via email. No real-time alerts. |
| MySugr | No | N/A | No caregiver features. |

### Target User
Adult children (ages 35-65) managing elderly parents' medication schedules. Specifically: Medisafe premium users paying $39.99/yr for Medfriend alerts who want the same functionality without their parent's health data being stored on Medisafe's cloud servers. Migration path: same caregiver alert functionality, but all health data stays on-device.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  caregiver/
    engine.ts                   -- NEW: Caregiver alert logic, contact management, alert generation
    __tests__/engine.test.ts    -- NEW: Engine tests
  db/
    caregiver.ts                -- NEW: CRUD for caregiver contacts and alert config
    schema.ts                   -- MODIFY: Add md_caregivers, md_caregiver_alerts tables
  models/
    caregiver.ts                -- NEW: Zod schemas for caregivers and alerts
    index.ts                    -- MODIFY: Export caregiver models
  definition.ts                 -- MODIFY: Add V4 migration
  index.ts                      -- MODIFY: Export caregiver engine + types
apps/mobile/app/(meds)/
  caregivers.tsx                -- NEW: Caregiver management screen
  add-caregiver.tsx             -- NEW: Add caregiver form
apps/web/app/meds/
  caregivers/page.tsx           -- NEW: Web caregiver management
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [Missed dose → triggers caregiver alert]
       ├── Settings tab
       │    └── Caregiver Alerts ← YOU ARE HERE
       │         ├── [Add Caregiver]
       │         ├── [Caregiver list with alert preferences]
       │         └── [Alert history]
       └── Medications tab
            └── [Per-medication caregiver toggle]
```

### Data Model

```sql
-- Caregiver contacts
CREATE TABLE IF NOT EXISTS md_caregivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  relationship TEXT CHECK (relationship IN ('spouse', 'parent', 'child', 'sibling', 'friend', 'doctor', 'nurse', 'other')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Alert configuration per caregiver-medication pair
CREATE TABLE IF NOT EXISTS md_caregiver_alert_config (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL REFERENCES md_caregivers(id) ON DELETE CASCADE,
  medication_id TEXT REFERENCES md_medications(id) ON DELETE CASCADE,
  alert_all_meds INTEGER NOT NULL DEFAULT 0,
  delay_minutes INTEGER NOT NULL DEFAULT 30,
  alert_method TEXT NOT NULL DEFAULT 'sms' CHECK (alert_method IN ('sms', 'email', 'both')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Alert history log
CREATE TABLE IF NOT EXISTS md_caregiver_alerts (
  id TEXT PRIMARY KEY,
  caregiver_id TEXT NOT NULL REFERENCES md_caregivers(id) ON DELETE CASCADE,
  medication_id TEXT REFERENCES md_medications(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('missed_dose', 'low_adherence', 'low_supply', 'custom')),
  message TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('sms', 'email')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Dependencies
- **Internal:** `@mylife/meds` reminders engine (for missed dose detection), adherence engine (for low adherence threshold alerts), refill tracker (for low supply alerts)
- **External:** `expo-sms` (iOS/Android SMS composition), `expo-mail-composer` (email fallback). No cloud push notifications -- alerts are composed on-device and sent via native share sheet.
- **Cross-Module:** None (self-contained within meds)

## Functional Requirements

### User Stories
1. As a caregiver, I want to be notified when my parent misses a critical medication so I can remind them or check on them.
2. As a patient, I want to add trusted contacts who receive alerts only for medications I choose so I maintain control over my health privacy.
3. As a patient, I want to set a delay before alerts fire (e.g., 30 minutes) so minor schedule variations do not trigger unnecessary alerts.
4. As a caregiver, I want to see a weekly adherence summary for the person I am caring for so I can bring concerns to their doctor.

### Behavior Specification

1. User navigates to Settings tab in MyMeds
2. User taps "Caregiver Alerts" section
3. User taps "Add Caregiver" button
4. User enters name, phone number or email, and relationship
5. System saves caregiver record to `md_caregivers`
6. User selects which medications trigger alerts (or "all medications")
7. User sets delay (15/30/60 minutes after missed dose)
8. User sets alert method (SMS, email, or both)
9. When a scheduled dose is missed (no `md_dose_logs` entry within delay window):
   a. System generates alert message: "[Patient name] missed their [time] dose of [medication name]"
   b. System opens native SMS/email composer with pre-filled message
   c. System logs the alert to `md_caregiver_alerts`
10. Weekly summary: every Sunday at configured time, system generates adherence summary for the past 7 days and offers to send to caregivers

### Edge Cases

- Caregiver has no phone number AND no email: block save, require at least one contact method
- User disables a medication that has caregiver alerts configured: deactivate those alert configs (do not delete)
- User deletes a medication: CASCADE deletes alert configs (via FK)
- User re-enables a medication: alert configs remain deactivated; user must re-enable manually
- Alert fires while phone is in airplane mode: log as "pending", retry on next app foreground
- Delay period set to 0 minutes: treat as "immediate" (fires as soon as dose window closes)
- Multiple caregivers for same medication: each gets independent alert
- User has no reminders set for a medication: caregiver alerts cannot fire (they depend on scheduled doses). Show warning: "Set up reminders first"
- Module disabled mid-use: alerts stop firing, data preserved

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** User can add a caregiver with name + phone/email + relationship from Settings
- [ ] **AC-2:** User can select specific medications or "all" for each caregiver
- [ ] **AC-3:** User can set alert delay (15/30/60 min options)
- [ ] **AC-4:** When a dose is missed beyond the delay window, the SMS/email composer opens with pre-filled alert message
- [ ] **AC-5:** User can view alert history showing sent/pending/failed alerts with timestamps
- [ ] **AC-6:** User can deactivate a caregiver without deleting (toggle)
- [ ] **AC-7:** User can delete a caregiver and all associated alert configs are removed
- [ ] **AC-8:** Weekly adherence summary can be composed and shared with selected caregivers
- [ ] **AC-9:** Per-medication caregiver toggle visible on medication detail screen

### Technical Criteria
- [ ] **TC-1:** `md_caregivers` table created in V4 migration with correct constraints
- [ ] **TC-2:** `md_caregiver_alert_config` table created with FK to caregivers and medications
- [ ] **TC-3:** `md_caregiver_alerts` log table tracks all generated alerts with status
- [ ] **TC-4:** Alert generation runs within <100ms (just message composition, no network)
- [ ] **TC-5:** Caregiver CRUD operations persist correctly across app restart
- [ ] **TC-6:** Weekly summary aggregates adherence data from `getAdherenceStats()` for 7-day window
- [ ] **TC-7:** Alert delay timer integrates with existing reminder scheduler

### Negative Criteria
- [ ] **NC-1:** Caregiver alerts must NOT send data to any cloud service -- all alert composition happens on-device
- [ ] **NC-2:** Caregiver contacts must NOT be accessible from other modules
- [ ] **NC-3:** Alert system must NOT fire for medications without active reminders
- [ ] **NC-4:** Deleting a caregiver must NOT affect dose logs, adherence history, or medication records

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#06B6D4` (meds cyan)
- Caregiver list: glass cards with avatar placeholder (first initial), name, relationship badge, active toggle
- Add form: full-screen modal with name, phone (with country picker), email, relationship dropdown
- Alert history: timeline-style list with status badges (sent=green, pending=yellow, failed=red)

### Web (Next.js)
- Same tokens via CSS variables in `globals.css`
- Sidebar navigation: `/meds/caregivers`
- Two-column layout: caregiver list (left), detail/config panel (right)
- Alert history as sortable table with status column

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards for caregiver list | Initial data fetch |
| Empty | "No caregivers added yet" + "Add your first caregiver" CTA | No caregiver records |
| Error | "Could not load caregivers" + retry button | Database read fails |
| Success | List of caregiver cards with toggles and alert counts | Data loaded |
| Partial | Caregiver added but no medications assigned | Incomplete setup |

## Test Requirements

### Unit Tests
- [ ] `addCaregiver`: creates record with valid name + phone
- [ ] `addCaregiver`: rejects when neither phone nor email provided
- [ ] `generateAlertMessage`: formats correct message with medication name and time
- [ ] `shouldFireAlert`: returns true when dose missed beyond delay window
- [ ] `shouldFireAlert`: returns false when dose logged within delay window
- [ ] `shouldFireAlert`: returns false when caregiver is deactivated
- [ ] `getWeeklySummary`: aggregates 7-day adherence for all caregiver-linked medications
- [ ] `deactivateCaregiver`: sets is_active to 0, preserves alert configs

### Integration Tests
- [ ] Full flow: add caregiver -> assign medication -> miss dose -> alert generated
- [ ] Error flow: add caregiver without contact info -> validation error shown
- [ ] Cascade: delete medication -> alert configs removed -> caregiver still exists

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyMeds -> Settings
3. Tap "Caregiver Alerts"
4. Verify: empty state with "Add your first caregiver" CTA -- corresponds to AC-1
5. Tap "Add Caregiver"
6. Enter: name "Mom", phone "555-0100", relationship "parent"
7. Tap Save
8. Verify: caregiver card appears with name, phone, relationship badge -- AC-1
9. Tap caregiver card to configure alerts
10. Select "Lisinopril" from medication list
11. Set delay to 30 minutes
12. Set method to SMS
13. Verify: config saved, medication shows under caregiver -- AC-2, AC-3
14. Go to Today tab
15. Let a scheduled dose for Lisinopril pass without logging (wait 30+ min or adjust time)
16. Verify: SMS composer opens with message "[Name] missed their [time] dose of Lisinopril" -- AC-4
17. Navigate back to caregiver alert history
18. Verify: alert logged with "sent" status and timestamp -- AC-5
19. Toggle caregiver to inactive
20. Verify: caregiver grayed out, no future alerts fire -- AC-6
21. Delete caregiver
22. Verify: caregiver removed, alert configs gone, medication records unchanged -- AC-7, NC-4
23. Repeat steps 3-10 on web at `/meds/caregivers`

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to `/meds/caregivers`, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for alert generation engine

### Post-merge:
- [ ] `/parity-check` -- if module has standalone counterpart

## Handoff State

### Before This Work
The meds module has reminders (`md_reminders`), dose logging (`md_dose_logs`), and adherence analytics but no way to notify external contacts about missed doses. Alert information stays entirely within the app.

### After This Work
Caregivers can be registered, assigned to specific medications, and automatically receive SMS/email alerts when doses are missed. Alert history is persisted. Weekly adherence summaries can be shared. All alert composition happens on-device -- no cloud dependency.

### Files Changed
- `modules/meds/src/caregiver/engine.ts` -- Alert generation, message formatting, delay logic
- `modules/meds/src/caregiver/__tests__/engine.test.ts` -- Engine tests
- `modules/meds/src/db/caregiver.ts` -- CRUD for caregivers, alert configs, alert logs
- `modules/meds/src/db/schema.ts` -- V4 table definitions
- `modules/meds/src/models/caregiver.ts` -- Zod schemas
- `modules/meds/src/models/index.ts` -- Re-export caregiver models
- `modules/meds/src/definition.ts` -- V4 migration
- `modules/meds/src/index.ts` -- Export caregiver API
- `apps/mobile/app/(meds)/caregivers.tsx` -- Caregiver management screen
- `apps/mobile/app/(meds)/add-caregiver.tsx` -- Add caregiver form
- `apps/web/app/meds/caregivers/page.tsx` -- Web caregiver management

### Known Limitations
- Alerts use native SMS/email composer, not push notifications. The app must be running (foreground or background) to detect missed doses and compose alerts.
- No real-time dashboard for caregivers (that would require cloud infrastructure). Caregivers receive point-in-time alerts, not a live view.
- Weekly summary is user-initiated (tap to compose and send), not automatically dispatched.

### Context for Next Agent
- The caregiver alert system depends on the reminder scheduler detecting missed doses. The key integration point is `getDoseLogsForDate()` from `reminders/` -- if no log exists for a scheduled time after the delay window, an alert should fire.
- SMS composition uses `expo-sms` which requires a physical device or simulator with Messages app configured. Tests should mock the SMS API.
- The V4 migration adds 3 new tables. Check `definition.ts` for migration ordering.
