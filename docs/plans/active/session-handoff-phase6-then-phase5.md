# Session Handoff: Phase 6 (MyCar) then Phase 5 (MySurf)

## Purpose

This document provides full context for a fresh session to execute Phase 6 and Phase 5 of the MyLife hub consolidation. Read this document first, then execute the phases in order.

## Completed Work (Context)

| Phase | Module | Status | Key Outcomes |
|-------|--------|--------|-------------|
| Phase 1 | MyBudget | Archived (2026-03-07) | 13 tables, budget + subscription engines, 200 tests |
| Phase 2 | MyRecipes | Archived (2026-03-08) | 8 tables, recipe scaling/nutrition engines, tests |
| Phase 3 | MyBooks | Archived (2026-03-08) | 11 tables, stats/export/import engines, tests |
| Phase 4 | MyWorkouts | Archived (2026-03-08) | 11 tables, V3 schema, 8 engines, 284 tests |

All parity checks pass: `pnpm check:parity` succeeds.

## Execution Order

### 1. Execute Phase 6: MyCar Consolidation

**Plan file:** `docs/plans/active/phase-6-mycar-consolidation.md`

This is a standard local-only SQLite consolidation (same pattern as Phases 1-4). The MyCar standalone has 7 tables, 7 repository implementations, and 4 pure-logic engines. The hub module currently has only 4 tables.

**Summary of work:**
1. Expand types + add V2 migration (3 new tables: reminders, expenses, documents) + align existing maintenance table
2. Implement all missing CRUD (reminders, expenses, documents, settings)
3. Port 4 pure engines: fuel calculator, reminder scheduler, expense summary, backup snapshot
4. Write ~100+ tests (port 11 standalone test files)
5. Archive standalone: deinit submodule, git rm, mv to archive, update parity scripts

**Standalone source:** `MyLife/MyCar/packages/shared/src/`
**Hub module:** `MyLife/modules/car/`

**Verification after Phase 6:**
```bash
pnpm typecheck
pnpm test -- --filter @mylife/car
pnpm check:parity
```

### 2. Execute Phase 5: MySurf Consolidation

**Plan file:** `docs/plans/active/phase-5-mysurf-consolidation.md`

This is the first cloud-capable module consolidation. Unlike Phase 6, MySurf has dual-layer architecture: local SQLite + Supabase cloud backend. The plan establishes the reusable template for cloud module consolidation.

**Summary of work:**
1. Expand types (6 type domains: spot, forecast, user, alerts, community, trails)
2. V2 migration (enrich spots, add forecast/buoy/tide/narrative tables) + V3 migration (user pins, alerts, community, session waves, trail hikes)
3. Port 10 pure engines (rating algorithm, energy, wind, tide, directions, geo, wave detection, alerts, trails, GPX)
4. Port pure pipeline parsers (NDBC/WW3 line parsers, prompt templates, color mapper, tile math)
5. Create cloud query adapters in `src/cloud/` (9 files mirroring local CRUD but targeting Supabase)
6. Write ~150+ tests
7. Archive standalone

**Key architectural decision:** All CRUD functions use `DatabaseAdapter` (local SQLite). Cloud query adapters are a separate `src/cloud/` directory. The UI layer (in `apps/`) decides which source to use based on `SyncTier`. This is documented as a reusable template in the plan's Appendix.

**Standalone source:** `MyLife/MySurf/packages/shared/src/` and `packages/api/src/`
**Hub module:** `MyLife/modules/surf/`

**Verification after Phase 5:**
```bash
pnpm typecheck
pnpm test -- --filter @mylife/surf
pnpm check:parity
```

## Reference Files

| File | Purpose |
|------|---------|
| `MyLife/CLAUDE.md` | Hub architecture, module system, conventions |
| `docs/plans/active/phase-6-mycar-consolidation.md` | Full Phase 6 plan with gap analysis |
| `docs/plans/active/phase-5-mysurf-consolidation.md` | Full Phase 5 plan with gap analysis + cloud template |
| `docs/plans/active/scaffold-13-modules-handoff.md` | Handoff for 13 scaffold modules (separate work stream) |
| `MyLife/scripts/check-module-parity.mjs` | Module parity verification script |
| `MyLife/scripts/check-workouts-parity.mjs` | Reference for module-specific parity script pattern |
| `MyLife/apps/web/test/parity/standalone-passthrough-matrix.test.ts` | Passthrough parity test |

## Parity Script Update Checklist (Per Archive)

After archiving each standalone, update these files:
1. `scripts/check-module-parity.mjs` -- Change module spec from `status: 'implemented'` to `status: 'archived'` with `archiveRoot: 'archive/<Name>'`
2. `apps/web/test/parity/standalone-passthrough-matrix.test.ts` -- Move module to archived list, replace passthrough enforcement block with archive verification block
3. `archive/README.md` -- Add row with module name, hub path, archive date, key stats
4. `.gitmodules` -- Remove submodule entry
5. `MyLife/CLAUDE.md` -- Update archive status table

## Standalone Archive Commands (Per Module)

```bash
cd /Users/trey/Desktop/Apps/MyLife
git submodule deinit -f <StandaloneName>
git rm --cached <StandaloneName>
# Edit .gitmodules to remove the [submodule "StandaloneName"] block
mv <StandaloneName> archive/<StandaloneName>
```

Note: `git submodule deinit` empties the working tree, so `archive/<Name>/` will be an empty placeholder directory. This is expected. Module-specific parity scripts should only verify hub-side artifacts (not standalone comparisons) after archive.

## Hub Test Pattern

All module tests follow this pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, closeDb } from '@mylife/db';
import { MODULE } from '../definition';

let db: ReturnType<typeof createModuleTestDatabase>;

beforeEach(() => {
  db = createModuleTestDatabase('moduleName', MODULE.migrations!);
});

afterEach(() => {
  closeDb(db);
});
```

## Existing Consolidation Patterns to Follow

The best reference implementations are:
- **modules/workouts/** -- Most recent, 284 tests, V3 schema, 8 engine files. Use as primary template.
- **modules/budget/** -- 13 tables, 200 tests, complex engine (budget + subscription).
- **modules/books/** -- Import/export engines, stats aggregation.

## Notes

- The `.git/modules/MyWorkouts` metadata directory was left in place (user denied `rm -rf`). It's inert and doesn't affect functionality.
- Phase 6 is simpler and should be done first to maintain momentum.
- Phase 5's cloud template appendix in the plan file is the deliverable for the "reusable handoff document for non-local database connections" requirement.
- The 13 scaffold modules have their own handoff at `docs/plans/active/scaffold-13-modules-handoff.md` and can be done in parallel by other agents/sessions.
