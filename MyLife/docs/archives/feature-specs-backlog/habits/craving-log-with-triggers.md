# Feature Spec: Craving Log with Triggers

## Metadata
- **Module:** habits
- **Priority Score:** 36 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 4 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 3-4 hours
- **Depends On:** Sobriety clock (craving log pairs with sobriety tracking)
- **Blocks:** none

## Business Context

### Why This Feature Exists
I Am Sober's craving log is their second most-used feature after the sobriety clock. When a user feels a craving, they log it with: what triggered it, how intense it was, and what coping strategy they used. Over time, this data reveals patterns (e.g., "I crave cigarettes most at 3pm after meetings") that empower users to proactively avoid or prepare for triggers. This is a CBT (Cognitive Behavioral Therapy) technique called "trigger mapping" that therapists recommend for addiction recovery. No competitor in the habit tracking space except I Am Sober offers structured trigger logging.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| I Am Sober | Yes | Freemium ($39.99/yr for analytics) | Log cravings with intensity (1-10), triggers (preset + custom), coping strategies, notes. Craving heatmap by time of day. Trigger frequency analysis. |
| Streaks | No | N/A | No craving/trigger tracking. |
| Habitica | No | N/A | No craving/trigger tracking. |
| Habitify | No | N/A | No craving/trigger tracking. |
| Fabulous | No | N/A | Journey coaching but no structured craving logs. |

### Target User
Anyone in addiction recovery or quitting a habit who wants to understand what triggers their cravings. Also people managing anxiety, binge eating, or compulsive behaviors who want to identify patterns. Migration: I Am Sober premium users paying $39.99/yr for craving analytics get it included with MyLife.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  sobriety/
    craving-engine.ts           -- NEW: Craving analysis (trigger frequency, time patterns, intensity trends)
    __tests__/craving-engine.test.ts -- NEW: Engine tests
  db/
    cravings.ts                 -- NEW: Craving log CRUD
    schema.ts                   -- MODIFY: Add hb_cravings, hb_craving_triggers tables
  types.ts                      -- MODIFY: Add craving Zod schemas
  definition.ts                 -- MODIFY: Add to V3 migration
  index.ts                      -- MODIFY: Export craving engine + types
apps/mobile/app/(habits)/
  log-craving.tsx               -- NEW: Quick craving logging screen
  craving-insights.tsx          -- NEW: Craving pattern analysis screen
apps/web/app/habits/
  cravings/page.tsx             -- NEW: Web craving log + insights page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Quick "Log Craving" FAB button]
       ├── Habits tab
       │    └── [Negative habit detail] -> Craving History
       ├── Stats tab
       │    └── [Craving Insights sub-section]
       └── Settings tab
```

### Data Model

```sql
-- Craving log entries
CREATE TABLE IF NOT EXISTS hb_cravings (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
  intensity INTEGER NOT NULL CHECK (intensity >= 1 AND intensity <= 10),
  duration_minutes INTEGER,
  coping_strategy TEXT,
  outcome TEXT CHECK (outcome IN ('resisted', 'gave_in', 'distracted', 'delayed')),
  notes TEXT,
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Triggers associated with a craving (many-to-many)
CREATE TABLE IF NOT EXISTS hb_craving_triggers (
  id TEXT PRIMARY KEY,
  craving_id TEXT NOT NULL REFERENCES hb_cravings(id) ON DELETE CASCADE,
  trigger_name TEXT NOT NULL,
  trigger_category TEXT NOT NULL
    CHECK (trigger_category IN ('emotional', 'social', 'environmental', 'physical', 'routine', 'custom')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS hb_cravings_habit_idx ON hb_cravings(habit_id);
CREATE INDEX IF NOT EXISTS hb_cravings_logged_idx ON hb_cravings(logged_at DESC);
CREATE INDEX IF NOT EXISTS hb_craving_triggers_craving_idx ON hb_craving_triggers(craving_id);
CREATE INDEX IF NOT EXISTS hb_craving_triggers_name_idx ON hb_craving_triggers(trigger_name);
```

### Dependencies
- **Internal:** `@mylife/habits` (negative habits, sobriety profiles), `@mylife/db` (DatabaseAdapter)
- **External:** None.
- **Cross-Module:** Mood module (craving intensity correlates with mood entries). Health module (craving patterns in wellness timeline).

## Functional Requirements

### User Stories
1. As a user managing cravings, I want to quickly log a craving with its intensity so I can track frequency and severity.
2. As a user, I want to tag what triggered the craving so I can identify patterns over time.
3. As a user, I want to record what coping strategy I used so I can learn what works.
4. As a user, I want to see craving patterns by time of day and day of week so I can prepare for high-risk times.
5. As a user, I want to see which triggers cause the most cravings so I can avoid or plan for them.
6. As a user, I want to see my craving intensity trending down over time so I feel encouraged.

### Behavior Specification

**Quick craving logging (FAB button on Today tab):**
1. User taps the "Log Craving" floating action button.
2. A bottom sheet / modal appears with:
   a. Habit selector (dropdown of active negative habits). If only one negative habit, auto-selected.
   b. Intensity slider (1-10, with emoji faces: 1=barely noticeable, 5=moderate, 10=overwhelming).
   c. Trigger quick-select (preset categories with common triggers):
      - **Emotional:** Stress, Anxiety, Boredom, Sadness, Anger, Loneliness
      - **Social:** Party, Friends drinking, Peer pressure, Celebration
      - **Environmental:** Walking past a bar, Smell, TV ad, Store
      - **Physical:** Hunger, Fatigue, Pain, Withdrawal
      - **Routine:** After meal, Morning coffee, Driving, Work break
      - **Custom:** Free-text entry
   d. Multiple triggers can be selected per craving.
   e. Coping strategy (optional): What did you do? Free text or quick-select (Deep breathing, Walked away, Called someone, Drank water, Waited it out).
   f. Outcome: Resisted | Gave in | Distracted myself | Delayed
   g. Notes (optional free text).
3. Tap "Log" to save. Entry saved to `hb_cravings` with associated triggers in `hb_craving_triggers`.

**Craving insights screen:**
1. User navigates to Stats tab > Craving Insights or from negative habit detail.
2. Sections:
   a. **Craving frequency chart:** Bar chart showing cravings per day over the last 30 days.
   b. **Intensity trend:** Line chart showing average intensity per week, with a trend line. Goal: see it decreasing.
   c. **Peak craving times:** Heatmap or bar chart showing craving count by hour of day (0-23).
   d. **Top triggers:** Ranked list of trigger names by frequency. Bar chart showing count per trigger.
   e. **Coping effectiveness:** For each outcome type, show count and percentage. Success rate = resisted / total.
   f. **Summary stats:** Total cravings logged, average intensity, most common trigger, best coping strategy (highest resist rate).

**Preset trigger catalog:**
The app ships with ~25 common triggers across the 5 categories. Users can add custom triggers. Custom triggers are persisted (they appear in quick-select after first use). Triggers normalize by lowercase trimming for deduplication.

### Edge Cases

- **No negative habits:** "Log Craving" button hidden. Insights section hidden.
- **No cravings logged:** Insights shows "Log your first craving to start seeing patterns" with CTA.
- **Single craving logged:** Charts show single data point. Trend line not meaningful yet (show message).
- **Multiple negative habits:** Habit selector in the logging form. Insights can filter by habit.
- **Very high frequency (10+ cravings/day):** Charts handle gracefully. Consider daily aggregation.
- **Custom trigger with typo:** Normalize and suggest existing triggers (fuzzy match on quick-select).
- **Craving logged without outcome:** outcome is optional in the schema (NULL allowed). Default to 'resisted' in UI or leave blank.
- **Module disabled mid-logging:** Data already saved persists. Unsaved form state lost.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Quick "Log Craving" FAB appears on Today tab when negative habits exist
- [ ] **AC-2:** Craving logging form shows intensity slider (1-10) with emoji indicators
- [ ] **AC-3:** Trigger quick-select shows preset triggers organized by category
- [ ] **AC-4:** Multiple triggers can be selected for a single craving
- [ ] **AC-5:** Custom trigger entry is available and persists for future use
- [ ] **AC-6:** Coping strategy and outcome can be recorded
- [ ] **AC-7:** Craving frequency chart shows daily cravings for last 30 days
- [ ] **AC-8:** Intensity trend shows weekly average with visible trend direction
- [ ] **AC-9:** Peak craving times heatmap shows cravings by hour of day
- [ ] **AC-10:** Top triggers ranked list shows correct frequency counts
- [ ] **AC-11:** Coping effectiveness shows resist rate as a percentage
- [ ] **AC-12:** Feature works on both mobile and web

### Technical Criteria
- [ ] **TC-1:** `analyzeTriggerFrequency` returns triggers sorted by frequency descending
- [ ] **TC-2:** `analyzeIntensityTrend` returns weekly averages with correct calculations
- [ ] **TC-3:** `analyzePeakTimes` returns 24 hour buckets with correct counts
- [ ] **TC-4:** `analyzeCopingEffectiveness` returns outcome counts and resist rate
- [ ] **TC-5:** Craving-trigger relationship is many-to-many (one craving, multiple triggers)
- [ ] **TC-6:** Custom triggers are case-insensitive normalized (lowercase, trimmed)
- [ ] **TC-7:** V3 migration creates tables without affecting existing habit data

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Craving log must NOT be available for non-negative habits
- [ ] **NC-2:** Trigger names must NOT allow empty strings
- [ ] **NC-3:** Intensity must NOT be outside the 1-10 range
- [ ] **NC-4:** Analysis engine must NOT crash on empty craving data

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token)
- Module accent: `#8B5CF6` (habits purple)
- Intensity slider: gradient from green (1) through yellow (5) to red (10)
- Trigger chips: glass pills with category-coded borders
- FAB: Purple accent, bottom-right, "+" icon or brain icon

Logging form layout:
```
[Log Craving -- bottom sheet]

  "How intense?"
  [1 😌 ----o---- 😰 10]      [slider]

  "What triggered it?"
  [Stress] [Boredom] [Anxiety]  [chips, multi-select]
  [After meal] [Fatigue] [+Custom]

  "What helped?"
  [Deep breathing] [Walked away]  [optional chips]

  "Outcome"
  (Resisted) (Gave in) (Distracted) (Delayed)  [radio]

  [Notes...]                    [optional text]

  [Log Craving]                 [primary button]
```

### Web (Next.js)

- Route: `/habits/cravings`
- Two-column layout: logging form (left), insights dashboard (right)
- Charts use same library as other modules (recharts)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton form and chart placeholders | Initial load |
| No negative habits | FAB hidden, insights section hidden | No negative habits exist |
| No cravings | "Log your first craving" CTA | No craving records |
| Active logging | Bottom sheet with form | User taps FAB |
| Insights | Charts and analysis | Cravings exist |
| Error | "Could not save craving" + retry | Save failure |

## Test Requirements

### Unit Tests
- [ ] `analyzeTriggerFrequency`: 5 cravings with 3 having "stress" -> stress at top with count 3
- [ ] `analyzeTriggerFrequency`: empty cravings -> empty array
- [ ] `analyzeIntensityTrend`: 14 cravings over 2 weeks -> 2 weekly average points
- [ ] `analyzeIntensityTrend`: decreasing intensities -> trend direction "improving"
- [ ] `analyzePeakTimes`: cravings at 9am, 9am, 3pm -> hour 9 count 2, hour 15 count 1
- [ ] `analyzeCopingEffectiveness`: 3 resisted, 1 gave_in -> resist rate 75%
- [ ] `analyzeCopingEffectiveness`: zero cravings -> resist rate 0, no division error
- [ ] Trigger normalization: "  Stress  " and "stress" treated as same trigger

### Integration Tests
- [ ] Full flow: create negative habit -> log 3 cravings with different triggers -> insights show correct patterns
- [ ] Custom trigger: log craving with custom trigger -> trigger appears in quick-select next time
- [ ] Filter: 2 negative habits, log cravings for each -> insights filter by habit correctly

### QA Verification Script

1. Open the app on [iOS / web]
2. Create a negative habit "Quit Smoking"
3. Verify: "Log Craving" FAB appears on Today tab -- AC-1
4. Tap the FAB
5. Verify: Logging form appears with intensity slider -- AC-2
6. Set intensity to 7
7. Verify: Trigger categories shown with preset options -- AC-3
8. Select "Stress" and "After meal" triggers -- AC-4
9. Add custom trigger "Phone call" -- AC-5
10. Select coping strategy "Deep breathing" and outcome "Resisted" -- AC-6
11. Tap "Log Craving"
12. Log 4 more cravings at different times with different triggers
13. Navigate to craving insights
14. Verify: Frequency chart shows cravings -- AC-7
15. Verify: Intensity trend shows data -- AC-8
16. Verify: Peak times shows hour distribution -- AC-9
17. Verify: Top triggers ranked correctly -- AC-10
18. Verify: Resist rate percentage shown -- AC-11
19. Verify on web -- AC-12

## gstack Quality Gates

Based on Complexity score 4 (Small):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to craving log, test logging flow, check insights

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- eval suite for craving analysis engine

### Post-merge:
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Negative habits exist with slip tracking (value = -1 completions).
- No craving logging, no trigger tracking, no craving analysis.

### After This Work
- Craving logging with intensity, triggers, coping strategy, and outcome.
- Analysis engine: trigger frequency, intensity trends, peak times, coping effectiveness.
- New tables: `hb_cravings`, `hb_craving_triggers`.
- New screens: mobile log-craving, craving-insights; web cravings page.

### Files Changed
- `modules/habits/src/sobriety/craving-engine.ts` -- NEW: Craving pattern analysis
- `modules/habits/src/sobriety/__tests__/craving-engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/cravings.ts` -- NEW: Craving + trigger CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add V3 craving tables + indexes
- `modules/habits/src/types.ts` -- MODIFY: Add Craving, CravingTrigger schemas
- `modules/habits/src/definition.ts` -- MODIFY: V3 migration
- `modules/habits/src/index.ts` -- MODIFY: Export craving engine + types
- `apps/mobile/app/(habits)/log-craving.tsx` -- NEW: Quick craving logging
- `apps/mobile/app/(habits)/craving-insights.tsx` -- NEW: Craving analysis
- `apps/web/app/habits/cravings/page.tsx` -- NEW: Web craving page

### Known Limitations
- **No push notification for craving check-ins.** Future: periodic "how are you feeling?" prompts.
- **No ML pattern prediction.** Analysis is descriptive only, not predictive.
- **Trigger catalog is English-only.** Future: localization.

### Context for Next Agent
- Craving triggers use a many-to-many pattern. One craving can have multiple triggers. Always insert triggers in the same transaction as the craving.
- The preset trigger catalog should be a const array in the engine file, not a database table. Custom triggers are persisted via the `hb_craving_triggers` table and can be queried with `SELECT DISTINCT trigger_name`.
- Intensity uses 1-10 integer scale. For emoji mapping: 1-2 = calm, 3-4 = mild, 5-6 = moderate, 7-8 = strong, 9-10 = overwhelming.
- The craving log pairs naturally with the sobriety clock. On the sobriety clock screen, consider adding a "Log Craving" shortcut button.
