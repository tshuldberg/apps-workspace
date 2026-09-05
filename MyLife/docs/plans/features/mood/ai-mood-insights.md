# Feature Spec: AI Mood Insights

## Metadata
- **Module:** mood
- **Priority Score:** 30 / 50 (A-Tier)
- **Scoring Breakdown:** Market [3] x3 + Switching [3] x3 + Complexity [2] x2 + CrossModule [4] x1 + PaidUser [4] x1
- **Sprint:** 5
- **Estimated CC Time:** 4-5 hours
- **Depends On:** Existing mood entry CRUD, activity correlations, emotion tags, daily averages
- **Blocks:** none

## Business Context

### Why This Feature Exists
Users log mood data consistently but most mood apps stop at showing charts and averages. They don't tell the user what the data means or what to do about it. Reflectly ($59.99/yr) differentiates itself with "AI-powered insights," but those require cloud processing, violating privacy. MyMood can deliver the same value with an on-device pattern detection engine that analyzes existing mood data and generates actionable insights without any network calls. The high cross-module score (4/5) means insights can incorporate signals from other MyLife modules (workouts, fasting, sleep) to surface patterns the user would never notice in a single-module view.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Reflectly | Yes | Yes ($59.99/yr) | Cloud AI generates journal prompts and mood insights, requires network, privacy concerns |
| Daylio | Partial | Yes ($35.99/yr) | Basic activity correlations and charts, no AI narrative or pattern detection |
| Bearable | Partial | Yes ($34.99/yr) | Multi-factor correlation analysis, shows factor rankings, no AI narration |
| Calm | No | N/A | No mood analytics (meditation-focused) |

### Target User
Regular mood loggers (18-55) who have accumulated 2+ weeks of data and want to understand their patterns without manually analyzing charts. Users of Reflectly ($59.99/yr) who want AI-quality insights without cloud processing. Also data-curious users who log mood alongside activities and want to know which behaviors actually correlate with better days.

## Technical Context

### Where This Lives in MyLife

```
modules/mood/src/
  types.ts                                  -- New types: MoodInsight, InsightType, InsightSeverity
  engines/insight-engine.ts                 -- NEW: Pattern detection engine, insight generators
  engines/insight-templates.ts              -- NEW: Natural language insight template strings
  __tests__/insight-engine.test.ts          -- NEW: Unit tests for pattern detection

apps/mobile/app/(mood)/
  insights-feed.tsx                         -- NEW: AI Insights feed screen (or section in existing Insights tab)

apps/web/app/mood/
  insights/page.tsx                         -- MODIFIED: Add insights feed section
```

### Wireframe Position

```
Hub Dashboard
  └── MyMood card
       └── Insights tab
            ├── Dashboard (existing averages, streaks)
            ├── Correlations (existing Pearson r)
            └── Insights Feed ← YOU ARE HERE
                 ├── Insight cards sorted by recency
                 ├── "Your Patterns" section
                 └── Cross-module insights (future)
```

The Insights Feed is accessible from:
1. The Insights tab in MyMood as a sub-section or dedicated view
2. A "New Insight" badge on the MyMood dashboard card
3. A weekly digest notification (optional, user-configurable)

### Data Model

No new tables required. Insights are computed on-the-fly from existing mood data (mo_entries, mo_activities, mo_emotion_tags, mo_entry_activities). Insight state (which insights have been seen/dismissed) is stored in `mo_settings` with key prefix `insight_`.

```sql
-- No new tables. Settings keys used for insight state:
-- 'insight_last_generated' = ISO timestamp of last generation
-- 'insight_dismissed_[insightId]' = '1' for dismissed insights
-- 'insight_weekly_digest_enabled' = 'true'/'false'
```

**Insight types computed by the engine:**

| Insight Type | Algorithm | Minimum Data |
|-------------|-----------|-------------|
| `day_of_week_pattern` | Compare average score per weekday across last 30 days | 14 entries across 3+ weekdays |
| `time_of_day_pattern` | Compare morning/afternoon/evening entry averages | 14 entries with varied times |
| `activity_impact` | Use existing Pearson r correlations, surface top positive and negative | 20 entries with 3+ activities |
| `emotion_cluster` | Find frequently co-occurring emotions across entries | 30 entries with 2+ emotions each |
| `streak_impact` | Compare mood during active streaks vs streak-broken periods | 1 completed streak + 1 gap |
| `trend_direction` | Compare this week's average to last 4 weeks' rolling average | 35 entries (5 weeks) |
| `volatility_alert` | Standard deviation of daily scores over the past 7 days | 7 entries in last 7 days |
| `best_worst_day` | Identify best and worst days with context (activities, emotions) | 14 entries |

### Dependencies
- **Internal:** `@mylife/db` (DatabaseAdapter), `@mylife/ui` (Cool Obsidian tokens), existing analytics functions (getDailyAverages, getActivityCorrelations, getTopEmotions, getMoodDashboard)
- **External:** `zod` (validation). No external APIs, no cloud AI, no network calls.
- **Cross-Module:** Designed for future cross-module integration. Insight engine accepts a generic `DataSource[]` parameter so that Workouts frequency, Fast completion, Journal word count, and other module signals can be piped in as additional correlation factors. MVP is mood-only.

## Functional Requirements

### User Stories
1. As a regular mood logger, I want the app to tell me what patterns it detects in my mood data, so I can understand my emotional trends without manually analyzing charts.
2. As a data-driven user, I want to see which days of the week and times of day correlate with better or worse moods, so I can adjust my schedule.
3. As an activity-aware tracker, I want the app to surface which activities most impact my mood (positively and negatively), so I can make informed lifestyle choices.
4. As a long-term user, I want weekly insights that compare this week to my recent baseline, so I can spot emerging trends early.
5. As a privacy-first user, I want all insight computation to happen on my device with zero network calls, so my emotional patterns never leave my phone.

### Behavior Specification

**Insight generation (automatic):**
1. On every app open where the last generation was > 24 hours ago (tracked via `insight_last_generated` setting):
2. The insight engine runs all 8 pattern detectors against the user's mood data.
3. Each detector returns 0 or more insights with a type, severity (info/notable/actionable), title, body, and supporting data (numbers, activity names, etc.).
4. Insights are deduplicated against previously generated insights (same type + same conclusion = skip).
5. New insights are added to the feed. `insight_last_generated` is updated to now.

**Viewing the insights feed:**
1. User navigates to MyMood > Insights > Insights Feed (or a dedicated "For You" sub-tab).
2. Feed shows insight cards sorted by recency (newest first).
3. Each card shows: insight type icon, title (e.g., "Your Best Day"), body text (e.g., "Wednesdays are your happiest day -- your average mood is 7.8 compared to 6.2 on Mondays"), supporting metric in accent color.
4. Cards have a "Dismiss" action (swipe or tap X) that marks the insight as seen and removes it from the feed.
5. A "Refresh" button re-runs the insight engine immediately (bypasses the 24-hour cooldown).

**Insight card structure:**
- **Title:** short, attention-grabbing (e.g., "Exercise Boosts Your Mood", "Monday Blues Confirmed", "Volatile Week")
- **Body:** 1-3 sentences explaining the pattern with specific numbers (e.g., "Over the last 30 days, your mood averages 7.2 on days you exercise compared to 5.8 on days you don't. That's a +1.4 point difference.")
- **Supporting metric:** key number highlighted (e.g., "+1.4 pts", "r = 0.45", "3-day streak")
- **Severity badge:** Info (neutral), Notable (amber), Actionable (green)

**Pattern detector behavior (each of the 8 types):**

1. **day_of_week_pattern:** Compute per-weekday average over last 30 days. If any weekday differs from overall average by > 1.0 point, generate insight. Title: "Your Best Day" or "Your Hardest Day". Body includes the specific weekday and comparison.

2. **time_of_day_pattern:** Bucket entries by time of day (morning 5am-12pm, afternoon 12pm-5pm, evening 5pm-10pm, night 10pm-5am). Compare averages. If any bucket differs by > 0.8 from overall, generate insight.

3. **activity_impact:** Use existing `getActivityCorrelations()`. For the top positive activity (highest avg score) and top negative (lowest avg score), generate insight cards. Requires Pearson |r| >= 0.2 to surface (lower threshold than the 0.3 significance threshold to surface interesting-but-not-yet-significant patterns).

4. **emotion_cluster:** Find emotion pairs that co-occur in > 30% of entries. Generate insight: "Joy and Anticipation often appear together in your entries (42% of the time)."

5. **streak_impact:** Compare average mood during streak periods vs non-streak days. Generate insight if difference > 0.5: "During logging streaks, your mood averages 7.1 vs 5.9 on gap days."

6. **trend_direction:** Compare this week's average to the 4-week rolling average. If this week is > 1.0 higher: "Great week! Your mood is trending up." If > 1.0 lower: "Tough week. Your mood is below your recent average."

7. **volatility_alert:** Compute standard deviation of daily averages over last 7 days. If stddev > 2.0: "Volatile week -- your mood has been swinging significantly. Consider what might be driving the ups and downs."

8. **best_worst_day:** Find the highest-scored and lowest-scored days in the last 14 days. Surface them with context: "Your best day was Wednesday (8.5) -- you logged Exercise and Social that day."

**Weekly digest (optional):**
1. If `insight_weekly_digest_enabled` is "true":
2. Every Sunday evening (local time), compute all 8 pattern detectors.
3. If any new insights generated, schedule a local notification: "Your weekly mood insights are ready."
4. User taps notification -> navigates to Insights Feed.

**Insufficient data handling:**
- Each pattern detector has a minimum data threshold (see Data Model table).
- If insufficient data: the detector returns no insight (silently skipped).
- If the user has < 14 total entries: the Insights Feed shows an encouraging empty state: "Keep logging! After 2 weeks, we'll start spotting patterns in your mood."

### Edge Cases

- **Brand new user (0 entries):** Insights Feed shows empty state with "Log your mood for 2 weeks to unlock insights." No pattern detectors run.
- **User with entries only on weekdays:** day_of_week_pattern will not flag weekends as unusual (no data to compare).
- **All entries have the same score:** Standard deviation = 0, volatility_alert never fires. trend_direction shows stable. Activity correlations are null (zero variance).
- **User logs 10 times in one day:** Entries are averaged for that day. The day counts as 1 data point for pattern detection.
- **No activities tagged on any entry:** activity_impact detector returns no insights (skipped silently).
- **No emotions tagged:** emotion_cluster detector returns no insights.
- **User dismisses all insights:** Feed shows "All caught up! Check back in a few days for new patterns."
- **Insight generation takes > 500ms:** Should not happen with < 10,000 entries. If it does, run generation in a background task and show a loading skeleton.
- **Module disabled while weekly digest is scheduled:** Cancel the pending notification. Re-enabling does not retroactively generate missed digests.
- **Same insight regenerated after dismissal:** Dismissed insights (tracked via `insight_dismissed_[id]` settings) are not shown again for 30 days.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** After 14+ mood entries, the Insights Feed shows at least 1 pattern-based insight card.
- [ ] **AC-2:** Insight cards display a title, body with specific numbers, supporting metric, and severity badge.
- [ ] **AC-3:** Swiping or tapping dismiss removes the insight card from the feed.
- [ ] **AC-4:** A "Refresh" button re-runs pattern detection and surfaces any new insights.
- [ ] **AC-5:** With < 14 entries, the feed shows "Keep logging! After 2 weeks, we'll start spotting patterns."
- [ ] **AC-6:** day_of_week_pattern insight shows the specific weekday and score comparison (e.g., "Wednesdays: 7.8 vs overall 6.2").
- [ ] **AC-7:** activity_impact insight shows the activity name, its average score, and the overall average (e.g., "Exercise days: 7.2 vs non-exercise: 5.8").
- [ ] **AC-8:** trend_direction insight compares this week to the 4-week rolling average with direction indicator.
- [ ] **AC-9:** volatility_alert fires when 7-day standard deviation > 2.0 with a "volatile week" message.
- [ ] **AC-10:** best_worst_day insight shows the specific day, score, and activities/emotions logged that day.
- [ ] **AC-11:** Weekly digest notification fires on Sunday when enabled, linking to the Insights Feed.
- [ ] **AC-12:** Dismissed insights are not re-shown for 30 days.

### Technical Criteria
- [ ] **TC-1:** No new tables created. Insight state stored in mo_settings with `insight_` key prefix.
- [ ] **TC-2:** `generateInsights()` runs all 8 pattern detectors and returns an array of Insight objects.
- [ ] **TC-3:** Each pattern detector checks its minimum data threshold before computing. Returns empty array if insufficient data.
- [ ] **TC-4:** `detectDayOfWeekPattern()` computes per-weekday average and flags weekdays differing from overall by > 1.0 point.
- [ ] **TC-5:** `detectTimeOfDayPattern()` buckets entries into morning/afternoon/evening/night and flags buckets differing by > 0.8.
- [ ] **TC-6:** `detectActivityImpact()` reuses existing `getActivityCorrelations()` and surfaces activities with |r| >= 0.2.
- [ ] **TC-7:** `detectEmotionCluster()` finds emotion pairs co-occurring in > 30% of tagged entries.
- [ ] **TC-8:** `detectStreakImpact()` compares streak-period average to non-streak average with threshold > 0.5.
- [ ] **TC-9:** `detectTrendDirection()` compares current week average to 4-week rolling average with threshold > 1.0.
- [ ] **TC-10:** `detectVolatilityAlert()` computes 7-day standard deviation with threshold > 2.0.
- [ ] **TC-11:** `detectBestWorstDay()` finds highest and lowest scored days in last 14 days with activity/emotion context.
- [ ] **TC-12:** Insight deduplication prevents the same type + conclusion from appearing multiple times.
- [ ] **TC-13:** `insight_last_generated` setting ensures generation runs at most once per 24 hours (unless manually refreshed).
- [ ] **TC-14:** Dismissed insights tracked via `insight_dismissed_[id]` settings with 30-day expiry.
- [ ] **TC-15:** All pattern detectors are pure functions accepting data arrays and returning Insight objects. No database access inside detectors.
- [ ] **TC-16:** Full insight generation for 500 entries completes in < 300ms.

### Negative Criteria (things that must NOT happen)
- [ ] **NC-1:** Insight generation must NOT make any network calls. All computation is on-device.
- [ ] **NC-2:** Insights must NOT modify any mood data (entries, activities, emotions). Read-only access.
- [ ] **NC-3:** Weekly digest notifications must NOT include mood scores or emotional content in the notification body (privacy: "Your weekly insights are ready" only).
- [ ] **NC-4:** Pattern detectors must NOT return insights when data is below the minimum threshold. No guessing or interpolation.
- [ ] **NC-5:** The insight engine must NOT depend on any external AI/ML library. Pure TypeScript algorithmic detection only.

## UI Specification

### Mobile (Expo)

**Insights Feed:**
- Background: `#0A0A0F` (background token)
- Insight cards: `rgba(255,255,255,0.04)` (glass token) with `rgba(255,255,255,0.10)` border
- Card layout:
  - Top row: type icon (left) + title (bold, text color) + severity badge (right)
  - Body: 1-3 lines of text in textSecondary
  - Supporting metric: large number in module accent `#FB923C`
  - Bottom: "Dismiss" text button (textSecondary)
- Severity badges:
  - Info: gray background, "Info" label
  - Notable: `#FFD60A` amber background, "Notable" label
  - Actionable: `#30D158` green background, "Actionable" label
- Feed header: "Your Patterns" title + "Refresh" icon button (accent color)
- Empty state (< 14 entries): Centered lightbulb icon, encouraging text, progress indicator "7 of 14 entries to first insights"
- All caught up state: Centered checkmark, "All caught up! Check back in a few days."
- Card icons per type: calendar (day_of_week), clock (time_of_day), activity (dumbbell), emotions (heart), flame (streak), trending-up (trend), zap (volatility), star (best_worst)

### Web (Next.js)

- Same tokens via CSS variables
- Insights Feed at `/mood/insights` (merged into existing insights page as a new section or tab)
- Cards use glass morphism, wider layout allows 2-column grid for insight cards
- Same severity badges and dismiss functionality
- No weekly digest notification on web (notifications are mobile-only)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton insight cards (3) | Generation running |
| Empty (new user) | "Keep logging!" with progress bar | < 14 total entries |
| Has Insights | Feed of insight cards sorted by recency | 14+ entries, patterns detected |
| All Dismissed | "All caught up!" checkmark | User dismissed all visible insights |
| Error | "Could not generate insights" + retry | Computation failure |

## Test Requirements

### Unit Tests (modules/mood/src/__tests__/insight-engine.test.ts)
- [ ] `detectDayOfWeekPattern`: returns insight when Wednesday avg is 2.0 higher than overall
- [ ] `detectDayOfWeekPattern`: returns no insight when all weekday averages are within 1.0
- [ ] `detectDayOfWeekPattern`: returns no insight with < 14 entries
- [ ] `detectTimeOfDayPattern`: returns insight when morning avg differs by > 0.8 from overall
- [ ] `detectTimeOfDayPattern`: correctly buckets entries by hour
- [ ] `detectActivityImpact`: returns insight for activity with |r| >= 0.2
- [ ] `detectActivityImpact`: returns no insight when no activities have sufficient correlation
- [ ] `detectEmotionCluster`: returns insight for emotion pair co-occurring in > 30% of entries
- [ ] `detectEmotionCluster`: returns no insight when no pairs exceed threshold
- [ ] `detectStreakImpact`: returns insight when streak avg differs from non-streak by > 0.5
- [ ] `detectTrendDirection`: returns "trending up" when this week avg > 4-week avg + 1.0
- [ ] `detectTrendDirection`: returns "trending down" when this week avg < 4-week avg - 1.0
- [ ] `detectTrendDirection`: returns no insight when within 1.0 of rolling average
- [ ] `detectVolatilityAlert`: returns insight when 7-day stddev > 2.0
- [ ] `detectVolatilityAlert`: returns no insight when stddev <= 2.0
- [ ] `detectBestWorstDay`: returns insights for highest and lowest days with context
- [ ] `generateInsights`: runs all 8 detectors and aggregates results
- [ ] `generateInsights`: deduplicates insights with same type and conclusion
- [ ] `generateInsights`: returns empty array when all detectors return no insights
- [ ] `formatInsightBody`: includes specific numbers in the body text
- [ ] `standardDeviation`: correctly computes for [1,2,3,4,5] (result ~1.41)
- [ ] `standardDeviation`: returns 0 for constant array [5,5,5,5]

### Integration Tests
- [ ] Full flow: create 30 mood entries with varied scores/activities, run generateInsights, verify at least 2 insight types surface
- [ ] Dismiss flow: generate insights, dismiss one, re-run, verify dismissed insight not re-shown
- [ ] Insufficient data flow: create 5 entries, run generateInsights, verify empty result
- [ ] Performance: generate insights from 500 entries, verify < 300ms

### QA Verification Script

1. Open the app on iOS/Android simulator.
2. Navigate to MyMood > Insights. Verify no "Insights Feed" section yet (< 14 entries). If entries exist, verify the empty state message with progress indicator. -- Verifies empty state, AC-5.
3. Log 20 mood entries across 14 days with varied scores:
   - Wednesdays: score 8-9 (high)
   - Mondays: score 3-4 (low)
   - Other days: score 5-7
   - Tag "Exercise" on high-score days
   - Tag "joy" and "anticipation" emotions together on several entries
4. Force-refresh the insights feed (or wait 24h). -- Triggers generation.
5. Verify at least one insight card appears in the feed. -- Corresponds to AC-1.
6. Find the day_of_week_pattern insight (should identify Wednesday as best, Monday as hardest). Verify title, body with specific numbers, and supporting metric. -- Corresponds to AC-2, AC-6.
7. Find the activity_impact insight (should identify Exercise as positive). Verify body shows average on Exercise days vs non-Exercise days. -- Corresponds to AC-7.
8. Tap "Dismiss" on one insight card. Verify it disappears from the feed. -- Corresponds to AC-3.
9. Tap "Refresh". Verify dismissed insight does not reappear. -- Corresponds to AC-4, AC-12.
10. Log entries for 5 more weeks to accumulate 35+ entries with a noticeably lower week.
11. Force-refresh. Look for trend_direction insight comparing this week to rolling average. -- Corresponds to AC-8.
12. Log 7 entries in one week with scores [2, 9, 3, 8, 2, 9, 3] (high volatility).
13. Force-refresh. Verify volatility_alert insight fires with "volatile week" message. -- Corresponds to AC-9.
14. Look for best_worst_day insight showing highest and lowest days with activity context. -- Corresponds to AC-10.
15. Navigate to Settings. If weekly digest toggle exists, enable it. Verify notification fires on Sunday. -- Corresponds to AC-11.
16. Repeat key steps (3-9) on web at `/mood/insights`. Verify functional parity (minus weekly notifications). -- Web parity check.

## gstack Quality Gates

Based on this feature's Complexity Inverse score of 2 (Large):

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI (check all that apply):
- [ ] `/browse` -- navigate to `/mood/insights`, verify all states (loading, empty, has-insights, all-dismissed)
- [ ] Batch QA: after 5 features in mood module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for `insight-engine.ts` (all 8 pattern detectors + generateInsights)

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
- Mood module has analytics: dashboard averages, activity correlations (Pearson r), top emotions, daily averages, Year-in-Pixels
- No pattern detection, no insight generation, no natural language summaries
- Existing correlation engine in engine/streak.ts provides statistical primitives
- mo_settings exists for key/value storage

### After This Work
- New insight-engine.ts with 8 pattern detectors and a master generateInsights function
- New insight-templates.ts with natural language template strings for each insight type
- Insights Feed UI in both mobile and web, integrated into the existing Insights tab
- Insight state (generation timestamp, dismissed insights) stored in mo_settings
- Optional weekly digest via expo-notifications
- All computation purely on-device, no AI/ML dependencies, no network calls

### Files Changed

- `modules/mood/src/types.ts` -- Add MoodInsightSchema, InsightTypeSchema, InsightSeveritySchema types
- `modules/mood/src/engines/insight-engine.ts` -- NEW: 8 pattern detector functions + generateInsights orchestrator + deduplication + formatInsightBody
- `modules/mood/src/engines/insight-templates.ts` -- NEW: Template strings for natural language insight bodies
- `modules/mood/src/index.ts` -- Re-export insight types and engine
- `modules/mood/src/__tests__/insight-engine.test.ts` -- NEW: 22+ unit tests for all pattern detectors
- `apps/mobile/app/(mood)/insights-feed.tsx` -- NEW: Insights Feed screen/section
- `apps/web/app/mood/insights/page.tsx` -- MODIFIED: Add insights feed section

### Known Limitations
- No external AI or ML. Insights are template-based, not generated by a language model. This preserves privacy but limits the expressiveness of insight narratives.
- No cross-module data integration in MVP. The engine is designed for it (generic DataSource interface) but only mood data is piped in initially.
- Emotion cluster detection is basic (pair co-occurrence). No advanced clustering algorithms (k-means, hierarchical).
- Insight deduplication is based on type + conclusion hash. If the underlying data changes slightly but the conclusion is different, a new insight is generated.
- Performance target of 300ms for 500 entries may need tuning with larger datasets. The engine uses pre-aggregated data from existing analytics functions where possible.
- Weekly digest notification scheduling is best-effort (depends on OS notification scheduling reliability).

### Context for Next Agent
- All 8 pattern detectors MUST be pure functions. They accept pre-computed data (arrays of entries, averages, correlations) and return Insight objects. They must NOT call database functions directly. The orchestrator (`generateInsights`) calls the existing CRUD/analytics functions to prepare data, then passes it to detectors.
- The `getActivityCorrelations()` function in db/crud.ts already computes Pearson r for activities. Reuse it. Do not re-implement correlation computation in the insight engine.
- Insight deduplication: hash the type + key conclusion data (e.g., for day_of_week, hash "day_of_week:Wednesday:best"). Store as `insight_dismissed_Wednesday_best` or similar in mo_settings.
- The `standardDeviation()` helper is needed for volatility detection. Implement it as a utility in insight-engine.ts. It's a simple population standard deviation (not sample), since we have the full dataset.
- Insight generation should be idempotent. Running it twice with the same data produces the same insights. The 24-hour cooldown is a performance optimization, not a correctness requirement.
- Future cross-module integration: the `generateInsights` function should accept an optional `externalFactors: { name: string; dates: Map<string, number> }[]` parameter. In MVP, this is always empty. When Workouts or Fast modules are integrated, their daily summaries (workout count, fast completion) can be passed in as external factors for cross-correlation.
