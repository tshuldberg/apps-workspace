# Feature Spec: Sobriety Clock with Money Saved

## Metadata
- **Module:** habits
- **Priority Score:** 39 / 50 (A-Tier)
- **Scoring Breakdown:** Market 3 x3 + Switching 5 x3 + Complexity 4 x2 + CrossModule 3 x1 + PaidUser 4 x1
- **Sprint:** Sprint 2
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (negative habit type and streaks already exist)
- **Blocks:** Milestone celebrations (uses sobriety days as milestone source)

## Business Context

### Why This Feature Exists
I Am Sober is a $10M+/yr app that does exactly one thing: counts days sober and calculates money saved. It has 15M+ downloads and a 4.8 star rating. The entire value proposition is a real-time counter showing "X days, Y hours, Z minutes" since the user's quit date, plus a running total of money saved based on their self-reported daily spend on the habit. MyLife's habits module already supports negative habits (habits to avoid) with `getNegativeStreaks` tracking days since last slip. Adding a dedicated sobriety clock mode with a money-saved calculator turns the existing foundation into a direct I Am Sober competitor at no additional subscription cost.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| I Am Sober | Yes | Freemium ($39.99/yr premium) | Real-time sobriety clock (days/hours/min/sec), money saved counter, daily pledge, community, milestone celebrations. Premium adds advanced stats and motivational content. |
| Streaks | Partial | $4.99 one-time | Generic negative habit tracking. No money-saved calculation. No dedicated sobriety mode. |
| Habitica | No | N/A | Positive habit reinforcement only. No sobriety/quit tracking. |
| Habitify | No | N/A | Basic habit tracking. No dedicated quit/sobriety features. |
| Fabulous | No | N/A | Behavior coaching only. No sobriety tools. |

### Target User
I Am Sober users paying $39.99/yr who want sobriety tracking integrated with their other health data. Also anyone quitting smoking, drinking, vaping, gambling, or any expensive habit who wants to see the financial impact of their decision. Migration path: I Am Sober user discovers MyLife tracks sobriety AND cross-references it with mood, health, and budget data.

## Technical Context

### Where This Lives in MyLife

```
modules/habits/src/
  sobriety/
    engine.ts                   -- NEW: Sobriety clock calculator, money saved engine
    __tests__/engine.test.ts    -- NEW: Engine tests
  db/
    sobriety.ts                 -- NEW: Sobriety profile CRUD (hb_sobriety_profiles)
    schema.ts                   -- MODIFY: Add hb_sobriety_profiles, hb_sobriety_pledges tables
  types.ts                      -- MODIFY: Add sobriety Zod schemas
  definition.ts                 -- MODIFY: Add V3 migration
  index.ts                      -- MODIFY: Export sobriety engine + types
apps/mobile/app/(habits)/
  sobriety-clock.tsx            -- NEW: Sobriety clock screen (live counter, money saved)
apps/web/app/habits/
  sobriety/page.tsx             -- NEW: Web sobriety page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHabits card
       ├── Today tab
       │    └── [Negative habit card with sobriety clock widget]
       ├── Habits tab
       │    └── [Tap negative habit] -> Sobriety Clock screen
       ├── Stats tab
       └── Settings tab
```

A negative habit with `sobriety_enabled = 1` shows a mini sobriety clock on the Today tab. Tapping it opens the full Sobriety Clock screen.

### Data Model

```sql
-- Sobriety profile: per-habit sobriety configuration
CREATE TABLE IF NOT EXISTS hb_sobriety_profiles (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES hb_habits(id) ON DELETE CASCADE,
  quit_date TEXT NOT NULL,
  daily_cost INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  motivation TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(habit_id)
);

-- Daily pledge: optional commitment renewal each day
CREATE TABLE IF NOT EXISTS hb_sobriety_pledges (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES hb_sobriety_profiles(id) ON DELETE CASCADE,
  pledged_on TEXT NOT NULL,
  fulfilled INTEGER NOT NULL DEFAULT 0 CHECK (fulfilled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id, pledged_on)
);

CREATE INDEX IF NOT EXISTS hb_sobriety_profiles_habit_idx
  ON hb_sobriety_profiles(habit_id);
CREATE INDEX IF NOT EXISTS hb_sobriety_pledges_profile_date_idx
  ON hb_sobriety_pledges(profile_id, pledged_on DESC);
```

### Dependencies
- **Internal:** `@mylife/habits` (negative habit type, getNegativeStreaks, completions CRUD), `@mylife/db` (DatabaseAdapter)
- **External:** None. Pure local calculation.
- **Cross-Module:** Mood module correlation (sobriety days vs mood scores). Health module (sobriety as a health metric). Budget module (money saved feeds into financial tracking). All via existing cross-module interface.

## Functional Requirements

### User Stories
1. As a user quitting a habit, I want a live clock showing exactly how long I've been sober so I feel the weight of my achievement in real-time.
2. As a user quitting an expensive habit, I want to see how much money I've saved since quitting so I feel the financial reward.
3. As a user, I want to set a daily pledge to stay sober so I start each day with intentional commitment.
4. As a user, I want to log a slip (relapse) and have the clock reset accurately so I'm tracking honestly.
5. As a user, I want to see my sobriety history (total clean days, total slips, longest streak) so I can see progress even after setbacks.
6. As a user, I want to write a personal motivation statement that displays on my sobriety screen so I'm reminded why I quit.

### Behavior Specification

**Creating a sobriety profile:**
1. User creates or edits a negative habit (e.g., "Quit Smoking").
2. A toggle appears: "Enable Sobriety Clock."
3. When enabled, user enters:
   - Quit date (defaults to today, can be in the past)
   - Daily cost of the habit in dollars (e.g., $15/day for cigarettes)
   - Personal motivation (optional text, e.g., "For my kids")
4. This creates an `hb_sobriety_profiles` record linked to the habit.

**Sobriety Clock screen:**
1. Hero section: Live counter updating every second:
   - "X years, Y months, Z days"
   - "H hours, M minutes, S seconds"
   - All relative to `quit_date` minus any time lost to slips.
2. Money saved section:
   - "You've saved $X,XXX" (large green number)
   - Calculated: `clean_days * daily_cost`
   - "That's $Y per month you're keeping"
3. Motivation section: User's personal motivation text in a prominent card.
4. Daily pledge section:
   - If today's pledge hasn't been made: "Take today's pledge" button.
   - If pledged: Checkmark with "Pledged for today."
   - Pledge streak counter: "X consecutive daily pledges."
5. Quick actions:
   - "I Slipped" button (logs a slip, opens confirmation dialog)
   - "Reset Clock" (starts over from today)
6. Stats section:
   - Total clean days (lifetime, across all attempts)
   - Total slips
   - Current streak
   - Longest streak
   - Money saved (lifetime total)

**Slip handling:**
1. User taps "I Slipped."
2. Confirmation dialog: "This will log a slip for today. Your clock will reset. Are you sure?"
3. On confirm: records a completion with `value = -1` (existing negative habit convention).
4. The sobriety clock resets to 0. The money-saved counter resets for the current streak.
5. Lifetime stats still show total clean days across all attempts.
6. The slip is logged in the activity feed.

**Money saved calculation:**
```
clean_days = days since quit_date, minus days with slips
money_saved_current_streak = days_since_last_slip * daily_cost
money_saved_lifetime = total_clean_days * daily_cost
```

### Edge Cases

- **Quit date in the future:** Prevent. Validation: quit_date <= today.
- **Daily cost = $0:** Valid (tracking sobriety without financial component). Money saved section shows $0 but clock still runs.
- **Multiple slips on the same day:** Only counts as one slip day. Clock resets once.
- **Slip logged for a past date:** Not supported in V1. Slips are always "today."
- **User changes quit date:** Recalculates everything from new quit date.
- **User changes daily cost:** Applies to all future calculations. Past savings are recalculated retroactively.
- **Very long sobriety (years):** Clock shows years, months, days. Money saved shows formatted with commas.
- **Module disabled:** Clock stops displaying but data is preserved.
- **Habit deleted:** Sobriety profile cascades delete (ON DELETE CASCADE).
- **Multiple sobriety profiles (quit smoking AND quit drinking):** Supported. Each negative habit can have its own profile.
- **Timer precision:** The live counter uses client-side `setInterval(1000)`. The calculated "seconds since quit" is derived from `Date.now() - quitDateTimestamp`. No server round-trips for ticking.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Sobriety clock shows live counter (years/months/days/hours/min/sec) updating every second
- [ ] **AC-2:** Money saved displays as a formatted dollar amount based on clean days * daily cost
- [ ] **AC-3:** Personal motivation text is displayed prominently on the clock screen
- [ ] **AC-4:** Daily pledge button allows the user to commit each day
- [ ] **AC-5:** Pledge streak tracks consecutive daily pledges
- [ ] **AC-6:** "I Slipped" resets the clock and logs a slip after confirmation
- [ ] **AC-7:** Lifetime stats show total clean days, total slips, longest streak across all attempts
- [ ] **AC-8:** Creating a negative habit with sobriety enabled creates the profile correctly
- [ ] **AC-9:** Mini sobriety widget shows on the Today tab for enabled habits
- [ ] **AC-10:** Feature renders correctly on both mobile and web
- [ ] **AC-11:** Clock continues to show correct time after app backgrounding/foregrounding

### Technical Criteria
- [ ] **TC-1:** `calculateSobrietyDuration` returns correct years/months/days/hours/min/sec from quit date
- [ ] **TC-2:** `calculateMoneySaved` returns correct amount for given clean days and daily cost
- [ ] **TC-3:** Slips are recorded as completions with value = -1 (existing convention)
- [ ] **TC-4:** V3 migration creates hb_sobriety_profiles and hb_sobriety_pledges tables
- [ ] **TC-5:** Sobriety profile is UNIQUE per habit (only one profile per habit)
- [ ] **TC-6:** Daily pledge is UNIQUE per profile per day
- [ ] **TC-7:** Engine functions are pure (no side effects, no database calls)

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Sobriety clock must NOT allow a quit date in the future
- [ ] **NC-2:** Slip logging must NOT happen without user confirmation
- [ ] **NC-3:** Clock reset must NOT delete historical slip data
- [ ] **NC-4:** Money saved must NOT show negative values
- [ ] **NC-5:** The live timer must NOT drain battery (use 1-second intervals, not sub-second)

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Module accent: `#8B5CF6` (habits purple)
- Clock numbers: Large monospace font (40pt), white
- Money saved: `#22C55E` (green), 32pt bold
- Motivation text: `rgba(240,240,245,0.65)` (textSecondary), italic
- Slip button: `#EF4444` (danger red) outlined

Layout:
```
[Sobriety Clock Screen]

  "Quit Smoking"                    [habit name]
  "247 days, 14 hours"             [large, white, live]
  "32 minutes, 18 seconds"         [medium, secondary]

  [$3,705 saved]                   [large, green]
  "$15/day kept in your pocket"    [small, secondary]

  [Motivation Card]
  "For my kids and my health"      [italic, glass card]

  [Daily Pledge Card]
  [✓ Pledged for today]            [or: Take Today's Pledge button]
  "12-day pledge streak"

  [Stats Card]
  Total clean days: 247
  Longest streak: 247 days
  Total slips: 2
  Lifetime saved: $4,185

  [I Slipped]                      [red outlined button, bottom]
```

### Web (Next.js)

- Route: `/habits/sobriety`
- Same tokens via CSS variables
- Clock uses `setInterval(1000)` client-side for live updates
- Responsive: single column, max-width 600px centered

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton clock placeholder | Initial data fetch |
| No profile | "Enable sobriety tracking on a negative habit to get started" + CTA | No sobriety profiles exist |
| Active (clean) | Live clock ticking, money accumulating, green theme | Clean streak active |
| Just slipped | Clock at 0, "Day 1 starts now" encouraging message | After logging a slip |
| Pledge pending | "Take Today's Pledge" prominent button | New day, no pledge yet |
| Pledge made | Checkmark, pledge streak counter | Pledge logged for today |
| Error | "Could not load sobriety data" + retry | Data fetch failure |

## Test Requirements

### Unit Tests
- [ ] `calculateSobrietyDuration`: quit date 30 days ago, no slips -> 30 days 0 hours
- [ ] `calculateSobrietyDuration`: quit date 1 year ago -> correct year/month/day breakdown
- [ ] `calculateSobrietyDuration`: quit date today -> 0 days, hours/min since midnight
- [ ] `calculateMoneySaved`: 30 clean days, $15/day -> $450 (45000 cents)
- [ ] `calculateMoneySaved`: 0 clean days -> $0
- [ ] `calculateMoneySaved`: daily_cost = 0 -> $0
- [ ] `calculateLifetimeStats`: 2 slips in history, 100 total clean days -> correct totals
- [ ] `calculateLifetimeStats`: no slips ever -> clean days = days since quit date
- [ ] `getPledgeStreak`: 5 consecutive pledges -> streak = 5
- [ ] `getPledgeStreak`: gap in pledges -> streak resets
- [ ] Slip recording: creates completion with value = -1

### Integration Tests
- [ ] Full flow: create negative habit -> enable sobriety -> clock starts -> money accumulates
- [ ] Slip flow: log slip -> clock resets -> lifetime stats preserved
- [ ] Pledge flow: take pledge -> pledge streak increments -> skip day -> streak resets

### QA Verification Script

1. Open the app on [iOS / web]
2. Navigate to MyHabits > Habits tab
3. Create a negative habit "Quit Smoking" with sobriety enabled, quit date = 30 days ago, daily cost = $15
4. Navigate to the sobriety clock screen
5. Verify: Clock shows ~30 days with live ticking -- AC-1
6. Verify: Money saved shows ~$450 -- AC-2
7. Enter motivation text "For my kids"
8. Verify: Motivation displays in card -- AC-3
9. Tap "Take Today's Pledge"
10. Verify: Pledge confirmed, streak shows 1 -- AC-4, AC-5
11. Tap "I Slipped"
12. Verify: Confirmation dialog appears
13. Confirm the slip
14. Verify: Clock resets to 0, lifetime stats still show 30 clean days + 1 slip -- AC-6, AC-7
15. Navigate to Today tab
16. Verify: Mini sobriety widget visible for this habit -- AC-9
17. Verify on web at /habits/sobriety -- AC-10

## gstack Quality Gates

Based on Complexity score 4 (Small), these gates are required:

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to sobriety clock, verify live counter, test slip flow

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for sobriety + money-saved calculations

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Negative habit type exists with `getNegativeStreaks` (daysSinceLastSlip, longestCleanStreak).
- Slips are recorded as completions with value = -1.
- No sobriety-specific UI, no money-saved calculator, no daily pledge system, no sobriety profiles.
- Habits module has V2 schema (9 tables), habit types: standard, timed, negative, measurable.

### After This Work
- New engine: `modules/habits/src/sobriety/engine.ts` with duration, money-saved, lifetime stats, and pledge streak calculations.
- New CRUD: `modules/habits/src/db/sobriety.ts` for sobriety profiles and pledges.
- New tables: `hb_sobriety_profiles`, `hb_sobriety_pledges` (V3 migration).
- New screens: mobile sobriety clock, web `/habits/sobriety` page.
- Mini sobriety widget on Today tab for enabled negative habits.

### Files Changed
- `modules/habits/src/sobriety/engine.ts` -- NEW: Sobriety calculation engine
- `modules/habits/src/sobriety/__tests__/engine.test.ts` -- NEW: Engine tests
- `modules/habits/src/db/sobriety.ts` -- NEW: Sobriety profile + pledge CRUD
- `modules/habits/src/db/schema.ts` -- MODIFY: Add V3 tables + indexes
- `modules/habits/src/types.ts` -- MODIFY: Add SobrietyProfile, SobrietyPledge Zod schemas
- `modules/habits/src/definition.ts` -- MODIFY: Add V3 migration
- `modules/habits/src/index.ts` -- MODIFY: Export sobriety engine + types
- `apps/mobile/app/(habits)/sobriety-clock.tsx` -- NEW: Mobile sobriety clock screen
- `apps/web/app/habits/sobriety/page.tsx` -- NEW: Web sobriety page

### Known Limitations
- **No community/social features.** I Am Sober has a community feed. Out of scope.
- **No motivational content library.** I Am Sober premium has daily motivational quotes. Out of scope.
- **Slips are day-granularity only.** Can't log a slip at a specific time.
- **No push notification for daily pledge reminder.** Future: integrate with expo-notifications.

### Context for Next Agent
- Slips use the existing negative habit convention: `recordCompletion(db, id, habitId, date, -1)`. The value = -1 flag is how `getNegativeStreaks` identifies slip days.
- The live clock is client-side only. The engine computes duration from `quit_date` to `Date.now()`. The database stores quit_date; the UI handles live ticking.
- `daily_cost` is stored as integer cents (like the budget module). Display as dollars with 2 decimal places.
- The sobriety profile is 1:1 with a habit (UNIQUE(habit_id)). Don't create a profile for standard/timed/measurable habits, only negative ones.
- For the mini widget on the Today tab, show: "[habit name]: X days | $Y saved" in a compact card format.
