# Manhattan Phase 1 (Local CRUD + UI) (2026-06-06)

## What was done

Completed Phase 1 of Manhattan (plan `docs/plans/queue/12-manhattan-phase-1-local-crud-ui.md`), making the standalone app usable fully offline. Built subagent-driven on `feature/manhattan-scaffold` in three chunks (CRUD, screens, onboarding), each verified independently.

## Code shipped

CRUD (`modules/manhattan/src/db/crud/`, all mirror `events.ts`, with tests):
- `pins.ts`, `plans.ts`, `plan-members.ts`, `facets.ts`, `sources.ts`, `settings.ts`.
- Zod schemas + row types added to `src/types.ts`; all re-exported from `src/index.ts`.
- `getPlansOnDay` compares `substr(start_at,1,10)`; `upsertSource`/`setSetting` use `INSERT ... ON CONFLICT DO UPDATE`.
- Tests: 6 files, 18 tests passing (schema 2, events 2, pins 2, plans 5, facets 3, settings 4).

Screens (`apps/manhattan/app/(root)/`):
- `(tabs)/pins.tsx` list + `pin/new.tsx` + `pin/[id].tsx` (create, shareable toggle, soft-delete).
- `(tabs)/plans.tsx` grouped-by-day list + `plan/new.tsx` + `plan/[id].tsx` (title, `YYYY-MM-DDTHH:mm` start, reminder chips, pin link, members read-only).
- `(tabs)/discover.tsx` saved/manual events with SearchBar + inline add.
- `(tabs)/calendar.tsx` day agenda via `getPlansOnDay` with prev/next/today.
- `(tabs)/settings.tsx` default city + AI-off toggle via `getSetting`/`setSetting` + local data reset.
- `onboarding/pledge.tsx` (OnboardingPage) + gate in `(root)/_layout.tsx` using `useSegments()` to avoid a redirect loop; persists `onboardingComplete` in `mh_settings`.
- `DatabaseProvider.tsx` exposes `useResetDatabase()` for the Settings reset.

## Verification
- `pnpm --filter @mylife/manhattan typecheck`: clean; `test`: 18 passed.
- `pnpm --filter @mylife/manhattan-app typecheck`: clean.
- `pnpm check:passthrough-parity`: 114 passed, 4 skipped.
- Runtime boot not performed (no simulator); manual follow-up.

## Real `@mylife/ui` API confirmed
- `Button`: `title | label | children`, `variant: 'primary'|'secondary'|'ghost'` (no `danger`; used `secondary` for destructive).
- `Card`: `elevated?`, `children`. `EmptyState`: `icon?`, `title`, `message?`, `actionLabel?`, `onAction?`.
- `Text`: `variant: heading|subheading|body|caption|label|stat|heroTitle|iconCaption`.

## Decisions / notes
- No datetime picker dependency added; start time is a labeled `YYYY-MM-DDTHH:mm` text field.
- Calendar mirroring deferred to Phase 3 (`updatePlan` preserves end_at/event_id/etc. so edits do not clobber).
- Plan members are read-only in Phase 1 (no add-member UI yet).
- All chunks stayed in scope (modules/manhattan and apps/manhattan only); no `--no-verify` needed (no shared `packages/` edits this phase).

## Remaining
- Phase 2: source adapters (SeatGeek, NYC Open Data, ICS) + gap stubs + dedup + taxonomy + discovery feed.
- Phases 3-5 per the roadmap.
- Manual Expo boot verification of `apps/manhattan`.
