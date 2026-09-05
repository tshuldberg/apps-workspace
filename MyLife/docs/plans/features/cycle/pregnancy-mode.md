# Feature Spec: Pregnancy Mode

## Metadata
- **Module:** cycle
- **Priority Score:** 38 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** 5
- **Estimated CC Time:** 3-4 hours
- **Depends On:** none (standalone mode toggle on existing module)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Pregnancy mode transforms the cycle tracker into a pregnancy companion when the user conceives. Flo (440M registered users, $275M revenue) and Ovia (free, fertility/pregnancy focus) both offer pregnancy modes that retain users through a 40-week journey instead of losing them when they stop cycling. Without pregnancy mode, MyCycle becomes irrelevant for 9+ months. With it, the module provides week-by-week tracking, due date countdown, symptom logging adapted to pregnancy context, and appointment tracking, keeping users engaged and subscribed through a major life event.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Flo | Yes | Yes ($49.99/yr) | Full pregnancy mode with week-by-week fetal development, symptom tracker, contraction timer, postpartum mode |
| Ovia | Yes | No (free) | Pregnancy + fertility focus, week-by-week guides, health insights, community |
| Clue | Partial | Yes ($39.99/yr) | Pregnancy tracking added recently, less mature than Flo |
| Natural Cycles | Yes | Yes ($89.99/yr) | "Plan Pregnancy" mode, follows same BBT tracking but flips fertile window from "avoid" to "try" |

### Target User
Users who have been tracking their cycle with MyCycle and become pregnant. Instead of switching to a dedicated pregnancy app (Ovia, What to Expect, BabyCenter), they stay in the MyCycle ecosystem. Also targets users who are actively trying to conceive (TTC) and want a seamless transition from cycle tracking to pregnancy tracking when conception occurs.

## Technical Context

### Where This Lives in MyLife

```
modules/cycle/src/types.ts                  -- New schemas: PregnancyConfig, PregnancyWeek, Appointment
modules/cycle/src/db/schema.ts              -- New tables: cy_pregnancy_config, cy_appointments
modules/cycle/src/db/crud.ts                -- Pregnancy CRUD functions
modules/cycle/src/engine/pregnancy.ts       -- Week calculator, trimester logic, due date
modules/cycle/src/definition.ts             -- Migration version 3 (or 2 if temp not yet shipped)
modules/cycle/src/data/pregnancy-weeks.ts   -- Static week-by-week data (fetal size, development notes)
modules/cycle/src/index.ts                  -- Export new functions and types
apps/mobile/app/(cycle)/                    -- Conditional rendering: pregnancy dashboard vs cycle view
apps/web/app/cycle/                         -- Web equivalent (when wired)
```

### Wireframe Position

```
Hub Dashboard
  └── MyCycle card (label changes to "MyCycle - Week 24" when pregnant)
       └── [PREGNANCY MODE ACTIVE]
            └── Pregnancy Dashboard ← YOU ARE HERE (replaces Today tab)
                 ├── Week progress ring + due date countdown
                 ├── Baby size comparison ("Your baby is the size of a mango")
                 ├── Symptom logging (pregnancy-specific symptoms)
                 └── Appointments list
            └── Timeline tab (replaces Calendar)
                 └── Week-by-week pregnancy timeline
            └── Insights tab
                 └── Pregnancy stats + weight tracking
            └── Settings tab
                 └── "End pregnancy" / "Switch back to cycle mode"
```

### Data Model

```sql
-- Pregnancy configuration (one active row at a time)
CREATE TABLE IF NOT EXISTS cy_pregnancy_config (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',   -- active | completed | loss
  start_method TEXT NOT NULL,              -- last_period | conception_date | due_date | transfer_date
  last_period_date TEXT,                   -- used for Naegele's rule calculation
  conception_date TEXT,                    -- if known
  due_date TEXT NOT NULL,                  -- calculated or user-provided
  actual_end_date TEXT,                    -- when pregnancy ended (birth, loss, etc.)
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Appointments (prenatal visits, ultrasounds, etc.)
CREATE TABLE IF NOT EXISTS cy_appointments (
  id TEXT PRIMARY KEY,
  pregnancy_id TEXT NOT NULL REFERENCES cy_pregnancy_config(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,                               -- HH:MM format
  location TEXT,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS cy_preg_status_idx ON cy_pregnancy_config(status);
CREATE INDEX IF NOT EXISTS cy_appt_preg_idx ON cy_appointments(pregnancy_id);
CREATE INDEX IF NOT EXISTS cy_appt_date_idx ON cy_appointments(date ASC);
```

**New Zod schemas:**

```typescript
export const PregnancyStatusSchema = z.enum(['active', 'completed', 'loss']);
export type PregnancyStatus = z.infer<typeof PregnancyStatusSchema>;

export const PregnancyStartMethodSchema = z.enum([
  'last_period',
  'conception_date',
  'due_date',
  'transfer_date',
]);
export type PregnancyStartMethod = z.infer<typeof PregnancyStartMethodSchema>;

export const PregnancyConfigSchema = z.object({
  id: z.string(),
  status: PregnancyStatusSchema,
  startMethod: PregnancyStartMethodSchema,
  lastPeriodDate: z.string().nullable(),
  conceptionDate: z.string().nullable(),
  dueDate: z.string(),
  actualEndDate: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PregnancyConfig = z.infer<typeof PregnancyConfigSchema>;

export const AppointmentSchema = z.object({
  id: z.string(),
  pregnancyId: z.string(),
  title: z.string(),
  date: z.string(),
  time: z.string().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  completed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Appointment = z.infer<typeof AppointmentSchema>;

export const PregnancyWeekInfoSchema = z.object({
  week: z.number().int().min(1).max(42),
  trimester: z.number().int().min(1).max(3),
  babySize: z.string(),           // "blueberry", "lemon", "mango", etc.
  babySizeCm: z.number(),
  developmentHighlight: z.string(), // One-line development note
});
export type PregnancyWeekInfo = z.infer<typeof PregnancyWeekInfoSchema>;
```

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), existing cy_cycle_days/cy_symptoms for continued symptom logging
- **External:** None. All data local.
- **Cross-Module:** Health module wellness timeline could show pregnancy milestones. Meds module could flag pregnancy-unsafe medications (future enhancement). Nutrition module could surface pregnancy nutrition guidance (future).

## Functional Requirements

### User Stories
1. As a user who just got pregnant, I want to switch MyCycle to pregnancy mode so that I get week-by-week tracking instead of period predictions.
2. As a pregnant user, I want to see my current week, due date countdown, and baby size comparison so that I can follow my pregnancy progression.
3. As a pregnant user, I want to log pregnancy-specific symptoms (morning sickness, fatigue, back pain, etc.) so that I can track how I feel throughout pregnancy.
4. As a pregnant user, I want to track prenatal appointments so that I never miss a checkup.
5. As a user whose pregnancy ended, I want to end pregnancy mode and return to cycle tracking with sensitivity and without data loss.

### Behavior Specification

**Entering pregnancy mode:**
1. User navigates to MyCycle Settings tab
2. User taps "I'm pregnant" button
3. System presents a setup flow:
   a. "How would you like to calculate your due date?"
      - Last menstrual period (LMP) date -- Naegele's rule: LMP + 280 days
      - Known conception date -- conception + 266 days
      - Due date from doctor -- enter directly
      - IVF transfer date -- transfer + 266 days (or adjusted by embryo age)
   b. User enters the relevant date
   c. System calculates and displays the due date
   d. User confirms
4. System creates a cy_pregnancy_config row with status 'active'
5. MyCycle UI switches to pregnancy mode:
   - Today tab becomes Pregnancy Dashboard
   - Calendar tab becomes Timeline (week-by-week)
   - Hub Dashboard card shows "MyCycle - Week [N]" with due date
   - Cycle predictions and fertile window are suspended

**Pregnancy dashboard (Today tab replacement):**
1. Top section: circular progress ring showing weeks completed out of 40
2. "Week [N] of 40" with trimester label (Trimester 1: weeks 1-13, Trimester 2: weeks 14-27, Trimester 3: weeks 28-40+)
3. Due date countdown: "[X] days until due date"
4. Baby size comparison: "Your baby is about the size of a [fruit/object]" with an illustration/emoji
5. Quick-log buttons for common pregnancy symptoms
6. Upcoming appointments list (next 3)

**Symptom logging in pregnancy mode:**
1. Same cy_symptoms table but with pregnancy-adapted symptom list
2. Pregnancy symptoms replace the standard cycle symptom options:
   - Physical: morning_sickness, fatigue, back_pain, heartburn, swelling, round_ligament_pain, braxton_hicks, insomnia, constipation, frequent_urination
   - Mood: anxious, excited, overwhelmed, nesting, emotional, calm
3. Symptoms still have mild/moderate/severe intensity
4. Existing symptom CRUD functions work unchanged; only the symptom constants differ in the UI

**Appointments:**
1. User taps "Add Appointment" on the dashboard or Timeline
2. Enters: title (e.g., "20-week ultrasound"), date, optional time, optional location, optional notes
3. System saves to cy_appointments
4. Appointments appear in date order on both dashboard (next 3) and Timeline (all)
5. User can mark appointments as completed
6. User can edit or delete appointments

**Timeline (Calendar tab replacement):**
1. Vertical scrollable timeline showing weeks 1 through 40+
2. Each week shows:
   - Week number + trimester badge
   - Baby development highlight (from static data)
   - Any logged symptoms for that week
   - Any appointments for that week
3. Current week is highlighted and auto-scrolled to

**Ending pregnancy mode:**
1. User navigates to Settings tab
2. User taps "End pregnancy tracking"
3. System asks sensitively: "How would you like to proceed?"
   - "Baby arrived" -- sets status to 'completed', records actual_end_date
   - "Pregnancy loss" -- sets status to 'loss', records actual_end_date
   - "Cancel" -- returns to pregnancy mode
4. On confirmation, pregnancy mode deactivates:
   - Cycle tracking UI returns
   - All pregnancy data is preserved (not deleted)
   - A new cycle can be started when the user is ready
5. Historical pregnancy data remains viewable in Insights (past pregnancies section)

### Edge Cases

- **Already in pregnancy mode, user taps "I'm pregnant" again:** Button is hidden/disabled while pregnancy mode is active.
- **Due date in the past:** Allowed (user might enter data retroactively). Week calculation shows week 40+ with "past due date" label.
- **Week > 42:** Cap display at "42+ weeks" with a note that the due date has passed.
- **LMP date more than 280 days ago:** Show a warning "This date suggests you may be past your due date. Is this correct?" with confirm/edit options.
- **No appointments logged:** Appointments section shows empty state: "No upcoming appointments. Tap to add one."
- **User ends pregnancy then gets pregnant again:** A new cy_pregnancy_config row is created. Previous pregnancy data is preserved with status 'completed' or 'loss'.
- **Module disabled during pregnancy:** Pregnancy config is preserved. Re-enabling restores pregnancy mode.
- **Symptom data during pregnancy:** Uses the same cy_symptoms table. When switching back to cycle mode, pregnancy-period symptoms are still visible in history.
- **User wants to change due date:** Allow editing the due date in Settings at any time (doctors sometimes adjust). Update cy_pregnancy_config.due_date.
- **Very early pregnancy (week 1-4):** Baby size data starts at week 4 ("poppy seed"). Weeks 1-3 show "Too early to measure."

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Tapping "I'm pregnant" in Settings opens a setup flow with 4 due date calculation methods
- [ ] **AC-2:** Entering a last period date calculates and displays the correct due date (LMP + 280 days)
- [ ] **AC-3:** After confirming, the Today tab transforms into a Pregnancy Dashboard showing current week and due date countdown
- [ ] **AC-4:** Baby size comparison text matches the current week of pregnancy
- [ ] **AC-5:** Trimester label updates correctly: weeks 1-13 = Trimester 1, 14-27 = Trimester 2, 28+ = Trimester 3
- [ ] **AC-6:** Pregnancy symptom list replaces the standard cycle symptom options in the log
- [ ] **AC-7:** Adding an appointment shows it on the dashboard (next 3) and Timeline
- [ ] **AC-8:** Marking an appointment as completed shows a checkmark and moves it to the completed section
- [ ] **AC-9:** Timeline shows all 40 weeks with development highlights and any logged data
- [ ] **AC-10:** Hub Dashboard card shows "MyCycle - Week [N]" during pregnancy
- [ ] **AC-11:** Tapping "End pregnancy tracking" presents options with appropriate sensitivity ("Baby arrived" / "Pregnancy loss")
- [ ] **AC-12:** After ending pregnancy, cycle tracking mode returns and all pregnancy data is preserved
- [ ] **AC-13:** Due date can be edited from Settings after initial setup
- [ ] **AC-14:** Period predictions and fertile window are NOT shown during pregnancy mode

### Technical Criteria
- [ ] **TC-1:** cy_pregnancy_config table is created by migration with correct schema
- [ ] **TC-2:** cy_appointments table is created with correct foreign keys and indexes
- [ ] **TC-3:** Only one pregnancy config can have status='active' at a time (enforced in code)
- [ ] **TC-4:** Due date calculation from LMP uses Naegele's rule (LMP + 280 days) correctly
- [ ] **TC-5:** Due date calculation from conception date uses conception + 266 days correctly
- [ ] **TC-6:** Week calculation: floor((today - LMP) / 7) + 1, handles timezone correctly
- [ ] **TC-7:** Pregnancy week data (static) covers weeks 1-42 with sizes and development highlights
- [ ] **TC-8:** Appointment CRUD (create, get, update, delete, mark complete) functions work correctly
- [ ] **TC-9:** Ending pregnancy sets status and actual_end_date without deleting any data

### Negative Criteria
- [ ] **NC-1:** Pregnancy data must NOT be deleted when ending pregnancy mode
- [ ] **NC-2:** Cycle predictions must NOT run while pregnancy mode is active
- [ ] **NC-3:** Pregnancy data must NOT be sent over the network
- [ ] **NC-4:** The word "miscarriage" must NOT appear in the UI; use "pregnancy loss" for sensitivity

## UI Specification

### Mobile (Expo)

**Pregnancy Dashboard:**
- Background: `#0A0A0F` (background token)
- Week progress ring: large circular indicator, `#F472B6` accent fill, `rgba(255,255,255,0.06)` track
- Due date countdown: `#F0F0F5` text, large font
- Baby size card: glass card (`rgba(255,255,255,0.04)`) with fruit/object emoji and size text
- Symptom quick-log: pill-shaped buttons in `rgba(255,255,255,0.08)` (glassStrong), `#F472B6` when selected
- Appointments: list items in glass cards, `#30D158` (success) checkmark for completed

**Timeline:**
- Vertical scroll with week markers
- Current week has `#F472B6` accent border
- Past weeks: `rgba(240,240,245,0.65)` (textSecondary) text
- Future weeks: `rgba(255,255,255,0.06)` (border) faded

### Web (Next.js)
- Same tokens via CSS variables
- Pregnancy dashboard at `/cycle` route (replaces cycle view when pregnant)
- Timeline as a scrollable vertical list
- Appointments with date picker for scheduling

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton cards in dashboard | Initial data fetch |
| Empty (no pregnancy) | Standard cycle tracking UI with "I'm pregnant" option in Settings | No active pregnancy |
| Active pregnancy | Full pregnancy dashboard with week/countdown/size | Active pregnancy config |
| Past due | Week 40+ with "past due date" indicator | Current date > due date |
| Ended - birth | Cycle mode returns, pregnancy data in history | Status set to 'completed' |
| Ended - loss | Cycle mode returns, pregnancy data in history, gentle messaging | Status set to 'loss' |

## Test Requirements

### Unit Tests
- [ ] `createPregnancyConfig`: creates config with correct calculated due date from LMP
- [ ] `createPregnancyConfig`: creates config with correct due date from conception date
- [ ] `createPregnancyConfig`: stores user-provided due date directly
- [ ] `createPregnancyConfig`: rejects creation when active pregnancy exists
- [ ] `getActivePregnancy`: returns active config or null
- [ ] `endPregnancy`: sets status and actual_end_date
- [ ] `endPregnancy`: does not delete data
- [ ] `updateDueDate`: updates due_date on active config
- [ ] `calculateDueDateFromLMP`: LMP + 280 days
- [ ] `calculateDueDateFromConception`: conception + 266 days
- [ ] `getCurrentWeek`: returns correct week number given LMP and today
- [ ] `getCurrentWeek`: handles week 40+ (past due)
- [ ] `getCurrentTrimester`: weeks 1-13 = 1, 14-27 = 2, 28+ = 3
- [ ] `getPregnancyWeekInfo`: returns correct baby size for weeks 4-42
- [ ] `getPregnancyWeekInfo`: returns "too early" for weeks 1-3
- [ ] Appointment CRUD: create, get by pregnancy, update, delete, mark complete
- [ ] `getUpcomingAppointments`: returns only future uncompleted appointments sorted by date

### Integration Tests
- [ ] Full flow: enter LMP -> pregnancy mode activates -> dashboard shows correct week -> end pregnancy -> cycle mode returns
- [ ] Appointment flow: create appointment -> shows on dashboard -> mark complete -> moves to completed section
- [ ] Multiple pregnancies: first pregnancy completed -> second pregnancy started -> both configs exist, only latest is active

### QA Verification Script

1. Open the app on iOS simulator
2. Navigate to MyCycle module from Hub Dashboard
3. Navigate to Settings tab
4. Tap "I'm pregnant"
5. Verify: Setup flow appears with 4 due date methods -- corresponds to AC-1
6. Select "Last menstrual period"
7. Enter a date 20 weeks ago (e.g., 2025-11-01 if today is 2026-03-22)
8. Verify: Calculated due date is LMP + 280 days (2026-08-08) -- corresponds to AC-2
9. Confirm setup
10. Verify: Today tab transforms to Pregnancy Dashboard showing "Week 20 of 40" -- corresponds to AC-3
11. Verify: Baby size comparison shows appropriate text for week 20 -- corresponds to AC-4
12. Verify: Trimester label shows "Trimester 2" -- corresponds to AC-5
13. Tap symptom log area
14. Verify: Pregnancy symptoms appear (morning_sickness, fatigue, etc.) instead of cycle symptoms -- corresponds to AC-6
15. Tap "Add Appointment"
16. Enter "20-week ultrasound" with a future date
17. Tap Save
18. Verify: Appointment appears on dashboard and Timeline -- corresponds to AC-7
19. Tap the appointment's complete checkbox
20. Verify: Checkmark appears -- corresponds to AC-8
21. Navigate to Timeline/Calendar tab
22. Verify: 40 weeks are displayed with development highlights -- corresponds to AC-9
23. Return to Hub Dashboard
24. Verify: MyCycle card shows "MyCycle - Week 20" -- corresponds to AC-10
25. Navigate to MyCycle Settings
26. Tap "End pregnancy tracking"
27. Verify: Options "Baby arrived" and "Pregnancy loss" are shown -- corresponds to AC-11
28. Select "Baby arrived"
29. Verify: Cycle tracking mode returns -- corresponds to AC-12
30. Navigate to Settings, verify pregnancy data is still accessible in history -- corresponds to AC-12
31. Start a new pregnancy, navigate to Settings, change due date
32. Verify: Due date updates and week recalculates -- corresponds to AC-13
33. While in pregnancy mode, check that no period predictions or fertile window appear -- corresponds to AC-14

## gstack Quality Gates

Based on Complexity 2 (Inverse), this feature is "Large" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for due date calculation and week/trimester engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- cycle has no standalone counterpart (skip)

## Handoff State

### Before This Work
Cycle module tracks periods, symptoms, flow levels, and predicts next periods. No concept of pregnancy exists. When a user becomes pregnant, the module has nothing to offer them for 9+ months.

### After This Work
- Pregnancy mode toggle in Settings with sensitive UX
- Due date calculation from 4 input methods (LMP, conception, doctor-provided, IVF transfer)
- Week-by-week pregnancy dashboard with progress ring, baby size, due date countdown
- Pregnancy-adapted symptom logging
- Appointment tracking with completion
- Timeline view of all 40 weeks
- Graceful end-of-pregnancy flow (birth or loss) with data preservation
- Hub Dashboard card reflecting pregnancy state

### Files Changed
- `modules/cycle/src/types.ts` -- Added PregnancyConfig, Appointment, PregnancyWeekInfo schemas and enums
- `modules/cycle/src/db/schema.ts` -- Added cy_pregnancy_config, cy_appointments DDL
- `modules/cycle/src/db/crud.ts` -- Added pregnancy and appointment CRUD functions
- `modules/cycle/src/engine/pregnancy.ts` -- New file: due date calculation, week/trimester logic
- `modules/cycle/src/data/pregnancy-weeks.ts` -- New file: static week-by-week baby data (42 entries)
- `modules/cycle/src/definition.ts` -- Added migration version (2 or 3)
- `modules/cycle/src/index.ts` -- Exported new types and functions
- `modules/cycle/src/__tests__/pregnancy.test.ts` -- New test file
- `apps/mobile/app/(cycle)/` -- Conditional pregnancy dashboard rendering

### Known Limitations
- No contraction timer (could be a future enhancement)
- No postpartum mode (period irregularity tracking after birth)
- No kick counter
- No weight tracking chart (could integrate with Health module)
- Week-by-week data is static text, not dynamically generated content
- No push notification reminders for appointments (would need platform notification integration)

### Context for Next Agent
- Only one pregnancy can be active at a time; enforce in createPregnancyConfig by checking for existing active records
- Pregnancy mode is a UI-level toggle, not a schema-level switch. The same cy_cycle_days and cy_symptoms tables are used; only the symptom constants and screen rendering change
- The static pregnancy-weeks data file should be a simple array of 42 objects, not fetched from any API
- "Pregnancy loss" is the preferred term everywhere in UI and code comments; avoid clinical terms that may feel harsh
- When pregnancy mode is active, suppress all calls to predictNextPeriod and getCurrentPhase in the UI layer
