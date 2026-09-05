# Feature Spec: Caffeine Tracking

## Metadata
- **Module:** fast
- **Priority Score:** 27 / 50 (B-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [2] x3 + Complexity [3] x2 + CrossModule [3] x1 + PaidUser [3] x1
- **Sprint:** 2+
- **Estimated CC Time:** 2-3 hours
- **Depends On:** Multi-beverage types (FT-014, provides beverage log infrastructure and caffeine_mg column)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Caffeine is the most widely consumed psychoactive substance and is directly relevant to fasting. Many intermittent fasters drink black coffee or tea during fasting windows. Knowing daily caffeine intake and when it will metabolize helps users: (1) stay within the FDA-recommended 400mg daily limit, (2) time their last caffeinated drink to avoid sleep disruption, and (3) understand how caffeine interacts with their fasting protocol. Zero ($69.99/yr) is the only major fasting app with caffeine awareness, and it's behind a paywall. Offering this free creates a meaningful competitive advantage.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Zero | Yes | Yes ($69.99/yr) | Basic caffeine awareness, logs caffeinated drinks, daily total |
| Simple | No | N/A | No caffeine tracking |
| WaterMinder | No | N/A | Tracks beverage types but no caffeine metrics |
| Fastic | No | N/A | No beverage or caffeine tracking |
| HiCoffee | Yes | Free | Dedicated caffeine tracker, metabolization curve, sleep impact warnings |
| Caffeine Tracker | Yes | Free | Simple daily total, half-life countdown |

### Target User
Coffee-drinking intermittent fasters (the majority of IF practitioners). Users who drink 2-4 cups of coffee/tea daily and want to know if they're overdoing it. People who struggle with sleep quality and suspect late-day caffeine is a factor. Users of dedicated caffeine apps (HiCoffee, Caffeine Tracker) who would prefer all tracking in one app.

## Technical Context

### Where This Lives in MyLife

```
modules/fast/src/types.ts                    -- CaffeineSnapshot, CaffeineSummary types
modules/fast/src/engines/caffeine-engine.ts  -- Pure caffeine calculation engine
modules/fast/src/db/beverages.ts             -- getCaffeineLogsForDate query (extends existing)
modules/fast/src/db/schema.ts                -- New settings seeds (V4 migration, same as FT-014)
modules/fast/src/index.ts                    -- Export caffeine engine functions
apps/mobile/app/(fast)/timer.tsx             -- Add CaffeineSummaryCard below hydration card
apps/web/app/fast/page.tsx                   -- Add caffeine summary section
```

### Wireframe Position

```
Hub Dashboard
  └── MyFast card
       └── Timer tab
            └── Hydration Card (with beverage picker from FT-014)
                 └── Caffeine Summary Card ← YOU ARE HERE
```

The caffeine card sits directly below the hydration card on the Timer tab. It only appears when `caffeineTrackingEnabled` is true in ft_settings.

### Data Model

No new tables are required. Caffeine tracking reads from the infrastructure created by FT-014 (Multi-Beverage Types):

- **ft_beverage_types.caffeine_mg** -- Already populated with caffeine content per default serving (e.g., coffee=95mg, green tea=28mg)
- **ft_beverage_log** -- Already records volume_oz and beverage_type_id with timestamps

**New settings keys (added to V4 migration seed):**

```sql
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('caffeineTrackingEnabled', 'false');
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('caffeineCutoffTime', '14:00');
INSERT OR IGNORE INTO ft_settings (key, value) VALUES ('caffeineDailyLimitMg', '400');
```

### Dependencies
- **Internal:** FT-014 Multi-Beverage Types (required -- provides ft_beverage_types with caffeine_mg, ft_beverage_log with timestamps)
- **External:** None (all on-device, pure math)
- **Cross-Module:** Health module could display caffeine as a daily metric. Mood module could correlate caffeine intake with mood entries. Sleep tracking (if added to Health) could use caffeine clear-by time.

## Functional Requirements

### User Stories
1. As a coffee drinker who fasts, I want to see my daily caffeine total so I know if I'm approaching the 400mg recommended limit.
2. As someone who has trouble sleeping, I want to know when my caffeine will metabolize below a negligible level so I can time my last cup.
3. As a health-conscious user, I want a warning if I drink caffeine after my personal cutoff time so I can make informed choices.
4. As an intermittent faster, I want caffeine tracking integrated into my fasting timer screen so I don't need a separate app.

### Behavior Specification

**Viewing caffeine summary:**
1. User opens MyFast Timer tab
2. If `caffeineTrackingEnabled` is true, a Caffeine Summary Card appears below the hydration card
3. Card shows: daily total (e.g., "190 mg"), status indicator (green/yellow/orange), and "clear by" estimate
4. If no caffeinated beverages logged today, card shows "0 mg caffeine" with muted styling

**Logging caffeine (automatic):**
1. User logs a caffeinated beverage via the beverage picker (from FT-014)
2. System automatically calculates caffeine: caffeine_mg * (volume_oz / default_oz)
3. Caffeine card updates with new total
4. If total exceeds daily limit (default 400mg), yellow warning appears
5. If drink was logged after cutoff time (default 14:00), orange warning appears

**Metabolization timeline:**
1. User taps the caffeine card to expand details
2. Expanded view shows: list of today's caffeinated drinks with individual mg amounts, a metabolization curve (declining exponential), and "caffeine clear by" timestamp
3. Metabolization uses a 5-hour half-life constant
4. "Clear by" is the time when estimated remaining caffeine drops below 25mg

**Settings:**
1. User navigates to Settings > Caffeine Tracking
2. Toggle: enable/disable caffeine tracking
3. Cutoff time picker: HH:MM (default 14:00)
4. Daily limit input: number in mg (default 400)
5. Custom caffeine values: user can override caffeine_mg per beverage type

### Edge Cases

- **No caffeinated drinks today:** Card shows "0 mg caffeine" in muted state. No timeline or warnings shown.
- **Beverage type has null caffeine_mg:** Treated as 0mg. Non-caffeinated drinks do not appear in the caffeine timeline.
- **Multiple drinks at different times:** Each metabolizes independently. Total remaining = SUM of individual remaining amounts at any given time t.
- **Volume differs from default_oz:** Caffeine scales linearly. A 16oz coffee (default 8oz at 95mg) contributes 190mg.
- **Half-life is approximate:** Display metabolization as "estimated" since actual half-life varies by individual (3-7 hours). The 5-hour constant is the median.
- **Drinks logged without timestamp context:** ft_beverage_log.logged_at provides the timestamp. If user manually edits a log date to the past, caffeine should recalculate from that timestamp.
- **Caffeine total exceeds 1000mg:** Show red warning "Extremely high caffeine intake" in addition to numeric total. This is medically significant.
- **Cutoff time set to 00:00:** All caffeinated drinks trigger the "late caffeine" warning. This is valid (user wants to track all caffeine).
- **Module disabled mid-day:** Caffeine data preserved. Re-enabling shows cumulative data for the day.
- **Clear-by time extends past midnight:** Display as "Tomorrow 2:30 AM" format. Do not wrap around to show nonsensical times.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Caffeine Summary Card appears on Timer tab when `caffeineTrackingEnabled` is true
- [ ] **AC-2:** Card shows "0 mg caffeine" in muted state when no caffeinated drinks logged
- [ ] **AC-3:** Logging 2 drip coffees (95mg each) shows "190 mg" with green indicator
- [ ] **AC-4:** When daily total >= 400mg, yellow warning shows "High caffeine day"
- [ ] **AC-5:** When daily total >= 1000mg, red warning shows "Extremely high caffeine intake"
- [ ] **AC-6:** Logging coffee after cutoff time (default 14:00) shows orange warning "Late caffeine -- may affect sleep"
- [ ] **AC-7:** Tapping card expands to show individual drink breakdown with mg per drink
- [ ] **AC-8:** Expanded view shows metabolization curve as declining exponential
- [ ] **AC-9:** "Caffeine clear by" estimate shown (time when remaining < 25mg)
- [ ] **AC-10:** A 16oz coffee (double default 8oz) correctly shows 190mg (scaled caffeine)
- [ ] **AC-11:** Metabolization timeline shows ~100mg remaining 5 hours after consuming 200mg
- [ ] **AC-12:** Settings allows toggle on/off, cutoff time adjustment, and daily limit change

### Technical Criteria
- [ ] **TC-1:** `calculateDailyCaffeine` sums caffeine_mg * (volume_oz / default_oz) across all caffeinated beverage logs for a given date
- [ ] **TC-2:** `calculateRemainingCaffeine` applies half-life formula: remaining = dose * 0.5^((now - loggedAt) / 5h) for each drink
- [ ] **TC-3:** `calculateClearByTime` finds the time when SUM(remaining) < 25mg, accurate to 15-minute granularity
- [ ] **TC-4:** Caffeine engine functions are pure (no side effects, no DB access -- take data as input)
- [ ] **TC-5:** Settings keys (caffeineTrackingEnabled, caffeineCutoffTime, caffeineDailyLimitMg) read/write via existing getSetting/setSetting
- [ ] **TC-6:** All caffeine calculations complete in <10ms for 20+ drinks per day
- [ ] **TC-7:** Beverages with null caffeine_mg are excluded from caffeine calculations (treated as 0mg)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Caffeine tracking must NOT create any new database tables
- [ ] **NC-2:** Caffeine data must NOT be sent off-device
- [ ] **NC-3:** The caffeine card must NOT appear when caffeineTrackingEnabled is false
- [ ] **NC-4:** Non-caffeinated beverage logs must NOT appear in the caffeine breakdown
- [ ] **NC-5:** Caffeine calculations must NOT modify beverage log entries (read-only)

## UI Specification

### Mobile (Expo)

**Caffeine Summary Card (collapsed):**
- Background: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Layout: single row with caffeine icon (left), total mg (center-left, large text), status indicator (center-right), chevron (right)
- Status indicator colors: green (<400mg before cutoff), yellow (>=400mg), orange (any drink after cutoff), red (>=1000mg)
- Status indicator: small colored dot or pill with short label

**Caffeine Summary Card (expanded):**
- Drink list: each row shows beverage icon, name, time logged, and mg amount
- Metabolization curve: small SVG/canvas chart showing declining exponential from each drink
- "Clear by" estimate: text below chart, e.g., "Caffeine clears by ~10:30 PM"
- All text uses `#F0F0F5` (text token), secondary info uses `rgba(240,240,245,0.65)` (textSecondary)

**Settings:**
- Toggle row: "Caffeine Tracking" with switch
- Time picker: "Cutoff Time" with time wheel (HH:MM format)
- Number input: "Daily Limit (mg)" with stepper

### Web (Next.js)

- Same tokens via CSS variables
- Card uses `<details>/<summary>` or accordion pattern instead of tap-to-expand
- Metabolization chart: lightweight inline SVG (no chart library needed for simple exponential curve)
- Settings: standard form inputs in the Fast settings page

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Disabled | Card not rendered | caffeineTrackingEnabled = false |
| Empty | "0 mg caffeine" muted text, no chart | No caffeinated drinks today |
| Normal | Green dot, total mg, "Clear by X" | < 400mg, before cutoff |
| High | Yellow pill "High caffeine day" | >= 400mg |
| Late | Orange pill "Late caffeine" | Any drink after cutoff time |
| Critical | Red pill "Extremely high" | >= 1000mg |
| Error | "Could not load caffeine data" + retry | DB query failure |

## Test Requirements

### Unit Tests
- [ ] `calculateDailyCaffeine`: 2 coffees (95mg each) returns 190mg
- [ ] `calculateDailyCaffeine`: 16oz coffee (default 8oz, 95mg) returns 190mg (scaled)
- [ ] `calculateDailyCaffeine`: herbal tea (0mg caffeine) returns 0mg
- [ ] `calculateDailyCaffeine`: mix of caffeinated and non-caffeinated returns only caffeinated sum
- [ ] `calculateDailyCaffeine`: no drinks returns 0
- [ ] `calculateRemainingCaffeine`: 200mg at T, check at T+5h returns ~100mg (within 1mg tolerance)
- [ ] `calculateRemainingCaffeine`: 200mg at T, check at T+10h returns ~50mg
- [ ] `calculateRemainingCaffeine`: multiple drinks at different times calculates independently
- [ ] `calculateClearByTime`: 200mg at 8AM clears by approximately 9:40 PM (200 * 0.5^(t/5) < 25 when t ~ 15h)
- [ ] `calculateClearByTime`: no caffeinated drinks returns null (already clear)
- [ ] `getCaffeineStatus`: <400mg before cutoff returns 'normal'
- [ ] `getCaffeineStatus`: >=400mg returns 'high'
- [ ] `getCaffeineStatus`: any drink after cutoff returns 'late'
- [ ] `getCaffeineStatus`: >=1000mg returns 'critical'
- [ ] `getCaffeineStatus`: no caffeine returns 'empty'
- [ ] `scaleCaffeine`: correctly scales mg by volume ratio (volume_oz / default_oz)

### Integration Tests
- [ ] Full flow: log 3 coffees at different times -> daily total correct -> metabolization curve renders -> clear-by time reasonable
- [ ] Settings flow: enable caffeine tracking -> card appears -> change cutoff -> late warning triggers correctly
- [ ] Cross-feature: logging via beverage picker (FT-014) automatically updates caffeine card

### QA Verification Script

1. Open the app on mobile
2. Navigate to MyFast > Settings
3. Enable "Caffeine Tracking"
4. Set cutoff time to 14:00 (2 PM)
5. Set daily limit to 400 mg
6. Navigate back to Timer tab
7. Verify: Caffeine Summary Card appears showing "0 mg caffeine" -- AC-1, AC-2
8. Tap "+" on hydration card, log 1 drip coffee (8oz)
9. Verify: Caffeine card updates to "95 mg" with green indicator -- AC-3
10. Log another drip coffee
11. Verify: Card shows "190 mg" with green indicator -- AC-3
12. Tap the caffeine card to expand
13. Verify: Shows 2 coffee entries with 95mg each, metabolization curve, "clear by" time -- AC-7, AC-8, AC-9
14. Log a 16oz coffee via long-press (double volume)
15. Verify: Card shows "380 mg" (190 + 190) -- AC-10
16. Log one more 8oz coffee
17. Verify: Card shows "475 mg" with yellow "High caffeine day" warning -- AC-4
18. Note the current time. If before 2 PM, change cutoff to a time in the past
19. Log another coffee
20. Verify: Orange "Late caffeine -- may affect sleep" warning appears -- AC-6
21. Log enough coffee to exceed 1000mg total
22. Verify: Red "Extremely high caffeine intake" warning -- AC-5
23. Expand card, check metabolization
24. Verify: Shows declining curve, individual drink breakdown -- AC-7, AC-8
25. Verify: "Clear by" time shows reasonable future time (should be ~15 hours after last heavy intake) -- AC-9, AC-11
26. Navigate to Settings, disable caffeine tracking
27. Verify: Caffeine card disappears from Timer tab -- NC-3
28. Re-enable: verify data is preserved
29. Repeat steps 7-13 on web at `/fast`

## gstack Quality Gates

Based on this feature's complexity score (3/5 = Inverse 2), these gstack skills are REQUIRED:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states
- [ ] Batch QA: after 5 features in this module, run `/qa` on the module URL

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for caffeine calculation engine

### Post-merge (handled by sprint lead):
- [ ] `/parity-check` -- if module has standalone counterpart
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- ft_beverage_types exists with caffeine_mg column pre-populated (from FT-014)
- ft_beverage_log records drink entries with timestamps and volumes
- No caffeine awareness, no metabolization calculations, no caffeine UI

### After This Work
- Caffeine engine with pure calculation functions (daily total, remaining at time t, clear-by estimate, status classification)
- Caffeine Summary Card on Timer tab (collapsed and expanded views)
- Three new settings keys for caffeine preferences
- Metabolization timeline visualization

### Files Changed
- `modules/fast/src/types.ts` -- Added CaffeineSnapshot, CaffeineSummary, CaffeineStatus types
- `modules/fast/src/engines/caffeine-engine.ts` -- New file: pure caffeine calculation engine
- `modules/fast/src/db/beverages.ts` -- Added getCaffeineLogsForDate query
- `modules/fast/src/db/schema.ts` -- Added 3 caffeine settings to SEED_SETTINGS
- `modules/fast/src/index.ts` -- Exported caffeine engine functions
- `apps/mobile/app/(fast)/timer.tsx` -- Added CaffeineSummaryCard component
- `apps/web/app/fast/page.tsx` -- Added caffeine summary section

### Known Limitations
- Half-life is fixed at 5 hours. Individual variation (3-7 hours) is not configurable in this iteration.
- Metabolization curve is a simple declining exponential. Real caffeine metabolism involves absorption delay (~45 min to peak) which is not modeled.
- No integration with sleep tracking or Health module yet. Future work could auto-set cutoff based on typical bedtime.
- Caffeine from food sources (chocolate, etc.) is not tracked, only from beverages.

### Context for Next Agent
- The caffeine engine must be 100% pure functions. No database access inside engine functions. The calling layer fetches data and passes it to the engine.
- The metabolization formula is: remaining(t) = dose * 0.5^((t - loggedAt) / (5 * 3600000)) where times are in milliseconds.
- CaffeineStatus is an enum: 'empty' | 'normal' | 'high' | 'late' | 'critical'. The UI maps these to indicator colors.
- The "clear by" time is found by binary search or iterative stepping (15-min increments) on the total remaining function. The total remaining at time t is the sum of individual remaining amounts for each drink.
