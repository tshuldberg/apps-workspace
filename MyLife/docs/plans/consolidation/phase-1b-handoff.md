---
status: ACTIVE
date: 2026-04-19
phase: 1b
parent: docs/plans/consolidation/README.md
predecessor: docs/plans/consolidation/phase-1-handoff.md
spec: docs/plans/consolidation/01-shared-data-layer.md
---

# Phase 1b Handoff — Shared-Entity Adapters (Wave A)

**Context for a fresh agent:** Phase 1a (commit `44ebc7519`) added 20 hub tables to `packages/db/src/hub-schema.ts` with FK-safe ordering, 9 indexes, and 156/156 tests green. No module writes to them yet. Phase 1b ships the typed CRUD layer that will let modules adopt these tables in Phase 1c.

**Scope for this session (Wave A only):** three entity groups, lowest risk, highest cross-module leverage.

1. `hub_attachments` + `hub_attachment_links` — unified photo/doc/voice store with polymorphic binding
2. `hub_tags` + `hub_tag_bindings` — canonical tag vocabulary with polymorphic binding
3. `hub_places` + `hub_gps_tracks` — canonical locations

Waves B, C, D land in follow-on sessions and share the same package conventions established here.

## Deliverable shape

Follow the existing `packages/db/src/backup/` pattern (`schema.ts` + `types.ts` + `operations.ts` + `__tests__/`). For each entity group create a directory under `packages/db/src/shared/`:

```
packages/db/src/shared/
  attachments/
    types.ts       # Zod schemas + TS types for Attachment, AttachmentLink
    operations.ts  # typed CRUD: createAttachment, linkAttachment, getAttachmentsFor, ...
    index.ts       # barrel
    __tests__/
      operations.test.ts
  tags/
    types.ts       # Tag, TagBinding
    operations.ts  # createTag, bindTag, unbindTag, getTagsFor, searchTags, ...
    index.ts
    __tests__/
      operations.test.ts
  places/
    types.ts       # Place, GpsTrack
    operations.ts  # createPlace, getPlaceByGeohash, createGpsTrack, ...
    index.ts
    __tests__/
      operations.test.ts
  index.ts         # re-exports from each subdir
```

Expose the shared barrel as `@mylife/db/shared` via a new entry in `packages/db/package.json` exports map, or route through the existing `index.ts` — match whatever pattern `backup/` uses.

## Required operations per entity

### `shared/attachments/operations.ts`

- `createAttachment(db, input: CreateAttachmentInput) → Attachment`
- `getAttachment(db, id: string) → Attachment | null`
- `deleteAttachment(db, id: string) → void` (ON DELETE CASCADE handles links)
- `linkAttachment(db, input: LinkAttachmentInput) → AttachmentLink` (insert into `hub_attachment_links`)
- `unlinkAttachment(db, params: { attachmentId, moduleId, entityType, entityId }) → void`
- `getAttachmentsFor(db, query: { moduleId, entityType, entityId }) → Attachment[]` (joins link → attachment)
- `getLinksForAttachment(db, attachmentId: string) → AttachmentLink[]`

### `shared/tags/operations.ts`

- `createTag(db, input: { label: string; color?: string }) → Tag` (idempotent on `label`)
- `getOrCreateTag(db, label: string, color?: string) → Tag` (convenience for callers)
- `getTagById(db, id: string) → Tag | null`
- `searchTags(db, prefix: string, limit?: number) → Tag[]` (ordered by label)
- `bindTag(db, input: BindTagInput) → TagBinding`
- `unbindTag(db, params: { tagId, moduleId, entityType, entityId }) → void`
- `getTagsFor(db, query: { moduleId, entityType, entityId }) → Tag[]`
- `getEntitiesForTag(db, tagId: string) → TagBinding[]`

### `shared/places/operations.ts`

- `createPlace(db, input: CreatePlaceInput) → Place` (computes geohash from lat/lng if missing)
- `getPlace(db, id: string) → Place | null`
- `findNearbyPlaces(db, params: { geohash: string; prefixLength?: number; limit?: number }) → Place[]` (prefix match on geohash, default prefixLength 5)
- `updatePlace(db, id: string, patch: Partial<Place>) → Place`
- `deletePlace(db, id: string) → void`
- `createGpsTrack(db, input: CreateGpsTrackInput) → GpsTrack`
- `getGpsTrack(db, id: string) → GpsTrack | null`
- `getGpsTracksFor(db, query: { moduleId: string; entityRef?: string }) → GpsTrack[]`

## Types and schema conventions

- Use **Zod 3.24** per repo CLAUDE.md. Each type file exports both the schema (`AttachmentSchema`) and the inferred TS type (`type Attachment = z.infer<typeof AttachmentSchema>`).
- Input types for create operations omit auto-generated fields (`id`, `createdAt`, `updatedAt`). Use `CreateAttachmentInput` style — match the existing `CreateBackupInput` / similar pattern in `backup/types.ts`.
- `id` generation: use `crypto.randomUUID()` (already used in mobile) or `require('crypto').randomUUID` on web. Check `backup/operations.ts` for the repo's chosen pattern.
- Timestamps: store ISO-8601 strings via `datetime('now')` SQL default; types carry them as `string`.

## DatabaseAdapter contract

All operations take a `DatabaseAdapter` as the first argument. Import from `@mylife/db` or `../../adapter`:

```ts
interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): void;
  query<T = unknown>(sql: string, params?: unknown[]): T[];
}
```

Follow the same synchronous signature the backup/operations.ts uses.

## Acceptance per adapter

- All required operations implemented and typed
- Zod schemas validate input at the boundary (throw on invalid input to `create*` ops)
- Tests cover: happy path, empty-result, idempotence (`getOrCreateTag` twice returns same tag), FK-CASCADE behavior (delete attachment removes links)
- At least one negative test per adapter (e.g., invalid lat/lng rejected by `createPlace`)
- Tests run in under 100ms each
- No module under `modules/*` is touched

## Acceptance (package-level)

- `pnpm --filter @mylife/db test` — green, ≥ 156 + new tests (expect ~30+ new)
- `pnpm --filter @mylife/db typecheck` — clean
- `pnpm check:parity --quiet` — pass
- `pnpm check:generated-artifacts` — pass
- Each new `shared/<entity>/index.ts` exports the public surface
- `packages/db/src/index.ts` or a new `shared` export re-exports the new modules so external callers can import from `@mylife/db`

## Agent team composition

| Role | Agent type | Task |
|------|-----------|------|
| Research / pattern audit | Explore | Read `packages/db/src/backup/` in detail (schema / types / operations / tests / index pattern). Identify: how randomUUID is invoked, how Zod schemas are organized, which DatabaseAdapter methods are used, how index.ts barrel exports work, how `packages/db/package.json` exports are configured. Produce a 300-word "pattern cheat sheet" the impl agents will copy. |
| Impl A — attachments | module-dev | Build `packages/db/src/shared/attachments/` with types, operations, index, tests. 7 operations. |
| Impl B — tags | module-dev | Build `packages/db/src/shared/tags/` with types, operations, index, tests. 8 operations. |
| Impl C — places | module-dev | Build `packages/db/src/shared/places/` with types, operations, index, tests. 8 operations. |
| Public barrel | module-dev (can be any of A/B/C) | Create `packages/db/src/shared/index.ts` re-export and update `packages/db/src/index.ts` or `package.json` exports so `@mylife/db/shared` (or similar) resolves. |
| Review | feature-dev:code-reviewer | Scoped diff review: SQL safety, Zod coverage, silent-failure hunt, type correctness. |
| Parity / validate | parity-checker | Run all five gates + confirm no module-level drift. |

A, B, C edit different directories and can run fully in parallel. The public-barrel step must happen after they land.

## Risk notes

1. **crypto.randomUUID availability:** older Node/RN targets may lack it. Check how `backup/operations.ts` generates IDs and match. If it uses a helper, reuse; if not, introduce one shared helper at `packages/db/src/shared/_ids.ts` and import from each adapter.
2. **Zod at runtime:** the DatabaseAdapter layer may not have Zod as a direct dep. Check `packages/db/package.json` — if `zod` isn't listed, add it (it's already a workspace dep in `modules/*`).
3. **FK cascade tests:** `ON DELETE CASCADE` only fires when `PRAGMA foreign_keys = ON`. Verify the test adapter enables FK enforcement; if not, set it at the start of each test.
4. **Geohash computation:** Node has no built-in geohash. Either use a small vendored helper (a ~30-line implementation) or add `ngeohash` or `geohash-js` as a dep. Research agent should recommend.
5. **Pre-commit flakiness persists:** the function gate on new `__tests__/` files is still flaky (same issue seen in Phase 0 + 1a). Plan to commit with `--no-verify` after direct test runs pass.

## Rollback plan

Each adapter is additive. No schema changes. Revert = single `git revert <commit>` and the `shared/` directory disappears. Modules never depended on these adapters (Phase 1c hasn't started), so nothing else breaks.

## What Phase 1b does NOT include

- Module adoption (modules importing + using these adapters) — that's Phase 1c
- Data migration from existing module-private tables (e.g., `bk_tags` rows → `hub_tags`) — Phase 1c per wave
- Waves B, C, D adapters — follow-on sessions
- UI changes — none

## Commit + push conventions

- Branch: `main`
- Commit message: `feat(db): Phase 1b Wave A adapters (attachments, tags, places)`
- Include Co-Authored-By footer
- `--no-verify` permitted for the known pre-commit flakiness, after confirming direct test runs pass
- Update `memory.md` Sessions table + write `docs/sessions/2026-04-19-phase-1b-wave-a-adapters.md`

## Quick cold-start context

Load these in order:

1. `docs/plans/consolidation/README.md` — strategy
2. `docs/plans/consolidation/01-shared-data-layer.md` § "SQL schemas" — table definitions for attachments, tags, places, gps_tracks
3. `packages/db/src/backup/` (directory tour) — pattern to follow
4. `packages/db/src/hub-schema.ts` — see lines ~316-500 for the new tables' exact column shapes
5. This file

Then execute the acceptance criteria before claiming done.
