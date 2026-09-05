# Manhattan Phase 3 (Calendar + Share Intent) (2026-06-07)

## What was done

Completed Phase 3 of Manhattan (plan `docs/plans/manhattan-mission-control.html`, cards P3-A/B/C; design `docs/designs/DESIGN-manhattan-events-calendar-discovery.md` section 13): two-way device calendar, OS share-intent ingestion, TikTok oEmbed, and opt-in AI extraction. Built on `feature/manhattan-scaffold` after a boot smoke test confirmed Phases 0-2 were healthy.

User decision for this checkpoint: full plan including the native iOS/Android share extension (`expo-share-intent` + App Groups), accepting that the native config is bundle-verifiable only in this export-only, no-simulator environment.

## Code shipped

Module (`modules/manhattan/src`, pure + TDD):
- `engines/calendar-payload.ts` (30 tests): `ManhattanCalendarPayload`, `planToCalendarPayload`, `eventToCalendarPayload`, `generateManhattanICS` (RFC5545, `DTSTART;TZID=America/New_York`, all-day `VALUE=DATE` with exclusive `DTEND` guard), `buildManhattanEventNotes`/`extractManhattanId` (Manhattan id survives EventKit identifier churn), `reconcileInboundDeviceEvents` (pure inbound dedup).
- `parser/url-parser.ts` (31 tests): port of the SwiftUI `EventLinkParser` (title/date/venue/URL extraction, date-only -> 20:00 bump). Category classification deliberately left to `taxonomy.ts`.
- `sources/tiktok-oembed.ts` (6 tests): `mapTikTokOembed` + `fetchTikTokEvent` (injected `FetchImpl`) + registry-listable adapter that no-ops in pull ingest.
- `sources/share-intent.ts` (4 tests): `parseShareIntent` + adapter (no-op in pull ingest).
- `ai/event-extraction.ts` (10 tests): `extractEventFromShare(db, text, fetchFn)` gated by `isLLMConfigured(db)`, reuses the `@mylife/intelligence` transport, OFF by default, returns null when not consented, never throws. Event JSON rides in the insight `description` because the shared transport hardcodes the insights `json_schema`.
- `db/crud/plans.ts`: `updatePlanCalendarEventId`, `getPlanByCalendarEventId`.
- `definition.ts`: migration v3 (index on `mh_plans.calendar_event_id`), `schemaVersion: 3`.
- `sources/registry.ts` + `index.ts`: wired the new adapters and barrel exports. Added `@mylife/intelligence` as a module dependency.

App (`apps/manhattan`):
- Deps: `expo-calendar ~15.0.8` (SDK 54 via `expo install`), `expo-share-intent@5.1.1` (the `expo ^54` line).
- `app.json`: `expo-calendar` plugin (calendar/reminders permission strings) + `expo-share-intent` plugin (iosActivationRules text/url/webpage, App Group `group.com.mylife.manhattan`, share extension name, android `text/*`).
- `app/(root)/lib/device-calendar.ts`: expo-calendar bridge. Dedicated "Manhattan Events" calendar, timezone-correct event Date construction (Intl `formatToParts` offset, naive fallback), all-day anchored at local noon, two-way sync that skips Manhattan's own exports on import, per-plan resilience.
- `app/_layout.tsx`: `ShareIntentProvider`. `app/(root)/_layout.tsx`: `ShareIntentWatcher` routes incoming shares to the confirm screen; `share/confirm` registered as a modal.
- `app/(root)/share/confirm.tsx`: confirm/edit a parsed candidate; optional "Enhance with AI" when enabled; saves a classified event.
- `(tabs)/calendar.tsx`: "Sync device" action. `(tabs)/discover.tsx`: "Import link" entry.

## Verification

- `pnpm --filter @mylife/manhattan typecheck`: clean. `test`: 18 files, 142 passed (60 prior + 82 new).
- `pnpm --filter @mylife/manhattan-app typecheck`: clean.
- `pnpm exec expo export -p ios`: clean (3252 modules, 6.69 MB Hermes bundle) with the new native deps in the graph.
- `pnpm check:passthrough-parity`: 114 passed, 4 skipped.
- Adversarial review (4 parallel agents) before commit.

## Review findings and fixes

- High (fixed): inbound dedup hole. `importDeviceEvents` re-imported Manhattan's own exported plan events as duplicate `device_calendar` rows. Now skips device events linked to a plan via `getPlanByCalendarEventId`.
- High (fixed): timezone mismatch. `new Date(floatingLocal)` parsed in the device zone while the event was tagged `America/New_York`. Now converts a zoned wall-time to the correct absolute instant via Intl, with a naive fallback.
- Medium (fixed): all-day `DTEND` could be zero/negative length. Now only emits `DTEND` when strictly after `DTSTART` (RFC5545 exclusive).
- Medium (hardened): one failing plan export no longer aborts the whole sync (per-plan try/catch + `failed` count surfaced).
- Low (documented): no `VTIMEZONE` block; the named `America/New_York` TZID is resolved natively by all major clients.
- AI consent and code-quality dimensions: no defects.

## Decisions and caveats

- Native config (expo-calendar/expo-share-intent plugins, App Groups, iOS share extension target) is NOT executed by `expo export`; it is bundle-verified only. Runtime correctness (permission prompts, the share extension, App Group handoff) needs an EAS dev build on a device. This is the accepted risk of building the share extension in this environment.
- Cross-timezone correctness is now handled at the device-calendar boundary via Intl, but the pure ICS payload remains floating-local + TZID (correct).

## Remaining

- Phase 4: hub composition (cross-module interface, notes + friends bridges, notifications adapter, Equinox class capture).
- Phase 5: cloud + social + monetization + release (ManhattanCloudProvider, app lock, mesh sync, $4.99 paywall, EAS).
- Device QA: EAS dev build to exercise expo-calendar permissions and the share extension end to end.
- SeatGeek client id + edge-function proxy (carried from Phase 2).
- Open Brain capture not possible (MCP unavailable this session); capture in a connected MyLife session.
