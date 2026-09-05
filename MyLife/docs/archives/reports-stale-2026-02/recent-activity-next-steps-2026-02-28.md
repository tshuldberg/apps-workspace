# MyLife + Subapps Recent Activity Review (as of 2026-02-28)

## Scope
- Reviewed activity in MyLife root and all git submodules listed in `.gitmodules`.
- Sources used: `timeline.md`, `My*/timeline.md`, root/submodule `git log`, and root/submodule working tree status.
- Time window emphasized: 2026-02-26 to 2026-02-28, with older entries included when they are still active dependencies.

## Executive Summary
- The hub is in an aggressive parity phase. Major web modules are being converted to standalone passthrough wrappers, with strict parity matrix enforcement.
- The biggest product shift on 2026-02-27 was retiring MySubs as a hub module and consolidating subscription tracking into MyBudget.
- The largest in-progress (not committed) stream is a MySurf web transition to passthrough wrappers plus local auth/data runtime changes in the standalone MySurf repo.
- MyBudget and MyBooks have explicit, documented next-step backlogs that should be treated as current priority items.

## What Happened Recently

### MyLife Hub (root)
- **2026-02-27**
  - Consolidated MySubs into MyBudget and removed `@mylife/subs` from hub wiring.
  - Updated module registry/parity matrix so MySubs is `standalone_only` with no hub moduleId.
  - Updated free tier to MyFast only.
  - Synced docs (`AGENTS.md`, `CLAUDE.md`) to reflect 10-module hub reality.
- **2026-02-26 to 2026-02-27 parity conversions and hardening**
  - MyWords web switched to strict passthrough wrappers.
  - MyBudget web switched to strict passthrough wrappers.
  - MyBooks web switched to strict passthrough wrappers.
  - MyWorkouts passthrough stability fixes landed (exercise loading and invalid route recovery).
  - Security hardening commit landed in root (`feat(security): harden self-hosting against common attack vectors`, 2026-02-27).

### Active standalone apps with recent meaningful work
- **MyBudget (latest commit 2026-02-27, branch `feature/bank-sync-build1`)**
  - Shipped Rocket Money style web redesign and earlier bank-sync runtime/API routes.
  - Documented next steps are security-critical (webhook verification, auth guards, persistent encrypted token store, idempotency, route tests).
- **MyBooks (latest commit 2026-02-27, branch `feature/mysurf-full-parity`)**
  - Added standalone web route surfaces under `apps/web/app/books/**` for hub passthrough.
  - Timeline next steps remain open: replace temporary re-exports with route-owned implementations, add route tests, plan mobile passthrough.
- **MyRecipes (latest commit 2026-02-27, branch `main`)**
  - Added pantry inventory, nutrition tracking, smart shopping list generation, and multi-method import workflow.
- **MyWorkouts (latest commit 2026-02-27, branch `main`)**
  - Web overhaul commit indicates local auth, exercise catalog, and Supabase client refactor.
- **MyWords (latest feature commits 2026-02-25, branch `fix/restore-rich-words-ui`)**
  - Restored richer dictionary/thesaurus UI and added standalone runtime.
- **MyHomes / MyFast / MyCar / MyHabits (2026-02-26 to 2026-02-27)**
  - Mostly compatibility and passthrough-enabling updates (path alias cleanup, runtime surfaces, dependency/tooling alignment).

### Lower-activity subapps
- MyCloset, MyCycle, MyFlash, MyGarden, MyJournal, MyMeds, MyMood, MyNotes, MyPets, MyStars, MySubs, MyTrails remain at initial-commit level (2026-02-22) and currently behave as standalone-only or design-deferred inventory.

## Current In-Progress Work Observed (uncommitted)

### Root MyLife repo
- Large uncommitted web `surf` refactor:
  - Hub route files under `apps/web/app/surf/**` now reduced to thin wrappers like `export { default } from '@mysurf-web/...';`.
  - Old hub-native surf action/shell files were removed.
  - Parity matrix and host wiring (`tsconfig`, `next.config`, Tailwind content paths) were updated for `@mysurf-web`, `@mysurf/shared`, and `@mysurf/ui`.
- Additional uncommitted docs/assets exist in root (`docs/Marketing and Competition/*`, landing screenshots).

### MySurf submodule
- Significant uncommitted app changes in `MySurf/apps/web` and new local runtime files (`local-auth`, local db helpers).
- This aligns with the root surf passthrough conversion and appears to be the paired standalone-side implementation.

## Consolidated Next Steps (collective)

### Priority 1 (blocking parity stream)
1. Finish the MySurf standalone + hub passthrough pair in one pass.
   - Finalize MySurf standalone changes.
   - Finalize hub `apps/web/app/surf/**` passthrough wrappers and route shape (`[slug]` path).
   - Run and record parity/test checks (`pnpm check:passthrough-parity`, `pnpm test:parity-matrix`, `pnpm check:parity`).

### Priority 2 (security and correctness)
2. Complete MyBudget bank-sync hardening backlog in both standalone and hub copies.
   - Plaid webhook JWT verification flow.
   - Auth/authorization guards on `/api/bank/*`.
   - Persistent encrypted connector/token state and webhook idempotency.
   - Route-level failure/auth/provider tests in standalone and hub.

### Priority 3 (known documented parity debt)
3. Complete MyBooks passthrough maturity work.
   - Replace temporary route re-exports with full standalone-owned route implementations.
   - Add route-level standalone tests for library/search/import/stats/reader/detail routes.
   - Plan and execute MyBooks mobile passthrough conversion from adapter to passthrough.

### Priority 4 (repo hygiene and release readiness)
4. Clean up working trees before next merge cycle.
   - Resolve untracked `.claude/*` files across submodules (keep/commit or ignore).
   - Remove or ignore generated local runtime artifacts (for example `apps/web/.data/`).
   - Ensure no accidental docs/assets are mixed with release commits unless intentional.

### Priority 5 (operational consistency)
5. Keep timeline docs current where feature commits outpaced timeline entries.
   - Notably MySurf and MyWorkouts have major recent commits that should be reflected in their `timeline.md` files.

## Suggested Execution Order
1. Close MySurf paired conversion and parity checks first.
2. Move immediately into MyBudget bank-sync hardening and tests.
3. Finish MyBooks route ownership and mobile passthrough plan.
4. Do a cross-repo cleanup + timeline sync pass before the next release PR.

