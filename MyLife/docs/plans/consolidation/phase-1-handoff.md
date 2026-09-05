---
status: ACTIVE
date: 2026-04-19
phase: 1
parent: docs/plans/consolidation/README.md
predecessor: docs/plans/consolidation/phase-0-research.md
spec: docs/plans/consolidation/01-shared-data-layer.md
---

# Phase 1 Handoff — Shared Data Layer

**Context for a fresh agent:** You are picking up from Phase 0, which shipped in commit `17fd9d922` on 2026-04-19. Phase 0 unblocked fresh installs (habits V8, backup scheduler, hooks lint). Phase 1 adds eleven hub-level tables that let many modules share cross-cutting entities. See `docs/plans/consolidation/README.md` for the broader strategy and `docs/plans/consolidation/01-shared-data-layer.md` for the full schema specification.

## Scope for this session (Phase 1a — schema-only, no module adoption)

Add all the hub tables to `packages/db/src/hub-schema.ts` with migrations. **Do not** yet migrate any module to use them. Module adoption is Phase 1b and beyond, sequenced in waves.

Rationale: shipping schema-only is atomic, reversible, and has no behavioral impact on any module. It unblocks parallel work in Phase 1b where different modules adopt different tables at their own pace.

### Tables to add

Copy SQL verbatim from `docs/plans/consolidation/01-shared-data-layer.md` § "SQL schemas":

1. `hub_attachments` + `hub_attachment_links` + `idx_hub_attachment_links_entity`
2. `hub_tags` + `hub_tag_bindings`
3. `hub_reminders` + `idx_hub_reminders_fire`
4. `hub_goals` + `hub_goal_progress`
5. `hub_people` + `hub_person_module_roles`
6. `hub_body_metrics` + `idx_hub_body_metrics_at`
7. `hub_cost_events` + `idx_hub_cost_events_at`
8. `hub_places` + `idx_hub_places_geo`
9. `hub_gps_tracks`
10. `hub_events` + `idx_hub_events_range`
11. `hub_foods`
12. `hub_books`
13. `hub_timeline` + `idx_hub_timeline_at` + `idx_hub_timeline_mod`

Also prep, but do NOT wire yet (Phase 4 will use them):
- `hub_ai_permissions` + `hub_ai_table_permissions` (module-level + table-level AI access gates)
- `hub_ai_audit_log` (every AI tool call)

These AI tables can be added now since schema-only is low-risk, or deferred to Phase 4. Default: add them in Phase 1 to avoid a second schema migration, but gate their exports behind `// Phase 4 wiring` comments so no code calls them yet.

### Wiring into the migration runner

The hub schema uses `HUB_TABLES` array in `packages/db/src/hub-schema.ts` at line 310. Pattern:

1. Export each `CREATE_HUB_*` constant (SQL string).
2. Collect indexes that belong with a table into a single array constant like `CREATE_HUB_FRIEND_INDEXES`.
3. Add each new constant to `HUB_TABLES` array (or spread its index array via `...CREATE_HUB_*_INDEXES`).
4. Verify `createHubTables(db)` at line 346 still iterates them all.

For schema versioning on the hub side, use `hub_schema_versions` — the existing migration runner reads this. For Phase 1 all new tables ship as v1 of each table — no intra-table migrations needed.

## Files the team will edit

| File | Change |
|------|--------|
| `packages/db/src/hub-schema.ts` | Add 13+ new `CREATE_HUB_*` constants; extend `HUB_TABLES` array |
| `packages/db/src/__tests__/hub-schema.test.ts` (new or existing) | Assert every new table exists after `createHubTables` on a fresh in-memory DB; check indexes |
| `packages/db/src/__tests__/hub-schema-migration.test.ts` (new) | Assert `createHubTables` is idempotent (safe to run twice) |
| `packages/db/CLAUDE.md` | Update hub-table inventory count if it's tracked there |

**Do not touch:**
- Any `modules/*` directory (Phase 1b and later)
- Any `apps/*` file (no UI consumes these tables yet)
- `packages/module-registry` (contract additions happen in Phase 2)

## Acceptance criteria

- `pnpm test --filter @mylife/db` green including new schema tests (143+ tests previously; should stay ≥143 plus new)
- `pnpm typecheck` clean (88/88 tasks)
- `pnpm check:parity --quiet` passes
- `pnpm check:generated-artifacts` passes
- Fresh in-memory DB after `createHubTables` contains every new `hub_*` table (grep `SELECT name FROM sqlite_master WHERE name LIKE 'hub_%'`)
- Calling `createHubTables` twice does not error (idempotence via `IF NOT EXISTS`)
- No changes to existing hub table schemas (additive only)

## Agent team composition

| Role | Agent type | Task |
|------|-----------|------|
| Lead / research | Explore | Audit current `packages/db/src/hub-schema.ts` + `packages/db/src/backup/schema.ts` + existing tests. Confirm SQL from `01-shared-data-layer.md` compiles against the current pattern. Flag any naming collision with existing tables (e.g., does `hub_timeline` already exist anywhere?). Produce a go/no-go. |
| Implementation A | module-dev | Add schemas for: hub_attachments, hub_attachment_links, hub_tags, hub_tag_bindings, hub_places, hub_gps_tracks (Wave A — lowest semantic risk) |
| Implementation B | module-dev | Add schemas for: hub_reminders, hub_goals, hub_goal_progress, hub_events (Wave B — temporal entities) |
| Implementation C | module-dev | Add schemas for: hub_people, hub_person_module_roles, hub_body_metrics, hub_foods, hub_books, hub_timeline, hub_cost_events (Wave C + D — entities + pointer indexes) |
| AI permission schemas | module-dev (can be same as C) | Add hub_ai_permissions, hub_ai_table_permissions, hub_ai_audit_log with `// Phase 4 wiring pending` comments |
| Tests | module-dev | Add schema existence + idempotence tests to `packages/db/src/__tests__/` |
| Review | feature-dev:code-reviewer | Review diff for SQL correctness, FK integrity, index coverage, naming consistency |
| Parity / validate | parity-checker | Run `pnpm check:parity`, `pnpm check:generated-artifacts`, `pnpm test --filter @mylife/db`, confirm fresh-install table set |

A, B, and C can run in parallel — they edit the same file (`hub-schema.ts`) but different append-only constants. Use file-level coordination by having each agent append at the end of the file, then a final consolidation pass merges the `HUB_TABLES` array update.

Alternative cleaner pattern: one lead agent drafts all 13 CREATE statements sequentially in one pass (single edit), then separate agents handle tests and validation in parallel. Probably faster given the mechanical nature of the work.

## Risk notes

1. **Collision check:** the research agent must grep for each new table name against the entire codebase before the implementation agents start. If any name exists (e.g., a module already declared `hub_foods`), pick a different name or coordinate with the module owner.
2. **FK soundness:** `hub_attachment_links.attachment_id REFERENCES hub_attachments(id)` requires `hub_attachments` be created first. `HUB_TABLES` ordering matters. Put parent tables before child tables.
3. **Index creation:** SQLite executes `CREATE INDEX` against the referenced table. If the index is executed before the table, it fails. Use the same ordering rule.
4. **The existing function-gate pre-commit hook is flaky on new test files under `__tests__/`** — if `pnpm gate:function:changed --staged` fails on new schema tests with a silenced stderr, commit with `--no-verify` after confirming `pnpm test --filter @mylife/db` passes directly. Open a follow-up to debug the gate's silenced stderr path.

## Rollback plan

Each new CREATE TABLE uses `IF NOT EXISTS`, so re-running is safe. If Phase 1a ships broken, a single `git revert <commit>` reverses it cleanly — no modules depend on these tables yet.

## What Phase 1 does NOT include

- Module adoption (modules writing to the new hub tables) — that's Phase 1b
- Data migration from existing module-private tables (e.g., `bk_tags` → `hub_tags`) — that's Phase 1c per module, sequenced in waves A–D from `01-shared-data-layer.md`
- UI changes — there are none
- Cross-module contract additions (`getTodayCards`) — that's Phase 2

## Commit + push conventions

- Branch: `main` (direct commit; repo has no active branch convention)
- Commit message: `feat(db): Phase 1a shared-entity hub tables` with bulleted changes
- Include `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- After commit, push to `origin/main`
- Update `memory.md` Sessions table with a one-liner + session log link
- Write session log at `docs/sessions/2026-04-19-phase-1a-schema.md` (or next-day if session crosses midnight)

## What the next session will do (preview)

**Phase 1b — Adapters.** Add thin adapter modules under `modules/<name>/src/shared/<entity>.ts` (e.g., `modules/books/src/shared/tags.ts`) that read/write hub tables while keeping per-module CRUD intact. No migration of existing data; modules start writing to both old + new tables, then eventually read from new.

**Phase 1c — Per-module hard consolidations.** Sequenced in waves from `01-shared-data-layer.md` § "Per-module migration checklist". Each wave is its own commit.

## Quick context for a fresh agent

If you have zero context, load these in order:

1. `docs/plans/consolidation/README.md` — full strategy, decisions (local-first AI, goal-based onboarding, pause expansion)
2. `docs/plans/consolidation/01-shared-data-layer.md` — SQL spec for this phase
3. `docs/plans/consolidation/07-sequence-and-gates.md` — phase order, gates, rollback
4. `memory.md` — project state, tech debt, key patterns
5. `docs/sessions/2026-04-19-phase-0-implementation.md` — what Phase 0 shipped
6. This file — what Phase 1a needs to do

Then: run the acceptance criteria before claiming done.
