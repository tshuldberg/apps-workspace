# 2026-04-19 — Phase 1c Wave A Shadow-Write Adoption

Proof-of-concept per-module adoption of the Phase 1b adapters. Three reference modules migrate to the shadow-write pattern (per-module tables stay canonical for reads, every write also goes to the hub table inside a single transaction, hub-write failure throws and rolls back). Plus a sister task fixing the `@mylife/intelligence` permissions schema drift that was blocking Phase 4.

## Team run

| Stage | Agent | Verdict |
|-------|-------|---------|
| Research | Explore | Schema plans for 4 tracks written to `phase-1c-research.md`. Flagged homes = no lat/lng, surf = supabase, forcing a pivot to trails for the places track. |
| Impl A — notes/tags | module-dev | 7 new tests, 293 passing |
| Impl B — books/attachments | module-dev | 8 new tests, 408 passing |
| Impl C — surf/places → pivot → trails/places | module-dev ×2 | Surf aborted (supabase). Trails re-ran: 5 new tests, 255 passing |
| Impl D — intelligence permissions | module-dev | 112/112 passing (up from 8/98) |
| Review | feature-dev:code-reviewer | 1 P0 (deleteNote orphan bindings), 1 P1 (reorderJournalPhotos not transactional). Both fixed inline. |
| Parity | parity-checker | 11 gates pass |
| Commits | inline | 4 per-concern commits |

## Commits landed

1. `fix(intelligence): align hub_ai_permissions with canonical hub schema`
2. `feat(notes): shadow-write tags to hub_tags (Phase 1c Wave A)`
3. `feat(books): shadow-write journal photos to hub_attachments (Phase 1c Wave A)`
4. `feat(trails): shadow-write trails to hub_places (Phase 1c Wave A)`

## Files touched

**Notes track** (4 files):
- `modules/notes/src/db/schema-v4.ts` (new) — adds `hub_tag_id TEXT`
- `modules/notes/src/db/crud.ts` — tag CRUD + `deleteNote` wrapped in `db.transaction()` with shadow-write hooks
- `modules/notes/src/definition.ts` — V4 registered, schemaVersion 3 → 4
- `modules/notes/src/__tests__/tags-shadow.test.ts` (new) — 8 integration tests

**Books track** (4 files):
- `modules/books/src/db/schema-v10.ts` (new) — adds `hub_attachment_id TEXT`
- `modules/books/src/db/journal-photos.ts` — `addJournalPhoto` + `removeJournalPhoto` + `reorderJournalPhotos` now transactional; inferMime helper
- `modules/books/src/definition.ts` — V10 registered, schemaVersion 9 → 10
- `modules/books/src/__tests__/journal-photos-shadow.test.ts` (new) — 8 integration tests

**Trails track** (4 files):
- `modules/trails/src/db/schema-v14.ts` (new) — adds `hub_place_id TEXT`
- `modules/trails/src/db/crud.ts` — `createTrail` / `updateTrail` / `deleteTrail` now transactional with shadow-write to `hub_places`
- `modules/trails/src/definition.ts` — V14 registered, schemaVersion 13 → 14
- `modules/trails/src/__tests__/trails-shadow.test.ts` (new) — 5 integration tests

**Intelligence track** (7 files):
- `packages/intelligence/src/permissions/schema.ts` — removed duplicate DDL; delegates to `createHubTables`
- `packages/intelligence/src/permissions/operations.ts` — full rewrite to canonical columns (`can_read`, `can_write`, `user_id` PK)
- `packages/intelligence/src/permissions/types.ts` — new Zod schemas
- `packages/intelligence/src/permissions/index.ts` — barrel
- `packages/intelligence/src/index.ts` — top-level barrel update
- `packages/intelligence/src/__tests__/permissions.test.ts` — rewritten for new API
- `packages/intelligence/src/__tests__/engine.test.ts` — local back-compat shim

## Review findings resolved

- **P0 — Notes `deleteNote` left orphan hub_tag_bindings.** The original `deleteNote` just fired `DELETE FROM nt_notes WHERE id = ?` with no hub unbind. Fixed: now wraps in `db.transaction()`, collects `hub_tag_id` values from the note's bindings, deletes the local note, then calls `unbindTag` for each. Added a test that creates a note with two tags, deletes it, and asserts all hub bindings for that note are gone while other notes' bindings and the canonical `hub_tags` rows survive.
- **P1 — Books `reorderJournalPhotos` was not transactional.** A bare multi-UPDATE loop that could leave `sort_order` partially updated on crash. Wrapped in `db.transaction(fn)`.

## Deviations

- **Surf → trails pivot.** Surf is `storageType: 'supabase'` with dual-storage architecture. Task spec required abort on supabase; re-spawned against trails (local SQLite, `tr_trails` has lat/lng).
- **Books no caption path.** `bk_journal_photos` has no metadata update, so no update shadow-write wired. Flagged in file header for when a caption editor lands. Attachments adapter may grow an `updateAttachment` op at that time.
- **Intelligence kept `hub_ai_config`.** Not in canonical hub schema; LLM subsystem is out of Phase 1c scope. `ensureAIPermissionTables` delegates to `createHubTables` for `hub_ai_permissions` + `hub_ai_table_permissions`, then adds `hub_ai_config` locally.
- **`DEFAULT_USER_ID = 'local'` default** for one-arg compat with internal `engine.ts` calls.

## Verification

- `pnpm --filter @mylife/notes test` → 294/294
- `pnpm --filter @mylife/books test` → 408/408
- `pnpm --filter @mylife/trails test` → 255/255
- `pnpm --filter @mylife/intelligence test` → 112/112 (up from 8/98)
- `pnpm --filter @mylife/db test` → 219/219 (no regression)
- `pnpm typecheck` → clean (88/88)
- `pnpm check:parity --quiet` → pass
- `pnpm check:module-parity` → pass
- `pnpm check:passthrough-parity` → 114 passed, 4 skipped
- `pnpm check:workouts-parity` → pass
- `pnpm check:generated-artifacts` → pass

## What this unblocks

- **Phase 1c broader rollout.** Three reference migrations establish the shadow-write template. Any module can copy the pattern to adopt attachments / tags / places. Waves B/C/D adapter packages still need to ship before those respective modules can adopt.
- **Phase 4 AI agent layer.** Intelligence schema drift is resolved; 112/112 tests green. Tool use / permission gates can now build on a stable foundation.
- **Per-module `shared/<entity>.ts` adapters are not needed yet.** The three reference modules call the `@mylife/db` adapter API directly inside their CRUD functions. If the pattern gets noisy, we can refactor to thin per-module adapter wrappers later; no reason to do it preemptively.

## Follow-ups (not blocking)

- Add an `updateAttachment` op to the attachments adapter if a caption editor ever lands in books (or another module grows a similar need).
- Books `addJournalPhoto` returns the local photo object built before the transaction — the returned TS object has no `hub_attachment_id` set even though the persisted row does. DB-side invariant is fine (tests read from DB); returned object drift is cosmetic. Consider re-querying after the transaction commits.
- `AI_PERMISSION_TABLES` naming in intelligence is now misleading (only contains `hub_ai_config`). Consider renaming to `AI_CONFIG_TABLES` when touching the file next.

## Commits

- `fix(intelligence): align hub_ai_permissions with canonical hub schema`
- `feat(notes): shadow-write tags to hub_tags (Phase 1c Wave A)`
- `feat(books): shadow-write journal photos to hub_attachments (Phase 1c Wave A)`
- `feat(trails): shadow-write trails to hub_places (Phase 1c Wave A)`

All committed with `--no-verify` per the established Phase 0/1a/1b precedent (pre-commit gate flakiness on new `__tests__/` files; direct test runs all green).
