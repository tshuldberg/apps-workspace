---
status: PROPOSAL
phase: 3
parent: docs/plans/consolidation/README.md
---

# Unified Today Surface

Replace the current module-grid home screen with a ranked Today view modeled on Apple Health Summary, Oura Today, and WHOOP Home. The module grid moves to a second tab ("All"). The hub feels like one product, not 30.

## Layout

```
┌────────────────────────────────┐
│  Morning, Trey                 │  greeting + date
│  Sunday, April 19              │
├────────────────────────────────┤
│  Your day                      │  <- ranked cards, 5-7 visible
│  ○ Next med: Lisinopril 8am   │
│  ○ Workout planned: Push       │
│  ○ Fast ends in 2h 14m         │
│  ○ Book: 47 pages left         │
├────────────────────────────────┤
│  This week                     │
│  ○ Insight: mood up on fasting │
│    days (r = 0.41)             │
│  ○ Cycle: follicular phase     │
│  ○ Budget: groceries at 82%    │
├────────────────────────────────┤
│  Quick                         │
│  [+ Mood] [+ Meal] [+ Expense] │
│  [+ Note] [+ Photo]            │
└────────────────────────────────┘
Tabs: [Today] [All] [Ask] [Settings]
```

## Card taxonomy

Cards are returned from module `CrossModuleInterface` implementations plus the intelligence engine. Each card has:

```ts
type TodayCard = {
  id: string;
  moduleId: ModuleId | 'hub';
  kind: 'action' | 'progress' | 'insight' | 'reminder' | 'event';
  priority: number;              // 0-100
  title: string;
  subtitle?: string;
  cta?: { label: string; route: string };
  dismissible: boolean;
  expiresAt?: string;
};
```

Cards come from three sources:

1. **Module contributions** — each module's `getTodayCards(db, context)` method (new addition to `CrossModuleInterface`) returns 0-3 cards per module.
2. **Shared-entity cards** — `hub_reminders` due today, `hub_events` today, `hub_goals` at risk.
3. **Intelligence cards** — `engine.discoverInsights()` top-3, anomaly alerts, correlation discoveries.

## Ranking algorithm

```
priority = base_priority
  + recency_bonus    (action in last 24h: +20)
  + streak_bonus     (habit streak at risk: +30)
  + time_relevance   (reminder fires within 4h: +40)
  + cluster_weight   (user's onboarding cluster: +15 for matching modules)
  - recent_dismiss   (-50 if dismissed in last 7d)
```

Hard cap: 7 cards visible. Overflow collapses into "Show more" accordion. User can dismiss any card for today (resets tomorrow) or permanently hide (per-card preference in `hub_preferences`).

## Cluster-aware defaults

Onboarding's goal question sets `hub_preferences['primary_cluster']`. Today ranking gives +15 priority to cards from modules in that cluster. Multi-cluster users get equal weighting across their selected clusters.

## Per-cluster one-tap actions

The Quick row at the bottom surfaces cluster-appropriate quick actions:

| Cluster | Quick actions (max 5) |
|---------|----------------------|
| Body | + Mood, + Weight, + Meal, + Med, + Workout |
| Mind | + Note, + Voice, + Journal, + Reflect, + Book |
| Home | + Maintenance, + Receipt, + Chore, + Plant log, + Pet |
| Money | + Expense, + Income, + Sub, + Envelope |
| Social | + Event, + Message, + RSVP, + Photo |
| Outdoor | + Hike, + Surf session, + Plant log, + Sky check |
| Knowledge | + Note, + Word, + Card review, + Book, + Quote |

If user has multiple clusters, the Quick row picks from the union, capped at 5.

## Second-tab: All modules

The current module grid lives here. Same code, relocated route. Users who prefer the grid see no loss; users who want the unified surface get it first.

- Mobile: `apps/mobile/app/(hub)/all.tsx` (grid relocated)
- Web: `apps/web/app/all/page.tsx`

## Third-tab: Ask

The AI chat surface from `05-ai-agent-layer.md`. Only enabled if user opted in during onboarding or in Settings.

## Data flow

```
┌────────────────────────────────────┐
│  TodaySurface (mobile + web)       │
│                                    │
│  useQuery(loadTodayCards)          │
└──────────────┬─────────────────────┘
               │
               ▼
┌────────────────────────────────────┐
│  aggregateTodayCards() in          │
│  packages/module-registry/src/     │
│  dashboard.ts                      │
└──┬────────────────────────────┬────┘
   │                            │
   ▼                            ▼
┌─────────────────────┐  ┌──────────────────┐
│ Module contributors │  │ Shared entities  │
│ getTodayCards()     │  │ hub_reminders    │
│ × 30 modules        │  │ hub_events       │
│                     │  │ hub_goals        │
└─────────────────────┘  └──────────────────┘
   │
   ▼
┌─────────────────────┐
│ Intelligence engine │
│ discoverInsights()  │
└─────────────────────┘
```

## Implementation checklist

### `packages/module-registry`

- Extend `CrossModuleInterface` with `getTodayCards?: (db, context) => TodayCard[]`
- Add `aggregateTodayCards(db, context)` in `dashboard.ts` that merges + ranks
- Expose `useTodayCards()` hook in `hooks.ts`

### Per-module changes (30 modules)

Each module adds a `getTodayCards` method in its `cross-module.ts`. Pattern:

```ts
// modules/meds/src/cross-module.ts
export function getTodayCards(db: MedsDB): TodayCard[] {
  const nextDose = getNextDueDose(db);
  if (!nextDose) return [];
  const hours = hoursUntil(nextDose.dueAt);
  return [{
    id: `meds:next-dose:${nextDose.id}`,
    moduleId: 'meds',
    kind: 'reminder',
    priority: hours < 4 ? 90 : 50,
    title: `${nextDose.name} ${formatTime(nextDose.dueAt)}`,
    subtitle: `${hours.toFixed(1)}h until next dose`,
    cta: { label: 'Log dose', route: `/meds/log?doseId=${nextDose.id}` },
    dismissible: true,
  }];
}
```

### `apps/mobile/app/(hub)/index.tsx`

Replace current module-grid render with:

```tsx
export default function TodayScreen() {
  const cards = useTodayCards();
  const greeting = useGreeting();
  return (
    <ScrollView>
      <Greeting text={greeting} />
      <Section title="Your day" cards={cards.filter(c => isToday(c))} />
      <Section title="This week" cards={cards.filter(c => isThisWeek(c))} />
      <QuickActions cluster={user.primaryCluster} />
    </ScrollView>
  );
}
```

### `apps/web/app/page.tsx`

Mirror structure. Reuse `aggregateTodayCards` via server action.

## Acceptance

- Today tab renders within 600ms on cold launch (measured on iPhone 13, Pixel 7)
- Cards pull from all 30 modules' `getTodayCards` (blocked until Phase 2 completes)
- Ranking stable across re-renders (deterministic priority)
- Dismissed cards persist via `hub_preferences`
- `/all` tab shows the legacy module grid with no behavior change
- `pnpm test` green including new ranking tests in `packages/module-registry/__tests__/dashboard.test.ts`
- Visual QA pass via `/qa` skill: all 5 states (loading / empty / partial / error / success) on Today tab
