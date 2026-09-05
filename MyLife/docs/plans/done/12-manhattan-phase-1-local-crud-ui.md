# Manhattan Phase 1 (Local CRUD + UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`). Build on branch `feature/manhattan-scaffold`. Touch only `modules/manhattan/` and `apps/manhattan/`. No em dashes. Conventional Commits.

**Goal:** Make Manhattan a usable offline app: full local CRUD for pins, plans, plan-members, facets, and sources, plus real screens (Discover, Calendar, Pins, Plans, Settings), create/edit forms, detail screens, and a first-run privacy pledge. No external sources yet (that is Phase 2).

**Architecture:** CRUD lives in `modules/manhattan/src/db/crud/*` (pure functions over `DatabaseAdapter`, mirroring `events.ts`), tested with `createModuleTestDatabase`. Screens live in `apps/manhattan/app/(root)/` and read the adapter via `useManhattanDatabase()`, refreshing with `useFocusEffect` + `useCallback`, rendered with `@mylife/ui` (Card, Button, Text, EmptyState, SearchBar, TagPill, OnboardingPage/OnboardingFlow).

**Tech Stack:** TypeScript, Expo Router, expo-sqlite, Zod, Vitest, @mylife/ui.

**Reference patterns (read these live files):**
- `modules/manhattan/src/db/crud/events.ts` (the CRUD pattern to mirror exactly).
- `modules/manhattan/src/types.ts` (where new Zod schemas/row types are added).
- `apps/manhattan/app/(root)/providers/DatabaseProvider.tsx` (`useManhattanDatabase()`).
- A sibling list+refresh screen: `apps/bestchef/app/(root)/pantry.tsx` (useFocusEffect + db read + list/empty states).
- `@mylife/ui` exports in `packages/ui/src/index.ts`.

---

## Task 1.1: Pins CRUD (TDD)

**Files:** Create `modules/manhattan/src/db/crud/pins.ts`, `modules/manhattan/src/db/__tests__/pins.test.ts`. Modify `modules/manhattan/src/types.ts`, `modules/manhattan/src/index.ts`.

- [ ] **Step 1: Add Pin schemas to `types.ts`** (append)

```ts
export const PinInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  category: z.string().nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  neighborhood: z.string().nullish(),
  photoRef: z.string().nullish(),
  isShareable: z.boolean().default(false),
});
export type PinInput = z.input<typeof PinInputSchema>;

export interface PinRow {
  id: string;
  name: string;
  category: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  photo_ref: string | null;
  is_shareable: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
```

- [ ] **Step 2: Write the failing test** `pins.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { createModuleTestDatabase } from '@mylife/db';
import { MANHATTAN_MODULE } from '../../definition';
import { createPin, getPins, getPinById, setPinShareable, softDeletePin } from '../crud/pins';

describe('manhattan pins CRUD', () => {
  it('creates, lists, reads', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPin(adapter, { name: 'Equinox Bond Street', category: 'Gym', neighborhood: 'NoHo' });
    expect(getPins(adapter)).toHaveLength(1);
    expect(getPinById(adapter, id)?.name).toBe('Equinox Bond Street');
    close();
  });
  it('toggles shareable and soft-deletes', () => {
    const { adapter, close } = createModuleTestDatabase('manhattan', MANHATTAN_MODULE.migrations!);
    const id = createPin(adapter, { name: 'Westlight' });
    setPinShareable(adapter, id, true);
    expect(getPinById(adapter, id)?.is_shareable).toBe(1);
    softDeletePin(adapter, id);
    expect(getPinById(adapter, id)).toBeNull();
    close();
  });
});
```

- [ ] **Step 3: Run to confirm fail.** `pnpm --filter @mylife/manhattan test` -> FAIL (module not found).

- [ ] **Step 4: Implement `pins.ts`** (mirror `events.ts` structure)

```ts
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { PinInputSchema, type PinInput, type PinRow } from '../../types';

export function createPin(db: DatabaseAdapter, input: PinInput): string {
  const data = PinInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(
    `INSERT INTO mh_pins (id, name, category, lat, lng, neighborhood, photo_ref, is_shareable)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, data.name, data.category ?? null, data.lat ?? null, data.lng ?? null,
     data.neighborhood ?? null, data.photoRef ?? null, data.isShareable ? 1 : 0],
  );
  return id;
}

export function getPins(db: DatabaseAdapter): PinRow[] {
  return db.query<PinRow>(`SELECT * FROM mh_pins WHERE deleted_at IS NULL ORDER BY name ASC`);
}

export function getPinById(db: DatabaseAdapter, id: string): PinRow | null {
  const rows = db.query<PinRow>(`SELECT * FROM mh_pins WHERE id = ? AND deleted_at IS NULL`, [id]);
  return rows[0] ?? null;
}

export function setPinShareable(db: DatabaseAdapter, id: string, shareable: boolean): void {
  db.execute(`UPDATE mh_pins SET is_shareable = ?, updated_at = datetime('now') WHERE id = ?`,
    [shareable ? 1 : 0, id]);
}

export function softDeletePin(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE mh_pins SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [id]);
}
```

- [ ] **Step 5: Export from `index.ts`** (add pins CRUD + PinInput/PinRow/PinInputSchema).
- [ ] **Step 6: Run tests + typecheck.** `pnpm --filter @mylife/manhattan test && pnpm --filter @mylife/manhattan typecheck` -> green.
- [ ] **Step 7: Commit.** `git add modules/manhattan && git commit -m "feat(manhattan): pins CRUD with tests"`

## Task 1.2: Plans + plan-members CRUD (TDD)

**Files:** Create `modules/manhattan/src/db/crud/plans.ts`, `plan-members.ts`, `__tests__/plans.test.ts`. Modify `types.ts`, `index.ts`.

- [ ] **Step 1: Add schemas to `types.ts`**

```ts
export const PlanInputSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  startAt: z.string().min(1),
  endAt: z.string().nullish(),
  eventId: z.string().nullish(),
  pinId: z.string().nullish(),
  reminderMinutes: z.number().int().nullish(),
  hasReservation: z.boolean().default(false),
  partySize: z.number().int().default(1),
  source: z.string().default('manual'),
});
export type PlanInput = z.input<typeof PlanInputSchema>;

export interface PlanRow {
  id: string; title: string; start_at: string; end_at: string | null;
  event_id: string | null; pin_id: string | null; reminder_minutes: number | null;
  calendar_event_id: string | null; has_reservation: number; party_size: number;
  source: string; status: string; created_at: string; updated_at: string; deleted_at: string | null;
}

export const PlanMemberInputSchema = z.object({
  id: z.string().optional(),
  planId: z.string().min(1),
  personRef: z.string().min(1),
  role: z.string().default('guest'),
});
export type PlanMemberInput = z.input<typeof PlanMemberInputSchema>;
export interface PlanMemberRow {
  id: string; plan_id: string; person_ref: string; role: string; created_at: string; updated_at: string;
}
```

- [ ] **Step 2: Write failing test** `plans.test.ts` covering: createPlan + getPlans + getPlanById + getPlansOnDay + updatePlan + softDeletePlan, and addPlanMember + getPlanMembers + removePlanMember. (Model assertions on `events.test.ts`. Use ISO date strings like `'2026-07-04T20:00:00'`; `getPlansOnDay(adapter, '2026-07-04')` returns plans whose `start_at` begins with that date.)

- [ ] **Step 3: Run -> FAIL.**

- [ ] **Step 4: Implement `plans.ts`**

```ts
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { PlanInputSchema, type PlanInput, type PlanRow } from '../../types';

export function createPlan(db: DatabaseAdapter, input: PlanInput): string {
  const data = PlanInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(
    `INSERT INTO mh_plans (id, title, start_at, end_at, event_id, pin_id, reminder_minutes,
       has_reservation, party_size, source)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, data.title, data.startAt, data.endAt ?? null, data.eventId ?? null, data.pinId ?? null,
     data.reminderMinutes ?? null, data.hasReservation ? 1 : 0, data.partySize, data.source],
  );
  return id;
}

export function getPlans(db: DatabaseAdapter): PlanRow[] {
  return db.query<PlanRow>(`SELECT * FROM mh_plans WHERE deleted_at IS NULL ORDER BY start_at ASC`);
}

export function getPlanById(db: DatabaseAdapter, id: string): PlanRow | null {
  const rows = db.query<PlanRow>(`SELECT * FROM mh_plans WHERE id = ? AND deleted_at IS NULL`, [id]);
  return rows[0] ?? null;
}

export function getPlansOnDay(db: DatabaseAdapter, isoDay: string): PlanRow[] {
  return db.query<PlanRow>(
    `SELECT * FROM mh_plans WHERE deleted_at IS NULL AND substr(start_at, 1, 10) = ? ORDER BY start_at ASC`,
    [isoDay],
  );
}

export function updatePlan(db: DatabaseAdapter, id: string, input: PlanInput): void {
  const data = PlanInputSchema.parse(input);
  db.execute(
    `UPDATE mh_plans SET title = ?, start_at = ?, end_at = ?, event_id = ?, pin_id = ?,
       reminder_minutes = ?, has_reservation = ?, party_size = ?, source = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [data.title, data.startAt, data.endAt ?? null, data.eventId ?? null, data.pinId ?? null,
     data.reminderMinutes ?? null, data.hasReservation ? 1 : 0, data.partySize, data.source, id],
  );
}

export function softDeletePlan(db: DatabaseAdapter, id: string): void {
  db.execute(`UPDATE mh_plans SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, [id]);
}
```

- [ ] **Step 5: Implement `plan-members.ts`**

```ts
import { v4 as uuidv4 } from 'uuid';
import type { DatabaseAdapter } from '@mylife/db';
import { PlanMemberInputSchema, type PlanMemberInput, type PlanMemberRow } from '../../types';

export function addPlanMember(db: DatabaseAdapter, input: PlanMemberInput): string {
  const data = PlanMemberInputSchema.parse(input);
  const id = data.id ?? uuidv4();
  db.execute(`INSERT INTO mh_plan_members (id, plan_id, person_ref, role) VALUES (?,?,?,?)`,
    [id, data.planId, data.personRef, data.role]);
  return id;
}
export function getPlanMembers(db: DatabaseAdapter, planId: string): PlanMemberRow[] {
  return db.query<PlanMemberRow>(`SELECT * FROM mh_plan_members WHERE plan_id = ? ORDER BY created_at ASC`, [planId]);
}
export function removePlanMember(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM mh_plan_members WHERE id = ?`, [id]);
}
```

- [ ] **Step 6: Export, test, typecheck, commit.** `git commit -m "feat(manhattan): plans and plan-members CRUD with tests"`

## Task 1.3: Facets + sources CRUD (TDD)

**Files:** Create `crud/facets.ts`, `crud/sources.ts`, `__tests__/facets.test.ts`. Modify `types.ts`, `index.ts`.

- [ ] **Step 1: Schemas** (FacetInput: eventId, axis (FacetAxis), value; SourceInput: id, enabled, configJson). Add `FacetRow`, `SourceRow`.
- [ ] **Step 2: Failing test** for: addFacet + getFacets(eventId) + getEventIdsByFacet(axis, value) + removeFacet; upsertSource + getSources + setSourceEnabled + setSourceLastSynced.
- [ ] **Step 3-4: Implement** `facets.ts` (addFacet, getFacets, getEventIdsByFacet, removeFacet) and `sources.ts` (upsertSource using `INSERT ... ON CONFLICT(id) DO UPDATE`, getSources, setSourceEnabled, setSourceLastSynced) mirroring the events pattern. `getEventIdsByFacet` returns `db.query<{event_id: string}>('SELECT event_id FROM mh_event_facets WHERE axis = ? AND value = ?', [axis, value])`.
- [ ] **Step 5: Export, test, typecheck, commit.** `git commit -m "feat(manhattan): facets and sources CRUD with tests"`

## Task 1.4: Pins screen + add/edit form + detail (worked example)

**Files:** Modify `apps/manhattan/app/(root)/(tabs)/pins.tsx`. Create `apps/manhattan/app/(root)/pin/[id].tsx`, `apps/manhattan/app/(root)/pin/new.tsx`. (Register the `pin/` stack routes if needed in `(root)/_layout.tsx`.)

- [ ] **Step 1: Pins list screen** — read `apps/bestchef/app/(root)/pantry.tsx` for the refresh pattern, then implement:

```tsx
import { useCallback, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, Card, Button, EmptyState } from '@mylife/ui';
import { getPins, type PinRow } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';

export default function PinsScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const [pins, setPins] = useState<PinRow[]>([]);

  const refresh = useCallback(() => { setPins(getPins(db)); }, [db]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  return (
    <View style={styles.container}>
      {pins.length === 0 ? (
        <EmptyState title="No saved spots yet" message="Pin a gym, bar, or venue to keep it handy." />
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/pin/${item.id}`)}>
              <Card>
                <Text variant="heading">{item.name}</Text>
                {item.neighborhood ? <Text variant="body">{item.neighborhood}</Text> : null}
              </Card>
            </Pressable>
          )}
        />
      )}
      <View style={styles.fab}>
        <Button title="Add spot" onPress={() => router.push('/pin/new')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  list: { padding: 16, gap: 12 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
```

(If the real `@mylife/ui` `Button`/`Card`/`EmptyState` props differ from `title`/`message`, open `packages/ui/src/components/{Button,Card,EmptyState}.tsx` and use the actual props. Do not guess.)

- [ ] **Step 2: `pin/new.tsx`** — a form (TextInput for name, neighborhood, category; a `Switch` for "Share in plans" bound to `isShareable`) that calls `createPin(db, {...})` then `router.back()`.
- [ ] **Step 3: `pin/[id].tsx`** — detail showing pin fields; a "Share in plans" toggle calling `setPinShareable`; a destructive "Delete" calling `softDeletePin` then `router.back()`.
- [ ] **Step 4: Typecheck** `pnpm --filter @mylife/manhattan-app typecheck` -> clean. Commit. `git commit -m "feat(manhattan): pins screen, add/edit, and detail"`

## Task 1.5: Plans screen + add/edit + detail

**Files:** Modify `(tabs)/plans.tsx`. Create `plan/new.tsx`, `plan/[id].tsx`.

- [ ] Implement the Plans list grouped by relative day (Today/Tomorrow/date) using `getPlans`. Add/edit form: title, a date-time entry (use a plain ISO text field or `@react-native-community/datetimepicker` only if already a dependency; otherwise a labeled text input accepting `YYYY-MM-DDTHH:mm`), reminder picker (None/15m/1h/1d -> minutes), optional link to a saved pin (picker from `getPins`). Calls `createPlan`/`updatePlan`. Detail screen shows fields, plan members (placeholder list via `getPlanMembers`), and delete via `softDeletePlan`. Calendar mirroring is Phase 3, so omit `addToCalendar` here. Typecheck, commit.

## Task 1.6: Discover + Calendar screens (saved/manual events)

**Files:** Modify `(tabs)/discover.tsx`, `(tabs)/calendar.tsx`.

- [ ] Discover: until Phase 2 adds sources, show the user's saved events from `getEvents(db)` (saved = 1) with a `SearchBar` filtering by title, plus an "Add event" action that creates a manual `mh_events` row (reuse `createEvent`). Empty state explains aggregation is coming.
- [ ] Calendar: a simple month or agenda view of plans by day (use `getPlansOnDay` per selected day; a lightweight day list is sufficient for Phase 1). Typecheck, commit.

## Task 1.7: Settings screen

**Files:** Modify `(tabs)/settings.tsx`.

- [ ] Read/write `mh_settings` (defaultCity, aiExtractionEnabled) via small inline queries (or a `crud/settings.ts` helper: `getSetting(db, key)`, `setSetting(db, key, value)` — preferred, with a quick test). Show: default city (text), AI extraction toggle (off by default), and a "Reset local data" action that calls the DatabaseProvider reset. Typecheck, commit.

## Task 1.8: First-run privacy pledge

**Files:** Create `apps/manhattan/app/(root)/onboarding/pledge.tsx`; gate it in `(root)/_layout.tsx`.

- [ ] Use `@mylife/ui` `OnboardingPage`/`OnboardingFlow` (read `packages/ui/src/components/OnboardingPage.tsx` for props) to present: "No data sale, ever. No ads, ever. Your city, on your device." Persist an `mh_settings` key `onboardingComplete='true'` on accept. In `(root)/_layout.tsx`, after the DB is ready, read that key and redirect first-run users to `/onboarding/pledge` before the tabs. Typecheck, commit.

## Task 1.9: Phase 1 verification + bookkeeping

- [ ] `pnpm --filter @mylife/manhattan typecheck && pnpm --filter @mylife/manhattan test` (all CRUD tests green).
- [ ] `pnpm --filter @mylife/manhattan-app typecheck` clean.
- [ ] `pnpm gate:function:changed` (module-only changes should pass; if it drags in pre-existing app errors via `packages/`, none were touched, so it should be clean).
- [ ] `pnpm check:passthrough-parity` green.
- [ ] Update `memory.md` Sessions row + write `docs/sessions/YYYY-MM-DD-manhattan-phase-1.md`. Commit.

**Phase 1 acceptance:** offline create/read/update/delete for pins, plans (+members), events, facets, sources persists across relaunch; all five tabs are functional with real data; first-run pledge shows once; module tests green; app typechecks.

---

## Self-review
- Coverage: CRUD for all five remaining entities (1.1-1.3) + screens for all five tabs (1.4-1.6) + settings (1.7) + onboarding (1.8) + verification (1.9). Matches design spec sections 5 (data model) and the Phase 1 roadmap.
- Placeholder honesty: CRUD code is exact. Screen tasks give one fully-worked example (Pins) and ground the rest in named live files (`@mylife/ui` components, `apps/bestchef/.../pantry.tsx`), with explicit "confirm real props" notes where the ui API was not read line-by-line during planning.
- Type consistency: `PinInput/PinRow`, `PlanInput/PlanRow`, `PlanMemberInput/PlanMemberRow` names are consistent across types, CRUD, tests, and screens; CRUD function names match between implementation and screen imports.
