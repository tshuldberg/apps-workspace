# Manhattan Phase 4 (Hub Composition) (2026-06-07)

## What was done

Completed Phase 4 of Manhattan (plan `docs/plans/manhattan-mission-control.html`, cards P4-A/B/C; design `DESIGN-manhattan-events-calendar-discovery.md` section 11 + 13): the cross-module interface, notes/tags + friends bridges, an opt-in notifications/reminders path, and Equinox/class capture. Standalone-first: the cross-module interface and the friends/classes bridges are implemented and unit-tested but the hub apps stay UNWIRED; the two surfaces that touch the standalone app (tags on pins/plans, plan reminders) are wired in `apps/manhattan`.

## Code shipped

Module (`modules/manhattan/src`, pure + TDD):
- `cross-module.ts`: `getTodayCards` / `getSearchableContent` / `getDataSummary` (pure reads of mh_events/mh_plans/mh_pins/mh_event_facets) + `manhattanCrossModule`. Wired into `MANHATTAN_MODULE.crossModule`.
- `integrations/notes-bridge.ts`: pure note-context builders (`buildPinNoteContext`/`buildPlanNoteContext`) + entity tag helpers (`setEntityTags`/`getEntityTags`/`removeEntityTag`/`entityTagLabel`) over the shared `hub_tags`/`hub_tag_bindings` substrate via `@mylife/db`.
- `integrations/friends-bridge.ts`: pure `mapEventToHangoutInput`/`eventTypeToActivityTag` producing a `@mylife/friends` `HangoutInput` (type-only import; the hub caller invokes `createHangout`).
- `integrations/classes-bridge.ts`: pure `mapClassToManhattanEvents` materializing recurring class `DayTime` buckets into first-occurrence `EventInput`s (type-only `@mylife/classes` import).
- `engines/reminders.ts`: pure `planReminderTrigger` + `planStartMs` + `reminderId`.
- `definition.ts`: `crossModule` wired; migrations/schemaVersion unchanged (v3, no P4 schema change). `index.ts`: all new symbols exported. Added `@mylife/friends` + `@mylife/classes` deps (type-only use).

App (`apps/manhattan`):
- Deps: `expo-notifications ~0.32.17` (SDK 54).
- `app/(root)/lib/notifications.ts`: app-level Expo `NotificationPlatformOps`-style adapter; `schedulePlanReminder` (cancel-then-schedule, deterministic id, permission-gated, DATE trigger, Android channel) + `cancelPlanReminder`.
- `app/(root)/components/EntityTags.tsx`: add/remove tags on a pin or plan, refreshing on focus.
- Wiring: plan reminders scheduled on create (`plan/new.tsx`) and edit (`plan/[id].tsx`), cancelled on delete; `EntityTags` on `pin/[id].tsx` + `plan/[id].tsx`; `app.json` expo-notifications plugin.

## Verification

- `pnpm --filter @mylife/manhattan typecheck`: clean. `test`: 23 files, 193 passed.
- `pnpm --filter @mylife/manhattan-app typecheck`: clean.
- `pnpm exec expo export -p ios`: clean (6.9 MB Hermes bundle).
- `pnpm check:passthrough-parity`: 114 passed, 4 skipped.
- Adversarial review (4 parallel agents) before commit.

## Review findings and fixes

- High (fixed): `planReminderTrigger` parsed floating wall-clock `start_at` with ambiguous `Date.parse`. Added `planStartMs` that interprets a floating `YYYY-MM-DDTHH:mm` string in the device-local zone (where the reminder fires) and honors explicit `Z`/offset instants; added floating-local tests.
- High (fixed): `@mylife/notifications` was an unused dependency; removed.
- Medium (fixed): `cross-module` next-reminder card reused the same ambiguous parse; now uses `planStartMs`.
- Medium (fixed): `EntityTags` did not refresh on focus; added `useFocusEffect`.
- Low (fixed): removed an unused `PlanRow` import in `cross-module.ts`; documented the notes-bridge orphan-tag trade-off.
- Cross-module, friends/classes bridge correctness, and scope/em-dash checks: clean.

## Decisions and caveats

- `NotificationPlatformOps` is implemented app-level (per the meds/sports precedent), not as a `packages/notifications` edit, keeping the package platform-agnostic. The standalone app schedules reminders directly through the adapter (no hub `hub_scheduled_notifications` table needed).
- Notifications + share-extension + calendar native config remain bundle-verified only; reminders firing, permission prompts, and Android channels need an EAS dev build on a device.
- The `@mylife/friends` `rsvp-link` / `music-link` integration stubs are intentionally NOT fulfilled: they are blocked on rsvp attendee tracking and a not-yet-existing music module. Manhattan's friends-bridge delivers the doable direction (attending an event maps to a hangout); the reverse module stubs stay as-is.
- Rich markdown notes (via MyNotes) are deferred; this phase delivers cross-module tags on pins/plans (the same entity-tag substrate the notes will reuse).

## Remaining

- Phase 5: cloud + social + monetization + release (ManhattanCloudProvider, app lock, mesh sync, $4.99 paywall, EAS init/build/submit, promote from hidden).
- Hub wiring (apps/mobile + apps/web) of the Manhattan cross-module + bridges when the suite turns Manhattan on (post-v1).
- Device QA via EAS dev build (calendar, share extension, reminders).
- Open Brain capture not possible (MCP unavailable this session).
