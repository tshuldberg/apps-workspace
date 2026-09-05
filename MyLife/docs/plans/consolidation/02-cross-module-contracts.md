---
status: PROPOSAL
phase: 2
parent: docs/plans/consolidation/README.md
---

# Cross-Module Contracts

Twenty-six of thirty modules don't export `CrossModuleInterface`. Each one missing an implementation leaves a blank slot in unified search, the activity feed, correlation engine, and the new Today surface. The contract is defined; implementations are the gap.

## The contract

From `packages/module-registry/src/cross-module-types.ts`:

```ts
interface CrossModuleInterface {
  getSearchableContent?: (db) => SearchableItem[];   // indexed by hub FTS5
  getDataSummary?: (db) => ModuleSummary;             // dashboard card stats
  getActivityFeed?: (db, since: Date) => ActivityItem[];  // weekly digest + hub feed
  getCorrelationData?: (db) => CorrelationDataset;    // time-series for intelligence engine
}
```

**Phase 3 addition:** extend with a new optional method used by the Today surface.

```ts
interface CrossModuleInterface {
  // ... existing
  getTodayCards?: (db, context: { now: Date; primaryClusters: string[] }) => TodayCard[];
}
```

## Current adoption

| Status | Modules |
|--------|---------|
| All 4 methods | workouts, habits, meds |
| 3 of 4 (no correlation) | books |
| Custom/partial | budget, flash, presence |
| None | 23 modules: car, closet, cycle, fast, forums, garden, health, homes, journal, mail, market, mood, notes, nutrition, pets, recipes, rsvp, stars, subs, surf, trails, voice, words |

## Implementation pattern

Copy `modules/workouts/src/cross-module.ts` as the reference. Structure for each new file:

```ts
// modules/<name>/src/cross-module.ts
import type {
  CrossModuleInterface,
  SearchableItem,
  ModuleSummary,
  ActivityItem,
  CorrelationDataset,
  TodayCard,
} from '@mylife/module-registry';
import type { <ModuleDB> } from './types';

export function getSearchableContent(db: <ModuleDB>): SearchableItem[] {
  // return every user-visible row as SearchableItem
}

export function getDataSummary(db: <ModuleDB>): ModuleSummary {
  // aggregate counts + module-specific stats
}

export function getActivityFeed(db: <ModuleDB>, since: Date): ActivityItem[] {
  // rows created/updated since `since`
}

export function getCorrelationData(db: <ModuleDB>): CorrelationDataset {
  // time-series that the user would plausibly correlate
  // e.g., nutrition returns calories + protein + water by date
}

export function getTodayCards(db: <ModuleDB>, ctx): TodayCard[] {
  // 0-3 cards appropriate for Today surface
}

export const crossModule: CrossModuleInterface = {
  getSearchableContent, getDataSummary, getActivityFeed, getCorrelationData, getTodayCards,
};
```

Then wire into `modules/<name>/src/definition.ts`:

```ts
import { crossModule } from './cross-module';

export const <NAME>_MODULE: ModuleDefinition = {
  // ... existing
  crossModule,
};
```

## Per-module stat + correlation hints

The columns each module should surface. Defer to existing schema when picking stat names.

| Module | getDataSummary stats | getCorrelationData series |
|--------|---------------------|---------------------------|
| car | `totalVehicles`, `openMaintenance`, `ytdFuelCost` | `fuel_cost`, `miles_driven` |
| closet | `totalItems`, `wornThisWeek`, `unwornCount` | (none; poor correlation fit) |
| cycle | `currentCyclePhase`, `nextPeriodDate` | `bbt`, `symptom_severity`, `cycle_day` |
| fast | `currentFastHours`, `fastsThisWeek` | `weight`, `fast_hours`, `water_ml` |
| forums | `postsThisWeek`, `unreadReplies` | (none) |
| garden | `plantCount`, `dueWatering` | `days_since_water` per plant |
| health | `sleepAvg7d`, `stepsToday`, `vitalsLogged` | `sleep_hours`, `steps`, `hr`, `hrv` |
| homes | `openMaintenance`, `totalCostYTD` | `home_cost` |
| journal | `entriesThisWeek`, `streakDays` | `entry_count_per_day` |
| mail | `unreadCount`, `threadsWithoutReply` | (none) |
| market | `activeListings`, `unreadMessages` | (none) |
| mood | `avgMood7d`, `entriesThisWeek` | `mood_score`, `emotion_intensity` |
| notes | `totalNotes`, `tagCount` | (none) |
| nutrition | `caloriesToday`, `proteinToday`, `waterToday` | `calories`, `protein`, `carbs`, `fat`, `water` |
| pets | `dueVaccinations`, `feedingToday` | `pet_weight` |
| presence | `focusMinutesToday`, `screenTimeToday` | `focus_min`, `screen_min` |
| recipes | `recipeCount`, `mealsPlanned` | `meals_cooked` |
| rsvp | `upcomingEvents`, `pendingRSVPs` | (none) |
| stars | `dailyReadingAvailable`, `savedCharts` | (none) |
| subs | `monthlySpend`, `upcomingRenewals` | `subscription_cost` |
| surf | `sessionsThisMonth`, `nextGoodWindow` | `wave_hours` |
| trails | `milesHikedYTD`, `trailsCompleted` | `distance_m`, `elevation_m` |
| voice | `recordingsThisWeek` | (none) |
| words | `newWordsThisWeek`, `lookupsThisMonth` | (none) |
| budget | `netWorthTrend`, `envelopeProgress` | `spending_daily`, `income_daily` |
| flash | `cardsDueToday`, `studyStreak` | `cards_studied` |
| presence | `accountabilityStreak` | (existing) |

Correlation series explicitly omitted for modules where time-series analysis doesn't reflect user intent (social, reference, catalog-style modules).

## Sequencing

Parallelizable across modules. Use Agent Teams with one `module-dev` per module. Each PR is small (one `cross-module.ts` file + wiring). Batches of 5-7 at a time so parity checker can validate incrementally.

Suggested batches:

1. **Batch 1 (Body cluster):** cycle, fast, health, mood, nutrition
2. **Batch 2 (Mind cluster):** journal, notes, voice, words
3. **Batch 3 (Home cluster):** car, closet, garden, homes, pets
4. **Batch 4 (Money cluster):** budget (upgrade), subs, market
5. **Batch 5 (Social cluster):** rsvp, forums, mail, presence (upgrade)
6. **Batch 6 (Outdoor + Knowledge):** surf, trails, stars, flash (upgrade)
7. **Batch 7 (polish):** remaining + upgrade books to 4 of 4

## Acceptance per module

- `modules/<name>/src/cross-module.ts` exists and exports `crossModule: CrossModuleInterface`
- All four base methods implemented (correlation may return empty series if N/A)
- `getTodayCards` returns 0-3 cards with deterministic priorities
- `definition.ts` references the new export
- `modules/<name>/__tests__/cross-module.test.ts` covers happy path + empty-db fixture
- `pnpm gate:function --file modules/<name>/src/cross-module.ts` green
- `pnpm check:module-parity` green
