# Manhattan Phase 2 (Source Adapters + Dedup + Taxonomy) (2026-06-07)

## What was done

Completed Phase 2 of Manhattan (plan `docs/plans/queue/13-manhattan-phase-2-sources-taxonomy.md`): the pluggable event-source layer plus the discovery feed. Built subagent-driven on `feature/manhattan-scaffold` in two chunks (deterministic core, then feed UI), each verified independently.

## Code shipped

Module (`modules/manhattan/src/`):
- `sources/types.ts`: `EventSourceAdapter`, `NormalizedEvent`, `SourceCoverage`, `FetchImpl` (injected for testability), `SourceGapError`, `SourceTier`/`GapReason`.
- `sources/gaps.ts`: 7 gap stubs (ticketmaster=tos_excluded, resident_advisor/dice/posh/partiful=no_public_api, equinox=auth_required, mylife_tickets=planned_first_party); each `isAvailable() === false` and throws `SourceGapError`.
- `sources/nyc-open-data.ts`: live Tier-1 adapter (no key). Field map confirmed against a real `fudw-fgrp` row: `date` + `start_time`/`end_time` combined into ISO `startAt`/`endAt`, `cost_free` (string "0"/"1") -> `isFree`, `location_description` -> venue, defensive coords. Pure `mapNycRow` fixture-tested.
- `sources/seatgeek.ts`: key-gated adapter (`isAvailable()` reads `EXPO_PUBLIC_SEATGEEK_CLIENT_ID`; null -> skipped). Pure `mapSeatGeekEvent` fixture-tested. In-code note: route via Supabase Edge Function proxy before production so the key is not shipped; deferred.
- `sources/ics-import.ts`: pure `icsToNormalized` reusing `parseIcs` from `@mylife/mail` (+ `icsImportAdapter`).
- `sources/registry.ts`: `buildSourceRegistry()` = [nycOpenData, icsImport, seatGeek, ...gaps].
- `engines/dedup.ts`: pure dedupe by normalized title+venue+day.
- `engines/taxonomy.ts`: pure `classify()` producing facets on category/format(purpose, incl. music facets)/price/time; keyword rules seeded from the SwiftUI EventLinkParser map + design spec purpose facets.
- `engines/ingest.ts`: `ingestFromSources(db, registry, query, fetchImpl)` fetches enabled Tier-1 adapters (per-source try/catch), dedupes, upserts into `mh_events`, replaces facets via `classify`, records last-synced.
- `db/crud/events.ts`: `upsertExternalEvent` (insert or update on `(source_id, external_id)`).
- `db/crud/facets.ts`: `removeFacetsForEvent`.
- `definition.ts`: migration v2 adds partial unique index `mh_events_source_ext_idx` on `(source_id, external_id) WHERE external_id IS NOT NULL`; `schemaVersion: 2`; v1 untouched.

App (`apps/manhattan/app/(root)/(tabs)/discover.tsx`): Refresh action runs `ingestFromSources` with the global `fetch` (wrapped as `FetchImpl`), then reloads `getEvents`; event Cards (title/venue/date/category/price); facet filter chips for category/time/price (AND across axes, OR within) with live counts; gap sources rendered as disabled "Coming with MyLife Tickets" chips; title SearchBar; manual add retained.

## Verification
- `pnpm --filter @mylife/manhattan typecheck`: clean; `test`: 13 files, 60 tests passing (18 prior + 42 new: gaps 8, dedup 5, taxonomy 8, nyc 7, seatgeek 6, ics 3, ingest 4, schema +1).
- `pnpm --filter @mylife/manhattan-app typecheck`: clean.
- `pnpm check:passthrough-parity`: 114 passed, 4 skipped.
- Runtime boot not performed (no simulator); manual follow-up. Live NYC Open Data fetch verified via curl during development, not in-app.

## Decisions / notes
- `@mylife/mail` exports `parseIcs` but not the `ParsedEvent` type from its barrel; the ICS adapter relies on the inferred return type to avoid touching the mail package (scope discipline).
- SeatGeek stays off until a client id is provided; the edge-function proxy for it is deferred to a later phase (needs Supabase deploy).
- Adapters take an injected `FetchImpl` so all network mapping is fixture-tested without live calls.
- All work stayed in `modules/manhattan/` and `apps/manhattan/`; no shared `packages/` edits, so no `--no-verify` needed.

## Remaining
- Phase 3: device calendar two-way (expo-calendar) + share intent (expo-share-intent) + TikTok oEmbed + opt-in AI extraction.
- Phases 4-5 per the roadmap.
- Provide a SeatGeek client id and deploy the edge-function proxy when ready.
- Manual Expo boot verification of `apps/manhattan`.
