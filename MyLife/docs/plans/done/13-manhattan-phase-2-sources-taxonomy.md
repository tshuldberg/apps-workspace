# Manhattan Phase 2 (Source Adapters + Dedup + Taxonomy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkboxes for tracking. Branch `feature/manhattan-scaffold`. No em dashes. Conventional Commits. Touch only `modules/manhattan/` and `apps/manhattan/`.

**Goal:** Add a pluggable event-source layer: an adapter interface with gap flags, a registry, real Tier-1 adapters (NYC Open Data live; ICS import; SeatGeek key-gated), gap stubs for the future ticketing module, plus pure dedup and multi-axis taxonomy engines and an ingest orchestrator. Wire the Discover feed to show aggregated, deduped, filterable events.

**Architecture:** Adapters are pure-ish units that take an injected `FetchImpl` (so they unit-test with a fake fetch) and return `NormalizedEvent[]`. The ingest orchestrator fetches enabled Tier-1 adapters, dedupes, classifies facets, and upserts into `mh_events` + `mh_event_facets`. Engines (`dedup`, `taxonomy`) are pure and fully tested. Secrets (SeatGeek key) are read from app config and gated by `isAvailable()`; a Supabase Edge Function proxy is deferred until keys + deploy are ready.

**Tech Stack:** TypeScript, Zod, Vitest, Expo, `@mylife/mail` (parseIcs), `@mylife/ui`.

**Reference (read live):** `modules/manhattan/src/db/crud/events.ts`, `modules/manhattan/src/types.ts`, `modules/mail` `parseIcs`/`ParsedEvent` (exported from `@mylife/mail`), the SwiftUI category keyword map in `/Users/trey/Superapp-Projects/Manhattan/Manhattan/Features/Plans/EventLinkParser.swift` (for taxonomy seeds), `apps/manhattan/app/(root)/(tabs)/discover.tsx`.

---

## Task 2.1: Add `@mylife/mail` dependency

- [ ] Add `"@mylife/mail": "workspace:*"` to `modules/manhattan/package.json` dependencies. Run `pnpm install`. Commit `chore(manhattan): add @mylife/mail dep for ICS parsing`.

## Task 2.2: Source adapter types

**File:** Create `modules/manhattan/src/sources/types.ts`.

- [ ] Implement (verbatim):

```ts
export type SourceTier = 'tier1' | 'gap';
export type GapReason = 'tos_excluded' | 'no_public_api' | 'auth_required' | 'planned_first_party';
export type IngestKind = 'api' | 'oembed' | 'share' | 'calendar' | 'scrape';

export interface SourceCoverage {
  categories: string[];
  ingestKinds: IngestKind[];
  realtime: boolean;
}

export interface NormalizedEvent {
  sourceId: string;
  externalId?: string;
  title: string;
  description?: string;
  venueName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
  category?: string;
  facets?: { axis: string; value: string }[];
  priceMin?: number;
  priceMax?: number;
  isFree?: boolean;
  imageUrl?: string;
  purchaseUrl?: string;
  ticketProvider?: string;
}

export interface SourceQuery {
  city?: string;
  near?: { lat: number; lng: number };
  radiusMeters?: number;
  limit?: number;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}
export type FetchImpl = (url: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

export class SourceGapError extends Error {
  constructor(
    public readonly sourceId: string,
    public readonly reason: GapReason,
    message: string,
  ) {
    super(message);
    this.name = 'SourceGapError';
  }
}

export interface EventSourceAdapter {
  id: string;
  displayName: string;
  tier: SourceTier;
  coverage: SourceCoverage;
  gapFlag?: { reason: GapReason; note: string };
  isAvailable(): boolean;
  fetchEvents(input: SourceQuery, fetchImpl: FetchImpl): Promise<NormalizedEvent[]>;
}
```

- [ ] Commit `feat(manhattan): event source adapter interface`.

## Task 2.3: Gap stub adapters

**File:** Create `modules/manhattan/src/sources/gaps.ts`. **Test:** `__tests__/gaps.test.ts`.

- [ ] Implement a factory + the 7 gap adapters:

```ts
import { type EventSourceAdapter, type GapReason, SourceGapError } from './types';

function gap(id: string, displayName: string, reason: GapReason, note: string, categories: string[]): EventSourceAdapter {
  return {
    id, displayName, tier: 'gap',
    coverage: { categories, ingestKinds: [], realtime: false },
    gapFlag: { reason, note },
    isAvailable: () => false,
    fetchEvents: async () => { throw new SourceGapError(id, reason, note); },
  };
}

export const gapAdapters: EventSourceAdapter[] = [
  gap('ticketmaster', 'Ticketmaster', 'tos_excluded', 'API terms exclude this use; coming with MyLife Tickets', ['Music', 'Comedy', 'Theater']),
  gap('resident_advisor', 'Resident Advisor', 'no_public_api', 'No public discovery API; coming with MyLife Tickets', ['Nightlife/Social', 'Music']),
  gap('dice', 'DICE', 'no_public_api', 'No public discovery API; coming with MyLife Tickets', ['Music', 'Nightlife/Social']),
  gap('posh', 'Posh', 'no_public_api', 'No public discovery API; coming with MyLife Tickets', ['Nightlife/Social']),
  gap('partiful', 'Partiful', 'no_public_api', 'No public discovery API; coming with MyLife Tickets', ['Nightlife/Social']),
  gap('equinox', 'Equinox', 'auth_required', 'Per-account schedules; capture via share or calendar', ['Education/Class']),
  gap('mylife_tickets', 'MyLife Tickets', 'planned_first_party', 'First-party ticketing module (planned)', ['Music', 'Comedy', 'Theater', 'Nightlife/Social']),
];
```

- [ ] Test: each gap adapter has `isAvailable() === false` and `fetchEvents` rejects with `SourceGapError` carrying the right `reason`. Commit.

## Task 2.4: Dedup engine (TDD)

**File:** Create `modules/manhattan/src/engines/dedup.ts`. **Test:** `__tests__/dedup.test.ts`.

- [ ] Test first: two events with same title/venue/day dedupe to one; different days do not.
- [ ] Implement:

```ts
import type { NormalizedEvent } from '../sources/types';

export function dedupKey(e: { title: string; venueName?: string; startAt?: string }): string {
  const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return [norm(e.title), norm(e.venueName), (e.startAt ?? '').slice(0, 10)].join('|');
}

export function dedupe(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Map<string, NormalizedEvent>();
  for (const e of events) {
    const k = dedupKey(e);
    if (!seen.has(k)) seen.set(k, e);
  }
  return [...seen.values()];
}
```

- [ ] Commit.

## Task 2.5: Taxonomy engine (TDD)

**File:** Create `modules/manhattan/src/engines/taxonomy.ts`. **Test:** `__tests__/taxonomy.test.ts`.

- [ ] Implement a pure classifier `classify(e: NormalizedEvent, now?: string): Facet[]` producing facets on axes `category` (single best match), `format` (purpose, multi, incl. music facets), `price`, and `time`. Seed the keyword rules from the SwiftUI `EventLinkParser` map plus the design spec's purpose facets. Concrete shape:

```ts
import type { NormalizedEvent } from '../sources/types';
export interface Facet { axis: string; value: string; }

const CATEGORY_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/comedy|stand-?up|open mic/i, 'Comedy'],
  [/theater|theatre|broadway|play|musical/i, 'Theater'],
  [/concert|live music|\bdj\b|\bset\b|gig|band|festival|jazz|hip-?hop|techno|house/i, 'Music'],
  [/yoga|pilates|workshop|class|lesson|seminar|lecture/i, 'Education/Class'],
  [/gym|equinox|run club|workout/i, 'Education/Class'],
  [/dinner|tasting|pop-?up|brunch|food|drink|cocktail/i, 'Food & Drink'],
  [/party|nightlife|club|rave|warehouse/i, 'Nightlife/Social'],
  [/market|fair|flea|sample sale/i, 'Markets & Fairs'],
  [/exhibit|gallery|museum|art/i, 'Visual Arts/Exhibition'],
  [/film|screening|movie|cinema/i, 'Film/Screening'],
];

const PURPOSE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/jam session/i, 'Jam Session'],
  [/open mic/i, 'Open Mic'],
  [/\bdj\b set|\bdj\b/i, 'DJ Set'],
  [/listening party|playback/i, 'Listening Party'],
  [/masterclass/i, 'Masterclass'],
  [/music theory/i, 'Music Theory'],
  [/music history/i, 'Music History'],
  [/luthier|instrument making|instrument-making/i, 'Instrument Making/Luthiery'],
  [/production|recording|studio session/i, 'Production/Recording'],
  [/workshop|lesson|class|teach/i, 'Class/Workshop'],
  [/festival/i, 'Festival'],
  [/screening/i, 'Screening'],
  [/talk|lecture|panel|q&a/i, 'Seminar/Talk'],
  [/party/i, 'Party'],
  [/concert|live/i, 'Live Performance'],
];

function firstMatch(text: string, rules: ReadonlyArray<readonly [RegExp, string]>): string | null {
  for (const [re, val] of rules) if (re.test(text)) return val;
  return null;
}

export function priceBucket(e: NormalizedEvent): string {
  if (e.isFree || e.priceMin === 0) return 'Free';
  const p = e.priceMin;
  if (p == null) return 'Unknown';
  if (p < 20) return 'Under $20';
  if (p < 50) return '$20-50';
  if (p < 100) return '$50-100';
  return '$100+';
}

export function timeBucket(startAt?: string, now?: string): string {
  if (!startAt) return 'Pick a Date';
  const day = startAt.slice(0, 10);
  const today = (now ?? startAt).slice(0, 10);
  if (day === today) return 'Tonight';
  return 'Upcoming';
}

export function classify(e: NormalizedEvent, now?: string): Facet[] {
  const text = [e.title, e.description, e.venueName, e.category].filter(Boolean).join(' ');
  const facets: Facet[] = [];
  const cat = e.category && /\S/.test(e.category) ? e.category : firstMatch(text, CATEGORY_RULES);
  if (cat) facets.push({ axis: 'category', value: cat });
  const purpose = firstMatch(text, PURPOSE_RULES);
  if (purpose) facets.push({ axis: 'format', value: purpose });
  facets.push({ axis: 'price', value: priceBucket(e) });
  facets.push({ axis: 'time', value: timeBucket(e.startAt, now) });
  for (const f of e.facets ?? []) facets.push(f);
  return facets;
}
```

- [ ] Tests: a "Jazz jam session at Blue Note" classifies category Music + format Jam Session; a free event -> price Free; same-day -> time Tonight. Commit.

## Task 2.6: NYC Open Data adapter (live, no key)

**File:** Create `modules/manhattan/src/sources/nyc-open-data.ts`. **Test:** `__tests__/nyc-open-data.test.ts`.

- [ ] Implement `nycOpenDataAdapter` (Tier-1, `isAvailable: () => true`). `fetchEvents` calls the NYC Parks events SODA endpoint `https://data.cityofnewyork.us/resource/fudw-fgrp.json?$limit=<limit>` via the injected `fetchImpl`, then maps each row to `NormalizedEvent` in a SEPARATE pure exported function `mapNycRow(row): NormalizedEvent` (so it is fixture-tested without network). Read the dataset's actual field names by fetching one row during development; map: `title <- name/title`, `description <- description`, `startAt <- start_date_time`, `endAt <- end_date_time`, `lat/lng <- coordinates if present`, `isFree <- cost_free === true`, `sourceId='nyc_open_data'`, `externalId <- the row id`. Be defensive about missing fields.
- [ ] Test `mapNycRow` with a fixture row object (no network). Commit.

## Task 2.7: SeatGeek adapter (key-gated)

**File:** Create `modules/manhattan/src/sources/seatgeek.ts`. **Test:** `__tests__/seatgeek.test.ts`.

- [ ] Implement `seatGeekAdapter`. `isAvailable()` returns whether a client id is configured: read it from a config getter `getSeatGeekClientId()` that returns `process.env.EXPO_PUBLIC_SEATGEEK_CLIENT_ID ?? null` (so the app can inject it later; null -> unavailable -> skipped by ingest). `fetchEvents` (only meaningful when available) calls `https://api.seatgeek.com/2/events?client_id=<id>&venue.city=New York&per_page=<limit>` via `fetchImpl`. Map in a pure exported `mapSeatGeekEvent(ev): NormalizedEvent`: `title <- title`, `startAt <- datetime_local`, `venueName <- venue.name`, `address <- venue.address`, `lat/lng <- venue.location.{lat,lon}`, `category <- type` (map SeatGeek `type` to a category via a small table), `priceMin <- stats.lowest_price`, `purchaseUrl <- url`, `ticketProvider='SeatGeek'`, `sourceId='seatgeek'`, `externalId <- String(id)`.
- [ ] Test `mapSeatGeekEvent` + `isAvailable()` false when no env id (fixture). Commit. Note in code: route through a Supabase Edge Function proxy before production so the key is not shipped client-side; deferred until edge-function deploy.

## Task 2.8: ICS import adapter

**File:** Create `modules/manhattan/src/sources/ics-import.ts`. **Test:** `__tests__/ics-import.test.ts`.

- [ ] Implement a pure `icsToNormalized(ics: string): NormalizedEvent[]` using `parseIcs` from `@mylife/mail`, mapping non-cancelled `ParsedEvent` -> `NormalizedEvent` (`title <- summary`, `venueName <- location`, `startAt <- dtstart`, `endAt <- dtend`, `allDay <- isAllDay`, `externalId <- uid`, `sourceId='ics_import'`). Also export an `icsImportAdapter` (Tier-1, `isAvailable: () => true`, `fetchEvents` returns `[]` since ICS is content-driven not query-driven; ingestion happens via a dedicated import path / Phase 3 share flow).
- [ ] Test `icsToNormalized` with a small ICS fixture string. Commit.

## Task 2.9: Registry + ingest orchestrator (TDD)

**Files:** Create `modules/manhattan/src/sources/registry.ts`, `modules/manhattan/src/engines/ingest.ts`. Modify `modules/manhattan/src/db/crud/events.ts` (add `upsertExternalEvent`). **Test:** `__tests__/ingest.test.ts`.

- [ ] `registry.ts`: `export function buildSourceRegistry(): EventSourceAdapter[]` returning `[nycOpenDataAdapter, icsImportAdapter, seatGeekAdapter, ...gapAdapters]`.
- [ ] Add to `events.ts`: `upsertExternalEvent(db, e: NormalizedEvent): string` that INSERTs or, on `(source_id, external_id)` match (when externalId present), UPDATEs the existing row (bump updated_at), returning the id. Add a unique index `mh_events_source_ext_idx` via a NEW migration v2 in `definition.ts` (`CREATE UNIQUE INDEX IF NOT EXISTS mh_events_source_ext_idx ON mh_events(source_id, external_id) WHERE external_id IS NOT NULL`). Keep migration v1 untouched; append v2.
- [ ] `ingest.ts`: `export async function ingestFromSources(db, registry, query, fetchImpl, now?): Promise<{ inserted: number; sources: string[] }>` that: filters `tier==='tier1' && isAvailable()`; calls each `fetchEvents` (wrap each in try/catch so one failure does not abort others); `dedupe` the combined list; for each, `upsertExternalEvent` then replace its facets (`removeFacetsForEvent` + `addFacet` per `classify(e, now)`); records `setSourceLastSynced`. Return counts.
- [ ] Test with a fake registry of two in-memory adapters (one returns 2 events, one returns a duplicate) + a no-op fetchImpl, asserting dedup + rows in `mh_events` + facets written. Commit.

## Task 2.10: Discover feed UI

**File:** Modify `apps/manhattan/app/(root)/(tabs)/discover.tsx`. Possibly add a filter component.

- [ ] Replace the saved-only list with: a "Refresh" action that runs `ingestFromSources(db, buildSourceRegistry(), { city: 'New York', limit: 50 }, fetch)` (use the global `fetch`, wrapped to match `FetchImpl`), then reloads from `getEvents(db)`; a list of events (Card per event: title, venue, date, category facet, price); a facet filter row (chips for the `category`, `time`, `price` axes built from `mh_event_facets`); and a section showing gap sources as disabled "Coming with MyLife Tickets" chips (from `buildSourceRegistry().filter(a => a.tier === 'gap')`). Keep the inline manual "Add event" too. Use real `@mylife/ui` props (Button `title`/`variant`, EmptyState `icon`/`title`/`message`). Typecheck. Commit.

## Task 2.11: Verification + bookkeeping

- [ ] `pnpm --filter @mylife/manhattan typecheck && test` green (new engine/adapter/ingest tests).
- [ ] `pnpm --filter @mylife/manhattan-app typecheck` clean.
- [ ] `pnpm check:passthrough-parity` green.
- [ ] memory.md Sessions row + `docs/sessions/YYYY-MM-DD-manhattan-phase-2.md`. Commit.

**Phase 2 acceptance:** Discover refresh pulls live NYC Open Data events (and SeatGeek when a key is set), dedupes, classifies facets, persists to `mh_events`, and the feed filters across category/time/price; gap sources render as coming-soon; all pure engines unit-tested; module + app typecheck green.

---

## Self-review
- Coverage: adapter interface + gap flags (spec 6), Tier-1 adapters (NYC Open Data live, SeatGeek key-gated, ICS), dedup + taxonomy engines (spec 4, 8), ingest, feed UI. Matches design spec sections 4, 6, 8 and the Phase 2 roadmap.
- Placeholder honesty: interface, gaps, dedup, taxonomy, ICS, ingest, and the v2 migration are exact code. NYC Open Data / SeatGeek field maps are specified against real endpoints with the network isolated behind a pure `map*` function + injected `FetchImpl` (so they are fixture-tested); the implementer confirms exact dataset field names by fetching one row. Feed UI is grounded in the real `@mylife/ui` API.
- Type consistency: `NormalizedEvent`, `EventSourceAdapter`, `FetchImpl`, `SourceGapError`, `classify`/`dedupe`/`ingestFromSources`, `upsertExternalEvent` names are consistent across tasks.
- Migration safety: v2 appends a unique index; v1 untouched; existing rows unaffected (partial index on non-null external_id).
