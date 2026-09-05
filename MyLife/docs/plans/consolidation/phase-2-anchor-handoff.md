---
status: ACTIVE
date: 2026-04-20
phase: 2-anchor + 1c-Wave-A-polish
parent: docs/plans/consolidation/README.md
predecessor: docs/plans/consolidation/phase-review-report.md
source: independent reviewer recommendations #1, #2, #4, #5
---

# Phase 2 Anchor Contracts + Wave A Readers + Plan Refresh

**Context for a fresh agent:** An independent reviewer audited Phase 0+1 at `docs/plans/consolidation/phase-review-report.md` (commit `3ba376578`) and concluded the shipped work is 100% foundation with zero experience-level progress. The five shipped commits (Phase 0 through Phase 1c Wave A) are spec-compliant but do not unblock the Today surface, onboarding, or AI chat. This handoff executes the reviewer's top-ranked fixes to start moving experience-level needles.

## Scope for this session

Three tracks in parallel, plus plan updates:

### Track A — Phase 2 anchor contracts (7 modules × `getTodayCards`)

Seven modules (one per workflow cluster) get a `cross-module.ts` that implements `getTodayCards(db, ctx): TodayCard[]`. Skip the other `CrossModuleInterface` methods for now — `getTodayCards` alone unblocks Phase 3 (the unified Today surface). Broader Phase 2 coverage (26 modules, all four contract methods) follows in a later session.

| Cluster | Anchor module | Status now |
|---------|---------------|------------|
| Body | `health` | No `cross-module.ts` — create it |
| Mind | `journal` | No `cross-module.ts` — create it |
| Home | `homes` | No `cross-module.ts` — create it |
| Money | `budget` | Partial / custom — audit and add `getTodayCards` |
| Social | `rsvp` | No `cross-module.ts` — create it |
| Outdoor | `trails` | No `cross-module.ts` — create it |
| Knowledge | `books` | 3/4 methods shipped — add `getTodayCards` |

### Track B — Wave A reader migrations

Each of the three Phase 1c modules gets a reader path so other modules can actually see the shared data they wrote:

- `notes`: expose `getTagsAcrossModules(db, tagLabel)` — returns every entity in every module that shares the tag label. Wraps `getEntitiesForTag` + module metadata.
- `books`: `bk_journal_photos` queries now optionally join `hub_attachment_links` to surface cross-module attachments.
- `trails`: `getTrailAtPlace(db, placeId)` returns the trail that a hub_place id points to (reverse lookup).

Minimal, additive. The shadow-write layer stays; we're just wiring the read path.

### Track C — Extend `packages/module-registry` with `TodayCard` + `getTodayCards`

Before Track A can compile, the registry must export the `TodayCard` type and extend `CrossModuleInterface`. This is a small typed addition — 30 lines in `packages/module-registry/src/cross-module-types.ts`.

### Track D — Plan refresh (docs only)

- Update `docs/plans/consolidation/README.md` with the post-review priority:
  - Pause Phase 1c Waves B/C/D until Wave A readers ship
  - Split Phase 5 into core (3-4 rules) + Phase 7 fast-follow
  - Phase 2 rescoped to 7 anchor modules first, 26-module full coverage later
- Update `docs/plans/consolidation/07-sequence-and-gates.md` to reflect the new ordering.
- Add a follow-ups item in `memory.md`.

## The `TodayCard` type (authoritative)

Define in `packages/module-registry/src/cross-module-types.ts`:

```ts
/** A card surfaced by a module for the hub's unified Today view. */
export interface TodayCard {
  /** Stable identifier within the module (module namespaces its own ids). */
  id: string;
  /** Owner module. */
  moduleId: string;
  /** Semantic kind that drives visual treatment + ranking. */
  kind: 'action' | 'progress' | 'insight' | 'reminder' | 'event';
  /** 0-100. Higher = more visible. Module computes with time-relevance bonuses. */
  priority: number;
  /** Primary display text. */
  title: string;
  /** Optional single-line supporting text. */
  subtitle?: string;
  /** Optional CTA; if present, the card is tappable. */
  cta?: { label: string; route: string };
  /** Whether the user may dismiss this card for today. */
  dismissible: boolean;
  /** Optional ISO timestamp after which the card should not render. */
  expiresAt?: string;
}

/** Context passed to `getTodayCards`. Modules may read or ignore. */
export interface TodayCardContext {
  /** Current wall-clock time; lets callers pass a fixed clock in tests. */
  now: Date;
  /** User's onboarding clusters, if known. Drives cluster-weighted ranking. */
  primaryClusters?: string[];
}
```

Extend `CrossModuleInterface` with one optional method:

```ts
export interface CrossModuleInterface {
  // ... existing methods unchanged
  /** Return 0-3 cards for the hub's unified Today view. */
  getTodayCards?: (db: unknown, context: TodayCardContext) => TodayCard[];
}
```

Ordering rule: implementations MUST cap at **3 cards per module**. The hub ranker will further trim across all modules to ~7 visible cards. Priority math:

```
base_priority (module choice: 30-60)
  + recency_bonus    (event in last 24h: +20)
  + time_relevance   (due in next 4h: +40)
  + streak_bonus     (streak at risk: +30)
```

Module decides which bonuses apply; the hub does NOT override. Users dismiss cards via `hub_preferences['today.dismissed.<cardId>'] = <iso-date>` (ranker reads this).

## Per-module card specs

Each module's `cross-module.ts` implements `getTodayCards`. Target 0-3 cards/module, hard cap 3.

### `health`
- **Next vital due** card: if user has a logged vital streak and hasn't logged today (reminder, priority 60 if morning, 40 later)
- **Sleep debt** card: if last night's sleep < target, show insight ("sleep debt 45 min")
- **Readiness score** card: if readiness computed for today, show the number

### `journal`
- **Today's entry** action: if no entry for today, CTA "Reflect" → `/journal/new`
- **On this day** insight: if there's an entry from last year on this date, show "A year ago: ..."
- **Streak** progress card: if user has a journaling streak ≥ 3 days

### `homes`
- **Maintenance due today** reminder: any `hm_maintenance_schedules.next_due_date <= today`, priority 70
- **Open project** progress: if there's an active home project, show % complete
- **Cost this month** insight: if YTD cost trend is notable, show it

### `budget`
- **Envelope approaching target** progress card: the envelope closest to overspend, `priority 50`
- **Upcoming subscription renewal** reminder: subs renewing in next 3 days, `priority 60`
- **Recent transaction without category** action: most recent uncategorized txn, CTA "Categorize"

### `rsvp`
- **Event today** event: `rv_events` with `starts_at` = today, `priority 80`
- **Pending RSVP** action: invite awaiting response in next 3 days
- **Expense split owed** action: if the user owes on an event expense, CTA "Settle"

### `trails`
- **Saved trail near you** insight: if location services permit + any saved trail within radius (skip if no location helper wired — return `[]`). Otherwise:
- **Last hike summary** progress: if most recent recording completed in last 24h, show "4.2 mi / 340 m"
- **Recording in progress** action: if there's an active unresolved recording session, CTA "Resume"

### `books`
- **Currently reading** progress card: the book with most recent session, show "% complete / pages left"
- **Reading goal progress** progress: if annual goal set, show `books_read / goal` with pace
- **Return library book** reminder: if a book is marked as library-due within 7 days

## Template (copy from `modules/workouts/src/cross-module.ts`)

The existing workouts implementation follows the right pattern. Each new cross-module.ts should:
- Import types from `@mylife/module-registry`
- Declare `MODULE_ID` constant
- Define internal row types for SQL queries (snake_case matching DB columns)
- One exported function per `CrossModuleInterface` method
- Final barrel: `export const crossModule: CrossModuleInterface = { getTodayCards }`
- Wire into `modules/<name>/src/definition.ts` via the `crossModule` field

## Wave A reader deliverables (Track B)

### notes
Add `modules/notes/src/shared/tags.ts`:
```ts
export function getNotesWithTagLabel(db, label: string): Note[] { /* ... */ }
export function getCrossModuleEntitiesForTagLabel(db, label): Array<{ moduleId, entityType, entityId, count }> { /* ... */ }
```

Exports surface via `modules/notes/src/index.ts`. Integration test verifies a tag bound by notes + (hypothetical future module) returns both.

### books
Add helper in `modules/books/src/db/journal-photos.ts`:
```ts
export function getCrossModuleAttachmentsForBook(db, bookId: string): Array<{ moduleId, entityType, entityId }> { /* ... */ }
```
This lets a future insights screen show "this book has X photos in journal, Y photos in notes, ..." without changing the primary `bk_journal_photos` reads.

### trails
Add `modules/trails/src/db/places.ts` (new):
```ts
export function getTrailByHubPlaceId(db, placeId: string): Trail | null { /* ... */ }
export function getTrailsNearGeohash(db, geohashPrefix: string, limit?: number): Trail[] { /* ... */ }
```
Uses `findNearbyPlaces` from `@mylife/db` + joins back to `tr_trails.hub_place_id`.

## Agent team composition

| Role | Agent type | Task |
|------|-----------|------|
| Registry extension | module-dev | Add `TodayCard` type + extend `CrossModuleInterface` in `packages/module-registry/src/cross-module-types.ts`. Export from `packages/module-registry/src/index.ts`. Add 3-5 unit tests validating TodayCard shape. |
| Today cards A (body + mind) | module-dev | Write `modules/health/src/cross-module.ts` + `modules/journal/src/cross-module.ts`. Both with `getTodayCards`. Wire into definition.ts. Each ≤3 cards. |
| Today cards B (home + money) | module-dev | `modules/homes/src/cross-module.ts` + `modules/budget/src/cross-module.ts`. Budget already has partial cross-module; preserve existing methods and add `getTodayCards`. |
| Today cards C (social + outdoor + knowledge) | module-dev | `modules/rsvp/src/cross-module.ts` + `modules/trails/src/cross-module.ts` + extend `modules/books/src/cross-module.ts` with `getTodayCards`. |
| Wave A readers | module-dev | Build the three reader helpers above with integration tests. |
| Plan refresh | general-purpose (docs) | Update `README.md` + `07-sequence-and-gates.md` + `memory.md` per the plan-refresh scope. |
| Review | feature-dev:code-reviewer | Diff review across all tracks. Check SQL safety, Zod coverage, that cards cap at 3, that priority math doesn't exceed 100, that no try/catch swallows. |
| Parity + validate | parity-checker | All five parity gates + per-module test counts. |

Registry extension must land first (Track C) so Tracks A and B can type-check. Run Tracks A + B + D in parallel once Track C lands.

## Acceptance

### Track C (registry)
- `TodayCard` + `TodayCardContext` types exported from `@mylife/module-registry`
- `CrossModuleInterface.getTodayCards?` added
- `pnpm --filter @mylife/module-registry test` green
- `pnpm typecheck` clean

### Track A (7 anchor modules)
- Each anchor has `src/cross-module.ts` exporting `crossModule: CrossModuleInterface` with `getTodayCards` implemented
- Each module's `definition.ts` references the new export
- Each returns 0-3 cards, none exceed priority 100, all have required TodayCard fields
- Tests: one unit test per module verifying card shape on a seeded fixture DB
- Module test counts go up but no existing tests break
- `pnpm typecheck` clean across all 7 modules

### Track B (Wave A readers)
- Each new reader helper exported from the module's public barrel
- Integration test per module verifying the reader returns expected rows
- No schema changes; reads only

### Track D (plan refresh)
- `docs/plans/consolidation/README.md` "Phased delivery sequence" section updated with the rescoped Phase 2 anchor approach and the Phase 5→Phase 5-core + Phase 7 split
- `docs/plans/consolidation/07-sequence-and-gates.md` order updated
- `memory.md` Sessions table gains a row; Known Tech Debt gains an item for "26-module Phase 2 full coverage deferred"

### Package-level
- All parity gates pass
- Commit boundaries: 5 commits
  1. `feat(module-registry): add TodayCard type + getTodayCards contract`
  2. `feat(modules): Phase 2 anchor getTodayCards (health, journal, homes, budget, rsvp, trails, books)`
  3. `feat(modules): Wave A hub readers (notes/tags, books/attachments, trails/places)`
  4. `docs(consolidation): refresh plan after Phase 0+1 review`
  5. (if needed) `docs(consolidation): Phase 2 anchor session log + memory`

## Constraints

- Read-only outside the 7 anchor modules + 3 Wave A modules + `packages/module-registry` + docs.
- No new npm deps.
- No changes to hub-schema.ts.
- No commit without running the gates.
- `--no-verify` permitted on commit if pre-commit gate flakes on new test files (same established precedent).
- Stay cluster-anchored: do NOT add `getSearchableContent` / `getDataSummary` / `getActivityFeed` / `getCorrelationData` in this session. Those are the broader Phase 2 rollout.

## Quick cold-start context

If loading cold, read in this order:

1. `docs/plans/consolidation/phase-review-report.md` — why this session exists
2. `docs/plans/consolidation/03-unified-today-surface.md` — the TodayCard spec in full
3. This file — scope + acceptance
4. `packages/module-registry/src/cross-module-types.ts` — current contract
5. `modules/workouts/src/cross-module.ts` — the template to copy
6. `packages/db/src/shared/{tags,attachments,places}/operations.ts` — the adapter surface

Then execute.
