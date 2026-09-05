---
status: ACTIVE
date: 2026-04-19
phase: 1c
parent: docs/plans/consolidation/README.md
predecessor: docs/plans/consolidation/phase-1b-handoff.md
spec: docs/plans/consolidation/01-shared-data-layer.md
---

# Phase 1c Wave A Handoff — Per-Module Shadow Adoption

**Context for a fresh agent:** Phase 1a (commit `44ebc7519`) added 20 hub tables. Phase 1b Wave A (commit `e69e3fcd3`) shipped typed CRUD adapters for attachments, tags, and places. No module writes to them yet. Phase 1c is per-module adoption.

**Scope for this session (proof-of-concept):** migrate ONE reference module per entity using the **shadow-write** pattern. This establishes the template other modules copy in follow-on sessions. Plus one sister task to unblock Phase 4.

## The shadow-write pattern

Per `docs/plans/consolidation/01-shared-data-layer.md` § "Migration philosophy":

> Pointer tables (soft adoption) — per-module tables stay canonical; hub table is a denormalized index. Safe to add without touching module code. Modules opt in by writing to both.

Concretely for Wave A:

1. Module keeps its existing per-module table as the canonical store (reads untouched).
2. On every write (INSERT/UPDATE/DELETE) to the per-module table, ALSO write the equivalent to the hub table via the Phase 1b adapter.
3. Wrap both writes in a single transaction so they stay in sync.
4. If the hub write fails, **throw** — do not silently swallow. We want to discover drift loudly during proof-of-concept.
5. Add integration tests that write via the module CRUD and assert both per-module AND hub tables contain the expected rows.

Reading from the hub tables is not part of Wave A. That's a later wave once writes have been validated in production.

## The three reference migrations

### Migration 1 — `notes` module → `hub_tags` + `hub_tag_bindings`

Files:

- `modules/notes/src/db/schema-v2.ts` — declares `nt_tags` + `nt_note_tags`
- `modules/notes/src/db/crud.ts` — tag CRUD (search for `nt_tags` / `nt_note_tags`)
- `modules/notes/src/__tests__/` — existing tag tests to extend

Shadow writes:

- On tag create: after inserting into `nt_tags`, call `getOrCreateTag(db, { label, color })` from `@mylife/db`. Map the returned hub tag id into `nt_tags.hub_tag_id` column (add this column via a V4 migration) so the module can later point reads at the hub.
- On note-tag binding: after inserting `nt_note_tags (note_id, tag_id)`, call `bindTag(db, { tagId: hubTagId, moduleId: 'notes', entityType: 'note', entityId: noteId })`.
- On note-tag unbind: mirror with `unbindTag(...)`.
- On tag delete: cascade to hub via `... WHERE id = hubTagId` style delete, or rely on `hub_tag_bindings.ON DELETE CASCADE` from `hub_tags` delete. Check actual cascade behavior.

Add `nt_tags.hub_tag_id TEXT` column in a new V4 schema migration. Backfill is empty (no existing rows in a fresh install; migration back-fill for prod users is handled later in this or a follow-on wave — document the backfill step but you don't need to execute it).

### Migration 2 — `books` module → `hub_attachments` + `hub_attachment_links`

Files:

- `modules/books/src/db/schema.ts` — declares `bk_journal_photos`
- `modules/books/src/db/journal-photos.ts` — CRUD
- `modules/books/src/__tests__/` — existing photo tests

Shadow writes:

- `bk_journal_photos` stores a photo attached to a reading journal entry (or similar). On create: after inserting locally, call `createAttachment(db, { uri, mime, ... })` to create the hub row, then call `linkAttachment(db, { attachmentId, moduleId: 'books', entityType: 'journal_photo', entityId: bkRowId })` to bind it. Store the hub attachment id on the `bk_journal_photos` row via a new `hub_attachment_id TEXT` column (V? migration; check current books schema version).
- On delete: delete via `deleteAttachment(db, hubAttachmentId)` — FK CASCADE on hub_attachment_links handles the link cleanup.

### Migration 3 — `homes` module → `hub_places`

Files:

- `modules/homes/src/db/schema.ts` — declares `hm_properties` with lat/lng
- `modules/homes/src/db/properties.ts` — CRUD

Shadow writes:

- On property create: after inserting `hm_properties`, call `createPlace(db, { name: property.address, kind: 'home', lat, lng, moduleOrigin: 'homes' })` and store the returned place id on `hm_properties.hub_place_id`.
- On property update: if address / lat / lng changed, call `updatePlace(db, hubPlaceId, patch)`.
- On property delete: call `deletePlace(db, hubPlaceId)`.

### Sister task — intelligence schema drift fix

`packages/intelligence` has its own `hub_ai_permissions` schema definition that diverges from the Phase 1a canonical one (`packages/db/src/hub-schema.ts`):

- intelligence says: `hub_ai_permissions(module_id, enabled, ...)` with `module_id` as PK
- Phase 1a canonical: `hub_ai_permissions(user_id, module_id, can_read, can_write, granular_mode, ...)` with composite `(user_id, module_id)` PK

90 of 98 `@mylife/intelligence` tests currently fail with `no such column: enabled`. Canonical is the hub schema (matches Phase 4 design in `05-ai-agent-layer.md`). Phase 4 is blocked until this is resolved.

Scope for this task:

1. Delete the intelligence-package-local `hub_ai_permissions` CREATE TABLE DDL. The hub schema owns it.
2. Rewrite `packages/intelligence/src/permissions/` to use the canonical columns: `can_read`, `can_write`, `granular_mode`, composite PK.
3. Update the operation API: replace a single `enabled` boolean with paired `canRead` / `canWrite` (and optional `granularMode`). `isAllowed(moduleId, 'read')` / `isAllowed(moduleId, 'write')` helpers.
4. Update all 98 tests. Target: 98/98 passing.
5. Do NOT change `packages/intelligence/src/{engine,llm,analytics}/` — only permissions.

## Files the team will create/edit

### Notes tags adoption
- `modules/notes/src/db/schema-v4.ts` (new) — adds `hub_tag_id TEXT` to `nt_tags`
- `modules/notes/src/db/crud.ts` — shadow-write hook calls in tag create/update/delete + note_tag bind/unbind
- `modules/notes/src/definition.ts` — register V4 migration, bump schemaVersion
- `modules/notes/src/__tests__/tags-shadow.test.ts` (new) — integration tests asserting both-tables-in-sync

### Books attachments adoption
- `modules/books/src/db/schema-v?.ts` (new) — adds `hub_attachment_id TEXT` to `bk_journal_photos`
- `modules/books/src/db/journal-photos.ts` — shadow-write hook calls
- `modules/books/src/definition.ts` — register new migration, bump schemaVersion
- `modules/books/src/__tests__/journal-photos-shadow.test.ts` (new)

### Homes places adoption
- `modules/homes/src/db/schema-v?.ts` (new) — adds `hub_place_id TEXT` to `hm_properties`
- `modules/homes/src/db/properties.ts` — shadow-write hook calls
- `modules/homes/src/definition.ts` — register new migration, bump schemaVersion
- `modules/homes/src/__tests__/properties-shadow.test.ts` (new)

### Intelligence fix
- `packages/intelligence/src/permissions/schema.ts` — delete (hub schema owns it)
- `packages/intelligence/src/permissions/operations.ts` — rewrite to use `can_read` / `can_write`
- `packages/intelligence/src/permissions/types.ts` — update Zod + TS types
- `packages/intelligence/src/permissions/__tests__/` — update all tests to match new API

## Acceptance (per migration)

- Shadow write throws if the hub write fails (no silent swallow)
- Both old + new tables contain the same rows after every CRUD op (asserted in tests)
- Module's existing CRUD tests still pass unchanged (reads never broke)
- Module schemaVersion bumped and new migration registered
- `pnpm test --filter @mylife/<module>` — green
- `pnpm gate:function:changed` passes for the touched module files (may hit the known pre-commit flakiness — acceptable to `--no-verify` the final commit after confirming direct test runs pass)

## Acceptance (package-level)

- `pnpm --filter @mylife/db test` — still 219/219 (no regression from Phase 1b)
- `pnpm --filter @mylife/intelligence test` — 98/98 (up from 8/98) after sister task
- `pnpm --filter @mylife/notes test`, `--filter @mylife/books test`, `--filter @mylife/homes test` — all green
- `pnpm typecheck` — clean
- `pnpm check:parity --quiet` — pass
- `pnpm check:module-parity` — pass
- Three modules now have a shadow-write path writing to Phase 1a hub tables

## Agent team composition

| Role | Agent type | Task |
|------|-----------|------|
| Research / schema inspection | Explore | For each of notes/books/homes, read the module's current schema + definition + relevant CRUD file. Report: current `schemaVersion`, the shape of the target per-module table, whether the module's migration system uses `ALTER TABLE ADD COLUMN` (notes probably does, others verify), whether the module has an existing `hub_*_id` column convention to follow. Also read `packages/intelligence/src/permissions/` and report the current API surface + tests that depend on it. Output: 4 concrete migration plans with exact file paths + schemaVersion bumps. |
| Impl A — notes/tags shadow | module-dev | Implement notes tags adoption with new V4 migration, shadow writes, and integration tests. |
| Impl B — books/attachments shadow | module-dev | Implement books journal-photos adoption. |
| Impl C — homes/places shadow | module-dev | Implement homes properties adoption. |
| Impl D — intelligence fix | module-dev | Rewrite `packages/intelligence/src/permissions/` to match canonical hub schema. Must land before or in parallel with A/B/C since it's independent scope. |
| Review | feature-dev:code-reviewer | Scoped diff review: SQL safety (transaction wrapping), Zod coverage, silent-failure hunt on shadow-write paths, test integrity. |
| Parity / validate | parity-checker | All five parity gates + confirm no regression in Phase 1a/1b test counts. |

A, B, C, D edit different directories and run fully in parallel.

## Risk notes

1. **Transaction wrapping.** Shadow writes must be atomic with per-module writes. If `DatabaseAdapter` has a `transaction(fn)` method, use it. If not, document the risk. Check `packages/db/src/adapter.ts` during research.
2. **Migration back-fill for production users.** New columns like `hub_tag_id` are NULL for existing rows. This session ships the forward-migration only. A separate backfill migration (Phase 1c polish) will populate hub rows from existing per-module data. Not blocking for this session since readers still hit per-module tables.
3. **Module test harness FK pragma.** Confirm each module's test adapter enables `PRAGMA foreign_keys = ON` so CASCADE tests work. Most use `createModuleTestDatabase` which already does this per the Phase 1b cheat sheet.
4. **Intelligence task is independent** and can land as its own commit separate from the three module migrations if coordination gets messy. Prefer one atomic commit per concern.
5. **Pre-commit gate flakiness persists.** Same known issue. Commit with `--no-verify` after direct tests green.

## Rollback plan

Per-module: each migration is a new `schema-v<N>.ts` + one new migration entry in the module's definition. Rollback = revert the commit; the added column is orphaned but harmless (NULL in existing rows, ignored by old code). The shadow-write calls disappear with the revert. No data loss.

Intelligence: rewrite is a refactor; tests guard the new API shape. Rollback = revert commit; intelligence tests return to the broken state they were in. Phase 4 stays blocked until redone.

## What Phase 1c Wave A proof-of-concept does NOT include

- All 30 modules adopting all 3 Wave A entities — that's the broad Phase 1c rollout
- Reads being switched to hub tables — that's Wave A polish or a later wave
- Dropping per-module tables — far future, only after readers migrate
- Waves B, C, D adoption — follow-on sessions
- UI changes — none

## Commit + push conventions

- Branch: `main`
- Suggested commit boundary: **four commits** since tasks are independent:
  1. `fix(intelligence): align hub_ai_permissions with canonical hub schema`
  2. `feat(notes): shadow-write tags to hub_tags`
  3. `feat(books): shadow-write journal photos to hub_attachments`
  4. `feat(homes): shadow-write properties to hub_places`
- Include Co-Authored-By footer
- `--no-verify` permitted
- Update `memory.md` Sessions table + write `docs/sessions/2026-04-19-phase-1c-wave-a-shadow.md`

Alternative: single atomic commit if the team prefers. Call it clearly in the session log either way.

## Quick cold-start context

Load these in order:

1. `docs/plans/consolidation/README.md` — strategy, decisions
2. `docs/plans/consolidation/01-shared-data-layer.md` § "Migration philosophy" — pointer vs hard consolidation; this session uses pointer/shadow-write pattern
3. `docs/plans/consolidation/phase-1-handoff.md` + `phase-1b-handoff.md` — what landed before
4. `docs/plans/consolidation/phase-1b-pattern-cheatsheet.md` — adapter API + typing conventions
5. `packages/db/src/shared/{attachments,tags,places}/index.ts` — the adapter signatures the modules will call
6. This file

Then execute the acceptance criteria before claiming done.
