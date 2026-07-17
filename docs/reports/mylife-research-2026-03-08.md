# MyLife Research And Production Readiness Audit

Date: 2026-03-08
Project: /Users/trey/Desktop/Apps/MyLife
Method: `research-app` workflow plus a generalized `audit-code` pass

## Executive Summary

MyLife has the right platform shape for a production suite: a clear monorepo split between host apps, modules, and shared packages; strong repo instructions; CI; parity tooling; and a meaningful testing surface. The architecture is ahead of where most early-stage app suites get.

It is not production-ready yet. The blocking issues are not conceptual, they are operational:

1. The core workspace gates do not pass (`typecheck`, `lint`, `test`, `check:parity`).
2. Shared packages that should be the most stable (`@mylife/auth`, `@mylife/billing-config`) are currently the ones breaking the workspace.
3. The module matrix has drifted from reality, so the safety net intended to keep hub and standalone surfaces aligned is itself stale.
4. The web app still defaults to a local SQLite file, which is acceptable for development and self-hosting but not for a horizontally scaled hosted production deployment.
5. The product surface is broader than the verified quality surface. The suite contains 27 known module IDs, while several modules remain scaffolded or design-only.

## Observed Facts

- Repo size: about 262.4 MB excluding common vendor and build directories.
- Git history: 64 commits, from 2026-02-22 through 2026-03-05 on `main`.
- Source footprint:
  - `apps/mobile/app`: 196 `.tsx` route files, 29 test-like files
  - `apps/web/app`: 47 `.ts`, 156 `.tsx`, 24 test-like files
  - `modules/`: 544 `.ts` files, 120 test-like files
  - `packages/`: 86 `.ts`, 20 `.tsx`, 21 test-like files
- Module registry currently enumerates 27 module IDs in [packages/module-registry/src/constants.ts](/Users/trey/Desktop/Apps/MyLife/packages/module-registry/src/constants.ts#L3).
- CI exists and runs parity, lint, typecheck, test, coverage, and conditional web E2E in [.github/workflows/ci.yml](/Users/trey/Desktop/Apps/MyLife/.github/workflows/ci.yml#L13).
- Web E2E specs exist in `/Users/trey/Desktop/Apps/MyLife/apps/web/e2e/`.

## Verification Results

### Passing

- `pnpm check:generated-artifacts`

### Failing

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm check:parity`

## Findings

### 1. Workspace typecheck is broken in `@mylife/auth`

Severity: HIGH

Evidence:
- [packages/auth/tsconfig.json](/Users/trey/Desktop/Apps/MyLife/packages/auth/tsconfig.json#L1) extends the base TS config, which only includes `lib: ["ES2022"]` and no JSX support.
- [packages/auth/src/provider.tsx](/Users/trey/Desktop/Apps/MyLife/packages/auth/src/provider.tsx#L43) exports JSX.
- [packages/auth/src/index.ts](/Users/trey/Desktop/Apps/MyLife/packages/auth/src/index.ts#L57) re-exports `./provider`.
- [packages/auth/src/client.ts](/Users/trey/Desktop/Apps/MyLife/packages/auth/src/client.ts#L25) references `window`.
- [packages/auth/src/__tests__/provider.test.tsx](/Users/trey/Desktop/Apps/MyLife/packages/auth/src/__tests__/provider.test.tsx#L1) is a TSX test file.

Impact:
- `pnpm typecheck` fails for the whole monorepo.
- Any production build pipeline depending on type safety is currently blocked.

Recommendation:
- Split `@mylife/auth` into environment-specific entrypoints or move it to a React-aware TS config.
- Add DOM and JSX support only where needed instead of leaking browser assumptions into the package base.

### 2. Billing configuration is out of sync with the module registry

Severity: HIGH

Evidence:
- [packages/billing-config/src/index.ts](/Users/trey/Desktop/Apps/MyLife/packages/billing-config/src/index.ts#L47) defines standalone unlock configs for only a subset of modules.
- The type contract at [packages/billing-config/src/index.ts](/Users/trey/Desktop/Apps/MyLife/packages/billing-config/src/index.ts#L59) requires `Record<Exclude<ModuleId, 'fast'>, StandaloneModuleConfig>`.
- The registry now includes many more module IDs in [packages/module-registry/src/constants.ts](/Users/trey/Desktop/Apps/MyLife/packages/module-registry/src/constants.ts#L3).

Impact:
- `pnpm lint` fails because the build prerequisite for `@mylife/billing-config` fails.
- Billing packaging is currently ambiguous for scaffolded, free, archived, and design-only modules.

Recommendation:
- Replace the naive `Exclude<ModuleId, 'fast'>` rule with an explicit billable-module list derived from module metadata or a dedicated billing schema.
- Do not require unlock SKUs for modules that are archived, free, scaffolded, or intentionally not sellable.

### 3. Monorepo tests fail because scaffold modules are treated like finished packages

Severity: HIGH

Evidence:
- [modules/stars/package.json](/Users/trey/Desktop/Apps/MyLife/modules/stars/package.json#L7) defines `"test": "vitest run"` even though the package has no test files.
- `pnpm test` stops on `@mylife/stars` with `No test files found, exiting with code 1`.

Impact:
- The top-level test command is unreliable as a release gate.
- Packages can fail the workspace for bookkeeping reasons rather than product regressions.

Recommendation:
- Classify scaffolded packages separately.
- Either add minimal smoke tests for every scaffold package or make scaffold packages opt into `--passWithNoTests` until they become launch-tier modules.

### 4. Parity enforcement is stale relative to current implementation

Severity: HIGH

Evidence:
- The parity matrix still treats pets as non-wired at [apps/web/test/parity/standalone-passthrough-matrix.test.ts](/Users/trey/Desktop/Apps/MyLife/apps/web/test/parity/standalone-passthrough-matrix.test.ts#L157).
- The scaffolded assertion at [apps/web/test/parity/standalone-passthrough-matrix.test.ts](/Users/trey/Desktop/Apps/MyLife/apps/web/test/parity/standalone-passthrough-matrix.test.ts#L686) expects no host-app wiring.
- Pets routes now exist in:
  - [apps/web/app/pets/page.tsx](/Users/trey/Desktop/Apps/MyLife/apps/web/app/pets/page.tsx)
  - [apps/mobile/app/(pets)/index.tsx](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/(pets)/index.tsx)
- Pets is now also wired into host dependencies in:
  - [apps/web/package.json](/Users/trey/Desktop/Apps/MyLife/apps/web/package.json#L36)
  - [apps/mobile/package.json](/Users/trey/Desktop/Apps/MyLife/apps/mobile/package.json#L39)
  - [apps/web/components/Providers.tsx](/Users/trey/Desktop/Apps/MyLife/apps/web/components/Providers.tsx#L25)
  - [apps/mobile/app/_layout.tsx](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/_layout.tsx#L25)

Impact:
- `pnpm check:parity` is currently red.
- The main mechanism intended to prevent hub and standalone drift cannot be trusted until the matrix is corrected.

Recommendation:
- Treat parity metadata as release-critical configuration.
- Any time a module moves from scaffolded/design-only to wired, update the matrix in the same change.

### 5. Web persistence is still tied to a local SQLite file

Severity: HIGH

Evidence:
- [apps/web/lib/db.ts](/Users/trey/Desktop/Apps/MyLife/apps/web/lib/db.ts#L43) defaults to `process.cwd()/mylife-hub.db`.
- The adapter is created through `better-sqlite3` at [apps/web/lib/db.ts](/Users/trey/Desktop/Apps/MyLife/apps/web/lib/db.ts#L52).

Impact:
- This is fine for local dev and some self-hosted single-node setups.
- It is not a hosted production-ready persistence model for a scaled web app with multiple instances, ephemeral filesystems, or stateless deploys.

Recommendation:
- Decide explicitly between:
  - self-hosted single-node SQLite as a supported mode, and
  - a hosted production backend with replicated or managed persistence.
- If web is intended to be a real hosted product, move critical hub state off local process storage.

### 6. Startup work scales with module count and still runs synchronously

Severity: MEDIUM

Evidence:
- Mobile startup opens SQLite synchronously and runs initialization plus migrations in [apps/mobile/components/DatabaseProvider.tsx](/Users/trey/Desktop/Apps/MyLife/apps/mobile/components/DatabaseProvider.tsx#L107).
- The provider iterates all known migration-bearing modules in [apps/mobile/components/DatabaseProvider.tsx](/Users/trey/Desktop/Apps/MyLife/apps/mobile/components/DatabaseProvider.tsx#L134).

Impact:
- Cold start cost increases as more modules are added.
- Production performance risk is concentrated in one critical startup path.

Recommendation:
- Keep hub-schema initialization eager, but move non-enabled module migrations to on-demand enable time or deferred background warmup.
- Track cold-start duration per module-enabled cohort before launch.

### 7. Payments and auth can fail closed in a way that looks healthy

Severity: MEDIUM

Evidence:
- Mobile silently falls back to `null` payment service in [apps/mobile/app/_layout.tsx](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/_layout.tsx#L96).
- Web does the same in [apps/web/components/Providers.tsx](/Users/trey/Desktop/Apps/MyLife/apps/web/components/Providers.tsx#L72).
- Mobile is currently mounted with `AuthProvider service={null}` in [apps/mobile/app/_layout.tsx](/Users/trey/Desktop/Apps/MyLife/apps/mobile/app/_layout.tsx#L110).

Impact:
- Billing/auth misconfiguration can degrade silently instead of surfacing as a launch blocker.
- That is dangerous during release prep because the app can appear healthy while monetization or sync is disabled.

Recommendation:
- Add environment readiness assertions for production builds.
- Surface a visible admin diagnostic page showing auth, billing, database, and sync readiness.

### 8. Secret handling is locally noisy even if git tracking is clean

Severity: MEDIUM

Evidence:
- Local env files are present in the active `MySurf` submodule:
  - `MySurf/.env`
  - `MySurf/.env.local`
  - `MySurf/apps/web/.env.local`
- Root `.gitignore` and `MySurf/.gitignore` do exclude env files.
- `git -C MySurf ls-files '.env' '.env.local' 'apps/web/.env.local'` returned no tracked files.

Impact:
- This is not currently a confirmed committed-secret incident.
- It is still easy for secrets to leak during refactors, copies, or report generation.

Recommendation:
- Standardize `.env.example` coverage across active standalone repos and hub apps.
- Add a CI secret-scan step and a workspace policy for redacted env audits.

### 9. Production diagnostics are intentionally absent

Severity: MEDIUM

Evidence:
- The product explicitly states that it does not collect crash reports in [apps/web/app/settings/page.tsx](/Users/trey/Desktop/Apps/MyLife/apps/web/app/settings/page.tsx#L109).
- Source inspection found console logging and one mobile error boundary, but no Sentry/Bugsnag/Crashlytics integration.

Impact:
- This matches the privacy-first product stance.
- It still leaves production support blind unless users can export logs or opt into diagnostics.

Recommendation:
- Add privacy-preserving observability: local error journal, redacted log export, and optional opt-in crash upload.

### 10. The launch surface is larger than the verified surface

Severity: MEDIUM

Evidence:
- 27 module IDs are registered in the suite at [packages/module-registry/src/constants.ts](/Users/trey/Desktop/Apps/MyLife/packages/module-registry/src/constants.ts#L3).
- Several modules remain scaffolded or design-only while implemented modules coexist in the same host shells.

Impact:
- Launch quality will be dominated by the weakest visible module, not the best one.

Recommendation:
- Define a launch-tier module list and hard-hide everything else from discovery, billing, onboarding, and marketing until it clears the same gates.

## Strengths

- Strong repo instructions and working conventions in `AGENTS.md` and `CLAUDE.md`.
- CI exists and already encodes parity, lint, typecheck, test, coverage, and E2E jobs.
- The module registry pattern is sound and gives the suite a real composition model.
- The repo already has a useful self-hosting foundation in [deploy/self-host/docker-compose.yml](/Users/trey/Desktop/Apps/MyLife/deploy/self-host/docker-compose.yml#L1).
- Existing audits and reports show the team is already operating with architecture and quality review loops.

## Recommendations

### Immediate

1. Restore green workspace gates.
   - Fix `@mylife/auth` tsconfig and environment typing.
   - Fix `@mylife/billing-config` billable-module typing.
   - Update parity metadata for `pets`.
   - Stop scaffold packages from failing `pnpm test` for lack of tests.

2. Freeze launch scope.
   - Choose a launch bundle of only fully verified modules.
   - Hide every other module from production discovery and purchase flows.

3. Decide the real web persistence model.
   - If hosted web matters, replace local-process SQLite for production.
   - If self-host only, document that clearly and build deployment around it.

### Short-Term

1. Add a production readiness dashboard for auth, billing, sync, DB path, and migrations.
2. Add CI secret scanning and env-template normalization across hub and active standalones.
3. Convert startup migrations to enabled-module or deferred execution.
4. Add smoke tests for every wired module route group on both mobile and web.

### Long-Term

1. Split launch-tier modules from incubation modules at the product and code-policy level.
2. Introduce privacy-preserving diagnostics and support export tooling.
3. Replace manual parity metadata with generated inventory where possible.
4. Revisit whether standalone parity should remain adapter-heavy on mobile or converge on a stronger shared-screen strategy.

## Overall Assessment

- Architecture: B+
- Documentation and process: A-
- CI and quality intent: A-
- Current build health: D
- Current release readiness: C-

The platform direction is correct. The next milestone should not be "add more modules." It should be "make the existing launch slice boringly reliable."
