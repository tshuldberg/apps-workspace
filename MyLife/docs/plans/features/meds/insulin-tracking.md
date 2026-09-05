# Feature Spec: Insulin Tracking

## Metadata
- **Module:** meds
- **Priority Score:** 31 / 50 (A-Tier)
- **Scoring Breakdown:** Market 2 x3 + Switching 4 x3 + Complexity 3 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Blood glucose logging (insulin doses correlate with glucose readings)
- **Blocks:** none

## Business Context

### Why This Feature Exists
MySugr (acquired by Roche for ~$100M) built a $10M+/yr business primarily around insulin + glucose logging for diabetics. CareClinic charges $119.88/yr and markets insulin tracking with injection site rotation as a premium feature. There are 37.3 million diabetics in the US (11.3% of the population), and approximately 8.4 million use insulin. MyLife's medication system can track insulin as a generic medication, but lacks insulin-specific fields: unit tracking (IU, not mg), insulin type classification (rapid/long-acting/mixed), injection site rotation, insulin-to-carb ratios, correction factors, and Insulin on Board (IOB) calculations. Adding structured insulin tracking turns MyLife from "a med tracker that happens to track insulin" into a dedicated diabetes companion that competes with MySugr.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| MySugr | Yes | Freemium ($59.99/yr Pro) | Insulin doses with type (rapid/long), carb-to-insulin ratio, bolus calculator, injection site map, IOB estimation. Gold standard for insulin tracking. |
| CareClinic | Yes | Yes ($119.88/yr) | Insulin logging with dosage, injection site tracking, medication reminders. No bolus calculator. |
| Medisafe | Partial | Free | Can track insulin as a medication. No insulin-specific fields (type, site rotation, IOB). |
| MyTherapy | Partial | Free | Basic insulin reminders. No structured insulin fields or site tracking. |

### Target User
Insulin-dependent diabetics (Type 1 and Type 2 on insulin) who need to track doses, rotate injection sites, and monitor their insulin usage alongside blood glucose. Migration path: MySugr Pro users paying $59.99/yr get insulin tracking + glucose logging + medication management + mood/symptom correlation in one app.

## Technical Context

### Where This Lives in MyLife

```
modules/meds/src/
  insulin/
    engine.ts                   -- NEW: IOB calculation, dose analysis, site rotation logic
    __tests__/engine.test.ts    -- NEW: Engine tests
  db/
    insulin.ts                  -- NEW: Insulin entry CRUD + injection site CRUD
    schema.ts                   -- MODIFY: Add md_insulin_entries, md_injection_sites tables
  models/
    insulin.ts                  -- NEW: Zod schemas for insulin entries
    index.ts                    -- MODIFY: Export insulin models
  definition.ts                 -- MODIFY: Add to V3 migration
  index.ts                      -- MODIFY: Export insulin engine + types
apps/mobile/app/(meds)/
  log-insulin.tsx               -- NEW: Insulin dose logging screen
  insulin-history.tsx           -- NEW: Insulin history + site rotation view
apps/web/app/meds/
  insulin/page.tsx              -- NEW: Web insulin dashboard
```

### Wireframe Position

```
Hub Dashboard
  └── MyMeds card
       ├── Today tab
       │    └── [Quick "Log Insulin" card / shortcut]
       │    └── [Active IOB indicator]
       ├── Medications tab
       │    └── [Insulin medications show insulin-specific detail]
       ├── History tab
       │    └── [Insulin History sub-section]
       └── Settings tab
            └── [Insulin settings: ratios, insulin profiles]
```

### Data Model

```sql
-- Insulin dose entries with type, site, and context
CREATE TABLE IF NOT EXISTS md_insulin_entries (
  id TEXT PRIMARY KEY,
  medication_id TEXT REFERENCES md_medications(id) ON DELETE SET NULL,
  insulin_type TEXT NOT NULL CHECK (insulin_type IN ('rapid', 'short', 'intermediate', 'long', 'mixed', 'ultra_rapid')),
  units REAL NOT NULL CHECK (units > 0),
  dose_category TEXT NOT NULL DEFAULT 'correction'
    CHECK (dose_category IN ('basal', 'bolus', 'correction', 'mixed')),
  injection_site TEXT,
  carbs_covered INTEGER,
  blood_glucose_before REAL,
  notes TEXT,
  administered_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Injection site rotation tracker
CREATE TABLE IF NOT EXISTS md_injection_sites (
  id TEXT PRIMARY KEY,
  site_name TEXT NOT NULL CHECK (site_name IN (
    'abdomen_left', 'abdomen_right',
    'thigh_left', 'thigh_right',
    'arm_left', 'arm_right',
    'buttock_left', 'buttock_right'
  )),
  last_used_at TEXT NOT NULL,
  use_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS md_insulin_entries_admin_idx ON md_insulin_entries(administered_at DESC);
CREATE INDEX IF NOT EXISTS md_insulin_entries_type_idx ON md_insulin_entries(insulin_type);
CREATE INDEX IF NOT EXISTS md_insulin_entries_med_idx ON md_insulin_entries(medication_id);
CREATE INDEX IF NOT EXISTS md_injection_sites_site_idx ON md_injection_sites(site_name, last_used_at DESC);
```

### Dependencies
- **Internal:** `@mylife/meds` (medication CRUD, dose logging, measurements), `@mylife/db`
- **External:** None. IOB calculation is math-only (exponential decay curves).
- **Cross-Module:** Health module (insulin doses as health data). Nutrition module (carb intake for bolus calculation context). Blood glucose logging (glucose readings inform correction doses).

## Functional Requirements

### User Stories
1. As an insulin user, I want to log my insulin doses with the specific type (rapid, long-acting, etc.) so my records are medically accurate.
2. As a user, I want to track which injection site I used so I can rotate sites properly and avoid lipodystrophy.
3. As a user, I want to see my Insulin on Board (IOB) so I know how much active insulin is still working.
4. As a user, I want to log how many carbs my dose covers so I can review my insulin-to-carb patterns.
5. As a user, I want the app to suggest which injection site to use next based on my rotation history.
6. As a user, I want to see my daily total insulin (basal + bolus breakdown) so I can monitor my usage.

### Behavior Specification

**Logging an insulin dose:**
1. User taps "Log Insulin" on the Today tab or from a medication detail.
2. A logging screen appears with:
   a. Insulin selector: dropdown of active insulin medications. If the user has only one insulin, auto-select it.
   b. Units field (numeric input with 0.5 increment, required). Large, easy to adjust.
   c. Insulin type (auto-filled from medication profile if linked, or manual): Rapid | Short | Intermediate | Long | Mixed | Ultra-rapid.
   d. Dose category: Basal | Bolus | Correction | Mixed (pill toggle).
   e. Injection site: body diagram or grid of 8 zones (abdomen left/right, thigh left/right, arm left/right, buttock left/right). The least-recently-used site is highlighted as "suggested."
   f. Carbs covered (optional numeric input): "How many grams of carbs does this cover?"
   g. Blood glucose before (optional numeric input): "Current blood glucose?" Pre-fills from most recent glucose reading if < 30 minutes old.
   h. Notes (optional free text).
   i. Time: defaults to now, adjustable.
3. User taps "Log Dose". Entry saved to `md_insulin_entries`. Injection site usage updated in `md_injection_sites`.

**IOB (Insulin on Board) calculation:**
1. IOB is displayed on the Today tab as a small indicator: "IOB: 3.2 IU" with a countdown.
2. IOB decays exponentially based on insulin type:
   - Rapid-acting: peaks at 1h, duration ~4h.
   - Short-acting: peaks at 2h, duration ~6h.
   - Intermediate: peaks at 4-6h, duration ~12h.
   - Long-acting: flat curve, duration ~24h.
3. Formula: `IOB = dose * (1 - elapsed / duration)` for linear decay (V1 simplification). Future: exponential curve.
4. IOB sums across all active doses (each dose has its own remaining IOB).
5. If IOB > 0, show the indicator. If IOB = 0, hide or show "0 IU".

**Injection site rotation:**
1. The site grid shows 8 zones. Each zone displays:
   - Last used date.
   - Times used in last 30 days.
   - Color: green (not used recently, suggested), yellow (used 2-3 days ago), red (used today/yesterday).
2. The "suggested" site is the one with the oldest `last_used_at`.
3. User can tap any site to select it (not forced to follow suggestion).

**Insulin history:**
1. User navigates to History > Insulin section.
2. Summary card:
   - Today's total: X IU (Y basal + Z bolus).
   - 7-day daily average.
   - 30-day daily average.
   - Basal/bolus ratio.
3. Chart: stacked bar chart showing daily basal (one color) and bolus (another color) doses over last 30 days.
4. List: all insulin entries, newest first, showing time, units, type, site, and linked glucose.

**Insulin settings (stored in `md_settings`):**
- `insulin_to_carb_ratio`: grams of carbs per 1 unit of insulin (default: 10).
- `correction_factor`: how much 1 unit lowers glucose in mg/dL (default: 50).
- `target_glucose`: target blood glucose in mg/dL (default: 100).
- `iob_duration_rapid`: IOB duration for rapid insulin in hours (default: 4).
- `iob_duration_long`: IOB duration for long-acting insulin in hours (default: 24).

### Edge Cases

- **No insulin medications:** "Log Insulin" still available (can log without linking to a medication). Show "Add an insulin medication for better tracking" suggestion.
- **Multiple insulin types:** User may take both rapid (bolus) and long-acting (basal). Both appear in the selector.
- **Half-unit dosing:** Units field supports 0.5 increments (pen injectors often support half units).
- **Site rotation with no history:** All sites show green (never used). No suggestion highlighted; user picks any.
- **Overlapping IOB from multiple doses:** Sum all active IOB values. Show total.
- **IOB for long-acting insulin:** Long-acting (e.g., Lantus) has a flat IOB curve over 24h. Display differently from rapid spikes.
- **Logging a past dose:** User can change the time to earlier. IOB calculation uses the adjusted time.
- **Medication deleted but insulin entries exist:** `medication_id` is SET NULL. Entries remain with null medication link.
- **Module disabled:** Data persists but UI hidden.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Insulin logging screen shows units input with 0.5 increment support
- [ ] **AC-2:** Insulin type selector shows all 6 types (rapid, short, intermediate, long, mixed, ultra-rapid)
- [ ] **AC-3:** Dose category selector shows basal/bolus/correction/mixed
- [ ] **AC-4:** Injection site grid shows 8 zones with usage recency coloring
- [ ] **AC-5:** Suggested injection site is highlighted (least recently used)
- [ ] **AC-6:** IOB indicator shows on Today tab with current active insulin
- [ ] **AC-7:** IOB decreases over time as insulin is metabolized
- [ ] **AC-8:** Carbs covered and blood glucose fields are available and optional
- [ ] **AC-9:** History shows daily total with basal/bolus breakdown
- [ ] **AC-10:** Stacked bar chart shows daily insulin usage over 30 days
- [ ] **AC-11:** Settings allow configuration of insulin-to-carb ratio and correction factor
- [ ] **AC-12:** Feature works on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `calculateIOB(doses, now)` returns correct remaining insulin for each type's decay curve
- [ ] **TC-2:** Insulin entries saved to `md_insulin_entries` with all fields persisted correctly
- [ ] **TC-3:** Injection site rotation correctly identifies least-recently-used site
- [ ] **TC-4:** `getDailyInsulinTotals(entries)` returns correct basal + bolus breakdown per day
- [ ] **TC-5:** V3 migration creates both tables without affecting existing data
- [ ] **TC-6:** Half-unit doses (e.g., 2.5 IU) are stored and retrieved without precision loss

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** IOB must NOT go negative (floor at 0)
- [ ] **NC-2:** Injection site suggestion must NOT force the user (they can pick any site)
- [ ] **NC-3:** Deleting a medication must NOT delete associated insulin entries (SET NULL)
- [ ] **NC-4:** Insulin entries must NOT appear in the generic `md_measurements` table

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token)
- Module accent: `#06B6D4` (meds cyan)
- IOB indicator: cyan pill badge on Today tab
- Injection site colors: green (`#30D158`), yellow (`#FFD60A`), red (`#FF453A`)
- Basal bar color: `#06B6D4` (cyan)
- Bolus bar color: `#8B5CF6` (purple)

Logging screen layout:
```
[Log Insulin]

  Insulin: [Humalog (rapid) ▾]     [medication selector]

  Units:  [- 4.5 +]                [stepper with 0.5 increments]

  Type:   (Rapid) (Short) (Long) ...  [auto-filled from med]
  Category: (Basal) (Bolus) (Correction) (Mixed)

  Injection Site:
  ┌─────────────────────┐
  │  [AL] [AR]          │  Abdomen Left/Right
  │  [TL] [TR]          │  Thigh Left/Right
  │  [aL] [aR]          │  Arm Left/Right
  │  [BL] [BR]          │  Buttock Left/Right
  └─────────────────────┘
  ★ Suggested: Thigh Right (last used 4 days ago)

  Carbs covered: [35] g            [optional]
  Glucose before: [145] mg/dL      [optional, auto-fill]

  [Log Dose]                       [primary button, cyan]
```

IOB indicator on Today tab:
```
  💉 IOB: 3.2 IU                  [small cyan badge, top of Today tab]
```

### Web (Next.js)

- Route: `/meds/insulin`
- Three-column layout: logging (left), IOB + site rotation (center), history chart (right)
- Same color scheme as mobile

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton form and chart | Initial load |
| No insulin entries | "Log your first insulin dose" + CTA | No entries |
| Logging | Full form with site grid | User opens log screen |
| IOB active | Cyan badge with decreasing IU | Active doses within decay window |
| IOB zero | Badge hidden or "0 IU" | All doses fully metabolized |
| History | Chart + list + averages | Entries exist |
| Error | "Could not save dose" + retry | Save failure |

## Test Requirements

### Unit Tests
- [ ] `calculateIOB`: rapid 10 IU administered 2h ago, 4h duration -> ~5 IU remaining
- [ ] `calculateIOB`: rapid 10 IU administered 4h ago, 4h duration -> 0 IU
- [ ] `calculateIOB`: long 20 IU administered 12h ago, 24h duration -> ~10 IU
- [ ] `calculateIOB`: multiple doses -> sum of individual IOBs
- [ ] `calculateIOB`: dose in the future -> full dose (IOB = dose units)
- [ ] `getSuggestedSite`: all sites unused -> returns first alphabetically (or any)
- [ ] `getSuggestedSite`: one site used today, rest 3+ days ago -> returns oldest
- [ ] `getDailyInsulinTotals`: 3 basal + 5 bolus entries -> correct per-day breakdown
- [ ] `getDailyInsulinTotals`: empty entries -> all zeros
- [ ] Half-unit precision: 2.5 IU stored and returned as 2.5

### Integration Tests
- [ ] Full flow: log insulin dose with site -> saved to md_insulin_entries -> injection site updated -> IOB reflects new dose
- [ ] Site rotation: log 3 doses at different sites -> suggested site is the unused one
- [ ] History: log doses over 3 days -> chart shows correct daily totals with basal/bolus split

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyMeds
3. Tap "Log Insulin" on the Today tab
4. Verify: Units input shown with stepper (+/- 0.5) -- AC-1
5. Verify: Insulin type selector shows all 6 options -- AC-2
6. Select "Bolus" category -- AC-3
7. Verify: Injection site grid shows 8 zones -- AC-4
8. Verify: One site is highlighted as suggested -- AC-5
9. Select a site, enter 5 units, tap "Log Dose"
10. Return to Today tab
11. Verify: IOB indicator shows ~5 IU -- AC-6
12. Wait 30 seconds, verify IOB has decreased slightly -- AC-7
13. Log another dose, fill in carbs and glucose -- AC-8
14. Navigate to Insulin History
15. Verify: Daily total with basal/bolus split shown -- AC-9
16. Verify: Stacked bar chart visible -- AC-10
17. Navigate to Settings
18. Verify: Insulin-to-carb ratio and correction factor configurable -- AC-11
19. Verify on web -- AC-12

## gstack Quality Gates

Based on Complexity score 3 (Medium):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- log insulin dose, check IOB, verify site rotation, review history

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- eval suite for IOB calculation and site rotation logic

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Insulin tracked as a generic medication in `md_medications`.
- No insulin-specific fields (type, units as IU, site, carb coverage).
- No IOB calculation.
- No injection site rotation tracking.
- No basal/bolus breakdown analytics.

### After This Work
- Dedicated `md_insulin_entries` table with type, units, site, carb coverage, and glucose context.
- `md_injection_sites` table tracking usage recency per zone.
- IOB calculation engine with per-type decay curves.
- Injection site rotation with suggestions.
- Daily insulin totals with basal/bolus breakdown.
- Logging screen, history screen, and IOB indicator.

### Files Changed
- `modules/meds/src/insulin/engine.ts` -- NEW: IOB calculation, site rotation, daily totals
- `modules/meds/src/insulin/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/meds/src/db/insulin.ts` -- NEW: Insulin entry + injection site CRUD
- `modules/meds/src/db/schema.ts` -- MODIFY: Add md_insulin_entries, md_injection_sites tables
- `modules/meds/src/models/insulin.ts` -- NEW: Zod schemas for insulin entries
- `modules/meds/src/models/index.ts` -- MODIFY: Export insulin models
- `modules/meds/src/definition.ts` -- MODIFY: V3 migration
- `modules/meds/src/index.ts` -- MODIFY: Export insulin engine + types
- `apps/mobile/app/(meds)/log-insulin.tsx` -- NEW: Mobile insulin logging
- `apps/mobile/app/(meds)/insulin-history.tsx` -- NEW: Mobile insulin history
- `apps/web/app/meds/insulin/page.tsx` -- NEW: Web insulin dashboard

### Known Limitations
- **No bolus calculator.** MySugr calculates suggested bolus based on carb intake, correction factor, and IOB. Future feature (requires careful medical disclaimer).
- **No CGM integration.** Future: pair with Dexcom/Libre for real-time glucose feeding into correction dose suggestions.
- **No insulin pump tracking.** Feature is designed for pen/syringe users. Pump integration is a separate feature.
- **Linear IOB decay (V1).** Real insulin action follows an exponential curve. V1 uses linear decay for simplicity. Future: implement Bilinear or Walsh exponential model.
- **No insulin brand database.** User must manually set insulin type. Future: brand catalog (Humalog -> rapid, Lantus -> long, etc.).

### Context for Next Agent
- IOB calculation is a pure function: `calculateIOB(doses: InsulinDose[], now: Date) -> number`. Each dose contributes `max(0, dose.units * (1 - elapsed / duration))` where duration depends on `insulin_type`. Sum all contributions.
- Duration constants: rapid = 4h, short = 6h, intermediate = 12h, long = 24h, mixed = 8h, ultra_rapid = 3h. Store in `md_settings` so users can customize.
- Injection sites use an upsert pattern: `INSERT OR REPLACE INTO md_injection_sites` on each dose log. The `use_count` increments and `last_used_at` updates.
- The `medication_id` foreign key is optional (SET NULL on delete) because users may want to log insulin doses without first creating a medication record.
- Blood glucose before can auto-fill from the most recent `md_glucose_readings` entry (from the blood glucose logging feature) if it was recorded < 30 minutes ago.
