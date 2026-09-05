# 2026-09-02 Meerkat Comprehensive Audit

## What

Completed a report-only audit of the Meerkat Expo app, shared sync package, relay package, production dependency graph, production bundle, mobile/web parity architecture, and the effective root/app `AGENTS.md` and `CLAUDE.md` instruction chain.

Canonical output:

- `docs/reports/REPORT-meerkat-comprehensive-code-performance-instruction-audit-2026-09-02.md`
- `docs/reports/REPORT-meerkat-comprehensive-code-performance-instruction-audit-2026-09-02.html`

## Why

The user requested a full audit with optimization conclusions supported by measured math, plus a review of rules that create more friction or risk than guidance.

## Main results

- 6,092 tests passed across app, sync, and relay; 192 integration tests were skipped and documented.
- Strict typecheck passed. Lint passed with nine warnings.
- At 320 posts the production feed read path issued 1,286 queries and took 1,995.45 ms median.
- A semantically equivalent batched prototype for the benchmark fixture used three queries and took 666.20 ms, a 99.77% query reduction and 2.995x speedup.
- Android production Hermes bytecode measured 15,338,903 bytes, or 5,308,996 bytes at Brotli quality 5.
- The source map included both LiveKit ESM and UMD builds and 1,549 Lucide modules.
- Expo Doctor passed 17 of 18 checks and found duplicate Expo native installations.
- Independent production dependency scanning found 13 advisory records across eight packages after workspace `pnpm audit` exhausted default and 8 GB heaps.
- The parity gate locks 49 duplicated mobile/web core pairs totaling 39,902 lines.
- The instruction review preserved the security and transport-honesty rules while identifying unbounded scope, mandatory side effects, overbroad artifact work, and direct contradictions.

## Files changed

- Added the Markdown and self-contained HTML audit report.
- Updated `docs/README.md`, `docs/reports/README.md`, and `apps/meerkat/docs/README.md`.
- Added this session log and updated `memory.md`.
- Logged the dependency-audit OOM, Expo duplicate, and open advisory findings in root `errors_log.md`.

No product function was changed. Temporary benchmark code and generated bundles stayed outside tracked product paths and were removed or retained only in `/tmp`.

## Verification

- App TypeScript: pass.
- App ESLint: pass with nine warnings.
- App Vitest: 1,815 pass.
- Sync Vitest: 2,624 pass, 3 skip.
- Relay Vitest: 1,653 pass, 189 skip; zero leftover Meerkat service processes.
- Meerkat parity: pass.
- Transport negative-control self-test and invariant gate: pass.
- Expo production exports: pass for Android and iOS.
- HTML opened locally after creation.
- Function quality gate skipped because no function logic changed.
- Committed as `233e32a2`. The pre-commit checks passed but its temporary-stash restore reported an error after the commit. All user files were verified present; two concurrently edited Jubilee files are newer than their stash copies, so the older stash was retained rather than applied.

## Remaining work

The report ranks dependency/native cleanup, feed read-model optimization, live integration proof, physical-device profiling, runtime DDL removal, bundle reduction, shared-core extraction, and instruction simplification. None was implemented because this task authorized an audit and report, not product or instruction changes.
