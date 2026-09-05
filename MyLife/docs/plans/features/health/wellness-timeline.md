# Feature Spec: Wellness Timeline

## Metadata
- **Module:** health
- **Priority Score:** 39 / 50 (A-Tier)
- **Scoring Breakdown:** Market 5 x3 + Switching 4 x3 + Complexity 2 x2 + CrossModule 5 x1 + PaidUser 3 x1
- **Sprint:** 5
- **Estimated CC Time:** 4-5 hours
- **Depends On:** none (uses existing data from hl_vitals, hl_sleep_sessions, absorbed modules)
- **Blocks:** Readiness score (consumes timeline data)

## Business Context

### Why This Feature Exists
The wellness timeline is the core hub value proposition: it aggregates data across all health-adjacent modules (vitals, sleep, medications, fasting, cycle, mood, workouts) into a single chronological feed. Apple Health and CareClinic both offer timeline views, but neither combines the breadth of domains that MyLife covers. This feature demonstrates why a unified hub is more valuable than separate apps. It scores 5/5 on CrossModule because it touches nearly every module.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Apple Health | Yes | Free | Health feed with recent activity from all sources |
| CareClinic | Yes | Yes ($9.99/mo) | Daily wellness report with symptom/medication correlation |
| Bearable | Yes | Yes ($34.99/yr) | Factor-symptom timeline with correlation graphs |
| Google Fit | Partial | Free | Activity feed but limited to fitness data |

### Target User
Users who track across multiple MyLife modules (health + workouts + mood + meds) and want a unified view of how their health inputs relate to each other over time. Power users who want to spot patterns like "I sleep worse on days I skip medication" or "my mood dips during the luteal phase."

## Technical Context

### Where This Lives in MyLife

```
modules/health/src/timeline/engine.ts       -- Timeline aggregation engine
modules/health/src/timeline/types.ts        -- Timeline event types
modules/health/src/index.ts                 -- Export timeline functions
apps/mobile/app/(health)/wellness-timeline.tsx -- Timeline feed screen
apps/web/app/health/timeline/               -- Web timeline page
```

### Wireframe Position

```
Hub Dashboard
  └── MyHealth card
       └── Insights tab
            └── Wellness Timeline ← YOU ARE HERE
                 ├── Today's events (reverse chronological)
                 ├── Date picker to browse history
                 └── Filter by event type
```

### Data Model

No new tables. The timeline engine reads from existing tables across modules:

- `hl_vitals` -- heart rate, steps, blood pressure, etc.
- `hl_sleep_sessions` -- sleep duration and quality
- `md_dose_logs` -- medication doses taken
- `md_mood_entries` -- mood check-ins
- `ft_fasts` -- fasting sessions
- `cy_cycle_days` -- cycle phase and symptoms
- `wk_sessions` -- workout sessions (if workouts module enabled)

**Timeline event union type:**

```typescript
export type TimelineEventType =
  | 'vital_reading'
  | 'sleep_session'
  | 'medication_dose'
  | 'mood_checkin'
  | 'fasting_session'
  | 'cycle_day'
  | 'workout_session'
  | 'goal_progress';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;       // ISO datetime, used for sorting
  title: string;           // "Heart Rate: 72 bpm"
  subtitle: string | null; // "Resting, via Apple Watch"
  icon: string;            // Emoji or icon name
  accentColor: string;     // Module accent color
  sourceModule: string;    // 'health' | 'meds' | 'fast' | 'cycle' | 'workouts'
  metadata: Record<string, unknown>; // Raw data for detail drill-down
}
```

### Dependencies
- **Internal:** `@mylife/db`, `@mylife/meds` (dose logs, mood), `@mylife/fast` (fasts), `@mylife/cycle` (cycle days), `@mylife/workouts` (sessions), `@mylife/module-registry` (check which modules are enabled)
- **External:** None
- **Cross-Module:** This feature is inherently cross-module. It reads from 5+ modules' tables. Must gracefully handle modules that are disabled (skip their events).

## Functional Requirements

### User Stories
1. As a health tracker, I want to see all my health events in one chronological feed so that I understand my daily health picture at a glance.
2. As a user, I want to filter the timeline by event type so that I can focus on specific domains.
3. As a user, I want to browse past days so that I can review historical patterns.
4. As a user, I want to tap an event to see its full details in the source module.

### Behavior Specification

**Viewing the timeline:**
1. User navigates to MyHealth > Insights tab
2. User taps "Wellness Timeline" (screen already declared in module definition)
3. System queries all enabled modules' tables for today's events
4. Events are displayed in reverse chronological order (newest first)
5. Each event shows: icon, title, subtitle, timestamp, and a colored accent bar matching its source module

**Filtering:**
1. Top of timeline shows filter chips: All, Vitals, Sleep, Meds, Mood, Fasting, Cycle, Workouts
2. Tapping a chip filters the list to that event type
3. Active filter is highlighted with module accent color
4. "All" shows everything (default)

**Date navigation:**
1. Date header at top shows current date with left/right arrows
2. Tapping arrows navigates to previous/next day
3. Tapping the date itself opens a date picker for jumping to any date
4. Days with no events show empty state: "No health events recorded for this day"

**Drill-down:**
1. Tapping any timeline event navigates to the relevant detail screen in the source module
2. E.g., tapping a medication dose opens med-detail in the meds section
3. E.g., tapping a sleep session opens sleep-detail
4. If the source module is disabled, show the event details inline (read-only, no navigation)

### Edge Cases

- **Module disabled:** Skip that module's events. Do not crash. If a filter chip's module is disabled, hide that chip.
- **No events for a day:** Empty state message with suggestion to log data.
- **Very busy day (50+ events):** Paginate with "Load more" after 30 events.
- **Future dates:** Allow navigation but show "No events yet" (do not show predictions).
- **Data from before module was enabled:** Show if data exists in tables.
- **Multiple vitals at the same timestamp:** Each is a separate event, sorted by vital_type.
- **Workouts module not installed:** Timeline simply has no workout events, no error.
- **Clock timezone changes:** Events display in device local time.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Wellness Timeline screen shows today's events in reverse chronological order
- [ ] **AC-2:** Each event shows an icon, title, subtitle, and timestamp
- [ ] **AC-3:** Events are color-coded by source module accent color
- [ ] **AC-4:** Filter chips at the top allow filtering by event type
- [ ] **AC-5:** Date navigation arrows browse previous/next days
- [ ] **AC-6:** Tapping a date opens a date picker
- [ ] **AC-7:** Tapping an event navigates to its detail screen in the source module
- [ ] **AC-8:** Days with no events show an appropriate empty state
- [ ] **AC-9:** Disabled modules' events are excluded without errors
- [ ] **AC-10:** Timeline loads within 500ms for a typical day (10-20 events)

### Technical Criteria
- [ ] **TC-1:** Timeline engine queries all enabled modules' tables in a single aggregation pass
- [ ] **TC-2:** Events are correctly sorted by timestamp descending
- [ ] **TC-3:** Module availability check uses @mylife/module-registry to determine enabled modules
- [ ] **TC-4:** Pagination returns 30 events per page with correct cursor
- [ ] **TC-5:** Timeline event metadata includes enough data for detail drill-down

### Negative Criteria
- [ ] **NC-1:** Timeline must NOT modify any source module's data
- [ ] **NC-2:** Disabled modules must NOT cause errors or empty filter chips
- [ ] **NC-3:** Timeline must NOT show future predictions (only recorded events)

## UI Specification

### Mobile (Expo)
- Background: `#0A0A0F`
- Date header: large `#F0F0F5` text with navigation arrows in `rgba(240,240,245,0.65)`
- Filter chips: glass pill buttons, `#10B981` (health accent) when active, `rgba(255,255,255,0.08)` when inactive
- Event cards: glass cards with left accent bar in source module color
- Event icon: 24x24, left-aligned
- Title: `#F0F0F5`, 16px. Subtitle: `rgba(240,240,245,0.65)`, 14px
- Timestamp: right-aligned, `rgba(240,240,245,0.65)`, 12px

### Web (Next.js)
- Same tokens via CSS variables
- Timeline at `/health/timeline` route
- Filter chips as horizontal scrollable bar on narrow viewports
- Two-column layout on wide screens (events left, daily summary right)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | Skeleton event cards | Initial data fetch |
| Empty | "No health events recorded for this day" | Day with no data |
| Success | Chronological event feed | Data loaded |
| Filtered | Subset of events matching filter | Filter chip tapped |
| Error | "Unable to load timeline" with retry | Query failure |

## Test Requirements

### Unit Tests
- [ ] `aggregateTimelineEvents`: returns events from all enabled modules
- [ ] `aggregateTimelineEvents`: excludes disabled modules
- [ ] `aggregateTimelineEvents`: sorts by timestamp descending
- [ ] `aggregateTimelineEvents`: limits to 30 events per page
- [ ] `aggregateTimelineEvents`: filters by event type
- [ ] `mapVitalToTimelineEvent`: creates correct title and subtitle
- [ ] `mapSleepToTimelineEvent`: formats duration correctly
- [ ] `mapDoseToTimelineEvent`: includes medication name and dosage
- [ ] `mapMoodToTimelineEvent`: includes mood score and top emotions
- [ ] `getTimelineForDate`: returns only events within the specified date range

### Integration Tests
- [ ] Full flow: log vital + log sleep + take medication -> timeline shows all 3 events in order
- [ ] Filter flow: filter to "Vitals" -> only vital events shown
- [ ] Cross-module: enable workouts -> workout sessions appear in timeline

### QA Verification Script

1. Open the app on iOS simulator
2. Log a vital (heart rate), a sleep session, and a medication dose
3. Navigate to MyHealth > Insights > Wellness Timeline
4. Verify: All 3 events appear in reverse chronological order -- corresponds to AC-1
5. Verify: Each event has icon, title, subtitle, timestamp -- corresponds to AC-2
6. Verify: Events have different accent colors by module -- corresponds to AC-3
7. Tap the "Vitals" filter chip
8. Verify: Only vital events shown -- corresponds to AC-4
9. Tap the left arrow to go to yesterday
10. Verify: Yesterday's events (or empty state) appear -- corresponds to AC-5
11. Tap the date header
12. Verify: Date picker opens -- corresponds to AC-6
13. Navigate back to today, tap a vital event
14. Verify: Navigates to vital detail screen -- corresponds to AC-7
15. Navigate to a date with no data
16. Verify: Empty state message shown -- corresponds to AC-8

## gstack Quality Gates

Based on Complexity 2 (Inverse), this feature is "Large" tier.

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to the feature's URL, click every button, verify all 5 states

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec BEFORE building. Fix issues found.

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for timeline aggregation

### Post-merge:
- [ ] `/parity-check` -- health has no standalone counterpart (skip)

## Handoff State

### Before This Work
Health module has isolated views for vitals, sleep, documents, and goals. The wellness-timeline screen is declared in the module definition but not implemented. The `getOverallWellnessTimeline` function exists in @mylife/meds but only covers medication-related data.

### After This Work
- Cross-module timeline aggregation engine that reads from 7+ module tables
- Timeline event union type with module-aware metadata
- Filterable, paginated, date-navigable timeline feed
- Drill-down navigation to source module detail screens

### Files Changed
- `modules/health/src/timeline/engine.ts` -- New: aggregation engine
- `modules/health/src/timeline/types.ts` -- New: TimelineEvent types
- `modules/health/src/index.ts` -- Export timeline functions
- `apps/mobile/app/(health)/wellness-timeline.tsx` -- Timeline UI

### Known Limitations
- No correlation analysis (that's a separate feature)
- No predictive insights (only recorded events)
- Workouts timeline integration requires workouts module wired status
- No export/share of timeline view

### Context for Next Agent
- The @mylife/meds module already exports `getOverallWellnessTimeline` which returns medication-specific timeline entries. The new health timeline engine should wrap/extend this, not replace it.
- Check module-registry to see which modules are enabled before querying their tables. Use `getEnabledModules()` from @mylife/module-registry.
- The 'wellness-timeline' screen name is already registered in the module definition's navigation.screens array.
- Cross-module table reads require the DatabaseAdapter from @mylife/db which has access to all prefixed tables.
