# Feature Spec: Sleep Bank

## Metadata
- **Module:** health
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 1 x3 + Complexity 4 x2 + CrossModule 2 x1 + PaidUser 2 x1
- **Sprint:** 5
- **Estimated CC Time:** 2-3 hours
- **Depends On:** none (uses existing hl_sleep_sessions data)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Sleep bank (or sleep debt) tracking shows users the cumulative difference between their target sleep and actual sleep over time. Apple Health introduced this concept showing weekly sleep trends against target. The idea is simple: if your target is 8 hours and you sleep 6, you're 2 hours "in debt." Complexity is 4 (easy) because it's pure math on existing sleep data. It gamifies consistent sleep habits and motivates users to "pay back" their sleep debt.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Sleep trend chart vs target, weekly summary |
| Rise Science | Yes | Yes ($69.99/yr) | Sleep debt as core metric, melatonin window |
| SleepWatch | Yes | Yes ($29.99/yr) | Sleep debt tracking with trends |
| Sleep Cycle | Partial | Yes ($39.99/yr) | Sleep deficit indicator |

### Target User
Users who want to understand their cumulative sleep deficit and be motivated to catch up on sleep. Health-conscious users who want to see if they're consistently meeting their sleep target.

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/sleep/bank.ts            -- Sleep bank/debt calculation engine
modules/health/src/sleep/types.ts           -- Extended with SleepBank types
modules/health/src/index.ts                 -- Export sleep bank functions
apps/mobile/app/(health)/sleep-detail.tsx   -- Sleep bank card on sleep view
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Vitals tab
            └── Sleep section
                 └── Sleep Bank ← YOU ARE HERE
                      ├── Current debt/surplus
                      ├── 7-day running balance
                      └── Trend direction
```

### Data Model

No new tables. Sleep bank is calculated dynamically from `hl_sleep_sessions` and the target sleep hours from `hl_settings` (key: 'sleep.targetHours', default: 8).

**New types:**

```typescript
export interface SleepBank {
  currentDebtMinutes: number;     // Positive = debt, negative = surplus
  currentDebtHours: number;       // Same, in hours for display
  sevenDayBalance: number[];      // Daily debt/surplus for last 7 days
  thirtyDayDebt: number;          // Total debt over 30 days
  averageSleepHours: number;      // 30-day average
  targetHours: number;
  status: 'well_rested' | 'slight_debt' | 'moderate_debt' | 'significant_debt';
  trend: 'paying_off' | 'stable' | 'accumulating';
}
```

### Dependencies
- **Internal:** `@mylife/db`, hl_sleep_sessions (duration_minutes), hl_settings (sleep.targetHours)
- **External:** None
- **Cross-Module:** Readiness score can factor in sleep debt. Wellness timeline shows sleep bank status.

## Functional Requirements

### User Stories
1. As a user, I want to see my cumulative sleep debt so I know how much sleep I need to catch up on.
2. As a user, I want a 7-day balance chart showing daily sleep surplus or deficit.
3. As a user, I want to know if my sleep debt is improving or worsening.

### Behavior Specification

**Sleep bank display:**
1. In the Sleep section (Vitals tab), a "Sleep Bank" card shows:
   a. **Current debt:** "You owe 4.5 hours of sleep" or "You're 2 hours ahead!"
   b. **Status badge:** well_rested (green), slight_debt (yellow), moderate_debt (orange), significant_debt (red)
   c. **7-day bar chart:** Each day shows a bar above (surplus) or below (deficit) the zero line
   d. **Trend:** "Paying off debt" (improving) or "Debt is accumulating" (worsening)

**Calculation:**
1. For each of the last 7 (or 30) days:
   - Get total sleep minutes from hl_sleep_sessions for that day
   - Calculate daily balance: actual_minutes - (target_hours * 60)
   - Positive = surplus, negative = deficit
2. Current debt = sum of daily balances over the rolling window (7 days)
3. Cap accumulated debt at 20 hours (beyond that, you can't realistically "pay it back")
4. Status thresholds:
   - Well rested: debt <= 0 (surplus or even)
   - Slight debt: 0 < debt <= 3 hours
   - Moderate debt: 3 < debt <= 8 hours
   - Significant debt: debt > 8 hours
5. Trend: compare this week's average daily balance to last week's

**Settings:**
- Target sleep hours adjustable in health settings (default 8)
- Rolling window: 7 days (shown) but 30-day total also available in detail view

### Edge Cases

- **No sleep data for a day:** Treat as 0 hours slept (full deficit for that day).
- **Multiple sleep sessions in one day:** Sum total minutes.
- **Very long sleep (12+ hours):** Allow; creates surplus for that day.
- **Target set to 0:** Prevent. Minimum 4 hours, maximum 12 hours.
- **First day of tracking:** Show single day's balance with "Track more days for trends."
- **Sleep debt cap (20 hours):** Show "20+ hours" not an exact number beyond the cap.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Sleep Bank card shows current debt or surplus in hours
- [ ] **AC-2:** Status badge color-coded by debt level
- [ ] **AC-3:** 7-day bar chart shows daily surplus/deficit around zero line
- [ ] **AC-4:** Trend indicator shows if debt is accumulating or being paid off
- [ ] **AC-5:** Adjusting target sleep hours recalculates the bank
- [ ] **AC-6:** Days with no data treated as 0 sleep (full deficit)

### Technical Criteria
- [ ] **TC-1:** Daily balance = actual_minutes - (target_hours * 60) calculated correctly
- [ ] **TC-2:** 7-day rolling debt sums correctly
- [ ] **TC-3:** Debt cap at 20 hours (1200 minutes) enforced
- [ ] **TC-4:** Multiple sleep sessions per day summed correctly
- [ ] **TC-5:** Trend comparison uses this-week vs last-week averages

### Negative Criteria
- [ ] **NC-1:** Sleep bank must NOT claim medical significance
- [ ] **NC-2:** Must NOT discourage napping as "cheating" (naps count as sleep)

## UI Specification

### Mobile (Expo)
- **Sleep Bank card:** Glass card on sleep section. Large debt/surplus number in `#F0F0F5`. Status badge colored. Direction arrow for trend.
- **7-day chart:** Bar chart centered on zero line. Surplus bars in `#30D158` (green), deficit bars in `#FF453A` (red). Zero line dashed `rgba(240,240,245,0.65)`.
- **Well rested:** Green glow on card border. Deficit: orange/red tint.

### Web (Next.js)
- Same visualization on `/health/sleep` page.

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| No data | "Start tracking sleep to see your sleep bank" | No sleep sessions |
| Well rested | Green badge, surplus hours | Debt <= 0 |
| Slight debt | Yellow badge, debt hours | 0 < debt <= 3h |
| Moderate debt | Orange badge | 3h < debt <= 8h |
| Significant debt | Red badge, "20+ hours" if capped | debt > 8h |

## Test Requirements

### Unit Tests
- [ ] `calculateDailyBalance`: 7h actual, 8h target = -60 min
- [ ] `calculateDailyBalance`: 9h actual, 8h target = +60 min
- [ ] `calculateSleepBank`: 7 days of 7h each with 8h target = -7h debt
- [ ] `calculateSleepBank`: caps at 20h (1200 min) for extreme debt
- [ ] `calculateSleepBank`: 0 sleep days count as full deficit
- [ ] `getSleepBankStatus`: 0 debt = 'well_rested'
- [ ] `getSleepBankStatus`: 5h debt = 'moderate_debt'
- [ ] `getSleepBankTrend`: improving weekly avg = 'paying_off'
- [ ] `sumDailySleep`: multiple sessions summed correctly

### Integration Tests
- [ ] Full flow: 7 days sleep data -> sleep bank card shows correct debt -> chart renders
- [ ] Target change flow: change target from 8 to 7 -> debt recalculates

### QA Verification Script

1. Log 7 nights of sleep: 7h, 6h, 8h, 7.5h, 6.5h, 9h, 7h (total 51h vs 56h target)
2. Navigate to MyHealth > Vitals > Sleep section
3. Verify: Sleep Bank card shows "5 hours of debt" -- corresponds to AC-1
4. Verify: Status badge is orange (moderate debt) -- corresponds to AC-2
5. Verify: 7-day chart shows daily surplus/deficit bars -- corresponds to AC-3
6. Verify: Trend indicator displayed -- corresponds to AC-4
7. Change target to 7 hours
8. Verify: Debt recalculates (now 2h surplus) -- corresponds to AC-5
9. Check a day with no data
10. Verify: Shows full deficit for that day -- corresponds to AC-6

## gstack Quality Gates

Based on Complexity 4 (Inverse), this feature is "Small" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if this feature contains business logic:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for sleep bank calculation

### Post-merge:
- [ ] `/parity-check` -- skip (no standalone)

## Handoff State

### Before This Work
Sleep section tracks individual sessions with duration and quality but has no cumulative debt/surplus view.

### After This Work
- Sleep bank calculation engine with 7-day and 30-day rolling debt
- Daily balance chart (surplus/deficit around zero line)
- Status classification (well_rested through significant_debt)
- Trend tracking (paying_off/stable/accumulating)
- Debt cap at 20 hours

### Files Changed
- `modules/health/src/sleep/bank.ts` -- New: sleep bank engine
- `modules/health/src/sleep/types.ts` -- Extended: SleepBank type
- `modules/health/src/index.ts` -- Export sleep bank functions
- `apps/mobile/app/(health)/sleep-detail.tsx` -- Sleep bank card

### Known Limitations
- No personalized sleep need detection (fixed target only)
- No chronotype adjustment
- No distinction between nighttime sleep and naps for bank calculation
- 20-hour cap is arbitrary but prevents misleading large numbers

### Context for Next Agent
- Sleep data lives in hl_sleep_sessions.duration_minutes. Get all sessions for a date range and sum per day.
- Target hours comes from hl_settings WHERE key='sleep.targetHours' (default '8', stored as string, parse to number).
- The sleep bank is dynamically computed, not stored. No new table needed.
- Cap debt at 20 hours because sleep science says you can't "bank" more than ~2-3 days of recovery. Showing "42 hours of debt" is demoralizing and meaningless.
